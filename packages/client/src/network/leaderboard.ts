// Global top-10 leaderboards, one per quiz type — separate from sync.ts's cross-device sync
// entirely (different collection, different trust model: sync is one person's own devices
// sharing a private study log behind a code only they know, this is public and meant to be seen
// by other people). Same Firestore project (see ./firebase), same "no accounts, the client
// writes directly" shape as the rest of this app.
//
// IMPORTANT CAVEAT (same one sync.ts's rules already carry, worth repeating here since this data
// is public rather than behind a private code): without Firebase Auth + Cloud Functions doing
// the actual writes server-side, a determined person could call the Firestore SDK directly and
// write a fake score. firestore.rules bounds the shape (percentCorrect 0-100, plausible question
// counts, only-ever-improves-your-own-entry) to block casual tampering, but this is not
// airtight — accepted tradeoff for a small, mostly-friends-and-family leaderboard, not a
// guarantee against someone determined to cheat. If that ever matters more, the fix is routing
// submissions through a Cloud Function that recomputes the score from raw results server-side
// instead of trusting whatever the client sends — the same Cloud Function infrastructure the
// daily-challenge push notifications need anyway (see BACKLOG.md).
import { collection, doc, getDoc, getDocs, limit, orderBy, query, setDoc } from 'firebase/firestore';
import { GenericSessionSummary, QuizConfig, SessionSummary } from '@worldly/engine';
import { db } from './firebase';

export type LeaderboardQuizType = 'countries' | 'usStates' | 'waterBodies';

export interface LeaderboardEntry {
  playerId: string;
  displayName: string;
  percentCorrect: number;
  correctCount: number;
  totalQuestions: number;
  timeSeconds: number;
  updatedAt: number;
}

/** Only the standard, full-size run of each quiz type counts toward the leaderboard — not every
 * mode/scope/category combination. Without this, the board would mix genuinely different tests
 * (a 5-country "just my weak spots" run scores very differently than the full 197-country one;
 * guessing a name from a flag isn't the same challenge as finding it on a blank map) under one
 * ranking, which would make the comparison meaningless rather than just imperfect. This is
 * deliberately narrower than the personal-bests records screen, which tracks every setup
 * separately — a leaderboard only works at all if everyone on it did the same thing. */
export function isCountryQuizLeaderboardEligible(config: QuizConfig): boolean {
  return config.mode === 'findIt' && config.category === 'country' && config.scope === 'all' && config.continents === 'all';
}

/** Same idea as isCountryQuizLeaderboardEligible, for the water-bodies/US-states quizzes —
 * `category` here defaults to 'name' (see useGenericQuiz's start()); 'flag'/'capital' (US states
 * only) are excluded for the same "not the same test" reason. */
export function isGenericQuizLeaderboardEligible(mode: string, scope: string, category: string): boolean {
  return mode === 'findIt' && scope === 'all' && category === 'name';
}

function entriesCollection(quizType: LeaderboardQuizType) {
  return collection(db, 'leaderboard', quizType, 'entries');
}

function entryRef(quizType: LeaderboardQuizType, playerId: string) {
  return doc(db, 'leaderboard', quizType, 'entries', playerId);
}

/** Builds the write payload from either quiz family's summary shape — both SessionSummary
 * (countries) and GenericSessionSummary (water bodies/US states) already carry exactly the
 * fields a leaderboard entry needs, just as two structurally-identical-but-separately-declared
 * interfaces (see genericSession.ts's own comment on why they're not unified). */
function entryFromSummary(playerId: string, displayName: string, summary: SessionSummary | GenericSessionSummary): Omit<LeaderboardEntry, 'updatedAt'> {
  return {
    playerId,
    displayName,
    percentCorrect: summary.percentCorrect,
    correctCount: summary.correctCount,
    totalQuestions: summary.totalQuestions,
    timeSeconds: Math.round(summary.totalElapsedMs / 1000),
  };
}

/** Submits a completed, eligible session's result. Only actually writes if it beats (or there's
 * no) existing entry for this player on this board — reading first rather than always writing
 * and letting firestore.rules' own monotonic check silently reject the no-op case, so a
 * not-an-improvement run doesn't cost a write attempt at all, and the caller can tell the two
 * cases apart (returns whether it actually improved your standing) to decide whether "submitted
 * to the leaderboard!" is honest to show. */
export async function submitLeaderboardScore(
  quizType: LeaderboardQuizType,
  playerId: string,
  displayName: string,
  summary: SessionSummary | GenericSessionSummary,
): Promise<boolean> {
  const ref = entryRef(quizType, playerId);
  const existing = await getDoc(ref);
  const candidate = entryFromSummary(playerId, displayName, summary);
  if (existing.exists()) {
    const prior = existing.data() as LeaderboardEntry;
    if (candidate.percentCorrect < prior.percentCorrect) return false;
    // Equal accuracy: only treat a faster time as an improvement, so a slower replay at the same
    // accuracy doesn't churn updatedAt (and, once ties are broken by time in
    // fetchLeaderboardTop, doesn't demote you under someone you were previously tied with).
    if (candidate.percentCorrect === prior.percentCorrect && candidate.timeSeconds >= prior.timeSeconds) return false;
  }
  await setDoc(ref, { ...candidate, updatedAt: Date.now() });
  return true;
}

/** Top 10 for one quiz type, ranked by accuracy then time. Firestore only sorts by the one field
 * this queries on (percentCorrect) — over-fetching a wider slice (top 40) and finishing the
 * accuracy+time sort client-side avoids needing a composite index for what's a small, low-write
 * collection anyway. */
export async function fetchLeaderboardTop(quizType: LeaderboardQuizType, count = 10): Promise<LeaderboardEntry[]> {
  const q = query(entriesCollection(quizType), orderBy('percentCorrect', 'desc'), limit(Math.max(count * 4, 40)));
  const snap = await getDocs(q);
  const entries = snap.docs.map((d) => d.data() as LeaderboardEntry);
  entries.sort((a, b) => b.percentCorrect - a.percentCorrect || a.timeSeconds - b.timeSeconds);
  return entries.slice(0, count);
}

/** Where a specific player stands even if they're outside the top 10 — "You: #47 · 82%" instead
 * of just disappearing off the board. Fetches a capped 500 entries to rank against rather than
 * the whole collection: fine for a small personal/friends-and-family leaderboard, but a genuine
 * limit if this ever grew into something with thousands of players — at that point this needs a
 * real backend-computed rank instead of "fetch everyone and count." */
export async function fetchPlayerRank(quizType: LeaderboardQuizType, playerId: string): Promise<{ rank: number; entry: LeaderboardEntry } | null> {
  const q = query(entriesCollection(quizType), orderBy('percentCorrect', 'desc'), limit(500));
  const snap = await getDocs(q);
  const entries = snap.docs.map((d) => d.data() as LeaderboardEntry);
  entries.sort((a, b) => b.percentCorrect - a.percentCorrect || a.timeSeconds - b.timeSeconds);
  const index = entries.findIndex((e) => e.playerId === playerId);
  return index === -1 ? null : { rank: index + 1, entry: entries[index] };
}
