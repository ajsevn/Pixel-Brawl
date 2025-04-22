import { useEffect, useRef, useState } from "react";
import socket from "./socket";
import { Howl } from "howler";

type Player = { x: number; y: number; color: string; score: number; size: number };
type Players = Record<string, Player>;

const joinSound = new Howl({ src: ["/sounds/join.wav"], volume: 0.5 });
const tagSound = new Howl({ src: ["/sounds/tag.wav"], volume: 0.6 });

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [players, setPlayers] = useState<Players>({});
  const [id, setId] = useState("");

  useEffect(() => {
    socket.on("init", ({ id, players }) => {
      setId(id);
      setPlayers(players);
    });

    socket.on("playerJoined", ({ id, player }) => {
      joinSound.play();
      setPlayers(p => ({ ...p, [id]: player }));
    });

    socket.on("playerMoved", ({ id, x, y }) => {
      setPlayers(p => ({ ...p, [id]: { ...p[id], x, y } }));
    });

    socket.on("playerLeft", (id) => {
      setPlayers(p => {
        const { [id]: _, ...rest } = p;
        return rest;
      });
    });

    socket.on("playerTagged", ({ taggerId, taggedId }) => {
      tagSound.play();
      setPlayers(p => ({
        ...p,
        [taggerId]: {
          ...p[taggerId],
          score: p[taggerId].score + 1,
          size: p[taggerId].size + 2,
        },
      }));
    });
  }, []);

  const handleMove = (dir: string) => {
    const p = players[id];
    if (!p) return;
    const delta = 10;
    const newX = p.x + (dir === "right" ? delta : dir === "left" ? -delta : 0);
    const newY = p.y + (dir === "down" ? delta : dir === "up" ? -delta : 0);
    socket.emit("move", { x: newX, y: newY });
    setPlayers(p => ({ ...p, [id]: { ...p[id], x: newX, y: newY } }));
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    if (!rect) return;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    socket.emit("move", { x, y });
    setPlayers(p => ({ ...p, [id]: { ...p[id], x, y } }));
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, 800, 600);
    Object.entries(players).forEach(([pid, { x, y, color, size }]) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, size || 15, 0, Math.PI * 2);
      ctx.fill();
      if (pid === id) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    });
  }, [players]);

  const leaderboard = Object.entries(players)
    .sort((a, b) => b[1].score - a[1].score)
    .map(([pid, player], index) => (
      <div key={pid} className={`text-sm ${pid === id ? "font-bold text-green-400" : ""}`}>
        {index + 1}. {pid === id ? "You" : `Player ${pid.slice(0, 4)}`} - {player.score}
      </div>
    ));

  return (
    <div className="flex flex-col items-center gap-4 p-4 bg-gray-900 text-white min-h-screen">
      <h1 className="text-3xl font-bold mb-2">Pixel Brawl 🔥</h1>
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="border-4 border-white rounded-xl bg-black"
        onClick={handleCanvasClick}
        onTouchStart={handleCanvasClick}
      />
      <div className="flex gap-2 text-lg">
        <button onClick={() => handleMove("up")}>⬆️</button>
        <button onClick={() => handleMove("left")}>⬅️</button>
        <button onClick={() => handleMove("right")}>➡️</button>
        <button onClick={() => handleMove("down")}>⬇️</button>
      </div>
      <div className="w-full max-w-sm mt-4 bg-gray-800 rounded-lg p-4 shadow">
        <h2 className="text-xl font-semibold mb-2">🏆 Leaderboard</h2>
        {leaderboard}
      </div>
    </div>
  );
}

export default App;
