import { useEffect, useRef, useState } from "react";
import "./Pong.css";

type PongProps = {
  onWin: () => void;
  onLose: () => void;
};

export function Pong({ onWin, onLose }: PongProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const playerRef = useRef({ y: 150, height: 80, speed: 6 });
  const ballRef = useRef({ x: 300, y: 200, radius: 8, speedX: 4, speedY: 4 });
  const scoreRef = useRef({ player: 0, ai: 0 });
  const aiRef = useRef({ y: 150, height: 80, speed: 3 });

  const handleClose = () => {
    if (gameOver) {
      setTimeout(won ? onWin : onLose, 200);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    const gameLoop = () => {
      const player = playerRef.current;
      const ball = ballRef.current;
      const ai = aiRef.current;
      const score = scoreRef.current;

      // Clear canvas
      ctx.fillStyle = "rgba(2, 6, 18, 0.8)";
      ctx.fillRect(0, 0, 400, 300);

      // Draw center line
      ctx.strokeStyle = "#7c9cff";
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(200, 0);
      ctx.lineTo(200, 300);
      ctx.stroke();
      ctx.setLineDash([]);

      // Move ball
      ball.x += ball.speedX;
      ball.y += ball.speedY;

      // Ball collision with top/bottom
      if (ball.y - ball.radius < 0 || ball.y + ball.radius > 300) {
        ball.speedY *= -1;
      }

      // Ball collision with player paddle
      if (
        ball.x - ball.radius < 10 &&
        ball.y > player.y &&
        ball.y < player.y + player.height
      ) {
        ball.speedX *= -1;
        ball.x = 10 + ball.radius;
      }

      // Ball collision with AI paddle
      if (
        ball.x + ball.radius > 390 &&
        ball.y > ai.y &&
        ball.y < ai.y + ai.height
      ) {
        ball.speedX *= -1;
        ball.x = 390 - ball.radius;
      }

      // Ball goes off screen
      if (ball.x < 0) {
        score.ai++;
        if (score.ai >= 3) {
          setGameOver(true);
          setWon(false);
        }
        ball.x = 200;
        ball.y = 150;
        ball.speedX = -4;
        ball.speedY = 4;
      } else if (ball.x > 400) {
        score.player++;
        if (score.player >= 3) {
          setWon(true);
          setGameOver(true);
        }
        ball.x = 200;
        ball.y = 150;
        ball.speedX = 4;
        ball.speedY = 4;
      }

      // AI paddle movement
      const aiCenter = ai.y + ai.height / 2;
      if (aiCenter < ball.y - 20) {
        ai.y += ai.speed;
      } else if (aiCenter > ball.y + 20) {
        ai.y -= ai.speed;
      }
      ai.y = Math.max(0, Math.min(300 - ai.height, ai.y));

      // Draw paddles
      ctx.fillStyle = "#7c9cff";
      ctx.fillRect(5, player.y, 8, player.height);
      ctx.fillRect(387, ai.y, 8, ai.height);

      // Draw ball
      ctx.fillStyle = "#00ff41";
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();

      // Draw score
      ctx.fillStyle = "#00ff41";
      ctx.font = "bold 20px monospace";
      ctx.textAlign = "left";
      ctx.fillText(String(score.player), 80, 30);
      ctx.textAlign = "right";
      ctx.fillText(String(score.ai), 320, 30);

      animationId = requestAnimationFrame(gameLoop);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") {
        playerRef.current.y = Math.max(0, playerRef.current.y - playerRef.current.speed);
      }
      if (e.key === "ArrowDown") {
        playerRef.current.y = Math.min(
          300 - playerRef.current.height,
          playerRef.current.y + playerRef.current.speed
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    gameLoop();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div className="pong-container">
      <div className="pong-header">
        <h2>Pong</h2>
        <p className="pong-description">Use ↑ ↓ to move paddle. First to 3 points wins!</p>
        {gameOver && (
          <button className="pong-close-btn" onClick={handleClose}>
            {won ? "Continue" : "Try Again"}
          </button>
        )}
      </div>
      <canvas
        ref={canvasRef}
        width={400}
        height={300}
        className="pong-canvas"
      />
      <div className="pong-status">
        <p>{gameOver ? (won ? "Victory!" : "Defeated!") : "Use ↑ ↓ to move"}</p>
      </div>
    </div>
  );
}
