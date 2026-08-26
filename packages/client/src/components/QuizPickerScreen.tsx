interface QuizPickerScreenProps {
  onCountries: () => void;
  onUsStates: () => void;
  onWaterBodies: () => void;
  onBack: () => void;
}

/** "Start a quiz" used to fan out into three separate, easy-to-miss home-screen buttons (Start a
 * quiz / Seas & oceans / US states) — scattered enough that the two newer quizzes needed
 * scrolling to even find. One entry point now, with the three quiz universes as tabs here
 * instead, each just navigating on to its own existing setup screen (SetupScreen /
 * UsStatesQuizScreen / WaterBodyQuizScreen) — this screen doesn't own any quiz state itself,
 * it's purely "which universe do you want," same spirit as MasteryScreen's universe picker. */
export function QuizPickerScreen({ onCountries, onUsStates, onWaterBodies, onBack }: QuizPickerScreenProps) {
  return (
    <div className="start-screen">
      <div className="start-screen__card">
        <button type="button" className="back-link" onClick={onBack}>
          ‹ Back
        </button>
        <h1>📝 Start a quiz</h1>
        <p className="start-screen__subtitle">Which one do you want to be quizzed on?</p>

        <div className="home-screen__choices">
          <button type="button" className="home-screen__choice" onClick={onCountries}>
            <span className="home-screen__choice-emoji">🌍</span>
            <span className="home-screen__choice-title">Countries</span>
            <span className="home-screen__choice-sub">Find it on the map, or type its name — untimed, either way.</span>
          </button>
          <button type="button" className="home-screen__choice" onClick={onUsStates}>
            <span className="home-screen__choice-emoji">🇺🇸</span>
            <span className="home-screen__choice-title">US states</span>
            <span className="home-screen__choice-sub">All 50 states — names, capitals, and flags.</span>
          </button>
          <button type="button" className="home-screen__choice" onClick={onWaterBodies}>
            <span className="home-screen__choice-emoji">🌊</span>
            <span className="home-screen__choice-title">Seas &amp; oceans</span>
            <span className="home-screen__choice-sub">Find the 5 oceans and the world's major seas.</span>
          </button>
        </div>
      </div>
    </div>
  );
}
