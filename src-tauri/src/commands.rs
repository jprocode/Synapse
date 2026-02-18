use chrono::Utc;
use tauri::State;

use crate::database::{Database, NoteVersion};
use crate::file_manager::{self, Note};

/// Creates a new note with the given title
#[tauri::command]
pub fn create_note(title: String, db: State<'_, Database>) -> Result<Note, String> {
    let note = file_manager::create_note(&title).map_err(|e| e.to_string())?;
    db.add_note_metadata(&note).map_err(|e| e.to_string())?;
    Ok(note)
}

/// Returns all notes (metadata only)
#[tauri::command]
pub fn get_all_notes(db: State<'_, Database>) -> Result<Vec<Note>, String> {
    db.get_notes_metadata().map_err(|e| e.to_string())
}

/// Returns the body content of a specific note
#[tauri::command]
pub fn get_note_content(id: String) -> Result<String, String> {
    file_manager::get_note_content(&id).map_err(|e| e.to_string())
}

/// Saves updated content for an existing note, and auto-saves a version snapshot
#[tauri::command]
pub fn save_note(id: String, content: String, db: State<'_, Database>) -> Result<(), String> {
    file_manager::save_note(&id, &content).map_err(|e| e.to_string())?;

    // Auto-save a version snapshot
    let _ = db.save_version(&id, &content);

    // Update modified_at in database
    let now = Utc::now().timestamp();
    let notes = db.get_notes_metadata().map_err(|e| e.to_string())?;
    if let Some(mut note) = notes.into_iter().find(|n| n.id == id) {
        note.modified_at = now;
        db.update_note_metadata(&note).map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Deletes a note by its ID (file + database entry + versions)
#[tauri::command]
pub fn delete_note(id: String, db: State<'_, Database>) -> Result<(), String> {
    file_manager::delete_note(&id).map_err(|e| e.to_string())?;
    let _ = db.delete_versions_for_note(&id);
    db.delete_note_metadata(&id).map_err(|e| e.to_string())?;
    Ok(())
}

/// Renames a note (updates frontmatter + database)
#[tauri::command]
pub fn rename_note(id: String, new_title: String, db: State<'_, Database>) -> Result<(), String> {
    file_manager::rename_note(&id, &new_title).map_err(|e| e.to_string())?;

    let now = Utc::now().timestamp();
    let notes = db.get_notes_metadata().map_err(|e| e.to_string())?;
    if let Some(mut note) = notes.into_iter().find(|n| n.id == id) {
        note.title = new_title;
        note.modified_at = now;
        db.update_note_metadata(&note).map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Retrieves all versions for a note
#[tauri::command]
pub fn get_versions(note_id: String, db: State<'_, Database>) -> Result<Vec<NoteVersion>, String> {
    db.get_versions(&note_id).map_err(|e| e.to_string())
}

/// Restores a note to a specific version
#[tauri::command]
pub fn restore_version(note_id: String, version_id: String, db: State<'_, Database>) -> Result<(), String> {
    let versions = db.get_versions(&note_id).map_err(|e| e.to_string())?;
    let version = versions.iter().find(|v| v.id == version_id)
        .ok_or_else(|| "Version not found".to_string())?;

    file_manager::save_note(&note_id, &version.content).map_err(|e| e.to_string())?;

    let now = Utc::now().timestamp();
    let notes = db.get_notes_metadata().map_err(|e| e.to_string())?;
    if let Some(mut note) = notes.into_iter().find(|n| n.id == note_id) {
        note.modified_at = now;
        db.update_note_metadata(&note).map_err(|e| e.to_string())?;
    }

    Ok(())
}
