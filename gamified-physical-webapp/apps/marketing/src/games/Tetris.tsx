import { useEffect, useMemo, useReducer, useRef } from "react";
import "./Tetris.css";

type TetrisProps = {
  onWin: () => void;
  onLose: () => void;
};

type Shape = number[][];

type Piece = {
  x: number;
  y: number;
  shape: Shape;
  color: string;
};

type Grid = (string | null)[][];

const GRID_WIDTH = 10;
const GRID_HEIGHT = 20;
const WIN_LINES = 5;
const TICK_MS = 400;

const PIECES: { shape: Shape; color: string }[] = [
  { shape: [[1, 1, 1, 1]], color: "#7bcfff" },
  { shape: [[1, 1], [1, 1]], color: "#ffff00" },
  { shape: [[0, 1, 0], [1, 1, 1]], color: "#ff00ff" },
  { shape: [[1, 0, 0], [1, 1, 1]], color: "#ffaa00" },
  { shape: [[0, 0, 1], [1, 1, 1]], color: "#00ff41" },
  { shape: [[0, 1, 1], [1, 1, 0]], color: "#00ff41" },
  { shape: [[1, 1, 0], [0, 1, 1]], color: "#ff3b3b" },
];

type GameState = {
  grid: Grid;
  current: Piece | null;
  lines: number;
  phase: "playing" | "won" | "lost";
};

type Action =
  | { type: "spawn"; piece: Piece }
  | { type: "tick"; fastDrop: boolean }
  | { type: "move_left" }
  | { type: "move_right" }
  | { type: "rotate" };

function emptyGrid(): Grid {
  return Array(GRID_HEIGHT).fill(null).map(() => Array(GRID_WIDTH).fill(null));
}

function randomPiece(): Piece {
  const p = PIECES[Math.floor(Math.random() * PIECES.length)];
  return {
    shape: p.shape.map((r) => [...r]),
    color: p.color,
    x: Math.floor(GRID_WIDTH / 2) - Math.floor(p.shape[0].length / 2),
    y: 0,
  };
}

function canPlace(grid: Grid, piece: Piece, dx = 0, dy = 0, shape?: Shape): boolean {
  const s = shape ?? piece.shape;
  for (let r = 0; r < s.length; r++) {
    for (let c = 0; c < s[r].length; c++) {
      if (!s[r][c]) continue;
      const nx = piece.x + c + dx;
      const ny = piece.y + r + dy;
      if (nx < 0 || nx >= GRID_WIDTH || ny >= GRID_HEIGHT) return false;
      if (ny >= 0 && grid[ny][nx]) return false;
    }
  }
  return true;
}

function rotateCW(shape: Shape): Shape {
  const rows = shape.length;
  const cols = shape[0].length;
  const rotated: Shape = Array(cols).fill(null).map(() => Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      rotated[c][rows - 1 - r] = shape[r][c];
  return rotated;
}

function placePiece(grid: Grid, piece: Piece): Grid {
  const newGrid = grid.map((r) => [...r]);
  for (let r = 0; r < piece.shape.length; r++)
    for (let c = 0; c < piece.shape[r].length; c++)
      if (piece.shape[r][c] && piece.y + r >= 0)
        newGrid[piece.y + r][piece.x + c] = piece.color;
  return newGrid;
}

function clearFullLines(grid: Grid): [Grid, number] {
  const remaining = grid.filter((row) => row.some((cell) => cell === null));
  const cleared = GRID_HEIGHT - remaining.length;
  const newGrid = [
    ...Array(cleared).fill(null).map(() => Array(GRID_WIDTH).fill(null)),
    ...remaining,
  ];
  return [newGrid, cleared];
}

function reducer(state: GameState, action: Action): GameState {
  if (state.phase !== "playing") return state;
  switch (action.type) {
    case "spawn": {
      if (!canPlace(state.grid, action.piece)) {
        return { ...state, phase: "lost" };
      }
      return { ...state, current: action.piece };
    }
    case "tick": {
      if (!state.current) return state;
      const dy = action.fastDrop ? 2 : 1;
      if (canPlace(state.grid, state.current, 0, dy)) {
        return { ...state, current: { ...state.current, y: state.current.y + dy } };
      }
      if (action.fastDrop && canPlace(state.grid, state.current, 0, 1)) {
        return { ...state, current: { ...state.current, y: state.current.y + 1 } };
      }
      // Freeze
      const frozen = placePiece(state.grid, state.current);
      const [clearedGrid, cleared] = clearFullLines(frozen);
      const newLines = state.lines + cleared;
      if (newLines >= WIN_LINES) {
        return { grid: clearedGrid, current: null, lines: newLines, phase: "won" };
      }
      return { grid: clearedGrid, current: null, lines: newLines, phase: "playing" };
    }
    case "move_left": {
      if (!state.current || !canPlace(state.grid, state.current, -1, 0)) return state;
      return { ...state, current: { ...state.current, x: state.current.x - 1 } };
    }
    case "move_right": {
      if (!state.current || !canPlace(state.grid, state.current, 1, 0)) return state;
      return { ...state, current: { ...state.current, x: state.current.x + 1 } };
    }
    case "rotate": {
      if (!state.current) return state;
      const rotated = rotateCW(state.current.shape);
      if (canPlace(state.grid, state.current, 0, 0, rotated))
        return { ...state, current: { ...state.current, shape: rotated } };
      if (canPlace(state.grid, state.current, 1, 0, rotated))
        return { ...state, current: { ...state.current, x: state.current.x + 1, shape: rotated } };
      if (canPlace(state.grid, state.current, -1, 0, rotated))
        return { ...state, current: { ...state.current, x: state.current.x - 1, shape: rotated } };
      return state;
    }
    default:
      return state;
  }
}

export function Tetris({ onWin, onLose }: TetrisProps) {
  const [state, dispatch] = useReducer(reducer, {
    grid: emptyGrid(),
    current: null,
    lines: 0,
    phase: "playing",
  });
  const keysPressed = useRef<Set<string>>(new Set());
  const phaseRef = useRef(state.phase);
  phaseRef.current = state.phase;

  // Spawn a new piece whenever current is null
  useEffect(() => {
    if (state.phase === "playing" && !state.current) {
      dispatch({ type: "spawn", piece: randomPiece() });
    }
  }, [state.current, state.phase]);

  // Game loop - single interval, no stale closures because dispatch is stable
  useEffect(() => {
    const interval = setInterval(() => {
      if (phaseRef.current !== "playing") return;
      dispatch({ type: "tick", fastDrop: keysPressed.current.has("ArrowDown") });
    }, TICK_MS);
    return () => clearInterval(interval);
  }, []);

  // Win / lose callbacks
  useEffect(() => {
    if (state.phase === "won") setTimeout(onWin, 300);
    if (state.phase === "lost") setTimeout(onLose, 300);
  }, [state.phase, onWin, onLose]);

  // Keyboard input
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keysPressed.current.add(e.key);
      if (e.key === "ArrowLeft") { e.preventDefault(); dispatch({ type: "move_left" }); }
      if (e.key === "ArrowRight") { e.preventDefault(); dispatch({ type: "move_right" }); }
      if (e.key === "ArrowUp") { e.preventDefault(); dispatch({ type: "rotate" }); }
      if (e.key === "ArrowDown") e.preventDefault();
    };
    const up = (e: KeyboardEvent) => keysPressed.current.delete(e.key);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  const displayGrid = useMemo(() => {
    const g = state.grid.map((r) => [...r]);
    if (state.current) {
      for (let r = 0; r < state.current.shape.length; r++)
        for (let c = 0; c < state.current.shape[r].length; c++)
          if (state.current.shape[r][c]) {
            const y = state.current.y + r;
            const x = state.current.x + c;
            if (y >= 0 && y < GRID_HEIGHT && x >= 0 && x < GRID_WIDTH) g[y][x] = state.current.color;
          }
    }
    return g;
  }, [state.grid, state.current]);

  return (
    <div className="tetris-container">
      <div className="tetris-header">
        <h2>Tetris</h2>
        <p className="tetris-description">Clear 5 rows to win! · ↑ Rotate · ↓ Fast drop · ← → Move</p>
      </div>
      <div className="tetris-content">
        <div className="tetris-board">
          {displayGrid.map((row, y) => (
            <div key={y} className="tetris-row">
              {row.map((cell, x) => (
                <div
                  key={`${y}-${x}`}
                  className="tetris-cell"
                  style={{ backgroundColor: cell || "transparent" }}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="tetris-info">
          <div className="tetris-stat">
            <span>Rows</span>
            <span>{state.lines}/{WIN_LINES}</span>
          </div>
          <div className="tetris-progress">
            <div className="tetris-progress-bar" style={{ width: `${(state.lines / WIN_LINES) * 100}%` }} />
          </div>
          {state.phase === "won" && <div className="tetris-gameover"><p>Victory! 🎉</p></div>}
          {state.phase === "lost" && <div className="tetris-gameover"><p>Game Over!</p></div>}
        </div>
      </div>
    </div>
  );
}
