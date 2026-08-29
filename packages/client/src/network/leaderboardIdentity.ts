// Remembers who you are for leaderboard purposes — two SEPARATE pieces of identity, same split
// syncSession.ts uses for "am I connected" vs. the actual synced data:
//
// - playerId: a random id generated once and never shown to anyone, used purely as the
//   leaderboard's own primary key (see network/leaderboard.ts) so overwriting your OWN best
//   score works the same way whether you've renamed yourself since or not.
// - displayName: the public name shown on leaderboard rows, chosen once (see
//   DisplayNamePrompt.tsx) and editable later without losing your leaderboard history.
//
// Deliberately NOT tied to syncCode: syncing is about one person's own devices sharing a single
// study log, while a leaderboard identity is about being recognizable to OTHER people, and there
// isn't a clean way to derive one from the other (two devices on the same sync code should
// probably show as the same leaderboard entry, but a syncCode is also just as easily shared with
// nobody at all if someone never sets sync up, which is the common case this needs to work for
// too).
const PLAYER_ID_KEY = 'worldlyPlayerId';
const DISPLAY_NAME_KEY = 'worldlyDisplayName';

function randomPlayerId(): string {
  // crypto.randomUUID is available in every browser this app already targets (same baseline as
  // the Web Audio API work) — no uuid dependency needed for one random string.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  // Extremely unlikely fallback (very old browser / non-secure context where randomUUID is
  // unavailable) — still unique enough for "don't collide with another local player," which is
  // all this needs.
  return `player-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** The same id every time, for this browser — generated once on first call and persisted from
 * then on. Never shown in the UI; it's purely how a leaderboard entry recognizes "this is still
 * the same player" across sessions. */
export function getOrCreatePlayerId(): string {
  try {
    const existing = localStorage.getItem(PLAYER_ID_KEY);
    if (existing) return existing;
    const fresh = randomPlayerId();
    localStorage.setItem(PLAYER_ID_KEY, fresh);
    return fresh;
  } catch {
    // localStorage unavailable — hand back a fresh id anyway so the leaderboard code this feeds
    // into doesn't need its own null-handling; it just means this "player" won't be recognized
    // as the same one on a later visit, same degraded-but-not-broken tradeoff as everywhere else
    // localStorage is optional.
    return randomPlayerId();
  }
}

export function getSavedDisplayName(): string | null {
  try {
    return localStorage.getItem(DISPLAY_NAME_KEY);
  } catch {
    return null;
  }
}

export function saveDisplayName(name: string): void {
  try {
    localStorage.setItem(DISPLAY_NAME_KEY, name);
  } catch {
    // Not persisted, but the caller already has it in memory for the rest of this page load.
  }
}
