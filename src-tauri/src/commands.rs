use std::path::PathBuf;
use tauri::State;

use crate::database::{CachedNote, Database};
use crate::indexer;
use crate::vault::{Vault, VaultEntry};

/// Shared app state
pub struct AppState {
    pub vault_path: std::sync::Mutex<Option<PathBuf>>,
    pub db: std::sync::Mutex<Option<Database>>,
}

// ─── Vault commands ────────────────────────────────────────────────

/// Check if a vault is already configured
#[tauri::command]
pub fn get_vault_path() -> Result<Option<String>, String> {
    match Vault::get_vault_path() {
        Ok(Some(p)) => Ok(Some(p.to_string_lossy().to_string())),
        Ok(None) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Create a new vault at the given path
#[tauri::command]
pub fn create_vault(path: String, state: State<'_, AppState>) -> Result<(), String> {
    let vault_path = PathBuf::from(&path);
    Vault::create_vault(&vault_path).map_err(|e| e.to_string())?;

    // Initialize database for this vault
    let db = Database::init_for_vault(&vault_path).map_err(|e| e.to_string())?;
    db.reindex_vault(&vault_path).map_err(|e| e.to_string())?;

    *state.vault_path.lock().unwrap() = Some(vault_path);
    *state.db.lock().unwrap() = Some(db);

    Ok(())
}

/// Open an existing vault
#[tauri::command]
pub fn open_vault(path: String, state: State<'_, AppState>) -> Result<(), String> {
    let vault_path = PathBuf::from(&path);
    Vault::open_vault(&vault_path).map_err(|e| e.to_string())?;

    // Initialize database for this vault
    let db = Database::init_for_vault(&vault_path).map_err(|e| e.to_string())?;
    db.reindex_vault(&vault_path).map_err(|e| e.to_string())?;

    *state.vault_path.lock().unwrap() = Some(vault_path);
    *state.db.lock().unwrap() = Some(db);

    Ok(())
}

// ─── File explorer commands ────────────────────────────────────────

/// List all entries in the vault (files and folders)
#[tauri::command]
pub fn list_vault_entries(state: State<'_, AppState>) -> Result<Vec<VaultEntry>, String> {
    let vault_path = get_vault(&state)?;
    Vault::list_entries(&vault_path).map_err(|e| e.to_string())
}

/// Create a new note in the vault
#[tauri::command]
pub fn create_note(
    title: String,
    folder: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let vault_path = get_vault(&state)?;
    let relative_path =
        Vault::create_note(&vault_path, &folder, &title).map_err(|e| e.to_string())?;

    // Index the new note
    if let Some(db) = state.db.lock().unwrap().as_ref() {
        let _ = db.reindex_note(&vault_path, &relative_path);
    }

    Ok(relative_path)
}

/// Create a new folder
#[tauri::command]
pub fn create_folder(path: String, state: State<'_, AppState>) -> Result<(), String> {
    let vault_path = get_vault(&state)?;
    Vault::create_folder(&vault_path, &path).map_err(|e| e.to_string())
}

/// Read a file's content
#[tauri::command]
pub fn read_note(path: String, state: State<'_, AppState>) -> Result<String, String> {
    let vault_path = get_vault(&state)?;
    Vault::read_file(&vault_path, &path).map_err(|e| e.to_string())
}

/// Save a file's content and reindex
#[tauri::command]
pub fn save_note(path: String, content: String, state: State<'_, AppState>) -> Result<(), String> {
    let vault_path = get_vault(&state)?;
    Vault::write_file(&vault_path, &path, &content).map_err(|e| e.to_string())?;

    // Reindex this note
    if let Some(db) = state.db.lock().unwrap().as_ref() {
        let _ = db.reindex_note(&vault_path, &path);
    }

    Ok(())
}

/// Delete a file or folder
#[tauri::command]
pub fn delete_entry(path: String, state: State<'_, AppState>) -> Result<(), String> {
    let vault_path = get_vault(&state)?;
    Vault::delete_entry(&vault_path, &path).map_err(|e| e.to_string())?;

    // Remove from index
    if let Some(db) = state.db.lock().unwrap().as_ref() {
        let _ = db.delete_note(&path);
    }

    Ok(())
}

/// Rename/move a file or folder and update all links
#[tauri::command]
pub fn rename_entry(
    old_path: String,
    new_path: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let vault_path = get_vault(&state)?;
    Vault::rename_entry(&vault_path, &old_path, &new_path).map_err(|e| e.to_string())?;

    // Update index: remove old, index new
    if let Some(db) = state.db.lock().unwrap().as_ref() {
        let _ = db.delete_note(&old_path);
        if new_path.ends_with(".md") {
            let _ = db.reindex_note(&vault_path, &new_path);
        }
    }

    Ok(())
}

/// Duplicate a file
#[tauri::command]
pub fn duplicate_entry(path: String, state: State<'_, AppState>) -> Result<String, String> {
    let vault_path = get_vault(&state)?;
    let new_path = Vault::duplicate_entry(&vault_path, &path).map_err(|e| e.to_string())?;

    // Index the new file
    if let Some(db) = state.db.lock().unwrap().as_ref() {
        if new_path.ends_with(".md") {
            let _ = db.reindex_note(&vault_path, &new_path);
        }
    }

    Ok(new_path)
}

// ─── Note metadata commands ───────────────────────────────────────

/// Get all cached notes (for quick switcher, search, etc.)
#[tauri::command]
pub fn get_all_notes(state: State<'_, AppState>) -> Result<Vec<CachedNote>, String> {
    let db_lock = state.db.lock().unwrap();
    let db = db_lock.as_ref().ok_or("No vault open")?;
    db.get_all_notes().map_err(|e| e.to_string())
}

/// Toggle star on a note
#[tauri::command]
pub fn toggle_star(path: String, state: State<'_, AppState>) -> Result<bool, String> {
    let db_lock = state.db.lock().unwrap();
    let db = db_lock.as_ref().ok_or("No vault open")?;
    db.toggle_star(&path).map_err(|e| e.to_string())
}

// ─── Links & backlinks commands ────────────────────────────────────

/// Get backlinks for a note (notes that link TO this note)
#[tauri::command]
pub fn get_backlinks(
    note_title: String,
    state: State<'_, AppState>,
) -> Result<Vec<BacklinkResult>, String> {
    let vault_path = get_vault(&state)?;
    let db_lock = state.db.lock().unwrap();
    let db = db_lock.as_ref().ok_or("No vault open")?;

    let source_paths = db.get_backlinks(&note_title).map_err(|e| e.to_string())?;
    let mut results = Vec::new();

    for source_path in source_paths {
        // Read source note to get context around the link
        if let Ok(content) = Vault::read_file(&vault_path, &source_path) {
            let fm = Vault::parse_frontmatter(&content);
            let title = fm.title.unwrap_or_else(|| {
                std::path::Path::new(&source_path)
                    .file_stem()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string()
            });

            // Find the context around the link
            let context = find_link_context(&content, &note_title);

            results.push(BacklinkResult {
                source_path: source_path.clone(),
                source_title: title,
                context,
            });
        }
    }

    Ok(results)
}

/// Get outgoing links from a note
#[tauri::command]
pub fn get_outgoing_links(
    path: String,
    state: State<'_, AppState>,
) -> Result<Vec<String>, String> {
    let db_lock = state.db.lock().unwrap();
    let db = db_lock.as_ref().ok_or("No vault open")?;
    db.get_outgoing_links(&path).map_err(|e| e.to_string())
}

/// Get all links in the vault (for graph view)
#[tauri::command]
pub fn get_all_links(state: State<'_, AppState>) -> Result<Vec<(String, String)>, String> {
    let db_lock = state.db.lock().unwrap();
    let db = db_lock.as_ref().ok_or("No vault open")?;
    db.get_all_links().map_err(|e| e.to_string())
}

/// Search notes by title for wikilink autocomplete
#[tauri::command]
pub fn search_notes(query: String, state: State<'_, AppState>) -> Result<Vec<CachedNote>, String> {
    let db_lock = state.db.lock().unwrap();
    let db = db_lock.as_ref().ok_or("No vault open")?;
    let all_notes = db.get_all_notes().map_err(|e| e.to_string())?;

    let query_lower = query.to_lowercase();
    let mut results: Vec<(usize, CachedNote)> = all_notes
        .into_iter()
        .filter_map(|note| {
            let title_lower = note.title.to_lowercase();
            if title_lower.contains(&query_lower) {
                // Score: exact match best, prefix match next, contains last
                let score = if title_lower == query_lower {
                    0
                } else if title_lower.starts_with(&query_lower) {
                    1
                } else {
                    2
                };
                Some((score, note))
            } else {
                // Fuzzy match: check if all query chars appear in order
                let mut query_chars = query_lower.chars();
                let mut current = query_chars.next();
                for c in title_lower.chars() {
                    if let Some(qc) = current {
                        if c == qc {
                            current = query_chars.next();
                        }
                    }
                }
                if current.is_none() {
                    Some((3, note)) // fuzzy match has lowest priority
                } else {
                    None
                }
            }
        })
        .collect();

    results.sort_by_key(|(score, _)| *score);
    let notes: Vec<CachedNote> = results.into_iter().take(20).map(|(_, n)| n).collect();

    Ok(notes)
}

// ─── Tags commands ─────────────────────────────────────────────────

/// Get all tags in the vault with their counts
#[tauri::command]
pub fn get_all_tags(state: State<'_, AppState>) -> Result<Vec<(String, usize)>, String> {
    let db_lock = state.db.lock().unwrap();
    let db = db_lock.as_ref().ok_or("No vault open")?;
    db.get_all_tags().map_err(|e| e.to_string())
}

/// Get all notes with a specific tag
#[tauri::command]
pub fn get_notes_by_tag(tag: String, state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let db_lock = state.db.lock().unwrap();
    let db = db_lock.as_ref().ok_or("No vault open")?;
    db.get_notes_by_tag(&tag).map_err(|e| e.to_string())
}

// ─── Headings / outline commands ──────────────────────────────────

/// Get headings for a note (for outline view)
#[tauri::command]
pub fn get_headings(
    path: String,
    state: State<'_, AppState>,
) -> Result<Vec<indexer::Heading>, String> {
    let db_lock = state.db.lock().unwrap();
    let db = db_lock.as_ref().ok_or("No vault open")?;
    db.get_headings(&path).map_err(|e| e.to_string())
}

// ─── Settings commands ────────────────────────────────────────────

#[tauri::command]
pub fn get_setting(key: String, state: State<'_, AppState>) -> Result<Option<String>, String> {
    let db_lock = state.db.lock().unwrap();
    let db = db_lock.as_ref().ok_or("No vault open")?;
    db.get_setting(&key).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_setting(key: String, value: String, state: State<'_, AppState>) -> Result<(), String> {
    let db_lock = state.db.lock().unwrap();
    let db = db_lock.as_ref().ok_or("No vault open")?;
    db.set_setting(&key, &value).map_err(|e| e.to_string())
}

// ─── Reindex command ──────────────────────────────────────────────

/// Force reindex the entire vault
#[tauri::command]
pub fn reindex_vault(state: State<'_, AppState>) -> Result<(), String> {
    let vault_path = get_vault(&state)?;
    let db_lock = state.db.lock().unwrap();
    let db = db_lock.as_ref().ok_or("No vault open")?;
    db.reindex_vault(&vault_path).map_err(|e| e.to_string())
}

// ─── Helper types & functions ─────────────────────────────────────

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BacklinkResult {
    pub source_path: String,
    pub source_title: String,
    pub context: String,
}

/// Get the vault path from state, or return error
fn get_vault(state: &State<'_, AppState>) -> Result<PathBuf, String> {
    state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or_else(|| "No vault open".to_string())
}

/// Find context around a wikilink in note content
fn find_link_context(content: &str, target: &str) -> String {
    let search_patterns = vec![
        format!("[[{}]]", target),
        format!("[[{}|", target),
        format!("[[{}#", target),
    ];

    for line in content.lines() {
        for pattern in &search_patterns {
            if line.contains(pattern) {
                // Return the whole line as context (trimmed)
                let trimmed = line.trim();
                if trimmed.len() > 200 {
                    return format!("{}...", &trimmed[..200]);
                }
                return trimmed.to_string();
            }
        }
    }

    String::new()
}
