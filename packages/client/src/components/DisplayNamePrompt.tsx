import { useState } from 'react';

interface DisplayNamePromptProps {
  onSubmit: (name: string) => void;
}

const MAX_NAME_LENGTH = 24;

/** Shown exactly once — the first time a session would qualify for a leaderboard entry (see
 * useLeaderboardSubmission) and no display name is saved yet. After this, the chosen name is
 * reused silently for every future submission; there's no "change your name" UI yet since
 * nothing has asked for one. */
export function DisplayNamePrompt({ onSubmit }: DisplayNamePromptProps) {
  const [name, setName] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim().slice(0, MAX_NAME_LENGTH);
    if (!trimmed) return;
    onSubmit(trimmed);
  }

  return (
    <form className="leaderboard-name-prompt" onSubmit={handleSubmit}>
      <p className="leaderboard-name-prompt__label">🏆 That qualifies for the leaderboard! Pick a name others will see:</p>
      <div className="leaderboard-name-prompt__row">
        <input
          type="text"
          className="leaderboard-name-prompt__input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_NAME_LENGTH}
          placeholder="Your name"
          autoFocus
        />
        <button type="submit" className="leaderboard-name-prompt__submit" disabled={!name.trim()}>
          Submit score
        </button>
      </div>
    </form>
  );
}
