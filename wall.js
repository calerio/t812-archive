// T812 memory wall — shows every approved memory; lets anyone add one.
const wall = document.getElementById("wall");
const metaEl = document.getElementById("meta");

function escapeHtml(s) {
  return (s || "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function render(notes) {
  wall.innerHTML = "";
  if (!notes.length) {
    wall.innerHTML = `<p class="empty">No memories yet — be the first above. 💛</p>`;
    return;
  }
  notes.forEach((n, i) => {
    const d = document.createElement("div");
    d.className = "wallnote";
    d.style.setProperty("--tilt", `${((i % 6) - 2.5) * 0.9}deg`);
    const where = n.chapter ? `<div class="sub">on ${escapeHtml(n.chapter)}</div>` : "";
    d.innerHTML = `
      <div class="msg">${escapeHtml(n.message)}</div>
      <div class="who">— ${escapeHtml(n.name || "anonymous")}</div>
      ${n.photo ? `<img loading="lazy" src="${n.photo}" alt="">` : ""}
      ${where}`;
    wall.appendChild(d);
  });
}

async function load() {
  if (!window.Supa || !Supa.configured()) {
    wall.innerHTML = `<p class="empty">The memory wall isn't connected yet.
      Add your Supabase key to <code>config.js</code>.</p>`;
    return;
  }
  wall.innerHTML = `<p class="empty">loading…</p>`;
  try {
    const notes = await Supa.getMemories();
    metaEl.textContent = `${notes.length} ${notes.length === 1 ? "memory" : "memories"} on the wall.`;
    render(notes);
  } catch {
    wall.innerHTML = `<p class="empty">Couldn't load the wall.</p>`;
  }
}

document.getElementById("wallForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target, note = document.getElementById("wallFormNote");
  if (f.website.value) return;                 // honeypot
  if (!Supa.configured()) { note.textContent = "Wall not connected yet."; return; }
  note.textContent = "pinning…";
  try {
    await Supa.postMemory({ name: f.name.value, message: f.message.value });
    f.reset();
    note.textContent = "Thank you! It'll appear once approved. 💛";
  } catch {
    note.textContent = "Hmm, that didn't send. Try again?";
  }
});

load();
