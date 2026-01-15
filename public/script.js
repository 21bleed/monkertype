const socket = io();

const roomInput = document.getElementById("roomInput");
const joinBtn = document.getElementById("join");
const startBtn = document.getElementById("start");
const textDiv = document.getElementById("text");
const input = document.getElementById("input");
const countdownEl = document.getElementById("countdown");
const statsEl = document.getElementById("stats");

let roomCode = "";
let text = "";
let started = false;
let cursor = 0;
let errors = 0;
let startTime = null;
let lastCaretPosition = 0;
let typed = [];

let caretTargetX = 0;
let caretX = 0;
let caretRAF = null;
let caretTargetY = 0;
let caretY = 0;

joinBtn.onclick = () => {
  roomCode = roomInput.value || "public";
  socket.emit("joinRoom", roomCode);
};

startBtn.onclick = () => {
  socket.emit("startRace", roomCode);
};

socket.on("countdown", n => {
  countdownEl.textContent = n >= 0 ? n : "";
});

socket.on("raceStart", t => {
  text = t;
  cursor = 0;
  errors = 0;
  started = true;
  startTime = Date.now();
  input.value = "";
  typed = [];
  render();
  if (document.getElementById('caret')) startCaretLoop();
});

input.addEventListener("keydown", e => {
  if (!started) return;

  if (e.key === "Backspace") {
    if (cursor > 0) cursor--;
    e.preventDefault();
    typed.pop();
    render();
    return;
  }

  if (e.key.length !== 1) return;
  typed.push(e.key);
  if (e.key !== text[cursor]) errors++;
  cursor++;

  socket.emit("progress", {
    roomCode,
    chars: cursor,
    errors
  });

  render();
});

function render() {
  // Word-based rendering
  const parts = text.match(/\S+\s*/g) || [text];
  const textInner = textDiv; // textDiv is the container
  textInner.innerHTML = '';

  let globalIndex = 0;
  parts.forEach(part => {
    const wordSpan = document.createElement('span');
    wordSpan.className = 'word';

    for (let i = 0; i < part.length; i++) {
      const ch = part[i];
      const chSpan = document.createElement('span');
      chSpan.className = 'char';
      chSpan.dataset.index = globalIndex;

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

  // update caret
  if (document.getElementById('caret')) updateCaretTarget();
}

function updateCaretTarget() {
  const textInner = textDiv;
  const caretEl = document.getElementById('caret');
  if (!caretEl) return;
  const marker = textInner.querySelector('.char[data-index="' + cursor + '"]');

  if (marker) {
    const parentRect = textInner.getBoundingClientRect();
    const mRect = marker.getBoundingClientRect();
    caretTargetX = mRect.left - parentRect.left;
    caretTargetY = mRect.top - parentRect.top;
    caretEl.style.height = mRect.height + 'px';
  } else {
    const last = textInner.querySelector('.char:last-child');
    if (last) {
      const parentRect = textInner.getBoundingClientRect();
      const mRect = last.getBoundingClientRect();
      caretTargetX = (mRect.right - parentRect.left) + 2;
      caretTargetY = mRect.top - parentRect.top;
      caretEl.style.height = mRect.height + 'px';
    }
  }
}

function startCaretLoop() {
  if (caretRAF) cancelAnimationFrame(caretRAF);
  const caretEl = document.getElementById('caret');
  if (!caretEl) return;
  const loop = () => {
    // snappier caret lerp to feel closer to Monkeytype
    caretX += (caretTargetX - caretX) * 0.28;
    caretY += (caretTargetY - caretY) * 0.28;
    caretEl.style.transform = `translate(${caretX}px, ${caretY}px)`;
    caretRAF = requestAnimationFrame(loop);
  };
  loop();
}

socket.on("roomUpdate", room => {
  const me = room.players[socket.id];
  if (!me || !me.startTime) return;

  const minutes = (Date.now() - me.startTime) / 60000;
  const wpm = Math.round((me.chars / 5) / minutes || 0);
  const acc =
    me.chars === 0
      ? 100
      : Math.max(0, 100 - (me.errors / me.chars) * 100);

  statsEl.textContent = `WPM: ${wpm} | Accuracy: ${acc.toFixed(1)}%`;
});
