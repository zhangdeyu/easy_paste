mod clipboard;
mod commands;
mod database;

use clipboard::ClipboardMonitor;
use database::models::Database;
use std::sync::Arc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Get app data directory
            let app_data_dir = app.path().app_data_dir().expect("Failed to get app data dir");

            // Initialize database
            let db = Arc::new(Database::new(&app_data_dir).expect("Failed to initialize database"));
            app.manage(db.clone());

            // Start clipboard monitor with database reference
            let app_handle = app.handle().clone();
            let _monitor = ClipboardMonitor::start(app_handle, db);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::clipboard::get_history,
            commands::clipboard::search_history,
            commands::clipboard::get_item,
            commands::clipboard::delete_item,
            commands::clipboard::toggle_favorite,
            commands::clipboard::copy_to_clipboard,
            commands::clipboard::save_clipboard,
            commands::history::get_favorites,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}