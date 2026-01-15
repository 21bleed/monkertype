const usernameInput = document.getElementById("username");
const roomInput = document.getElementById("roomInput");

document.getElementById("join").onclick = () => {
  const room = roomInput.value.trim();
  const username = usernameInput.value.trim();

  if (!room || !username) {
    alert("Enter username and room ID");
    return;
  }

  window.location.href =
    `/room/${room}?username=${encodeURIComponent(username)}`;
};

document.getElementById("create").onclick = () => {
  const username = usernameInput.value.trim();
  if (!username) {
    alert("Enter a username");
    return;
  }

  const room = Math.random().toString(36).substring(2, 8);
  window.location.href =
    `/room/${room}?username=${encodeURIComponent(username)}`;
};

function renderWords(words) {
    // Clear the current display
    const display = document.getElementById('display');
    display.innerHTML = '';

    // Create a span for each word
    words.forEach(word => {
        const span = document.createElement('span');
        span.textContent = word + ' '; // Add space between words
        display.appendChild(span);
    });
}
