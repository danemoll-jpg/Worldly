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
//
// Every quiz universe (countries, seas/oceans, US states) plus the daily-challenge streak lives
// in this SAME document, each in its own field — not because they're the same shape (they're
// not: StatsMap+SessionRecord[] for countries, StatsMap+GenericSessionRecord[] for the other two
// quizzes, a single small state object for the streak), but because "one sync code, one shared
// study log" is the whole product idea, and a player shouldn't have to think about which of
// several codes covers which part of their progress.
import { doc, onSnapshot, runTransaction, setDoc } from 'firebase/firestore';
import { applySessionToStats, mergeStatsMaps, QuizAnswerResult, StatsMap } from '@worldly/engine';
import { db } from './firebase';
import {
  DailyChallengeState,
  DEFAULT_DAILY_CHALLENGE_STATE,
  GenericSessionRecord,
  mergeDailyChallengeState,
  mergeHistory,
  SessionRecord,
} from '../lib/storage';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I, easy to read/type aloud

export interface SyncDoc {
  createdAt: number;
  updatedAt: number;
  stats: StatsMap;
  history: SessionRecord[];
  /** Every field below is optional so a doc created before it existed still deserializes fine —
   * every reader treats "field absent" as "no info yet" (leave whatever's already showing
   * locally alone) rather than treating "field present and empty" the same way, which would
   * wrongly wipe real local progress the first time an old doc is read after a new field
   * shipped. */
  dailyChallenge?: DailyChallengeState;
  waterBodyStats?: StatsMap;
  waterBodyHistory?: GenericSessionRecord[];
  usStateStats?: StatsMap;
  usStateHistory?: GenericSessionRecord[];
}

/** Every quiz universe's local state, bundled together for createSyncCode/connectToSyncCode —
 * grown one field at a time (daily challenge, then seas/oceans + US states) to the point where
 * separate positional parameters stopped being readable at the call site. */
export interface SyncExtras {
  dailyChallenge: DailyChallengeState;
  waterBodyStats: StatsMap;
  waterBodyHistory: GenericSessionRecord[];
  usStateStats: StatsMap;
  usStateHistory: GenericSessionRecord[];
}

/** Which (stats field, history field) pair a generic (non-country) quiz session applies to —
 * see applyGenericSessionToSync. */
export type GenericSyncFields =
  | { statsField: 'waterBodyStats'; historyField: 'waterBodyHistory' }
  | { statsField: 'usStateStats'; historyField: 'usStateHistory' };

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
export async function createSyncCode(localStats: StatsMap, localHistory: SessionRecord[], extras: SyncExtras): Promise<string> {
  const code = generateSyncCode();
  const now = Date.now();
  const seed: SyncDoc = { createdAt: now, updatedAt: now, stats: localStats, history: localHistory, ...extras };
  await setDoc(syncRef(code), seed);
  return code;
}

/** Wipes an already-connected sync's shared doc down to a clean, empty slate — used by the
 * "clear my stats & history" reset, across every quiz universe (countries, seas/oceans, US
 * states — all three read as "stats & history" to a player, unlike the daily streak, which is
 * its own separate kind of thing). A plain LOCAL clear alone wouldn't stick while connected: the
 * Firestore doc is the single source of truth once synced (see this file's header comment), so
 * the very next snapshot would just silently bring the old data straight back. Overwriting just
 * the named fields (`{ merge: true }` — not a transaction, this is a deliberate full reset, not
 * applying one more session) is what actually makes the reset stick, and pushes the clean slate
 * out to every other device sharing this code too. Deliberately leaves `dailyChallenge`
 * untouched: the button is named "clear my stats & history," and a daily streak reads as
 * neither to a player — a plain top-level replace instead of `merge: true` would have silently
 * wiped it as a side effect of not mentioning it. */
export async function resetSyncDoc(code: string): Promise<void> {
  const now = Date.now();
  const cleared = {
    createdAt: now,
    updatedAt: now,
    stats: {},
    history: [],
    waterBodyStats: {},
    waterBodyHistory: [],
    usStateStats: {},
    usStateHistory: [],
  };
  await setDoc(syncRef(code), cleared, { merge: true });
}

/** Joins an existing sync code — folds whatever this device already has locally into the
 * shared copy (once; see the module doc comment), and returns the merged result so the caller
 * can adopt it immediately instead of waiting on the subscription's first tick. */
export async function connectToSyncCode(code: string, localStats: StatsMap, localHistory: SessionRecord[], extras: SyncExtras): Promise<SyncDoc> {
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
      dailyChallenge: mergeDailyChallengeState(remote.dailyChallenge ?? DEFAULT_DAILY_CHALLENGE_STATE, extras.dailyChallenge),
      waterBodyStats: mergeStatsMaps(remote.waterBodyStats ?? {}, extras.waterBodyStats),
      waterBodyHistory: mergeHistory(remote.waterBodyHistory ?? [], extras.waterBodyHistory),
      usStateStats: mergeStatsMaps(remote.usStateStats ?? {}, extras.usStateStats),
      usStateHistory: mergeHistory(remote.usStateHistory ?? [], extras.usStateHistory),
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

/** Applies one just-completed COUNTRY-quiz session to the shared copy — reads whatever the
 * latest state actually is (which might already reflect a session finished moments ago on
 * another device) and applies this session's results on top of THAT, inside a transaction,
 * rather than overwriting with a stale local copy. */
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

/** Same idea as applySessionToSync, for the seas/oceans and US-states quizzes — parameterized by
 * which pair of fields to update (see GenericSyncFields) rather than being two near-identical
 * copies of the same function. */
export async function applyGenericSessionToSync(
  code: string,
  fields: GenericSyncFields,
  record: GenericSessionRecord,
  results: QuizAnswerResult[],
): Promise<{ stats: StatsMap; history: GenericSessionRecord[] }> {
  const ref = syncRef(code);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Sync code no longer exists.');
    const remote = snap.data() as SyncDoc;
    const nextStats = applySessionToStats(remote[fields.statsField] ?? {}, results);
    const nextHistory = mergeHistory(remote[fields.historyField] ?? [], [record]);
    const next: SyncDoc = { ...remote, updatedAt: Date.now(), [fields.statsField]: nextStats, [fields.historyField]: nextHistory };
    tx.set(ref, next);
    return { stats: nextStats, history: nextHistory };
  });
}

/** Applies today's daily-challenge result to the shared copy. Deliberately a plain merge write,
 * not a transaction like applySessionToSync above: `{ merge: true }` only ever touches this one
 * field, so it can't clobber a stats/history write another device makes at the same moment
 * (Firestore merges are per top-level field, not whole-document), and the low-stakes,
 * once-a-day-per-device nature of this field means the rare case of two devices completing the
 * same day's challenge within moments of each other is fine to resolve as plain last-write-wins
 * — the loser's local state is still correct locally, and the next realtime snapshot (see
 * subscribeSyncDoc) reconciles it to whichever write actually landed last. */
export async function applyDailyChallengeToSync(code: string, dailyChallenge: DailyChallengeState): Promise<void> {
  await setDoc(syncRef(code), { updatedAt: Date.now(), dailyChallenge }, { merge: true });
}
