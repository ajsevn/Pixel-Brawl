import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

type Player = {
  x: number;
  y: number;
  isIt: boolean;
  color: string;
};

let players: Record<string, Player> = {};

const getRandomColor = () =>
  "#" + Math.floor(Math.random() * 16777215).toString(16);

io.on("connection", (socket) => {
  console.log("🟢 Player joined:", socket.id);

  const isIt = Object.keys(players).length === 0;
  const newPlayer: Player = {
    x: Math.random() * 700 + 50,
    y: Math.random() * 500 + 50,
    isIt,
    color: isIt ? "red" : getRandomColor(),
  };

  players[socket.id] = newPlayer;

  // Send init state
  socket.emit("init", { id: socket.id, players });

  // Broadcast to others
  socket.broadcast.emit("playerJoined", {
    id: socket.id,
    player: newPlayer,
  });

  socket.on("move", ({ x, y }) => {
    const player = players[socket.id];
    if (!player) return;

    player.x = x;
    player.y = y;

    io.emit("playerMoved", { id: socket.id, x, y });

    if (player.isIt) checkTag(socket.id);
  });

  socket.on("disconnect", () => {
    console.log("🔴 Player left:", socket.id);

    const wasIt = players[socket.id]?.isIt;
    delete players[socket.id];
    io.emit("playerLeft", socket.id);

    if (wasIt) {
      // If "IT" left, make someone else IT
      const ids = Object.keys(players);
      if (ids.length > 0) {
        const newItId = ids[Math.floor(Math.random() * ids.length)];
        players[newItId].isIt = true;
        players[newItId].color = "red";
        console.log(`🔥 ${newItId} is now IT`);
        io.emit("playerMoved", {
          id: newItId,
          x: players[newItId].x,
          y: players[newItId].y,
        });
      }
    }
  });

  function checkTag(itId: string) {
    const itPlayer = players[itId];
    for (const [id, player] of Object.entries(players)) {
      if (id === itId) continue;

      const dx = itPlayer.x - player.x;
      const dy = itPlayer.y - player.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 30) {
        // Tag event
        itPlayer.isIt = false;
        itPlayer.color = getRandomColor();

        player.isIt = true;
        player.color = "red";

        console.log(`🏷️ ${itId} tagged ${id}`);

        io.emit("updatePlayers", players);
        break;
      }
    }
  }
});

server.listen(3000, () => {
  console.log("🚀 Server listening on port 3001");
});
