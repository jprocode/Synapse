use anyhow::{Context, Result};
use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;

use crate::file_manager::{self, Note};

/// Wrapper around SQLite connection for thread-safe access
pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    /// Opens (or creates) the SQLite database and runs migrations
    pub fn init() -> Result<Self> {
        let db_path = Self::db_path()?;

        // Ensure parent directory exists
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).context("Failed to create database directory")?;
        }

        let conn = Connection::open(&db_path)
            .with_context(|| format!("Failed to open database at {:?}", db_path))?;

        // Enable WAL mode for better concurrent read performance
        conn.execute_batch("PRAGMA journal_mode=WAL;")
            .context("Failed to set WAL mode")?;

        // Run migrations
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS notes (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                file_path TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                modified_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS note_versions (
                id TEXT PRIMARY KEY,
                note_id TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_versions_note_id ON note_versions(note_id, created_at DESC);",
        )
        .context("Failed to create tables")?;

        Ok(Database {
            conn: Mutex::new(conn),
        })
    }

    /// Returns the path to the SQLite database file
    fn db_path() -> Result<PathBuf> {
        let synapse_dir = file_manager::synapse_dir()?;
        Ok(synapse_dir.join("synapse.db"))
    }

    /// Inserts a new note's metadata into the database
    pub fn add_note_metadata(&self, note: &Note) -> Result<()> {
        let conn = self.conn.lock().expect("Database mutex poisoned");
        conn.execute(
            "INSERT INTO notes (id, title, file_path, created_at, modified_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            (&note.id, &note.title, &note.file_path, &note.created_at, &note.modified_at),
        )
        .context("Failed to insert note metadata")?;
        Ok(())
    }

    /// Retrieves all notes' metadata from the database, sorted by modified_at descending
    pub fn get_notes_metadata(&self) -> Result<Vec<Note>> {
        let conn = self.conn.lock().expect("Database mutex poisoned");
        let mut stmt = conn
            .prepare("SELECT id, title, file_path, created_at, modified_at FROM notes ORDER BY modified_at DESC")
            .context("Failed to prepare query")?;

        let notes = stmt
            .query_map([], |row| {
                Ok(Note {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    file_path: row.get(2)?,
                    created_at: row.get(3)?,
                    modified_at: row.get(4)?,
                })
            })
            .context("Failed to query notes")?
            .collect::<std::result::Result<Vec<_>, _>>()
            .context("Failed to collect note rows")?;

        Ok(notes)
    }

    /// Updates the metadata for an existing note
    pub fn update_note_metadata(&self, note: &Note) -> Result<()> {
        let conn = self.conn.lock().expect("Database mutex poisoned");
        conn.execute(
            "UPDATE notes SET title = ?1, modified_at = ?2 WHERE id = ?3",
            (&note.title, &note.modified_at, &note.id),
        )
        .context("Failed to update note metadata")?;
        Ok(())
    }

    /// Deletes a note's metadata from the database
    pub fn delete_note_metadata(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().expect("Database mutex poisoned");
        conn.execute("DELETE FROM notes WHERE id = ?1", [id])
            .context("Failed to delete note metadata")?;
        Ok(())
    }

    /// Saves a content snapshot as a new version for a note
    pub fn save_version(&self, note_id: &str, content: &str) -> Result<String> {
        let conn = self.conn.lock().expect("Database mutex poisoned");
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().timestamp();
        conn.execute(
            "INSERT INTO note_versions (id, note_id, content, created_at) VALUES (?1, ?2, ?3, ?4)",
            (&id, note_id, content, now),
        )
        .context("Failed to save version")?;

        // Keep only the most recent 50 versions per note
        conn.execute(
            "DELETE FROM note_versions WHERE note_id = ?1 AND id NOT IN (
                SELECT id FROM note_versions WHERE note_id = ?1 ORDER BY created_at DESC LIMIT 50
            )",
            [note_id],
        )
        .context("Failed to prune old versions")?;

        Ok(id)
    }

    /// Retrieves all versions for a note, sorted newest first
    pub fn get_versions(&self, note_id: &str) -> Result<Vec<NoteVersion>> {
        let conn = self.conn.lock().expect("Database mutex poisoned");
        let mut stmt = conn
            .prepare("SELECT id, note_id, content, created_at FROM note_versions WHERE note_id = ?1 ORDER BY created_at DESC")
            .context("Failed to prepare versions query")?;

        let versions = stmt
            .query_map([note_id], |row| {
                Ok(NoteVersion {
                    id: row.get(0)?,
                    note_id: row.get(1)?,
                    content: row.get(2)?,
                    created_at: row.get(3)?,
                })
            })
            .context("Failed to query versions")?
            .collect::<std::result::Result<Vec<_>, _>>()
            .context("Failed to collect version rows")?;

        Ok(versions)
    }

    /// Deletes all versions for a note
    pub fn delete_versions_for_note(&self, note_id: &str) -> Result<()> {
        let conn = self.conn.lock().expect("Database mutex poisoned");
        conn.execute("DELETE FROM note_versions WHERE note_id = ?1", [note_id])
            .context("Failed to delete versions")?;
        Ok(())
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct NoteVersion {
    pub id: String,
    pub note_id: String,
    pub content: String,
    pub created_at: i64,
}
