import { useState, useEffect, useCallback } from 'react';
import * as api from '@/lib/api';
import type { ClipboardItem } from '@/types/clipboard';

export function useHistory(limit: number = 100) {
  const [items, setItems] = useState<ClipboardItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getHistory(limit);
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch history');
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      fetchItems();
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.searchHistory(query, limit);
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search');
    } finally {
      setIsLoading(false);
    }
  }, [limit, fetchItems]);

  const toggleFavorite = useCallback(async (id: string) => {
    try {
      await api.toggleFavorite(id);
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, is_favorite: !item.is_favorite } : item
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle favorite');
    }
  }, []);

  const deleteItem = useCallback(async (id: string) => {
    try {
      await api.deleteItem(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item');
    }
  }, []);

  const deleteBatch = useCallback(async (ids: string[]) => {
    try {
      await api.deleteBatch(ids);
      setItems((prev) => prev.filter((item) => !ids.includes(item.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete items');
    }
  }, []);

  const addItem = useCallback((item: ClipboardItem) => {
    setItems((prev) => {
      // Check if item already exists to prevent duplicates
      const exists = prev.some((existing) => existing.id === item.id);
      if (exists) {
        // Move to top if already exists
        return [item, ...prev.filter((existing) => existing.id !== item.id)];
      }
      return [item, ...prev];
    });
  }, []);

  const clearHistory = useCallback(async () => {
    try {
      await api.clearHistory();
      setItems([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear history');
    }
  }, []);

  return {
    items,
    isLoading,
    error,
    search,
    toggleFavorite,
    deleteItem,
    deleteBatch,
    addItem,
    clearHistory,
    refresh: fetchItems,
  };
}