use crate::database::models::{ClipboardItem, Database};
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub async fn get_favorites(
    db: State<'_, Arc<Database>>,
    limit: i64,
) -> Result<Vec<ClipboardItem>, String> {
    // For now, we'll search through all items and filter favorites
    // In a production app, we'd have a dedicated query for this
    let all_items = db.get_all(limit * 10, 0).map_err(|e| e.to_string())?;
    let favorites: Vec<ClipboardItem> = all_items
        .into_iter()
        .filter(|item| item.is_favorite)
        .take(limit as usize)
        .collect();
    Ok(favorites)
}

#[tauri::command]
pub async fn clear_history(_db: State<'_, Arc<Database>>) -> Result<(), String> {
    // We need to add a clear_all method to Database for this
    // For now, return an error indicating this needs implementation
    Err("clear_history not yet implemented".to_string())
}