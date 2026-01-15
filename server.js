const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

app.get("/room/:id", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "room.html"));
});

const TEXT = "the quick brown fox jumps over the lazy dog";
const rooms = {};
const socketRoom = new Map();

io.on("connection", socket => {

  socket.on("joinRoom", ({ roomId, username }) => {
    if (!roomId || !username) return;

    const oldRoom = socketRoom.get(socket.id);
    if (oldRoom) socket.leave(oldRoom);

    socketRoom.set(socket.id, roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        text: TEXT,
        players: {},
        started: false
      };
    }

    socket.join(roomId);

    rooms[roomId].players[socket.id] = {
      username,
      chars: 0,
      errors: 0,
      startTime: null
    };

    socket.emit("joinedRoom");
    io.to(roomId).emit("roomUpdate", rooms[roomId]);
  });

  socket.on("startRace", () => {
    const roomId = socketRoom.get(socket.id);
    if (!roomId) return;

    const room = rooms[roomId];
    if (!room || room.started) return;

    room.started = true;

    let count = 3;
    const timer = setInterval(() => {
      io.to(roomId).emit("countdown", count);
      count--;

      if (count < 0) {
        clearInterval(timer);
        io.to(roomId).emit("raceStart", room.text);
        Object.values(room.players).forEach(p => {
          p.startTime = Date.now();
        });
      }
    }, 1000);
  });

  socket.on("progress", ({ chars, errors }) => {
    const roomId = socketRoom.get(socket.id);
    if (!roomId) return;

    const player = rooms[roomId]?.players[socket.id];
    if (!player) return;

    player.chars = chars;
    player.errors = errors;

    io.to(roomId).emit("roomUpdate", rooms[roomId]);
  });

  socket.on("disconnect", () => {
    const roomId = socketRoom.get(socket.id);
    if (!roomId) return;

    delete rooms[roomId].players[socket.id];
    socketRoom.delete(socket.id);
    io.to(roomId).emit("roomUpdate", rooms[roomId]);
  });
});

server.listen(3000, () => {
  console.log("✅ http://localhost:3000");
});
