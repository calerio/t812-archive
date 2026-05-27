// T812 originals — browse the full master scans.
const grid = document.getElementById("originals");
const metaEl = document.getElementById("meta");
const origbox = document.getElementById("origbox");
const origImg = document.getElementById("origImg");

function openOrig(src) { origImg.src = src; origbox.hidden = false; }
function closeOrig() { origbox.hidden = true; origImg.src = ""; }
document.getElementById("origClose").addEventListener("click", closeOrig);
origbox.addEventListener("click", (e) => { if (e.target === origbox) closeOrig(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeOrig(); });

fetch("manifest.json")
  .then((r) => r.json())
  .then((d) => {
    const originals = d.originals || [];
    metaEl.textContent = `${originals.length} original scan(s).`;
    grid.innerHTML = "";
    if (!originals.length) { grid.innerHTML = `<p class="empty">No originals listed.</p>`; return; }
    originals.forEach((o, i) => {
      const card = document.createElement("button");
      card.className = "card";
      card.style.setProperty("--tilt", `${((i % 5) - 2) * 1.1}deg`);
      card.innerHTML = `
        <img loading="lazy" src="${o.file}" alt="${o.title}">
        <div class="cap">${o.title}</div>
        <div class="sub">${o.crops} photo${o.crops === 1 ? "" : "s"} cut from this</div>`;
      card.addEventListener("click", () => openOrig(o.file));
      grid.appendChild(card);
    });
  })
  .catch(() => { grid.innerHTML = `<p class="empty">Couldn't load manifest.json.</p>`; });
