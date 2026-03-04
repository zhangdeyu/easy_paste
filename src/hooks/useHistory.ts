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

  const addItem = useCallback((item: ClipboardItem) => {
    setItems((prev) => [item, ...prev]);
  }, []);

  return {
    items,
    isLoading,
    error,
    search,
    toggleFavorite,
    deleteItem,
    addItem,
    refresh: fetchItems,
  };
}