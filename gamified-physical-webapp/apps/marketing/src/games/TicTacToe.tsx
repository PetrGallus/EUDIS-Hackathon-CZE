import { useEffect, useState } from "react";
import "./TicTacToe.css";

type TicTacToeProps = {
  onWin: () => void;
  onLose: () => void;
};

type CellValue = "X" | "O" | null;

export function TicTacToe({ onWin, onLose }: TicTacToeProps) {
  const [board, setBoard] = useState<CellValue[]>(Array(9).fill(null));
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<CellValue>(null);
  const [isAITurn, setIsAITurn] = useState(false);

  const calculateWinner = (cells: CellValue[]): CellValue => {
    const lines = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
    ];
    for (let i = 0; i < lines.length; i++) {
      const [a, b, c] = lines[i];
      if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) {
        return cells[a];
      }
    }
    return null;
  };

  const makeAIMove = (currentBoard: CellValue[]) => {
    const availableMoves = currentBoard
      .map((cell, idx) => (cell === null ? idx : null))
      .filter((idx) => idx !== null) as number[];

    if (availableMoves.length === 0) return;

    // 70% chance: just play random (easy AI)
    if (Math.random() < 0.7) {
      const move = availableMoves[Math.floor(Math.random() * availableMoves.length)];
      performMove(currentBoard, move, "O");
      return;
    }

    // 30% chance: block player if they are about to win
    for (const move of availableMoves) {
      const testBoard = [...currentBoard];
      testBoard[move] = "X";
      if (calculateWinner(testBoard) === "X") {
        testBoard[move] = null;
        performMove(currentBoard, move, "O");
        return;
      }
    }

    // Fallback: random
    const move = availableMoves[Math.floor(Math.random() * availableMoves.length)];
    performMove(currentBoard, move, "O");
  };

  const performMove = (newBoard: CellValue[], index: number, player: CellValue) => {
    newBoard[index] = player;
    setBoard([...newBoard]);

    const w = calculateWinner(newBoard);
    if (w) {
      setWinner(w);
      setGameOver(true);
      if (w === "X") {
        setTimeout(onWin, 500);
      } else {
        setTimeout(onLose, 500);
      }
    } else if (newBoard.every((cell) => cell !== null)) {
      setGameOver(true);
      setTimeout(onLose, 500);
    } else {
      setIsAITurn(player === "X");
    }
  };

  useEffect(() => {
    if (isAITurn && !gameOver) {
      const timer = setTimeout(() => {
        makeAIMove(board);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [isAITurn, gameOver, board]);

  const handleClick = (index: number) => {
    if (gameOver || board[index] !== null || isAITurn) return;
    performMove(board, index, "X");
  };

  const resetGame = () => {
    setBoard(Array(9).fill(null));
    setGameOver(false);
    setWinner(null);
    setIsAITurn(false);
  };

  return (
    <div className="tictactoe-container">
      <div className="tictactoe-header">
        <h2>Tic Tac Toe</h2>
        <p className="tictactoe-description">Win once to unlock the team photo! 🏆 Get 3 in a row to beat the AI.</p>
      </div>
      <div className="tictactoe-board">
        {board.map((cell, index) => (
          <button
            key={index}
            className={`tictactoe-cell ${cell ? "filled" : ""} ${isAITurn ? "disabled" : ""}`}
            onClick={() => handleClick(index)}
            disabled={gameOver || board[index] !== null || isAITurn}
          >
            {cell}
          </button>
        ))}
      </div>
      <div className="tictactoe-status">
        {winner ? (
          <p className={winner === "X" ? "winner" : "loser"}>
            {winner === "X" ? "You Win!" : "AI Wins!"}
          </p>
        ) : null}
        {!gameOver && !winner ? <p>{isAITurn ? "AI thinking..." : "Your turn (X)"}</p> : null}
        {gameOver && !winner ? <p>Draw!</p> : null}
      </div>
      {gameOver && (
        <button className="tictactoe-reset" onClick={resetGame}>
          Play Again
        </button>
      )}
    </div>
  );
}
