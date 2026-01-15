const socket = io();

const roomId = location.pathname.split("/").pop();
const username = new URLSearchParams(location.search).get("username");

document.getElementById("roomTitle").textContent = `Room: ${roomId}`;

const textDiv = document.getElementById("text");
const countdown = document.getElementById("countdown");
const stats = document.getElementById("stats");
const playersEl = document.getElementById("players");
const startBtn = document.getElementById("start");

let text = "";
let cursor = 0;
let errors = 0;
let started = false;
let typed = [];

// Caret animation state
let caretTargetX = 0;
let caretX = 0;
let caretRAF = null;

socket.emit("joinRoom", { roomId, username });

startBtn.onclick = () => socket.emit("startRace");

socket.on("countdown", n => {
  countdown.textContent = n >= 0 ? n : "";
});

socket.on("raceStart", t => {
  text = t;
  cursor = 0;
  errors = 0;
  started = true;
  typed = [];
  render();
  startCaretLoop();
});

document.body.addEventListener("keydown", e => {
  if (!started) return;

  if (e.key === "Backspace") {
    if (cursor > 0) cursor--;
    typed.pop();
    render();
    return;
  }

  if (e.key.length !== 1) return;

  // record typed character and update cursor
  typed.push(e.key);
  if (e.key !== text[cursor]) errors++;
  cursor++;

  socket.emit("progress", {
    chars: cursor,
    errors
  });

  render();
});

function render() {
  // Word-based rendering: split into words (preserve trailing spaces)
  const parts = text.match(/\S+\s*/g) || [text];
  const textInner = document.getElementById('textInner');
  textInner.innerHTML = '';

  let globalIndex = 0;
  parts.forEach((part, wIdx) => {
    const wordSpan = document.createElement('span');
    wordSpan.className = 'word';

    for (let i = 0; i < part.length; i++) {
      const ch = part[i];
      const chSpan = document.createElement('span');
      chSpan.className = 'char';
      chSpan.dataset.index = globalIndex;
      // determine correctness from typed array
      if (globalIndex < typed.length) {
        chSpan.classList.add(typed[globalIndex] === text[globalIndex] ? 'correct' : 'wrong');
      }

      if (globalIndex === cursor) chSpan.classList.add('caret-marker');

      chSpan.textContent = ch;
      wordSpan.appendChild(chSpan);
      globalIndex++;
    }

    textInner.appendChild(wordSpan);
  });

  updateCaretTarget();
}

function updateCaretTarget() {
  const textInner = document.getElementById('textInner');
  const caretEl = document.getElementById('caret');
  const marker = textInner.querySelector('.char[data-index="' + cursor + '"]');

  if (marker) {
    // compute caret X relative to textInner
    const parentRect = textInner.getBoundingClientRect();
    const mRect = marker.getBoundingClientRect();
    caretTargetX = mRect.left - parentRect.left;
    caretEl.style.height = mRect.height + 'px';
  } else {
    // if beyond end, place caret at end
    const last = textInner.querySelector('.char:last-child');
    if (last) {
      const parentRect = textInner.getBoundingClientRect();
      const mRect = last.getBoundingClientRect();
      caretTargetX = (mRect.right - parentRect.left) + 2;
      caretEl.style.height = mRect.height + 'px';
    }
  }
}

function startCaretLoop() {
  if (caretRAF) cancelAnimationFrame(caretRAF);
  const caretEl = document.getElementById('caret');
  const loop = () => {
    caretX += (caretTargetX - caretX) * 0.18; // lerp factor
    caretEl.style.transform = `translateX(${caretX}px)`;
    caretRAF = requestAnimationFrame(loop);
  };
  loop();
}

socket.on("roomUpdate", room => {
  playersEl.textContent = Object.values(room.players)
    .map(p => p.username)
    .join(" • ");

  const me = room.players[socket.id];
  if (!me || !me.startTime) return;

  const minutes = (Date.now() - me.startTime) / 60000;
  const wpm = Math.round((me.chars / 5) / minutes || 0);
  const acc =
    me.chars === 0
      ? 100
      : Math.max(0, 100 - (me.errors / me.chars) * 100);

  stats.textContent = `WPM: ${wpm} | Accuracy: ${acc.toFixed(1)}%`;
});
