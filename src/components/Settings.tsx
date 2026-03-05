import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Settings as SettingsIcon } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { getExpiryDays, setExpiryDays, cleanupExpired } from '@/lib/api';

interface SettingsProps {
  onClearHistory?: () => Promise<void>;
  onCleanup?: () => Promise<void>;
}

export function Settings({ onClearHistory, onCleanup }: SettingsProps) {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [isLoadingAutostart, setIsLoadingAutostart] = useState(false);
  const [expiryDays, setExpiryDaysState] = useState(30);
  const [isLoadingExpiry, setIsLoadingExpiry] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);

  // Check autostart status when dialog opens
  useEffect(() => {
    if (open) {
      checkAutostartStatus();
      loadExpiryDays();
      setCleanupMessage(null);
    }
  }, [open]);

  const checkAutostartStatus = async () => {
    try {
      const enabled = await invoke<boolean>('plugin:autostart|is_enabled');
      setAutostartEnabled(enabled);
    } catch (error) {
      console.error('Failed to check autostart status:', error);
    }
  };

  const loadExpiryDays = async () => {
    try {
      const days = await getExpiryDays();
      setExpiryDaysState(days);
    } catch (error) {
      console.error('Failed to load expiry days:', error);
    }
  };

  const toggleAutostart = async () => {
    setIsLoadingAutostart(true);
    try {
      if (autostartEnabled) {
        await invoke('plugin:autostart|disable');
        setAutostartEnabled(false);
      } else {
        await invoke('plugin:autostart|enable');
        setAutostartEnabled(true);
      }
    } catch (error) {
      console.error('Failed to toggle autostart:', error);
    } finally {
      setIsLoadingAutostart(false);
    }
  };

  const handleExpiryDaysChange = async (days: number) => {
    if (days < 1 || days > 365) return;
    setIsLoadingExpiry(true);
    try {
      await setExpiryDays(days);
      setExpiryDaysState(days);
    } catch (error) {
      console.error('Failed to set expiry days:', error);
    } finally {
      setIsLoadingExpiry(false);
    }
  };

  const handleCleanupExpired = async () => {
    setIsCleaningUp(true);
    setCleanupMessage(null);
    try {
      const count = await cleanupExpired();
      setCleanupMessage(`Cleaned up ${count} item${count !== 1 ? 's' : ''}`);
      if (onCleanup) {
        await onCleanup();
      }
    } catch (error) {
      console.error('Failed to cleanup expired items:', error);
      setCleanupMessage('Failed to cleanup');
    } finally {
      setIsCleaningUp(false);
    }
  };

  const handleClearClick = () => {
    setConfirmOpen(true);
  };

  const handleConfirmClear = async () => {
    setIsClearing(true);
    try {
      if (onClearHistory) {
        await onClearHistory();
      }
      setConfirmOpen(false);
      setOpen(false);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Open settings">
          <SettingsIcon className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <div className="space-y-4">
            {/* Autostart */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Launch at Login</p>
                <p className="text-xs text-muted-foreground">
                  Start Easy Paste when you log in
                </p>
              </div>
              <Button
                variant={autostartEnabled ? 'default' : 'outline'}
                size="sm"
                onClick={toggleAutostart}
                disabled={isLoadingAutostart}
              >
                {isLoadingAutostart ? '…' : autostartEnabled ? 'On' : 'Off'}
              </Button>
            </div>

            <Separator />

            {/* Expiry Days */}
            <div className="flex items-center justify-between">
              <label htmlFor="expiry-days" className="cursor-pointer">
                <p className="text-sm font-medium">History Expiry</p>
                <p className="text-xs text-muted-foreground">
                  Non-favorite items expire after {expiryDays} days
                </p>
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="expiry-days"
                  type="number"
                  min={1}
                  max={365}
                  value={expiryDays}
                  onChange={(e) => handleExpiryDaysChange(parseInt(e.target.value) || 30)}
                  disabled={isLoadingExpiry}
                  name="expiry-days"
                  autoComplete="off"
                  className="w-16 h-8 text-center text-sm border rounded px-1"
                />
                <span className="text-xs text-muted-foreground">days</span>
              </div>
            </div>

            <Separator />

            {/* Clear Expired */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Cleanup Expired</p>
                <p className="text-xs text-muted-foreground">
                  Delete expired non-favorite items now
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCleanupExpired}
                disabled={isCleaningUp}
              >
                {isCleaningUp ? 'Cleaning…' : 'Cleanup'}
              </Button>
            </div>
            {cleanupMessage && (
              <p className="text-xs text-muted-foreground">{cleanupMessage}</p>
            )}

            <Separator />

            {/* Clear History */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Clear History</p>
                <p className="text-xs text-muted-foreground">
                  Delete all clipboard history
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleClearClick}
              >
                Clear
              </Button>
            </div>

            {/* Confirmation Dialog */}
            {confirmOpen && (
              <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                <p className="text-sm font-medium text-destructive mb-3">
                  Are you sure you want to clear all history?
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  This action cannot be undone. All clipboard items will be permanently deleted.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmOpen(false)}
                    disabled={isClearing}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleConfirmClear}
                    disabled={isClearing}
                  >
                    {isClearing ? 'Clearing…' : 'Confirm'}
                  </Button>
                </div>
              </div>
            )}

            <Separator />
            <div className="space-y-2">
              <p className="text-sm font-medium">About</p>
              <p className="text-xs text-muted-foreground">
                Easy Paste v0.1.0
              </p>
              <p className="text-xs text-muted-foreground">
                A cross-platform clipboard manager
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}