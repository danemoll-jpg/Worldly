import { CountryDef, MultipleChoiceDifficulty, QuizCategory, QuizMode } from '@worldly/engine';

export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

/** Turns a session's (mode, category, difficulty, scope, continentsKey) into the same
 * plain-English description a player would recognize from the setup screen — used on the
 * records screen, where every row IS a distinct config, so this is the only thing telling two
 * rows apart. `category` is ignored for 'continent' mode and `multipleChoiceDifficulty` is
 * ignored for every mode except 'multipleChoice' (neither applies otherwise — see QuizConfig). */
export function describeConfig(
  mode: QuizMode,
  category: QuizCategory,
  multipleChoiceDifficulty: MultipleChoiceDifficulty,
  scope: 'all' | 'weakSpots',
  continentsKey: string,
): string {
  const modeLabel =
    mode === 'findIt' ? 'Find it' : mode === 'typeIt' ? 'Type it' : mode === 'multipleChoice' ? 'Multiple choice' : 'Continents';
  const categoryLabel = mode === 'continent' || category === 'country' ? '' : ` (${category === 'flag' ? 'flags' : 'capitals'})`;
  const difficultyLabel = mode === 'multipleChoice' && multipleChoiceDifficulty === 'hard' ? ' [hard]' : '';
  const scopeLabel = scope === 'weakSpots' ? 'weak spots only' : 'everything';
  const regionLabel = continentsKey === 'all' ? 'all regions' : continentsKey.split(',').join(', ');
  return `${modeLabel}${categoryLabel}${difficultyLabel} · ${scopeLabel} · ${regionLabel}`;
}

/** Same idea as describeConfig, for the seas/oceans and US-states quizzes' smaller config
 * surface (mode + scope + a plain string category — no continents, no multiple-choice
 * difficulty). `category` of 'name' describes as nothing (the plain/default prompt), same as
 * 'country' does for describeConfig above. */
export function describeGenericConfig(mode: 'findIt' | 'typeIt', scope: 'all' | 'weakSpots', category: string): string {
  const modeLabel = mode === 'findIt' ? 'Find it' : 'Type it';
  const categoryLabel = category === 'name' ? '' : ` (${category === 'flag' ? 'flags' : 'capitals'})`;
  const scopeLabel = scope === 'weakSpots' ? 'weak spots only' : 'everything';
  return `${modeLabel}${categoryLabel} · ${scopeLabel}`;
}

/** What to show as the quiz prompt for a given (category, country) pair — the answer is always
 * "identify the country" (see QuizCategory's doc comment); this just decides what's put in
 * front of the player to identify it FROM. 'flag' is deliberately its own `kind` rather than
 * lumped in with 'text' — callers render it at a much larger size, since a tiny flag emoji is
 * hard to make out. */
export function promptFor(category: QuizCategory, country: CountryDef): { kind: 'text' | 'flag'; content: string } {
  if (category === 'flag') return { kind: 'flag', content: country.flagEmoji };
  if (category === 'capital') return { kind: 'text', content: country.capitals[0] };
  return { kind: 'text', content: country.name };
}
