// T812 home/gallery + photo view with per-photo memories.
const shelf = document.getElementById("shelf");
const collectionEl = document.getElementById("collection");
const gallery = document.getElementById("gallery");
const metaEl = document.getElementById("meta");
const lb = document.getElementById("lightbox");
const origbox = document.getElementById("origbox");

let state = { collections: [], byId: {} };

function fmtDate(d) {
  if (!d) return "";
  const m = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const p = d.split("-");
  if (p.length === 1) return p[0];
  if (p.length === 2) return `${m[+p[1]] || ""} ${p[0]}`;
  return `${+p[2]} ${m[+p[1]] || ""} ${p[0]}`;
}
const tilt = (i) => `${((i % 5) - 2) * 1.1}deg`;

function renderShelf() {
  shelf.innerHTML = "";
  state.collections.forEach((c, i) => {
    const cover = c.items[0];
    const a = document.createElement("a");
    a.className = "chapter";
    a.href = "#" + encodeURIComponent(c.id);
    a.style.setProperty("--tilt", tilt(i));
    a.innerHTML = `
      ${cover ? `<img class="thumb" loading="lazy" src="${cover.file}" alt="">`
              : `<div class="thumb"></div>`}
      <div class="name">${c.emoji ? c.emoji + " " : ""}${c.title}</div>
      <div class="count">${c.items.length} ${c.items.length === 1 ? "photo" : "photos"}</div>`;
    a.addEventListener("click", (e) => { e.preventDefault(); openCollection(c.id); });
    shelf.appendChild(a);
  });
}

function openCollection(id) {
  const c = state.byId[id];
  if (!c) return;
  location.hash = encodeURIComponent(id);
  shelf.hidden = true;
  collectionEl.hidden = false;
  gallery.innerHTML = "";
  if (!c.items.length) {
    gallery.innerHTML = `<p class="empty">Nothing here yet.</p>`;
    return;
  }
  c.items.forEach((it, i) => {
    const card = document.createElement("button");
    card.className = "card";
    card.style.setProperty("--tilt", tilt(i));
    const sub = [fmtDate(it.date), it.by].filter(Boolean).join(" · ");
    card.innerHTML = `
      <img loading="lazy" src="${it.file}" alt="${it.title}">
      <div class="cap">${it.title}</div>
      ${sub ? `<div class="sub">${sub}</div>` : ""}`;
    card.addEventListener("click", () => openPhoto(it, c));
    gallery.appendChild(card);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function backToShelf() {
  collectionEl.hidden = true;
  shelf.hidden = false;
  history.replaceState(null, "", location.pathname);
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
document.getElementById("backToShelf").addEventListener("click", backToShelf);
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
    renderShelf();
    const hash = decodeURIComponent(location.hash.slice(1));
    if (hash && state.byId[hash]) openCollection(hash);
  })
  .catch(() => {
    shelf.innerHTML = `<p class="empty">Couldn't load <code>manifest.json</code>.
      Run <code>python3 scripts/build_manifest.py</code> and serve over http
      (<code>python3 -m http.server</code>).</p>`;
  });
