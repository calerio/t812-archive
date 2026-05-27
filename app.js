// T812 archive — vanilla JS, no build step. Reads manifest.json and renders.
const gallery = document.getElementById("gallery");
const filters = document.getElementById("filters");
const metaEl = document.getElementById("meta");
const lightbox = document.getElementById("lightbox");
const lightboxMedia = document.getElementById("lightboxMedia");
const lightboxCaption = document.getElementById("lightboxCaption");

let state = { collections: [], active: "all" };

function fmtDate(d) {
  if (!d) return "";
  // Accept YYYY, YYYY-MM, YYYY-MM-DD and render nicely.
  const parts = d.split("-");
  const months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${months[+parts[1]] || ""} ${parts[0]}`;
  return `${+parts[2]} ${months[+parts[1]] || ""} ${parts[0]}`;
}

function allItems() {
  return state.collections.flatMap((c) =>
    c.items.map((it) => ({ ...it, _collection: c.title })));
}

function render() {
  const items =
    state.active === "all"
      ? allItems()
      : (state.collections.find((c) => c.id === state.active)?.items || [])
          .map((it) => ({ ...it, _collection: "" }));

  gallery.innerHTML = "";
  if (!items.length) {
    gallery.innerHTML = `<p class="empty">Nothing here yet — be the first to add a memory.
      See <code>CONTRIBUTING.md</code>.</p>`;
    return;
  }

  items.forEach((it, i) => {
    const card = document.createElement("button");
    card.className = "card";
    card.style.setProperty("--tilt", `${((i % 5) - 2) * 1.1}deg`);

    const media =
      it.kind === "doc"
        ? `<div class="card__media card__doc">📄</div>`
        : `<img class="card__media" loading="lazy" src="${it.file}" alt="${it.title}">`;

    const sub = [fmtDate(it.date), it.by].filter(Boolean).join(" · ");
    card.innerHTML = `${media}
      <div class="card__label">
        <div class="card__title">${it.title}</div>
        ${sub ? `<div class="card__sub">${sub}</div>` : ""}
      </div>`;
    card.addEventListener("click", () => openLightbox(it));
    gallery.appendChild(card);
  });
}

function openLightbox(it) {
  lightboxMedia.innerHTML =
    it.kind === "doc"
      ? `<iframe src="${it.file}" title="${it.title}"></iframe>`
      : `<img src="${it.file}" alt="${it.title}">`;
  const meta = [fmtDate(it.date), it.by ? `by ${it.by}` : ""].filter(Boolean).join(" · ");
  const tags = (it.tags || []).map((t) => `<span class="tag">${t}</span>`).join("");
  lightboxCaption.innerHTML = `
    <h2>${it.title}</h2>
    ${meta ? `<div class="meta">${meta}</div>` : ""}
    ${it.caption ? `<p>${it.caption}</p>` : ""}
    ${tags ? `<div class="tags">${tags}</div>` : ""}`;
  lightbox.hidden = false;
}
function closeLightbox() { lightbox.hidden = true; lightboxMedia.innerHTML = ""; }

document.getElementById("lightboxClose").addEventListener("click", closeLightbox);
lightbox.addEventListener("click", (e) => { if (e.target === lightbox) closeLightbox(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeLightbox(); });

function buildFilters() {
  const tabs = [{ id: "all", title: "Everything" },
    ...state.collections.map((c) => ({ id: c.id, title: `${c.emoji || ""} ${c.title}`.trim() }))];
  filters.innerHTML = "";
  tabs.forEach((t) => {
    const b = document.createElement("button");
    b.textContent = t.title;
    b.setAttribute("aria-pressed", String(t.id === state.active));
    b.addEventListener("click", () => {
      state.active = t.id;
      [...filters.children].forEach((c) => c.setAttribute("aria-pressed", "false"));
      b.setAttribute("aria-pressed", "true");
      render();
    });
    filters.appendChild(b);
  });
}

fetch("manifest.json")
  .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then((data) => {
    state.collections = data.collections || [];
    metaEl.textContent = `${data.total_items || 0} memories archived.`;
    buildFilters();
    render();
  })
  .catch(() => {
    gallery.innerHTML = `<p class="empty">Couldn't load <code>manifest.json</code>.
      Run <code>python3 scripts/build_manifest.py</code>, then serve the folder over http
      (<code>python3 -m http.server</code>) rather than opening the file directly.</p>`;
  });
