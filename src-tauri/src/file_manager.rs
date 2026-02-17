use anyhow::{Context, Result};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use uuid::Uuid;

/// Represents a note with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub id: String,
    pub title: String,
    pub file_path: String,
    pub created_at: i64,
    pub modified_at: i64,
}

/// Returns the path to the Synapse notes directory (~/.synapse/notes/)
pub fn notes_dir() -> Result<PathBuf> {
    let home = dirs::home_dir().context("Could not determine home directory")?;
    let notes_path = home.join(".synapse").join("notes");
    Ok(notes_path)
}

/// Returns the path to the Synapse data directory (~/.synapse/)
pub fn synapse_dir() -> Result<PathBuf> {
    let home = dirs::home_dir().context("Could not determine home directory")?;
    Ok(home.join(".synapse"))
}

/// Ensures the notes directory exists, creating it if necessary
pub fn ensure_notes_dir() -> Result<PathBuf> {
    let dir = notes_dir()?;
    fs::create_dir_all(&dir).context("Failed to create notes directory")?;
    Ok(dir)
}

/// Creates a new note with the given title, writing a Markdown file with YAML frontmatter
pub fn create_note(title: &str) -> Result<Note> {
    let dir = ensure_notes_dir()?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().timestamp();

    let file_path = dir.join(format!("{}.md", id));
    let file_path_str = file_path.to_string_lossy().to_string();

    let frontmatter = format!(
        "---\nid: {}\ntitle: {}\ncreated: {}\nmodified: {}\n---\n",
        id, title, now, now
    );

    fs::write(&file_path, &frontmatter).context("Failed to write note file")?;

    Ok(Note {
        id,
        title: title.to_string(),
        file_path: file_path_str,
        created_at: now,
        modified_at: now,
    })
}

/// Reads all notes from the notes directory by parsing their YAML frontmatter
pub fn get_all_notes() -> Result<Vec<Note>> {
    let dir = ensure_notes_dir()?;
    let mut notes = Vec::new();

    let entries = fs::read_dir(&dir).context("Failed to read notes directory")?;

    for entry in entries {
        let entry = entry.context("Failed to read directory entry")?;
        let path = entry.path();

        if path.extension().map_or(false, |ext| ext == "md") {
            match parse_note_from_file(&path) {
                Ok(note) => notes.push(note),
                Err(e) => {
                    log::warn!("Skipping file {:?}: {}", path, e);
                }
            }
        }
    }

    // Sort by modified_at descending (most recent first)
    notes.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));

    Ok(notes)
}

/// Returns the content of a note (body only, without frontmatter)
pub fn get_note_content(id: &str) -> Result<String> {
    let dir = notes_dir()?;
    let file_path = dir.join(format!("{}.md", id));

    let raw = fs::read_to_string(&file_path)
        .with_context(|| format!("Failed to read note file: {}", id))?;

    Ok(strip_frontmatter(&raw))
}

/// Saves the content of an existing note, updating the modified timestamp
pub fn save_note(id: &str, content: &str) -> Result<()> {
    let dir = notes_dir()?;
    let file_path = dir.join(format!("{}.md", id));

    let raw = fs::read_to_string(&file_path)
        .with_context(|| format!("Failed to read note file for saving: {}", id))?;

    let (mut frontmatter_map, _) = parse_frontmatter_raw(&raw)?;
    let now = Utc::now().timestamp();
    frontmatter_map.insert("modified".to_string(), now.to_string());

    let new_content = rebuild_file(&frontmatter_map, content);
    fs::write(&file_path, new_content).context("Failed to save note file")?;

    Ok(())
}

/// Deletes a note by its ID
pub fn delete_note(id: &str) -> Result<()> {
    let dir = notes_dir()?;
    let file_path = dir.join(format!("{}.md", id));

    fs::remove_file(&file_path)
        .with_context(|| format!("Failed to delete note file: {}", id))?;

    Ok(())
}

/// Renames a note by updating its title in the frontmatter
pub fn rename_note(id: &str, new_title: &str) -> Result<()> {
    let dir = notes_dir()?;
    let file_path = dir.join(format!("{}.md", id));

    let raw = fs::read_to_string(&file_path)
        .with_context(|| format!("Failed to read note file for renaming: {}", id))?;

    let (mut frontmatter_map, body) = parse_frontmatter_raw(&raw)?;
    let now = Utc::now().timestamp();
    frontmatter_map.insert("title".to_string(), new_title.to_string());
    frontmatter_map.insert("modified".to_string(), now.to_string());

    let new_content = rebuild_file(&frontmatter_map, &body);
    fs::write(&file_path, new_content).context("Failed to save renamed note")?;

    Ok(())
}

// ─── Internal helpers ───────────────────────────────────────────────────────

/// Parses a Note struct from a markdown file by reading its YAML frontmatter
fn parse_note_from_file(path: &PathBuf) -> Result<Note> {
    let raw = fs::read_to_string(path)
        .with_context(|| format!("Failed to read file: {:?}", path))?;

    let (fm, _) = parse_frontmatter_raw(&raw)?;

    let id = fm
        .get("id")
        .context("Note missing 'id' in frontmatter")?
        .clone();
    let title = fm
        .get("title")
        .context("Note missing 'title' in frontmatter")?
        .clone();
    let created_at: i64 = fm
        .get("created")
        .context("Note missing 'created' in frontmatter")?
        .parse()
        .context("Invalid 'created' timestamp")?;
    let modified_at: i64 = fm
        .get("modified")
        .context("Note missing 'modified' in frontmatter")?
        .parse()
        .context("Invalid 'modified' timestamp")?;

    Ok(Note {
        id,
        title,
        file_path: path.to_string_lossy().to_string(),
        created_at,
        modified_at,
    })
}

/// Parses YAML frontmatter from raw file content into a key-value map + body
fn parse_frontmatter_raw(raw: &str) -> Result<(std::collections::HashMap<String, String>, String)> {
    let mut map = std::collections::HashMap::new();

    if !raw.starts_with("---") {
        // No frontmatter, return empty map and full content as body
        return Ok((map, raw.to_string()));
    }

    // Find the closing ---
    let rest = &raw[3..]; // skip opening ---
    let end_idx = rest
        .find("\n---")
        .context("Malformed frontmatter: missing closing ---")?;

    let frontmatter_str = &rest[..end_idx];
    let body_start = 3 + end_idx + 4; // opening --- (3) + content + \n--- (4)
    let body = if body_start < raw.len() {
        // Skip the newline after closing ---
        raw[body_start..].trim_start_matches('\n').to_string()
    } else {
        String::new()
    };

    for line in frontmatter_str.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        if let Some(colon_pos) = line.find(':') {
            let key = line[..colon_pos].trim().to_string();
            let value = line[colon_pos + 1..].trim().to_string();
            map.insert(key, value);
        }
    }

    Ok((map, body))
}

/// Strips YAML frontmatter from raw content, returning only the body
fn strip_frontmatter(raw: &str) -> String {
    if !raw.starts_with("---") {
        return raw.to_string();
    }
    let rest = &raw[3..];
    match rest.find("\n---") {
        Some(end_idx) => {
            let body_start = 3 + end_idx + 4;
            if body_start < raw.len() {
                raw[body_start..].trim_start_matches('\n').to_string()
            } else {
                String::new()
            }
        }
        None => raw.to_string(),
    }
}

/// Rebuilds a markdown file from frontmatter map and body content
fn rebuild_file(fm: &std::collections::HashMap<String, String>, body: &str) -> String {
    // Preserve consistent key ordering
    let keys = ["id", "title", "created", "modified"];
    let mut frontmatter = String::from("---\n");
    for key in &keys {
        if let Some(value) = fm.get(*key) {
            frontmatter.push_str(&format!("{}: {}\n", key, value));
        }
    }
    frontmatter.push_str("---\n");

    if body.is_empty() {
        frontmatter
    } else {
        format!("{}{}", frontmatter, body)
    }
}
