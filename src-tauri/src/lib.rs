mod commands;
mod database;
mod file_manager;

use database::Database;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize the database (creates ~/.synapse/ and tables if needed)
    let db = Database::init().expect("Failed to initialize database");

    tauri::Builder::default()
        .manage(db)
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
            commands::create_note,
            commands::get_all_notes,
            commands::get_note_content,
            commands::save_note,
            commands::delete_note,
            commands::rename_note,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
