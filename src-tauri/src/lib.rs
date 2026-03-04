mod clipboard;
mod commands;
mod database;
mod tray;
mod window_position;

use clipboard::ClipboardMonitor;
use database::models::Database;
use std::sync::Arc;
use tauri::Manager;
use tauri_plugin_autostart::MacosLauncher;
use window_position::WindowPositionStore;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .setup(|app| {
            // Get app data directory
            let app_data_dir = app.path().app_data_dir().expect("Failed to get app data dir");

            // Initialize database
            let db = Arc::new(Database::new(&app_data_dir).expect("Failed to initialize database"));
            app.manage(db.clone());

            // Initialize window position store
            let position_store = Arc::new(WindowPositionStore::new(&app_data_dir));
            app.manage(position_store.clone());

            // Restore window position if saved
            if let Some(window) = app.get_webview_window("main") {
                if let Some(position) = position_store.load() {
                    let _ = window.set_position(tauri::Position::Physical(
                        tauri::PhysicalPosition { x: position.x, y: position.y }
                    ));
                }
            }

            // Start clipboard monitor with database reference
            let app_handle = app.handle().clone();
            let _monitor = ClipboardMonitor::start(app_handle, db);

            // Setup system tray
            tray::setup_tray(app)?;

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
            commands::clipboard::save_window_position,
            commands::history::get_favorites,
            commands::history::clear_history,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}