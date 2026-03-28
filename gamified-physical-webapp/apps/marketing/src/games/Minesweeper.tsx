import { useState, useEffect } from "react";
import "./Minesweeper.css";

type MinesweeperProps = {
  onWin: () => void;
  onLose: () => void;
};

type Cell = {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  adjacent: number;
};

const GRID_SIZE = 8;
const MINES = 10;

export function Minesweeper({ onWin, onLose }: MinesweeperProps) {
  const [grid, setGrid] = useState<Cell[][]>(() => initializeGrid());
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [flagCount, setFlagCount] = useState(0);

  function initializeGrid(): Cell[][] {
    const g: Cell[][] = Array(GRID_SIZE)
      .fill(null)
      .map(() =>
        Array(GRID_SIZE)
          .fill(null)
          .map(() => ({ mine: false, revealed: false, flagged: false, adjacent: 0 }))
      );

    let minesPlaced = 0;
    while (minesPlaced < MINES) {
      const row = Math.floor(Math.random() * GRID_SIZE);
      const col = Math.floor(Math.random() * GRID_SIZE);
      if (!g[row][col].mine) {
        g[row][col].mine = true;
        minesPlaced++;
      }
    }

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (!g[r][c].mine) {
          let count = 0;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const nr = r + dr;
              const nc = c + dc;
              if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE && g[nr][nc].mine) {
                count++;
              }
            }
          }
          g[r][c].adjacent = count;
        }
      }
    }

    return g;
  }

  const revealCell = (row: number, col: number) => {
    if (gameOver || won) return;

    const newGrid = grid.map((r) => [...r]);
    const cell = newGrid[row][col];

    if (cell.flagged || cell.revealed) return;

    if (cell.mine) {
      cell.revealed = true;
      setGrid(newGrid);
      setGameOver(true);
      setTimeout(onLose, 500);
      return;
    }

    const reveal = (r: number, c: number) => {
      if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) return;
      const cl = newGrid[r][c];
      if (cl.revealed || cl.flagged) return;
      cl.revealed = true;
      if (cl.adjacent === 0 && !cl.mine) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            reveal(r + dr, c + dc);
          }
        }
      }
    };

    reveal(row, col);
    setGrid(newGrid);

    // Check win condition
    let revealed = 0;
    let total = 0;
    for (let i = 0; i < GRID_SIZE; i++) {
      for (let j = 0; j < GRID_SIZE; j++) {
        total++;
        if (newGrid[i][j].revealed && !newGrid[i][j].mine) {
          revealed++;
        }
      }
    }

    if (revealed === total - MINES) {
      setWon(true);
      setTimeout(onWin, 500);
    }
  };

  const toggleFlag = (row: number, col: number, e: React.MouseEvent) => {
    e.preventDefault();
    if (gameOver || won) return;

    const newGrid = grid.map((r) => [...r]);
    const cell = newGrid[row][col];

    if (cell.revealed) return;

    if (cell.flagged) {
      cell.flagged = false;
      setFlagCount(flagCount - 1);
    } else {
      cell.flagged = true;
      setFlagCount(flagCount + 1);
    }

    setGrid(newGrid);
  };

  return (
    <div className="minesweeper-container">
      <div className="minesweeper-header">
        <h2>Minesweeper</h2>
        <p className="minesweeper-description">Reveal all safe cells to win! Click to reveal, right-click to flag.</p>
      </div>
      <div className="minesweeper-stats">
        <span>Mines: {MINES}</span>
        <span>Flagged: {flagCount}</span>
      </div>
      <div className="minesweeper-board">
        {grid.map((row, r) => (
          <div key={r} className="minesweeper-row">
            {row.map((cell, c) => (
              <button
                key={`${r}-${c}`}
                className={`minesweeper-cell ${cell.revealed ? "revealed" : ""} ${
                  cell.flagged ? "flagged" : ""
                } ${cell.mine && cell.revealed ? "mine-hit" : ""}`}
                onClick={() => revealCell(r, c)}
                onContextMenu={(e) => toggleFlag(r, c, e)}
              >
                {cell.flagged ? "🚩" : cell.revealed && cell.mine ? "💣" : cell.revealed && cell.adjacent > 0 ? cell.adjacent : ""}
              </button>
            ))}
          </div>
        ))}
      </div>
      {gameOver && !won && <div className="minesweeper-gameover">Game Over!</div>}
      {won && <div className="minesweeper-won">You Won!</div>}
    </div>
  );
}
