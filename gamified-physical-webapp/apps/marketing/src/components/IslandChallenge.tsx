import { useState } from "react";
import { useI18n } from "../i18n";
import type { ProjectNode } from "../scene/projects";
import { GameRenderer } from "../games/GameRenderer";
import teamImage from "../images/1 team.png";
import hackathonImage from "../images/2 hackathon tackled topics.png";
import progressImage from "../images/3 hackathon progress.png";

type IslandChallengeProps = {
  project: ProjectNode;
  onAbort: () => void;
  onSuccess: () => void;
};

// Map minigame names to secret content
const SECRET_CONTENT: Record<string, { image: string; title: string; description: string; emoji: string }> = {
  "Tic Tac Toe": {
    image: teamImage,
    title: "🎯 Tým Odhaleno! 🎯",
    description: "Gratulujeme! Neomluvitelné lidské jádro projektu — tvůrci, innovátoři a nadšenci, kteří stojí za revolucí.",
    emoji: "👥✨",
  },
  "Space Invaders": {
    image: hackathonImage,
    title: "🚀 Témata Odhalena! 🚀",
    description: "Skvělá práce! Zde jsou všechny kritické oblasti, kterými se hackathon zabývá — od technologie až po dopad.",
    emoji: "📊🎓",
  },
  "Tetris": {
    image: progressImage,
    title: "📈 Progress Odhalen! 📈",
    description: "Paráda! Tady je snapshot průběhu hackathonu a aktuální stav doručení.",
    emoji: "✅🚁",
  },
};

export function IslandChallenge({ project, onAbort, onSuccess }: IslandChallengeProps) {
  const { messages } = useI18n();
  const [gameWon, setGameWon] = useState(false);
  const [gameLost, setGameLost] = useState(false);

  const secretContent = SECRET_CONTENT[project.minigame.name];

  const handleGameWin = () => {
    setGameWon(true);
  };

  const handleGameLose = () => {
    setGameLost(true);
  };

  const handleRetry = () => {
    setGameWon(false);
    setGameLost(false);
  };

  return (
    <aside className="modal challenge-modal">
      <div className="modal-panel challenge-panel">
        <div className="modal-topline">
          <p className="label">{messages.challenge.label}</p>
          <button type="button" className="ghost-button" onClick={onAbort}>
            {messages.challenge.abort}
          </button>
        </div>

        <div className="challenge-copy">
          <div>
            <p className="project-tag">{project.location}</p>
            <h2>{project.challenge.title}</h2>
            <p>{project.challenge.briefing}</p>
          </div>
          <div className="challenge-stats">
            <article>
              <span>{messages.challenge.difficulty}</span>
              <strong>{messages.challenge.easy}</strong>
            </article>
          </div>
        </div>

        <div className="challenge-game" role="region" aria-label="Game area">
          <GameRenderer
            minigameName={project.minigame.name}
            targetKills={project.challenge.targetKills}
            timeLimitSec={project.challenge.timeLimitSec}
            onWin={handleGameWin}
            onLose={handleGameLose}
          />
        </div>

        {gameWon ? (
          <div className="challenge-result-popup-backdrop" role="dialog" aria-modal="true" aria-label="Challenge solved">
            <div className="challenge-result-popup">
              {secretContent ? (
                <div className="secret-content-reveal">
                  <h3>{secretContent.title}</h3>
                  <img src={secretContent.image} alt="Secret content revealed" className="secret-image" />
                  <p className="secret-description">{secretContent.description}</p>
                  <div className="secret-emoji">{secretContent.emoji}</div>
                </div>
              ) : null}
              <div className="challenge-outcome success">
                <div>
                  <strong>{messages.challenge.successTitle}</strong>
                  <p>{messages.challenge.successBody}</p>
                </div>
                <button type="button" className="primary-button" onClick={onSuccess}>
                  {messages.challenge.successButton}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="challenge-footer">
          <p>{messages.challenge.instructions}</p>

          {gameLost ? (
            <div className="challenge-outcome failure">
              <div>
                <strong>{messages.challenge.failureTitle}</strong>
                <p>{messages.challenge.failureBody}</p>
              </div>
              <button type="button" className="primary-button" onClick={handleRetry}>
                {messages.challenge.retryButton}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
