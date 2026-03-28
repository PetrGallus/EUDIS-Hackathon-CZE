import { useEffect, useMemo, useState } from "react";
import "./SpaceInvaders.css";

type SpaceInvadersProps = {
  targetKills: number;
  timeLimitSec: number;
  onWin: () => void;
  onLose: () => void;
};

type ChallengePhase = "playing" | "won" | "lost";

type Enemy = {
  id: number;
  lane: number;
  row: number;
};

type Shot = {
  id: number;
  lane: number;
  row: number;
};

type GameState = {
  playerLane: number;
  enemies: Enemy[];
  shots: Shot[];
  kills: number;
  remainingMs: number;
  tick: number;
  nextId: number;
  phase: ChallengePhase;
};

const laneCount = 8;
const rowCount = 9;
const stepMs = 350;

function createInitialState(targetKills: number, timeLimitSec: number): GameState {
  return {
    playerLane: Math.floor(laneCount / 2),
    enemies: [],
    shots: [],
    kills: 0,
    remainingMs: timeLimitSec * 1000,
    tick: 0,
    nextId: 1,
    phase: "playing",
  };
}

function fireShot(game: GameState): GameState {
  if (game.phase !== "playing") {
    return game;
  }

  const alreadyInLane = game.shots.some((shot) => shot.lane === game.playerLane && shot.row >= rowCount - 3);
  if (alreadyInLane) {
    return game;
  }

  return {
    ...game,
    shots: [...game.shots, { id: game.nextId, lane: game.playerLane, row: rowCount - 2 }],
    nextId: game.nextId + 1,
  };
}

function movePlayerLeft(game: GameState): GameState {
  return { ...game, playerLane: Math.max(0, game.playerLane - 1) };
}

function movePlayerRight(game: GameState): GameState {
  return { ...game, playerLane: Math.min(laneCount - 1, game.playerLane + 1) };
}

function updateGameState(game: GameState, targetKills: number): GameState {
  if (game.phase !== "playing") {
    return game;
  }

  let updated = { ...game };

  // Spawn enemies
  if (Math.random() < 0.15) {
    updated = {
      ...updated,
      enemies: [...updated.enemies, { id: updated.nextId, lane: Math.floor(Math.random() * laneCount), row: 0 }],
      nextId: updated.nextId + 1,
    };
  }

  // Move enemies
  updated = {
    ...updated,
    enemies: updated.enemies.map((e) => ({ ...e, row: e.row + 1 })).filter((e) => e.row < rowCount),
  };

  // Move shots
  updated = {
    ...updated,
    shots: updated.shots.map((s) => ({ ...s, row: s.row - 1 })).filter((s) => s.row >= 0),
  };

  // Check collisions
  const shotsToRemove = new Set<number>();
  const enemiesToRemove = new Set<number>();
  updated.shots.forEach((shot) => {
    updated.enemies.forEach((enemy) => {
      if (shot.lane === enemy.lane && Math.abs(shot.row - enemy.row) < 1) {
        shotsToRemove.add(shot.id);
        enemiesToRemove.add(enemy.id);
      }
    });
  });

  updated = {
    ...updated,
    shots: updated.shots.filter((s) => !shotsToRemove.has(s.id)),
    enemies: updated.enemies.filter((e) => !enemiesToRemove.has(e.id)),
    kills: updated.kills + enemiesToRemove.size,
  };

  // Check lose condition
  if (updated.enemies.some((e) => e.row >= rowCount - 1)) {
    updated = { ...updated, phase: "lost" };
  }

  // Check win condition
  if (updated.kills >= targetKills && updated.remainingMs > 0) {
    updated = { ...updated, phase: "won" };
  } else if (updated.remainingMs <= 0) {
    updated = { ...updated, phase: "lost" };
  }

  return updated;
}

export function SpaceInvaders({ targetKills, timeLimitSec, onWin, onLose }: SpaceInvadersProps) {
  const [game, setGame] = useState(() => createInitialState(targetKills, timeLimitSec));
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      setPressedKeys((prev) => new Set(prev).add(e.key));
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      setPressedKeys((prev) => {
        const next = new Set(prev);
        next.delete(e.key);
        return next;
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useEffect(() => {
    if (game.phase !== "playing") {
      if (game.phase === "won") {
        onWin();
      } else if (game.phase === "lost") {
        onLose();
      }
    }
  }, [game.phase, onWin, onLose]);

  useEffect(() => {
    const interval = setInterval(() => {
      setGame((prev) => {
        let updated = updateGameState(prev, targetKills);

        if (pressedKeys.has("ArrowLeft") || pressedKeys.has("a")) {
          updated = movePlayerLeft(updated);
        }
        if (pressedKeys.has("ArrowRight") || pressedKeys.has("d")) {
          updated = movePlayerRight(updated);
        }
        if (pressedKeys.has(" ")) {
          updated = fireShot(updated);
        }

        return { ...updated, remainingMs: Math.max(0, updated.remainingMs - stepMs), tick: updated.tick + 1 };
      });
    }, stepMs);

    return () => clearInterval(interval);
  }, [pressedKeys, targetKills]);

  const gridCells: (string | number | null)[][] = Array(rowCount)
    .fill(null)
    .map(() => Array(laneCount).fill(null));

  game.enemies.forEach((enemy) => {
    if (enemy.row >= 0 && enemy.row < rowCount && enemy.lane >= 0 && enemy.lane < laneCount) {
      gridCells[enemy.row][enemy.lane] = "E";
    }
  });

  game.shots.forEach((shot) => {
    if (shot.row >= 0 && shot.row < rowCount && shot.lane >= 0 && shot.lane < laneCount) {
      gridCells[shot.row][shot.lane] = "S";
    }
  });

  gridCells[rowCount - 1][game.playerLane] = "P";

  const timeoutClass = game.remainingMs < 5000 ? "timeout-warning" : "";

  return (
    <div className="space-invaders-container">
      <div className="space-invaders-header">
        <h2>Space Invaders</h2>
        <p className="space-invaders-description">Win once to unlock hackathon topics! 🚀 Destroy {targetKills} enemies within {timeLimitSec}s.</p>
      </div>
      <div className={`space-invaders-hud ${timeoutClass}`}>
        <div className="hud-stat">
          <span className="label">Kills</span>
          <span className="value">
            {game.kills}/{targetKills}
          </span>
        </div>
        <div className="hud-stat">
          <span className="label">Time</span>
          <span className="value">{Math.ceil(game.remainingMs / 1000)}s</span>
        </div>
      </div>

      <div className="space-invaders-board">
        {gridCells.map((row, rowIndex) => (
          <div key={rowIndex} className="game-row">
            {row.map((cell, colIndex) => {
              let cellClass = "game-cell";
              if (cell === "E") cellClass += " enemy";
              if (cell === "S") cellClass += " shot";
              if (cell === "P") cellClass += " player";
              return <div key={`${rowIndex}-${colIndex}`} className={cellClass} />;
            })}
          </div>
        ))}
      </div>

      {game.phase === "won" && <div className="game-overlay won">Victory!</div>}
      {game.phase === "lost" && <div className="game-overlay lost">Game Over!</div>}
    </div>
  );
}
