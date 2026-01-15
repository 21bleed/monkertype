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

// A simple word bank for race generation (common words)
const WORDS = (`the be to of and a in that have I it for not on with he as you do at
this but his by from they we say her she or an will my one all would there their
what so up out if about who get which go me when make can like time no just him
know take people into year your good some could them see other than then now look
only come its over think also back after use two how our work first well way even
new want because any these give day most us`).split(/\s+/);

function generateText(wordCount = 50) {
  const out = [];
  for (let i = 0; i < wordCount; i++) {
    const w = WORDS[Math.floor(Math.random() * WORDS.length)];
    out.push(w);
  }
  return out.join(' ') + ' ';
}
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
        text: generateText(50),
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

  socket.on("startRace", (opts = {}) => {
    const roomId = socketRoom.get(socket.id);
    if (!roomId) return;

    const room = rooms[roomId];
    if (!room || room.started) return;

    // allow host to pick word count or mode
    const count = parseInt(opts.count, 10) || 50;
    // regenerate text for this race
    room.text = generateText(Math.max(5, Math.min(200, count)));
    room.started = true;

    let countDown = 3;
    const timer = setInterval(() => {
      io.to(roomId).emit("countdown", countDown);
      countDown--;

      if (countDown < 0) {
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
