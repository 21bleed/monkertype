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

// A larger word bank for race generation (common words)
const WORDS = (`the be to of and a in that have I it for not on with he as you do at
this but his by from they we say her she or an will my one all would there their
what so up out if about who get which go me when make can like time no just him
know take people into year your good some could them see other than then now look
only come its over think also back after use two how our work first well way even
new want because any these give day most us are were been has more some many
example sample typing test practice random words lorem ipsum quick brown fox jumps
over lazy dog keyboard fast accuracy speed precision challenge focus rhythm steady
garden ocean mountain river sky cloud moon sun star light dark pixel color sound
space time motion code script game play pause resume start end finish level high
score rank medal badge trophy friend rival teammate join leave host guest room
alpha beta gamma delta epsilon omega zeta eta theta iota kappa lambda mu nu xi
omicron pi rho sigma tau upsilon phi chi psi omega`).split(/\s+/);

// A few short sentence templates to generate sentence-mode text
const SENTENCE_TEMPLATES = [
  "The quick brown fox jumps over the lazy dog.",
  "Practice makes progress and speed follows accuracy.",
  "Typing tests help you focus on rhythm and precision.",
  "Keep your hands relaxed and eyes on the screen.",
  "Short sprints build speed; long runs build endurance." 
];

function generateText(count = 50, mode = 'words') {
  if (mode === 'sentences') {
    // generate `count` sentences by sampling templates and mixing words
    const sentences = [];
    for (let s = 0; s < count; s++) {
      // pick a template and optionally shuffle/add words
      let tpl = SENTENCE_TEMPLATES[Math.floor(Math.random() * SENTENCE_TEMPLATES.length)];
      // optionally append a short random clause
      if (Math.random() < 0.35) {
        tpl = tpl.replace(/\.$/, '');
        const extraWords = [];
        const extraCount = 3 + Math.floor(Math.random() * 6);
        for (let i = 0; i < extraCount; i++) extraWords.push(WORDS[Math.floor(Math.random() * WORDS.length)]);
        tpl = tpl + ' ' + extraWords.join(' ') + '.';
      }
      sentences.push(tpl);
    }
    return sentences.join(' ');
  }

  // default: words mode
  const out = [];
  for (let i = 0; i < count; i++) {
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
