use anyhow::{Context, Result};
use rusqlite::Connection;
use std::path::Path;
use std::sync::Mutex;

/// Wrapper around SQLite connection for thread-safe access.
/// Now uses vault-local cache database instead of global ~/.synapse/synapse.db
pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    /// Opens (or creates) the SQLite database at the given vault's .synapse/cache.db
    pub fn init_for_vault(vault_path: &Path) -> Result<Self> {
        let db_path = crate::vault::Vault::db_path(vault_path);

        // Ensure .synapse cache directory exists
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).context("Failed to create cache directory")?;
        }

        let conn = Connection::open(&db_path)
            .with_context(|| format!("Failed to open database at {:?}", db_path))?;

        // Enable WAL mode for better concurrent read performance
        conn.execute_batch("PRAGMA journal_mode=WAL;")
            .context("Failed to set WAL mode")?;

        // Run migrations
        conn.execute_batch(
            "
            -- Notes metadata cache (mirrors filesystem)
            CREATE TABLE IF NOT EXISTS notes (
                path TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                created_at TEXT,
                modified_at TEXT,
                word_count INTEGER DEFAULT 0,
                starred INTEGER DEFAULT 0
            );

            -- Outgoing links from notes
            CREATE TABLE IF NOT EXISTS links (
                source_path TEXT NOT NULL,
                target_name TEXT NOT NULL,
                PRIMARY KEY (source_path, target_name),
                FOREIGN KEY (source_path) REFERENCES notes(path) ON DELETE CASCADE
            );

            -- Tags on notes
            CREATE TABLE IF NOT EXISTS tags (
                note_path TEXT NOT NULL,
                tag TEXT NOT NULL,
                PRIMARY KEY (note_path, tag),
                FOREIGN KEY (note_path) REFERENCES notes(path) ON DELETE CASCADE
            );

            -- Headings in notes (for outline + section links)
            CREATE TABLE IF NOT EXISTS headings (
                note_path TEXT NOT NULL,
                text TEXT NOT NULL,
                level INTEGER NOT NULL,
                line_number INTEGER NOT NULL,
                FOREIGN KEY (note_path) REFERENCES notes(path) ON DELETE CASCADE
            );

            -- Settings key-value store
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            -- Indexes for fast lookups
            CREATE INDEX IF NOT EXISTS idx_links_target ON links(target_name);
            CREATE INDEX IF NOT EXISTS idx_tags_tag ON tags(tag);
            CREATE INDEX IF NOT EXISTS idx_headings_path ON headings(note_path);
            ",
        )
        .context("Failed to create tables")?;

        Ok(Database {
            conn: Mutex::new(conn),
        })
    }

    // ─── Note metadata ────────────────────────────────────────────────

    /// Upsert note metadata into the cache
    pub fn upsert_note(&self, note: &CachedNote) -> Result<()> {
        let conn = self.conn.lock().expect("Database mutex poisoned");
        conn.execute(
            "INSERT INTO notes (path, title, created_at, modified_at, word_count, starred)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(path) DO UPDATE SET
               title = excluded.title,
               modified_at = excluded.modified_at,
               word_count = excluded.word_count",
            (
                &note.path,
                &note.title,
                &note.created_at,
                &note.modified_at,
                note.word_count,
                note.starred as i32,
            ),
        )
        .context("Failed to upsert note")?;
        Ok(())
    }

    /// Get all cached notes
    pub fn get_all_notes(&self) -> Result<Vec<CachedNote>> {
        let conn = self.conn.lock().expect("Database mutex poisoned");
        let mut stmt = conn
            .prepare("SELECT path, title, created_at, modified_at, word_count, starred FROM notes ORDER BY modified_at DESC")
            .context("Failed to prepare query")?;

        let notes = stmt
            .query_map([], |row| {
                Ok(CachedNote {
                    path: row.get(0)?,
                    title: row.get(1)?,
                    created_at: row.get(2)?,
                    modified_at: row.get(3)?,
                    word_count: row.get(4)?,
                    starred: row.get::<_, i32>(5)? != 0,
                })
            })
            .context("Failed to query notes")?
            .collect::<std::result::Result<Vec<_>, _>>()
            .context("Failed to collect note rows")?;

        Ok(notes)
    }

    /// Delete a note and all its related data (links, tags, headings cascade)
    pub fn delete_note(&self, path: &str) -> Result<()> {
        let conn = self.conn.lock().expect("Database mutex poisoned");
        // Delete manually since SQLite foreign keys require PRAGMA foreign_keys=ON
        conn.execute("DELETE FROM links WHERE source_path = ?1", [path])?;
        conn.execute("DELETE FROM tags WHERE note_path = ?1", [path])?;
        conn.execute("DELETE FROM headings WHERE note_path = ?1", [path])?;
        conn.execute("DELETE FROM notes WHERE path = ?1", [path])
            .context("Failed to delete note")?;
        Ok(())
    }

    /// Toggle starred status
    pub fn toggle_star(&self, path: &str) -> Result<bool> {
        let conn = self.conn.lock().expect("Database mutex poisoned");
        conn.execute(
            "UPDATE notes SET starred = CASE WHEN starred = 0 THEN 1 ELSE 0 END WHERE path = ?1",
            [path],
        )?;
        let starred: bool = conn.query_row(
            "SELECT starred FROM notes WHERE path = ?1",
            [path],
            |row| row.get::<_, i32>(0).map(|v| v != 0),
        )?;
        Ok(starred)
    }

    // ─── Links ────────────────────────────────────────────────────────

    /// Replace all outgoing links for a note
    pub fn update_links(&self, source_path: &str, targets: &[String]) -> Result<()> {
        let conn = self.conn.lock().expect("Database mutex poisoned");
        conn.execute("DELETE FROM links WHERE source_path = ?1", [source_path])?;
        let mut stmt = conn.prepare(
            "INSERT OR IGNORE INTO links (source_path, target_name) VALUES (?1, ?2)",
        )?;
        for target in targets {
            stmt.execute(rusqlite::params![source_path, target])?;
        }
        Ok(())
    }

    /// Get all notes that link TO the given note title
    pub fn get_backlinks(&self, note_title: &str) -> Result<Vec<String>> {
        let conn = self.conn.lock().expect("Database mutex poisoned");
        let mut stmt = conn.prepare(
            "SELECT DISTINCT source_path FROM links WHERE target_name = ?1",
        )?;
        let paths = stmt
            .query_map([note_title], |row| row.get(0))
            .context("Failed to query backlinks")?
            .collect::<std::result::Result<Vec<String>, _>>()?;
        Ok(paths)
    }

    /// Get all outgoing links from a note
    pub fn get_outgoing_links(&self, source_path: &str) -> Result<Vec<String>> {
        let conn = self.conn.lock().expect("Database mutex poisoned");
        let mut stmt = conn.prepare(
            "SELECT target_name FROM links WHERE source_path = ?1",
        )?;
        let links = stmt
            .query_map([source_path], |row| row.get(0))
            .context("Failed to query outgoing links")?
            .collect::<std::result::Result<Vec<String>, _>>()?;
        Ok(links)
    }

    /// Get all links in the vault (for graph view)
    pub fn get_all_links(&self) -> Result<Vec<(String, String)>> {
        let conn = self.conn.lock().expect("Database mutex poisoned");
        let mut stmt = conn.prepare("SELECT source_path, target_name FROM links")?;
        let links = stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
            .context("Failed to query all links")?
            .collect::<std::result::Result<Vec<(String, String)>, _>>()?;
        Ok(links)
    }

    // ─── Tags ─────────────────────────────────────────────────────────

    /// Replace all tags for a note
    pub fn update_tags(&self, note_path: &str, tags: &[String]) -> Result<()> {
        let conn = self.conn.lock().expect("Database mutex poisoned");
        conn.execute("DELETE FROM tags WHERE note_path = ?1", [note_path])?;
        let mut stmt =
            conn.prepare("INSERT OR IGNORE INTO tags (note_path, tag) VALUES (?1, ?2)")?;
        for tag in tags {
            stmt.execute(rusqlite::params![note_path, tag])?;
        }
        Ok(())
    }

    /// Get all unique tags in the vault with their counts
    pub fn get_all_tags(&self) -> Result<Vec<(String, usize)>> {
        let conn = self.conn.lock().expect("Database mutex poisoned");
        let mut stmt = conn.prepare(
            "SELECT tag, COUNT(*) as cnt FROM tags GROUP BY tag ORDER BY cnt DESC",
        )?;
        let tags = stmt
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, usize>(1)?))
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?;
        Ok(tags)
    }

    /// Get all notes with a specific tag
    pub fn get_notes_by_tag(&self, tag: &str) -> Result<Vec<String>> {
        let conn = self.conn.lock().expect("Database mutex poisoned");
        let mut stmt = conn.prepare("SELECT note_path FROM tags WHERE tag = ?1")?;
        let paths = stmt
            .query_map([tag], |row| row.get(0))?
            .collect::<std::result::Result<Vec<String>, _>>()?;
        Ok(paths)
    }

    // ─── Headings ─────────────────────────────────────────────────────

    /// Replace all headings for a note
    pub fn update_headings(
        &self,
        note_path: &str,
        headings: &[crate::indexer::Heading],
    ) -> Result<()> {
        let conn = self.conn.lock().expect("Database mutex poisoned");
        conn.execute("DELETE FROM headings WHERE note_path = ?1", [note_path])?;
        let mut stmt = conn.prepare(
            "INSERT INTO headings (note_path, text, level, line_number) VALUES (?1, ?2, ?3, ?4)",
        )?;
        for h in headings {
            stmt.execute(rusqlite::params![
                note_path,
                &h.text,
                h.level as i32,
                h.line as i32,
            ])?;
        }
        Ok(())
    }

    /// Get headings for a specific note
    pub fn get_headings(&self, note_path: &str) -> Result<Vec<crate::indexer::Heading>> {
        let conn = self.conn.lock().expect("Database mutex poisoned");
        let mut stmt = conn.prepare(
            "SELECT text, level, line_number FROM headings WHERE note_path = ?1 ORDER BY line_number",
        )?;
        let headings = stmt
            .query_map([note_path], |row| {
                Ok(crate::indexer::Heading {
                    text: row.get(0)?,
                    level: row.get::<_, i32>(1)? as u8,
                    line: row.get::<_, i32>(2)? as usize,
                })
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?;
        Ok(headings)
    }

    // ─── Settings ─────────────────────────────────────────────────────

    /// Get a setting value
    pub fn get_setting(&self, key: &str) -> Result<Option<String>> {
        let conn = self.conn.lock().expect("Database mutex poisoned");
        let result = conn.query_row(
            "SELECT value FROM settings WHERE key = ?1",
            [key],
            |row| row.get(0),
        );
        match result {
            Ok(value) => Ok(Some(value)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    /// Set a setting value
    pub fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        let conn = self.conn.lock().expect("Database mutex poisoned");
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            [key, value],
        )?;
        Ok(())
    }

    // ─── Bulk operations ──────────────────────────────────────────────

    /// Reindex the entire vault — scans all .md files and rebuilds cache
    pub fn reindex_vault(&self, vault_path: &Path) -> Result<()> {
        let notes = crate::vault::Vault::list_notes(vault_path)?;

        for entry in &notes {
            let content = match crate::vault::Vault::read_file(vault_path, &entry.path) {
                Ok(c) => c,
                Err(_) => continue,
            };

            let fm = crate::vault::Vault::parse_frontmatter(&content);
            let index = crate::indexer::index_note(
                &entry.path,
                &content,
                &fm.tags,
            );

            let title = fm
                .title
                .unwrap_or_else(|| index.title.clone());

            let cached_note = CachedNote {
                path: entry.path.clone(),
                title,
                created_at: fm.created.clone(),
                modified_at: fm.modified.clone(),
                word_count: index.word_count as i64,
                starred: false,
            };

            self.upsert_note(&cached_note)?;
            self.update_links(&entry.path, &index.outgoing_links)?;
            self.update_tags(&entry.path, &index.tags)?;
            self.update_headings(&entry.path, &index.headings)?;
        }

        // Remove notes that no longer exist on disk
        let all_cached = self.get_all_notes()?;
        let disk_paths: std::collections::HashSet<String> =
            notes.iter().map(|e| e.path.clone()).collect();
        for cached in &all_cached {
            if !disk_paths.contains(&cached.path) {
                self.delete_note(&cached.path)?;
            }
        }

        Ok(())
    }

    /// Reindex a single note (after save or external change)
    pub fn reindex_note(&self, vault_path: &Path, relative_path: &str) -> Result<()> {
        let content = crate::vault::Vault::read_file(vault_path, relative_path)?;
        let fm = crate::vault::Vault::parse_frontmatter(&content);
        let index = crate::indexer::index_note(relative_path, &content, &fm.tags);

        let title = fm.title.unwrap_or_else(|| index.title.clone());

        let cached_note = CachedNote {
            path: relative_path.to_string(),
            title,
            created_at: fm.created.clone(),
            modified_at: fm.modified.clone(),
            word_count: index.word_count as i64,
            starred: false,
        };

        self.upsert_note(&cached_note)?;
        self.update_links(relative_path, &index.outgoing_links)?;
        self.update_tags(relative_path, &index.tags)?;
        self.update_headings(relative_path, &index.headings)?;

        Ok(())
    }
}

/// Cached note metadata (stored in SQLite, mirrors filesystem)
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CachedNote {
    pub path: String,
    pub title: String,
    pub created_at: Option<String>,
    pub modified_at: Option<String>,
    pub word_count: i64,
    pub starred: bool,
}
