import { useEffect, useRef } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { ClipboardItem } from '@/types/clipboard';

export function useClipboardListener(callback: (item: ClipboardItem) => void) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  // Track if listener is already set up (prevents double registration in StrictMode)
  const listenerRef = useRef<UnlistenFn | null>(null);
  const isSettingUp = useRef(false);

  useEffect(() => {
    // Prevent double setup in React StrictMode
    if (isSettingUp.current || listenerRef.current) {
      return;
    }

    isSettingUp.current = true;

    const setupListener = async () => {
      // Double check before setting up
      if (listenerRef.current) {
        return;
      }

      listenerRef.current = await listen<ClipboardItem>('clipboard-changed', (event) => {
        callbackRef.current(event.payload);
      });
    };

    setupListener();

    return () => {
      if (listenerRef.current) {
        listenerRef.current();
        listenerRef.current = null;
      }
      isSettingUp.current = false;
    };
  }, []);
}