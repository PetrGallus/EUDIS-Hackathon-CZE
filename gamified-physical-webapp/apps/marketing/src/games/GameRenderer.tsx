import type { ProjectNode } from "../scene/projects";
import { TicTacToe } from "./TicTacToe";
import { SpaceInvaders } from "./SpaceInvaders";
import { Tetris } from "./Tetris";
import { Minesweeper } from "./Minesweeper";
import { Pong } from "./Pong";

type GameRendererProps = {
  minigameName: string;
  targetKills?: number;
  timeLimitSec?: number;
  onWin: () => void;
  onLose: () => void;
};

export function GameRenderer({ minigameName, targetKills = 5, timeLimitSec = 20, onWin, onLose }: GameRendererProps) {
  const gameLower = minigameName.toLowerCase();

  if (gameLower.includes("tic tac toe")) {
    return <TicTacToe onWin={onWin} onLose={onLose} />;
  } else if (gameLower.includes("space invaders")) {
    return <SpaceInvaders targetKills={targetKills} timeLimitSec={timeLimitSec} onWin={onWin} onLose={onLose} />;
  } else if (gameLower.includes("tetris")) {
    return <Tetris onWin={onWin} onLose={onLose} />;
  } else if (gameLower.includes("minesweeper")) {
    return <Minesweeper onWin={onWin} onLose={onLose} />;
  } else if (gameLower.includes("pong")) {
    return <Pong onWin={onWin} onLose={onLose} />;
  }

  return <div className="game-error">Unknown game: {minigameName}</div>;
}
