// Remembers "am I connected to a sync code, and which one" across a page refresh — separate
// from the actual synced data (see lib/storage.ts), same idea as the card games' roomSession.ts.
const KEY = 'worldlySyncCode';

export function getSavedSyncCode(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveSyncCode(code: string): void {
  try {
    localStorage.setItem(KEY, code);
  } catch {
    // localStorage unavailable — sync will still work for this page load, just won't
    // reconnect automatically next time.
  }
}

export function clearSyncCode(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing to clean up if it was never saved
  }
}
