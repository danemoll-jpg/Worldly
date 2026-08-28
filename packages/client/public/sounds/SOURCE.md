# Sound effects

Five short cues, played by `packages/client/src/lib/sound.ts` — see that file for exactly when
each one fires. **None of the actual audio files are in this repo yet.** They're being created
externally (ElevenLabs Studio's sound-effects generator) rather than sourced/licensed, so the app
plays nothing (silently, no errors) until real files land here with these exact names:

| Filename                    | Fires when…                                                          |
| ---------------------------- | --------------------------------------------------------------------- |
| `correct.mp3`                 | any answer is marked correct, in any of the three quizzes             |
| `incorrect.mp3`               | any answer is marked wrong                                            |
| `quiz-finish.mp3`             | a session completes — the default "ordinary" ending                   |
| `quiz-finish-perfect.mp3`     | a session completes at 100% correct (and isn't ALSO a new best)       |
| `quiz-finish-record.mp3`      | a session completes as a new personal best for that exact setup — this outranks a merely-perfect score, since it's the rarer, more specifically-earned achievement (see `completionSound` in sound.ts) |

## Generation prompts (ElevenLabs Studio → Sound Effects)

Written to read as clean, modern, tasteful cues — explicitly NOT chiptune/8-bit/retro arcade
register, since that's the one thing to avoid. `correct`/`incorrect` will play very often (every
single answer), so both are deliberately short and low-fatigue rather than showy; the three
"finish" cues escalate from modest to genuinely celebratory.

**`correct.mp3`**
> A short, bright, satisfying confirmation chime — a single crisp two-note upward ping on a soft
> bell, marimba, or glockenspiel, warm and pleasant, like a gentle "ding!" Clean and modern
> production, no retro video-game beep, no harshness. Under 1 second.

**`incorrect.mp3`**
> A short, soft, neutral "that's not it" cue — a low, muted double-tap or gentle wooden knock
> tone, understated and non-punishing (this will play often, so it shouldn't feel like a buzzer
> or an error alarm). Calm, modern, low-fi-free production. Under 1 second.

**`quiz-finish.mp3`**
> A short, warm completion chime for finishing a quiz — a gentle ascending three-note melodic
> flourish on soft bells or a warm synth pad, pleasant and rewarding but understated, not a big
> fanfare. Clean, modern production. About 1–2 seconds.

**`quiz-finish-perfect.mp3`**
> A bright, triumphant short fanfare for a perfect (100%) score — a cheerful ascending run of
> bell/chime tones resolving into a bright major chord, energetic and celebratory but tasteful,
> like a light cinematic "success" sting. Polished, modern production, no chiptune or arcade
> sound. About 2 seconds.

**`quiz-finish-record.mp3`**
> An exciting, triumphant fanfare for beating a personal best — a richer ascending melodic
> flourish with bells plus a light brass or synth swell, resolving into a satisfying full chord;
> should feel like a genuine "you just accomplished something" reward moment, bigger than the
> perfect-score cue. Polished, cinematic, modern production, no retro game sounds. About 2–3
> seconds.

## Format / technical notes

- **MP3**, 44.1kHz is fine — no need for anything exotic; every target browser here plays MP3
  natively.
- Keep `correct`/`incorrect` genuinely short (well under a second) — they play on literally every
  question, so anything longer starts to feel like it's dragging on a quiz someone's moving
  through quickly.
- Normalize loudness across all five so none jumps out louder than the others (sound.ts plays
  every cue at the same fixed volume — it doesn't apply any per-clip gain).
- Drop the finished files straight into this folder with the exact filenames above — no code
  changes needed on this end once they're in place.
