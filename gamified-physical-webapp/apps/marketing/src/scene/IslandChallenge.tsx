import { useEffect, useMemo, useReducer, useRef } from "react";
import type { ProjectNode } from "./projects";

type Point = { x: number; y: number };
type HostileDrone = Point & { id: number };

type GameState = {
  phase: "playing" | "won" | "lost";
  remainingMs: number;
  tick: number;
  score: number;
  integrity: number;
  nextId: number;
  player: Point;
  hostiles: HostileDrone[];
  empCooldown: number;
  pulseCells: Point[];
};

type GameAction =
  | { type: "step" }
  | { type: "move"; dx: number; dy: number }
  | { type: "emp" }
  | { type: "reset" };

const stepMs = 190;
const width = 9;
const height = 8;
const initialHostiles = 2;

function randomCell(): Point {
  return {
    x: Math.floor(Math.random() * width),
    y: Math.floor(Math.random() * height),
  };
}

function seededHostiles(nextIdStart: number): { hostiles: HostileDrone[]; nextId: number } {
  const hostiles: HostileDrone[] = [];
  let nextId = nextIdStart;
  for (let i = 0; i < initialHostiles; i++) {
    const cell = randomCell();
    hostiles.push({ id: nextId++, ...cell });
  }
  return { hostiles, nextId };
}

function createInitialState(project: ProjectNode): GameState {
  const seeded = seededHostiles(1);
  return {
    phase: "playing",
    remainingMs: project.challenge.timeLimitSec * 1000,
    tick: 0,
    score: 0,
    integrity: 3,
    nextId: seeded.nextId,
    player: { x: Math.floor(width / 2), y: height - 1 },
    hostiles: seeded.hostiles,
    empCooldown: 0,
    pulseCells: [],
  };
}

function clampPoint(point: Point): Point {
  return {
    x: Math.max(0, Math.min(width - 1, point.x)),
    y: Math.max(0, Math.min(height - 1, point.y)),
  };
}

function moveHostile(hostile: HostileDrone, player: Point): HostileDrone {
  const stepTowardX = player.x === hostile.x ? 0 : player.x > hostile.x ? 1 : -1;
  const stepTowardY = player.y === hostile.y ? 0 : player.y > hostile.y ? 1 : -1;

  // Mostly moves toward player, sometimes drifts to keep it readable and simple.
  const bias = Math.random();
  const next =
    bias > 0.72
      ? { ...hostile, x: hostile.x + (Math.random() > 0.5 ? 1 : -1), y: hostile.y }
      : bias > 0.44
        ? { ...hostile, x: hostile.x + stepTowardX, y: hostile.y }
        : { ...hostile, x: hostile.x, y: hostile.y + stepTowardY };

  const clamped = clampPoint(next);
  return { ...hostile, x: clamped.x, y: clamped.y };
}

function reduceStep(game: GameState, project: ProjectNode): GameState {
  const remainingMs = Math.max(0, game.remainingMs - stepMs);
  const tick = game.tick + 1;

  const shouldMoveHostiles = tick % 2 === 0;
  let hostiles = shouldMoveHostiles ? game.hostiles.map((h) => moveHostile(h, game.player)) : game.hostiles;
  let integrity = game.integrity;
  let nextId = game.nextId;

  // Collisions damage integrity and respawn that hostile drone.
  hostiles = hostiles.map((h) => {
    if (h.x === game.player.x && h.y === game.player.y) {
      integrity = Math.max(0, integrity - 1);
      const spawned = randomCell();
      return { id: nextId++, ...spawned };
    }
    return h;
  });

  // Keep pressure by occasionally injecting a new hostile.
  if (tick % 20 === 0 && hostiles.length < 4) {
    const spawned = randomCell();
    hostiles.push({ id: nextId++, ...spawned });
  }

  const empCooldown = Math.max(0, game.empCooldown - 1);
  const pulseCells = game.pulseCells.length > 0 ? [] : game.pulseCells;

  if (game.score >= project.challenge.targetKills) {
    return { ...game, phase: "won" };
  }

  if (integrity <= 0 || remainingMs === 0) {
    return {
      ...game,
      phase: "lost",
      hostiles,
      integrity,
      remainingMs,
      tick,
      nextId,
      empCooldown,
      pulseCells,
    };
  }

  return {
    ...game,
    hostiles,
    integrity,
    remainingMs,
    tick,
    nextId,
    empCooldown,
    pulseCells,
  };
}

function reduceEmp(game: GameState, project: ProjectNode): GameState {
  if (game.phase !== "playing" || game.empCooldown > 0) {
    return game;
  }

  const pulseRadius = 1;
  const hits = new Set<number>();
  const pulseCells: Point[] = [];

  for (let y = game.player.y - pulseRadius; y <= game.player.y + pulseRadius; y++) {
    for (let x = game.player.x - pulseRadius; x <= game.player.x + pulseRadius; x++) {
      if (x >= 0 && x < width && y >= 0 && y < height) {
        pulseCells.push({ x, y });
      }
    }
  }

  for (const hostile of game.hostiles) {
    const distance = Math.abs(hostile.x - game.player.x) + Math.abs(hostile.y - game.player.y);
    if (distance <= pulseRadius + 1) {
      hits.add(hostile.id);
    }
  }

  let nextId = game.nextId;
  const remaining = game.hostiles.filter((h) => !hits.has(h.id));

  // Respawn disabled drones elsewhere so challenge remains active.
  for (let i = 0; i < hits.size; i++) {
    const spawned = randomCell();
    remaining.push({ id: nextId++, ...spawned });
  }

  const score = game.score + hits.size;
  if (score >= project.challenge.targetKills) {
    return {
      ...game,
      score,
      hostiles: remaining,
      pulseCells,
      nextId,
      empCooldown: 4,
      phase: "won",
    };
  }

  return {
    ...game,
    score,
    hostiles: remaining,
    pulseCells,
    nextId,
    empCooldown: 4,
  };
}

function gameReducer(game: GameState, action: GameAction, project: ProjectNode): GameState {
  switch (action.type) {
    case "step":
      return reduceStep(game, project);
    case "move": {
      if (game.phase !== "playing") {
        return game;
      }
      const nextPlayer = clampPoint({
        x: game.player.x + action.dx,
        y: game.player.y + action.dy,
      });
      return { ...game, player: nextPlayer };
    }
    case "emp":
      return reduceEmp(game, project);
    case "reset":
      return createInitialState(project);
    default:
      return game;
  }
}

export function IslandChallenge({
  project,
  onSuccess,
  onAbort,
}: {
  project: ProjectNode;
  onSuccess: () => void;
  onAbort: () => void;
}) {
  const [game, dispatch] = useReducer(
    (state: GameState, action: GameAction) => gameReducer(state, action, project),
    project,
    (p: ProjectNode) => createInitialState(p)
  );

  const gameIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const key = e.key;
      if (key === "ArrowLeft" || key === "ArrowRight" || key === "ArrowUp" || key === "ArrowDown" || key === " ") {
        e.preventDefault();
        e.stopPropagation();
      }

      if (key === "ArrowLeft") dispatch({ type: "move", dx: -1, dy: 0 });
      if (key === "ArrowRight") dispatch({ type: "move", dx: 1, dy: 0 });
      if (key === "ArrowUp") dispatch({ type: "move", dx: 0, dy: -1 });
      if (key === "ArrowDown") dispatch({ type: "move", dx: 0, dy: 1 });
      if (e.key === " ") {
        dispatch({ type: "emp" });
      }
      if (e.key === "Escape") onAbort();
    }

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [onAbort]);

  useEffect(() => {
    gameIntervalRef.current = window.setInterval(() => {
      dispatch({ type: "step" });
    }, stepMs);

    return () => {
      if (gameIntervalRef.current) {
        window.clearInterval(gameIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (game.phase === "won") {
      onSuccess();
    }
  }, [game.phase, onSuccess]);

  const gridCells = useMemo(() => {
    const hostileAt = new Set(game.hostiles.map((h) => `${h.x}:${h.y}`));
    const pulseAt = new Set(game.pulseCells.map((p) => `${p.x}:${p.y}`));
    const cells: Array<{ id: string; entity?: "player" | "hostile" | "pulse" }> = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const id = `${x}:${y}`;
        let entity: "player" | "hostile" | "pulse" | undefined;
        if (game.player.x === x && game.player.y === y) {
          entity = "player";
        } else if (hostileAt.has(id)) {
          entity = "hostile";
        } else if (pulseAt.has(id)) {
          entity = "pulse";
        }
        cells.push({ id, entity });
      }
    }

    return cells;
  }, [game.hostiles, game.player.x, game.player.y, game.pulseCells]);

  const remainingSeconds = Math.ceil(game.remainingMs / 1000);

  return (
    <div className="challenge-panel" tabIndex={-1}>
      <div className="challenge-header">
        <h2>Drone Intercept Grid</h2>
        <p className="challenge-briefing">
          Pilot the recon drone with arrows. Press Space to trigger EMP and disable hostile drones. Easy mode: slow hostile swarm.
        </p>
      </div>

      <div className="challenge-stats">
        <div className="challenge-stat">
          <span className="challenge-stat-label">Disabled</span>
          <span className="challenge-stat-value">
            {game.score}/{project.challenge.targetKills}
          </span>
        </div>
        <div className="challenge-stat">
          <span className="challenge-stat-label">Integrity</span>
          <span className="challenge-stat-value">{game.integrity}</span>
        </div>
        <div className="challenge-stat">
          <span className="challenge-stat-label">EMP</span>
          <span className="challenge-stat-value">{game.empCooldown === 0 ? "READY" : `${game.empCooldown}`}</span>
        </div>
        <div className="challenge-stat">
          <span className="challenge-stat-label">Time</span>
          <span className="challenge-stat-value">{remainingSeconds}s</span>
        </div>
      </div>

      <div className="challenge-grid challenge-grid-drone">
        {gridCells.map((cell) => (
          <div key={cell.id} className={`challenge-cell ${cell.entity || ""}`}>
            {cell.entity === "player" ? "D" : cell.entity === "hostile" ? "X" : cell.entity === "pulse" ? "*" : ""}
          </div>
        ))}
      </div>

      <div className="challenge-copy">
        <p>
          <strong>Controls:</strong> Arrow keys to move, Space for EMP burst, Esc to abort.
        </p>
      </div>

      {game.phase !== "playing" && (
        <div className={`challenge-outcome ${game.phase}`}>
          {game.phase === "won" ? "Dossier unlocked" : "Mission failed"}
        </div>
      )}

      <div className="challenge-footer">
        {game.phase === "lost" && (
          <>
            <button className="primary-button" onClick={() => dispatch({ type: "reset" })}>
              Retry Challenge
            </button>
            <button className="ghost-button" onClick={onAbort}>
              Abort
            </button>
          </>
        )}
      </div>
    </div>
  );
}
