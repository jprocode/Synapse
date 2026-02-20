use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

/// Represents a file or folder in the vault
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultEntry {
    /// Relative path from vault root (e.g. "Projects/Synapse.md")
    pub path: String,
    /// Just the filename without extension (display name)
    pub name: String,
    /// Whether this is a directory
    pub is_dir: bool,
    /// File size in bytes (0 for directories)
    pub size: u64,
    /// Last modified timestamp (unix seconds)
    pub modified: i64,
    /// Created timestamp (unix seconds)
    pub created: i64,
}

/// Represents parsed YAML frontmatter from a note
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Frontmatter {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub created: Option<String>,
    #[serde(default)]
    pub modified: Option<String>,
    #[serde(default)]
    pub aliases: Vec<String>,
    /// Catch-all for custom user properties
    #[serde(flatten)]
    pub extra: HashMap<String, serde_yaml::Value>,
}

/// Core vault operations
pub struct Vault;

impl Vault {
    /// Get the path where we store vault config (which vault is open)
    pub fn config_path() -> Result<PathBuf> {
        let home = dirs::home_dir().context("Could not determine home directory")?;
        let config_dir = home.join(".synapse");
        fs::create_dir_all(&config_dir).context("Failed to create config directory")?;
        Ok(config_dir.join("vault_config.json"))
    }

    /// Read the currently configured vault path
    pub fn get_vault_path() -> Result<Option<PathBuf>> {
        let config_path = Self::config_path()?;
        if !config_path.exists() {
            return Ok(None);
        }
        let raw = fs::read_to_string(&config_path).context("Failed to read vault config")?;
        let config: VaultConfig =
            serde_json::from_str(&raw).context("Failed to parse vault config")?;
        let path = PathBuf::from(&config.vault_path);
        if path.exists() {
            Ok(Some(path))
        } else {
            Ok(None)
        }
    }

    /// Save the vault path to config
    pub fn set_vault_path(path: &Path) -> Result<()> {
        let config_path = Self::config_path()?;
        let config = VaultConfig {
            vault_path: path.to_string_lossy().to_string(),
        };
        let raw = serde_json::to_string_pretty(&config).context("Failed to serialize config")?;
        fs::write(&config_path, raw).context("Failed to write vault config")?;
        Ok(())
    }

    /// Create a new vault at the given path
    pub fn create_vault(path: &Path) -> Result<()> {
        fs::create_dir_all(path).context("Failed to create vault directory")?;

        // Create .synapse cache dir inside vault
        let cache_dir = path.join(".synapse");
        fs::create_dir_all(&cache_dir).context("Failed to create .synapse cache dir")?;

        // Create a welcome note
        let welcome = r#"---
title: Welcome to Synapse
created: {{DATE}}
modified: {{DATE}}
tags:
  - getting-started
---

# Welcome to Synapse

This is your first note! Here are some things you can do:

- **Create new notes** — Cmd+N
- **Link notes** — Type `[[` to create a wikilink
- **Search** — Cmd+O to quickly open any note
- **Command palette** — Cmd+P for all commands
- **Graph view** — Cmd+G to see your knowledge graph

Start writing and connecting your ideas!
"#;
        let now = chrono::Utc::now().format("%Y-%m-%d").to_string();
        let welcome = welcome.replace("{{DATE}}", &now);
        fs::write(path.join("Welcome to Synapse.md"), welcome)
            .context("Failed to create welcome note")?;

        Self::set_vault_path(path)?;
        Ok(())
    }

    /// Open an existing vault (just validate and save path)
    pub fn open_vault(path: &Path) -> Result<()> {
        if !path.exists() || !path.is_dir() {
            anyhow::bail!("Vault path does not exist or is not a directory");
        }

        // Create .synapse cache dir if it doesn't exist
        let cache_dir = path.join(".synapse");
        fs::create_dir_all(&cache_dir).context("Failed to create .synapse cache dir")?;

        Self::set_vault_path(path)?;
        Ok(())
    }

    /// Get the .synapse cache directory inside the vault
    pub fn cache_dir(vault_path: &Path) -> PathBuf {
        vault_path.join(".synapse")
    }

    /// Get the path to the cache database
    pub fn db_path(vault_path: &Path) -> PathBuf {
        Self::cache_dir(vault_path).join("cache.db")
    }

    /// Recursively list all files and folders in the vault
    pub fn list_entries(vault_path: &Path) -> Result<Vec<VaultEntry>> {
        let mut entries = Vec::new();

        for entry in WalkDir::new(vault_path)
            .min_depth(1)
            .into_iter()
            .filter_entry(|e| {
                // Skip hidden directories (.synapse, .git, .obsidian, etc.)
                let name = e.file_name().to_string_lossy();
                !name.starts_with('.')
            })
        {
            let entry = entry.context("Failed to walk vault directory")?;
            let path = entry.path();
            let relative = path
                .strip_prefix(vault_path)
                .unwrap_or(path)
                .to_string_lossy()
                .to_string();

            let metadata = entry.metadata().context("Failed to read file metadata")?;

            let name = path
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();

            let modified = metadata
                .modified()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs() as i64)
                .unwrap_or(0);

            let created = metadata
                .created()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs() as i64)
                .unwrap_or(0);

            entries.push(VaultEntry {
                path: relative,
                name,
                is_dir: metadata.is_dir(),
                size: if metadata.is_dir() {
                    0
                } else {
                    metadata.len()
                },
                modified,
                created,
            });
        }

        // Sort: directories first, then alphabetical
        entries.sort_by(|a, b| {
            b.is_dir
                .cmp(&a.is_dir)
                .then_with(|| a.path.to_lowercase().cmp(&b.path.to_lowercase()))
        });

        Ok(entries)
    }

    /// List only markdown files in the vault
    pub fn list_notes(vault_path: &Path) -> Result<Vec<VaultEntry>> {
        let all = Self::list_entries(vault_path)?;
        Ok(all
            .into_iter()
            .filter(|e| !e.is_dir && e.path.ends_with(".md"))
            .collect())
    }

    /// Read a file's content by its relative path
    pub fn read_file(vault_path: &Path, relative_path: &str) -> Result<String> {
        let full_path = vault_path.join(relative_path);
        fs::read_to_string(&full_path)
            .with_context(|| format!("Failed to read file: {}", relative_path))
    }

    /// Write content to a file by its relative path
    pub fn write_file(vault_path: &Path, relative_path: &str, content: &str) -> Result<()> {
        let full_path = vault_path.join(relative_path);
        // Ensure parent directory exists
        if let Some(parent) = full_path.parent() {
            fs::create_dir_all(parent)
                .context("Failed to create parent directories for file")?;
        }
        fs::write(&full_path, content)
            .with_context(|| format!("Failed to write file: {}", relative_path))
    }

    /// Create a new note file in the vault
    pub fn create_note(vault_path: &Path, relative_dir: &str, title: &str) -> Result<String> {
        // Sanitize title for filename
        let safe_name = sanitize_filename(title);
        let relative_path = if relative_dir.is_empty() {
            format!("{}.md", safe_name)
        } else {
            format!("{}/{}.md", relative_dir, safe_name)
        };

        let full_path = vault_path.join(&relative_path);
        if full_path.exists() {
            anyhow::bail!("A note with this name already exists");
        }

        // Ensure parent directory exists
        if let Some(parent) = full_path.parent() {
            fs::create_dir_all(parent)?;
        }

        let now = chrono::Utc::now().format("%Y-%m-%d").to_string();
        let frontmatter = format!(
            "---\ntitle: {}\ncreated: {}\nmodified: {}\ntags: []\n---\n\n",
            title, now, now
        );

        fs::write(&full_path, &frontmatter)
            .with_context(|| format!("Failed to create note: {}", relative_path))?;

        Ok(relative_path)
    }

    /// Create a new folder in the vault
    pub fn create_folder(vault_path: &Path, relative_path: &str) -> Result<()> {
        let full_path = vault_path.join(relative_path);
        fs::create_dir_all(&full_path)
            .with_context(|| format!("Failed to create folder: {}", relative_path))
    }

    /// Delete a file or folder
    pub fn delete_entry(vault_path: &Path, relative_path: &str) -> Result<()> {
        let full_path = vault_path.join(relative_path);
        if full_path.is_dir() {
            fs::remove_dir_all(&full_path)
                .with_context(|| format!("Failed to delete folder: {}", relative_path))?;
        } else {
            fs::remove_file(&full_path)
                .with_context(|| format!("Failed to delete file: {}", relative_path))?;
        }
        Ok(())
    }

    /// Rename/move a file or folder
    pub fn rename_entry(
        vault_path: &Path,
        old_relative: &str,
        new_relative: &str,
    ) -> Result<()> {
        let old_path = vault_path.join(old_relative);
        let new_path = vault_path.join(new_relative);

        // Ensure new parent directory exists
        if let Some(parent) = new_path.parent() {
            fs::create_dir_all(parent)?;
        }

        fs::rename(&old_path, &new_path).with_context(|| {
            format!(
                "Failed to move {} to {}",
                old_relative, new_relative
            )
        })
    }

    /// Duplicate a note
    pub fn duplicate_entry(vault_path: &Path, relative_path: &str) -> Result<String> {
        let full_path = vault_path.join(relative_path);
        let stem = full_path
            .file_stem()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        let ext = full_path
            .extension()
            .map(|e| format!(".{}", e.to_string_lossy()))
            .unwrap_or_default();

        // Find a unique name
        let parent = full_path.parent().unwrap_or(vault_path);
        let mut counter = 1;
        let new_path;
        loop {
            let candidate = parent.join(format!("{} {}{}", stem, counter, ext));
            if !candidate.exists() {
                new_path = candidate;
                break;
            }
            counter += 1;
        }

        fs::copy(&full_path, &new_path).context("Failed to duplicate file")?;

        let new_relative = new_path
            .strip_prefix(vault_path)
            .unwrap_or(&new_path)
            .to_string_lossy()
            .to_string();

        Ok(new_relative)
    }

    /// Parse YAML frontmatter from a markdown file
    pub fn parse_frontmatter(content: &str) -> Frontmatter {
        if !content.starts_with("---") {
            return Frontmatter::default();
        }

        let rest = &content[3..];
        let end_idx = match rest.find("\n---") {
            Some(idx) => idx,
            None => return Frontmatter::default(),
        };

        let yaml_str = &rest[..end_idx];
        serde_yaml::from_str(yaml_str).unwrap_or_default()
    }

    /// Get the body content (without frontmatter) from a markdown file
    pub fn strip_frontmatter(content: &str) -> String {
        if !content.starts_with("---") {
            return content.to_string();
        }

        let rest = &content[3..];
        match rest.find("\n---") {
            Some(end_idx) => {
                let body_start = end_idx + 4; // skip \n---
                rest[body_start..].trim_start_matches('\n').to_string()
            }
            None => content.to_string(),
        }
    }
}

/// Sanitize a string for use as a filename
fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            _ => c,
        })
        .collect::<String>()
        .trim()
        .to_string()
}

#[derive(Debug, Serialize, Deserialize)]
struct VaultConfig {
    vault_path: String,
}
