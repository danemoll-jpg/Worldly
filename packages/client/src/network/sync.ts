// Cross-device sync — a single shared Firestore document per sync code, no accounts/auth
// involved (same "the code IS the access control" trust model as room codes elsewhere in this
// series, just for a personal study log instead of a multiplayer game). One person's own
// devices share a code; there's nothing here that's meant to be shared with anyone else.
//
// Sync model: once connected, the Firestore doc is the single source of truth. Completing a
// quiz applies its results to the doc inside a transaction (read the latest copy, apply
// @worldly/engine's applySessionToStats, write it back) — the same "single writer per turn,
// transaction when more than one caller might race" shape the card games use for their
// readiness-gate actions, which is exactly the situation here too (two devices could finish a
// session at close to the same moment). The only place a plain merge (rather than a
// transactional apply) happens is the ONE-TIME moment a device first connects to a code — see
// connectToSyncCode — folding in whatever local progress it made before syncing existed.
import { doc, onSnapshot, runTransaction, setDoc } from 'firebase/firestore';
import { applySessionToStats, mergeStatsMaps, QuizAnswerResult, StatsMap } from '@worldly/engine';
import { db } from './firebase';
import { mergeHistory, SessionRecord } from '../lib/storage';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I, easy to read/type aloud

export interface SyncDoc {
  createdAt: number;
  updatedAt: number;
  stats: StatsMap;
  history: SessionRecord[];
}

function generateSyncCode(length = 6): string {
  let code = '';
  for (let i = 0; i < length; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

function syncRef(code: string) {
  return doc(db, 'syncs', code.toUpperCase());
}

/** Starts a new sync code, seeded with whatever's on this device right now. Returns the code —
 * share it with your other devices (or "connect" them to it) to bring them in. */
export async function createSyncCode(localStats: StatsMap, localHistory: SessionRecord[]): Promise<string> {
  const code = generateSyncCode();
  const now = Date.now();
  const seed: SyncDoc = { createdAt: now, updatedAt: now, stats: localStats, history: localHistory };
  await setDoc(syncRef(code), seed);
  return code;
}

/** Joins an existing sync code — folds whatever this device already has locally into the
 * shared copy (once; see the module doc comment), and returns the merged result so the caller
 * can adopt it immediately instead of waiting on the subscription's first tick. */
export async function connectToSyncCode(code: string, localStats: StatsMap, localHistory: SessionRecord[]): Promise<SyncDoc> {
  const ref = syncRef(code);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("That sync code doesn't exist — check it and try again.");
    const remote = snap.data() as SyncDoc;
    const merged: SyncDoc = {
      ...remote,
      updatedAt: Date.now(),
      stats: mergeStatsMaps(remote.stats, localStats),
      history: mergeHistory(remote.history, localHistory),
    };
    tx.set(ref, merged);
    return merged;
  });
}

/** Realtime updates for a sync code — every connected device sees every other device's
 * completed sessions without needing to manually refresh. Returns an unsubscribe function. */
export function subscribeSyncDoc(code: string, callback: (doc: SyncDoc | null) => void): () => void {
  return onSnapshot(syncRef(code), (snap) => {
    callback(snap.exists() ? (snap.data() as SyncDoc) : null);
  });
}

/** Applies one just-completed session to the shared copy — reads whatever the latest state
 * actually is (which might already reflect a session finished moments ago on another device)
 * and applies this session's results on top of THAT, inside a transaction, rather than
 * overwriting with a stale local copy. */
export async function applySessionToSync(code: string, record: SessionRecord, results: QuizAnswerResult[]): Promise<SyncDoc> {
  const ref = syncRef(code);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Sync code no longer exists.');
    const remote = snap.data() as SyncDoc;
    const next: SyncDoc = {
      ...remote,
      updatedAt: Date.now(),
      stats: applySessionToStats(remote.stats, results),
      history: mergeHistory(remote.history, [record]),
    };
    tx.set(ref, next);
    return next;
  });
}
