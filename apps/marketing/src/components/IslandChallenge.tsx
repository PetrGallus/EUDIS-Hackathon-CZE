import { useEffect, useMemo, useState } from "react";
import type { ProjectNode } from "../scene/projects";

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

type IslandChallengeProps = {
  project: ProjectNode;
  onAbort: () => void;
  onSuccess: () => void;
};

const laneCount = 8;
const rowCount = 9;
const stepMs = 150;

function createInitialState(project: ProjectNode): GameState {
  return {
    playerLane: Math.floor(laneCount / 2),
    enemies: [],
    shots: [],
    kills: 0,
    remainingMs: project.challenge.timeLimitSec * 1000,
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

function stepGame(game: GameState, project: ProjectNode): GameState {
  if (game.phase !== "playing") {
    return game;
  }

  const tick = game.tick + 1;
  const remainingMs = Math.max(0, game.remainingMs - stepMs);
  const moveEnemies = tick % 5 === 0;
  const spawnEnemy = tick % 6 === 0 && Math.random() > 0.32;

  const movedShots = game.shots
    .map((shot) => ({ ...shot, row: shot.row - 1 }))
    .filter((shot) => shot.row >= 0);

  const movedEnemies = game.enemies.map((enemy) => ({
    ...enemy,
    row: moveEnemies ? enemy.row + 1 : enemy.row,
  }));

  const hits = new Set<number>();
  const spentShots = new Set<number>();

  for (const shot of movedShots) {
    const hitEnemy = movedEnemies.find((enemy) => enemy.lane === shot.lane && Math.abs(enemy.row - shot.row) <= 1);
    if (hitEnemy) {
      hits.add(hitEnemy.id);
      spentShots.add(shot.id);
    }
  }

  let enemies = movedEnemies.filter((enemy) => !hits.has(enemy.id));
  let shots = movedShots.filter((shot) => !spentShots.has(shot.id));
  let nextId = game.nextId;
  const kills = game.kills + hits.size;

  if (spawnEnemy) {
    enemies = [...enemies, { id: nextId, lane: Math.floor(Math.random() * laneCount), row: 0 }];
    nextId += 1;
  }

  if (kills >= project.challenge.targetKills) {
    return { ...game, enemies, shots, kills, remainingMs, tick, nextId, phase: "won" };
  }

  const enemyBreach = enemies.some((enemy) => enemy.row >= rowCount - 1);
  if (enemyBreach || remainingMs === 0) {
    return { ...game, enemies, shots, kills, remainingMs, tick, nextId, phase: "lost" };
  }

  return { ...game, enemies, shots, kills, remainingMs, tick, nextId };
}

export function IslandChallenge({ project, onAbort, onSuccess }: IslandChallengeProps) {
  const [game, setGame] = useState<GameState>(() => createInitialState(project));

  useEffect(() => {
    setGame(createInitialState(project));
  }, [project]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "a", "d", "A", "D", " ", "Escape"].includes(event.key)) {
        event.preventDefault();
      }

      if (event.key === "Escape") {
        onAbort();
        return;
      }

      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        setGame((current) => ({
          ...current,
          playerLane: Math.max(0, current.playerLane - 1),
        }));
      }

      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        setGame((current) => ({
          ...current,
          playerLane: Math.min(laneCount - 1, current.playerLane + 1),
        }));
      }

      if (event.key === " ") {
        setGame((current) => fireShot(current));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onAbort]);

  useEffect(() => {
    if (game.phase !== "playing") {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setGame((current) => stepGame(current, project));
    }, stepMs);

    return () => window.clearInterval(intervalId);
  }, [game.phase, project]);

  const cells = useMemo(() => {
    const rendered = [] as Array<{ key: string; className: string; glyph: string }>;

    for (let row = 0; row < rowCount; row += 1) {
      for (let lane = 0; lane < laneCount; lane += 1) {
        const enemy = game.enemies.find((item) => item.lane === lane && item.row === row);
        const shot = game.shots.find((item) => item.lane === lane && item.row === row);
        const player = row === rowCount - 1 && game.playerLane === lane;

        let className = "challenge-cell";
        let glyph = "";

        if (enemy) {
          className += " enemy";
          glyph = "S";
        } else if (shot) {
          className += " shot";
          glyph = "|";
        } else if (player) {
          className += " player";
          glyph = "A";
        }

        rendered.push({ key: `${row}-${lane}`, className, glyph });
      }
    }

    return rendered;
  }, [game.enemies, game.playerLane, game.shots]);

  return (
    <aside className="modal challenge-modal">
      <div className="modal-panel challenge-panel">
        <div className="modal-topline">
          <p className="label">16-bit intercept challenge</p>
          <button type="button" className="ghost-button" onClick={onAbort}>
            Abort
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
              <span>Timer</span>
              <strong>{Math.ceil(game.remainingMs / 1000)}s</strong>
            </article>
            <article>
              <span>Kills</span>
              <strong>{game.kills} / {project.challenge.targetKills}</strong>
            </article>
            <article>
              <span>Difficulty</span>
              <strong>Easy</strong>
            </article>
          </div>
        </div>

        <div className="challenge-grid" role="img" aria-label="Retro intercept challenge grid">
          {cells.map((cell) => (
            <div key={cell.key} className={cell.className}>
              {cell.glyph}
            </div>
          ))}
        </div>

        <div className="challenge-footer">
          <p>Move with A/D or arrow keys. Press Space to fire. Stop the incoming Shaheds before they breach the last row.</p>

          {game.phase === "won" ? (
            <div className="challenge-outcome success">
              <div>
                <strong>Sector secure.</strong>
                <p>The island dossier is unlocked.</p>
              </div>
              <button type="button" className="primary-button" onClick={onSuccess}>
                Open dossier
              </button>
            </div>
          ) : null}

          {game.phase === "lost" ? (
            <div className="challenge-outcome failure">
              <div>
                <strong>Sector lost.</strong>
                <p>Retry the easy intercept to reveal the island content.</p>
              </div>
              <button type="button" className="primary-button" onClick={() => setGame(createInitialState(project))}>
                Retry challenge
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
