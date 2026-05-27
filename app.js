// T812 home — one flat wall of every Polaroid, plus the per-photo memory view.
// Display only: the archive folder/semester structure is untouched (see manifest).
const wall = document.getElementById("wall");
const metaEl = document.getElementById("meta");
const lb = document.getElementById("lightbox");
const origbox = document.getElementById("origbox");

let state = { collections: [], byId: {} };

// The order the groups appear in on the wall.
const GROUP_ORDER = [
  "polaroids/roommates",
  "polaroids/staff",
  "polaroids/family",
  "polaroids/2024-25/I",
  "polaroids/2024-25/II",
  "polaroids/2025-26/I",
  "polaroids/2025-26/II",
];
// Still-numbered (un-renamed) photos start with the scan's year digits; named
// ones start with a letter. These get pooled into one group at the very end.
const isUnnamed = (it) => /^\d/.test(it.title);
const shortLabel = (c) => c.title.replace(/^Polaroids\s*[·.\-]\s*/i, "");

function fmtDate(d) {
  if (!d) return "";
  const m = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const p = d.split("-");
  if (p.length === 1) return p[0];
  if (p.length === 2) return `${m[+p[1]] || ""} ${p[0]}`;
  return `${+p[2]} ${m[+p[1]] || ""} ${p[0]}`;
}
const tilt = (i) => `${((i % 5) - 2) * 1.1}deg`;

function cardEl(entry, i) {
  const { it, coll } = entry;
  const card = document.createElement("button");
  card.className = "card";
  card.style.setProperty("--tilt", tilt(i));
  const sub = [fmtDate(it.date), it.by].filter(Boolean).join(" · ");
  card.innerHTML = `
    <img loading="lazy" src="${it.file}" alt="${it.title}">
    <div class="cap">${it.title}</div>
    ${sub ? `<div class="sub">${sub}</div>` : ""}`;
  card.addEventListener("click", () => openPhoto(it, coll));
  return card;
}

function sectionEl(label, emoji, entries, startIndex) {
  const sec = document.createElement("section");
  sec.className = "wallgroup";
  const h = document.createElement("h2");
  h.className = "grouphead";
  h.innerHTML = `${emoji ? emoji + " " : ""}${label}<span class="grpcount">${entries.length}</span>`;
  sec.appendChild(h);
  const grid = document.createElement("div");
  grid.className = "gallery";
  entries.forEach((e, k) => grid.appendChild(cardEl(e, startIndex + k)));
  sec.appendChild(grid);
  return sec;
}

function renderWall() {
  wall.innerHTML = "";
  // groups in the chosen order, then any future collection not listed above
  const ordered = GROUP_ORDER.map((id) => state.byId[id]).filter(Boolean);
  state.collections.forEach((c) => { if (!GROUP_ORDER.includes(c.id)) ordered.push(c); });

  const unnamed = [];
  let i = 0;
  ordered.forEach((c) => {
    c.items.forEach((it) => { if (isUnnamed(it)) unnamed.push({ it, coll: c }); });
    const named = c.items
      .filter((it) => !isUnnamed(it))
      .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }))
      .map((it) => ({ it, coll: c }));
    if (!named.length) return;
    wall.appendChild(sectionEl(shortLabel(c), c.emoji, named, i));
    i += named.length;
  });

  if (unnamed.length) {
    unnamed.sort((a, b) =>
      a.it.title.localeCompare(b.it.title, undefined, { numeric: true }));
    wall.appendChild(sectionEl("Still to be named", "🗂️", unnamed, i));
  }
}

// ---- photo lightbox ----
let current = null;
async function openPhoto(it, coll) {
  current = { it, coll };
  document.getElementById("lbMedia").innerHTML = `<img src="${it.file}" alt="${it.title}">`;
  document.getElementById("lbTitle").textContent = it.title;
  const meta = [fmtDate(it.date), it.by ? "by " + it.by : ""].filter(Boolean).join(" · ");
  document.getElementById("lbMeta").textContent = meta;
  const orig = document.getElementById("lbOrig");
  orig.innerHTML = it.source
    ? `<a href="#" id="viewOrig">🔍 view the original scan</a>`
    : "";
  if (it.source) {
    document.getElementById("viewOrig").addEventListener("click", (e) => {
      e.preventDefault(); openOriginal(it.source);
    });
  }
  lb.hidden = false;
  loadNotes(it);
}

async function loadNotes(it) {
  const box = document.getElementById("lbNotes");
  if (!window.Supa || !Supa.configured()) {
    box.innerHTML = `<p class="formnote">The memory wall isn't connected yet.</p>`;
    return;
  }
  box.innerHTML = `<p class="formnote">loading…</p>`;
  try {
    const notes = await Supa.getMemories({ photo: it.file });
    box.innerHTML = notes.length ? "" : `<p class="formnote">Be the first to leave a memory.</p>`;
    notes.forEach((n) => box.appendChild(noteEl(n)));
  } catch {
    box.innerHTML = `<p class="formnote">Couldn't load memories.</p>`;
  }
}

function noteEl(n) {
  const d = document.createElement("div");
  d.className = "note";
  const when = n.created_at ? new Date(n.created_at).toLocaleDateString() : "";
  d.innerHTML = `<span class="when">${when}</span>
    <div class="msg">${escapeHtml(n.message)}</div>
    <div class="who">— ${escapeHtml(n.name || "anonymous")}</div>`;
  return d;
}

function escapeHtml(s) {
  return (s || "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

document.getElementById("lbForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target, note = document.getElementById("lbFormNote");
  if (f.website.value) return;                 // honeypot tripped
  if (!Supa.configured()) { note.textContent = "Wall not connected yet."; return; }
  note.textContent = "pinning…";
  try {
    await Supa.postMemory({
      name: f.name.value, message: f.message.value,
      photo: current.it.file, chapter: current.coll.title,
    });
    f.reset();
    note.textContent = "Thank you! Your memory will appear once approved. 💛";
  } catch {
    note.textContent = "Hmm, that didn't send. Try again?";
  }
});

function openOriginal(src) { document.getElementById("origImg").src = src; origbox.hidden = false; }
function closeLb() { lb.hidden = true; document.getElementById("lbMedia").innerHTML = ""; }
function closeOrig() { origbox.hidden = true; document.getElementById("origImg").src = ""; }

document.getElementById("lightboxClose").addEventListener("click", closeLb);
lb.addEventListener("click", (e) => { if (e.target === lb) closeLb(); });
document.getElementById("origClose").addEventListener("click", closeOrig);
origbox.addEventListener("click", (e) => { if (e.target === origbox) closeOrig(); });
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!origbox.hidden) closeOrig();
  else if (!lb.hidden) closeLb();
});

fetch("manifest.json")
  .then((r) => r.json())
  .then((d) => {
    state.collections = d.collections.filter((c) => c.items.length);
    state.collections.forEach((c) => (state.byId[c.id] = c));
    metaEl.textContent = `${d.total_items} memories archived.`;
    renderWall();
  })
  .catch(() => {
    wall.innerHTML = `<p class="empty">Couldn't load <code>manifest.json</code>.
      Run <code>python3 scripts/build_manifest.py</code> and serve over http
      (<code>python3 -m http.server</code>).</p>`;
  });
