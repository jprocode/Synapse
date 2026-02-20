mod commands;
mod database;
mod file_manager;
mod indexer;
mod vault;

use commands::AppState;
use database::Database;
use vault::Vault;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Check if a vault is already configured
    let (vault_path, db) = match Vault::get_vault_path() {
        Ok(Some(path)) => {
            // Try to initialize database for existing vault
            match Database::init_for_vault(&path) {
                Ok(db) => {
                    // Reindex on startup to catch any external changes
                    let _ = db.reindex_vault(&path);
                    (Some(path), Some(db))
                }
                Err(e) => {
                    log::warn!("Failed to initialize database for vault: {}", e);
                    (None, None)
                }
            }
        }
        _ => (None, None),
    };

    let app_state = AppState {
        vault_path: std::sync::Mutex::new(vault_path),
        db: std::sync::Mutex::new(db),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(app_state)
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Vault
            commands::get_vault_path,
            commands::create_vault,
            commands::open_vault,
            // File explorer
            commands::list_vault_entries,
            commands::create_note,
            commands::create_folder,
            commands::read_note,
            commands::save_note,
            commands::delete_entry,
            commands::rename_entry,
            commands::duplicate_entry,
            // Notes metadata
            commands::get_all_notes,
            commands::toggle_star,
            // Links & backlinks
            commands::get_backlinks,
            commands::get_outgoing_links,
            commands::get_all_links,
            commands::search_notes,
            // Tags
            commands::get_all_tags,
            commands::get_notes_by_tag,
            // Headings
            commands::get_headings,
            // Settings
            commands::get_setting,
            commands::set_setting,
            // Reindex
            commands::reindex_vault,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
