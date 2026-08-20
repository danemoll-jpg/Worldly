export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

/** Turns a session's (mode, scope, continentsKey) into the same plain-English description a
 * player would recognize from the setup screen — used on the records screen, where every row
 * IS a distinct config, so this is the only thing telling two rows apart. */
export function describeConfig(mode: 'findIt' | 'typeIt', scope: 'all' | 'weakSpots', continentsKey: string): string {
  const modeLabel = mode === 'findIt' ? 'Find it' : 'Type it';
  const scopeLabel = scope === 'weakSpots' ? 'weak spots only' : 'everything';
  const regionLabel = continentsKey === 'all' ? 'all regions' : continentsKey.split(',').join(', ');
  return `${modeLabel} · ${scopeLabel} · ${regionLabel}`;
}
