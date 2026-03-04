import { invoke } from '@tauri-apps/api/core';
import type { ClipboardItem } from '@/types/clipboard';

export async function getHistory(limit: number = 100, offset: number = 0): Promise<ClipboardItem[]> {
  return invoke<ClipboardItem[]>('get_history', { limit, offset });
}

export async function searchHistory(query: string, limit: number = 100): Promise<ClipboardItem[]> {
  return invoke<ClipboardItem[]>('search_history', { query, limit });
}

export async function getItem(id: string): Promise<ClipboardItem | null> {
  return invoke<ClipboardItem | null>('get_item', { id });
}

export async function deleteItem(id: string): Promise<void> {
  return invoke('delete_item', { id });
}

export async function toggleFavorite(id: string): Promise<void> {
  return invoke('toggle_favorite', { id });
}

export async function copyToClipboard(content: string): Promise<void> {
  return invoke('copy_to_clipboard', { content });
}

export async function saveClipboard(content: string): Promise<ClipboardItem> {
  return invoke<ClipboardItem>('save_clipboard', { content });
}

export async function getFavorites(limit: number = 50): Promise<ClipboardItem[]> {
  return invoke<ClipboardItem[]>('get_favorites', { limit });
}