// T812 stats page — reads aggregate-only data (SECURITY DEFINER RPCs) and draws
// the headline numbers, a world map of visits, breakdown lists, and a timeline.
// No raw rows or personal data ever reach the browser.
(function () {
  const cfg = window.T812_CONFIG || {};
  const API = (cfg.SUPABASE_URL || "").replace(/\/$/, "");   // not "URL" — that shadows the global URL constructor
  const KEY = cfg.SUPABASE_ANON_KEY || "";
  const note = document.getElementById("statnote");

  // world.svg projection — keep in sync with scripts/build_worldmap.py
  const W = 1000, H = 500, LAT_TOP = 85, LAT_BOT = -57;
  const projX = (lon) => (lon + 180) / 360 * W;
  const projY = (lat) => (LAT_TOP - lat) / (LAT_TOP - LAT_BOT) * H;

  const esc = (s) => (s || "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function flag(cc) {
    if (!cc || cc.length !== 2) return "🏳️";
    return String.fromCodePoint(...[...cc.toUpperCase()]
      .map((c) => 127397 + c.charCodeAt(0)));
  }

  const PAGE_LABELS = {
    "index.html": "Gallery", "wall.html": "Memory Wall",
    "originals.html": "Originals", "stats.html": "Stats",
  };
  const pageLabel = (p) => PAGE_LABELS[p] || (p || "").replace(/\.html$/, "") || "Gallery";

  // Turn a raw referrer URL into a friendly source name.
  const SOURCES = {
    "instagram.com": "Instagram", "t.instagram.com": "Instagram", "l.instagram.com": "Instagram",
    "t.co": "X (Twitter)", "twitter.com": "X (Twitter)", "x.com": "X (Twitter)",
    "facebook.com": "Facebook", "l.facebook.com": "Facebook", "m.facebook.com": "Facebook",
    "wa.me": "WhatsApp", "api.whatsapp.com": "WhatsApp", "chat.whatsapp.com": "WhatsApp",
    "t.me": "Telegram", "out.reddit.com": "Reddit", "reddit.com": "Reddit",
    "youtube.com": "YouTube", "linkedin.com": "LinkedIn", "google.com": "Google",
    "calerio.github.io": "On-site",
  };
  function srcLabel(raw) {
    if (!raw || raw === "(direct)") return "Direct";
    let host = raw;
    try { host = new URL(raw).hostname; } catch {}
    host = host.replace(/^www\./, "");
    if (SOURCES[host]) return SOURCES[host];
    const base = host.split(".").slice(-2).join(".");
    return SOURCES[base] || host || "Direct";
  }

  async function rpc(fn) {
    const r = await fetch(`${API}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: KEY, Authorization: "Bearer " + KEY,
                 "Content-Type": "application/json" },
      body: "{}",
    });
    if (!r.ok) throw new Error(`${fn} ${r.status}`);
    return r.json();
  }

  function fmtDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }

  // ---- renderers ----
  function bignums(s) {
    const items = [
      ["visits", s.total],
      ["visitors", s.visitors],
      ["countries", s.countries],
      ["cities", s.cities],
    ];
    document.getElementById("bignums").innerHTML = items.map(([k, v]) =>
      `<div class="bignum"><span class="n">${(+v || 0).toLocaleString()}</span>
         <span class="k">${k}</span></div>`).join("");
  }

  function list(id, rows, labelFn, max) {
    const top = rows.slice(0, 8);
    const hi = Math.max(1, ...top.map((r) => +r.visits || 0));
    document.getElementById(id).innerHTML = top.map((r) => {
      const v = +r.visits || 0;
      return `<li><span class="bar" style="width:${Math.round(v / hi * 100)}%"></span>
        <span class="lbl">${labelFn(r)}</span><span class="cnt">${v}</span></li>`;
    }).join("") || `<li class="empty">nothing yet</li>`;
  }

  function timeline(rows) {
    const el = document.getElementById("timeline");
    if (!rows.length) {
      el.innerHTML = `<p class="formnote">No visits yet — this chart fills in day by day.</p>`;
      return;
    }
    // fill every day from the first visit to today so it reads as a real axis
    const byDay = {};
    rows.forEach((r) => { byDay[r.day] = +r.visits || 0; });
    const days = [];
    const d = new Date(rows[0].day + "T00:00:00Z");
    const end = new Date();
    for (; d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      days.push({ day: key, visits: byDay[key] || 0 });
    }
    const show = days.slice(-21);                 // last 3 weeks
    const hi = Math.max(1, ...show.map((x) => x.visits));
    el.innerHTML = show.map((x) => {
      const v = x.visits;
      const lbl = new Date(x.day + "T00:00:00Z")
        .toLocaleDateString(undefined, { day: "numeric", month: "short" });
      return `<div class="bar1">
        <b>${v || ""}</b>
        <div class="barcol"><span style="height:${v ? Math.max(8, Math.round(v / hi * 100)) : 0}%"></span></div>
        <i>${lbl}</i>
      </div>`;
    }).join("");
  }

  async function drawMap(geo, countries) {
    const holder = document.getElementById("map");
    let svgText;
    try {
      svgText = await (await fetch("assets/world.svg")).text();
    } catch {
      holder.innerHTML = `<p class="formnote">couldn't load the map.</p>`;
      return;
    }
    holder.innerHTML = svgText;
    const svg = holder.querySelector("svg");
    if (!svg) return;
    const tip = document.getElementById("maptip");

    // group cities under their country code
    const byCC = {};
    geo.forEach((g) => {
      const cc = (g.country_code || "").toUpperCase();
      if (!cc) return;
      (byCC[cc] = byCC[cc] || { country: g.country, cities: [] })
        .cities.push({ city: g.city, visits: +g.visits || 0 });
    });
    // authoritative per-country totals
    const totalByCC = {};
    countries.forEach((c) => { totalByCC[(c.country_code || "").toUpperCase()] = +c.visits || 0; });
    const maxTotal = Math.max(1, ...Object.values(totalByCC));

    let lit = 0;
    svg.querySelectorAll(".country").forEach((path) => {
      const cc = (path.getAttribute("data-cc") || "").toUpperCase();
      const total = totalByCC[cc] ||
        (byCC[cc] ? byCC[cc].cities.reduce((s, x) => s + x.visits, 0) : 0);
      if (total <= 0) return;
      lit++;
      const t = (0.32 + 0.6 * Math.sqrt(total / maxTotal)).toFixed(2);  // shade by volume
      path.style.fill = `rgba(192,96,63,${t})`;
      path.classList.add("lit");
      const name = (byCC[cc] && byCC[cc].country) || path.getAttribute("data-name") || cc;
      const cities = (byCC[cc] ? byCC[cc].cities : [])
        .filter((c) => c.city).sort((a, b) => b.visits - a.visits);
      const body = cities.length
        ? cities.map((c) => `<span class="tipcity">${esc(c.city)}<b>${c.visits}</b></span>`).join("")
        : `<span class="tipcity">${total} visit${total === 1 ? "" : "s"}</span>`;
      const html = `<span class="tiphead">${esc(name)}</span>${body}`;
      const place = (e) => {
        tip.style.left = e.clientX + "px";
        tip.style.top = (e.clientY - 14) + "px";
      };
      path.addEventListener("mouseenter", (e) => { tip.innerHTML = html; tip.hidden = false; place(e); });
      path.addEventListener("mousemove", place);
      path.addEventListener("mouseleave", () => { tip.hidden = true; });
    });

    document.getElementById("mapcap").textContent = lit
      ? `${lit} countr${lit === 1 ? "y" : "ies"} so far — hover one for its cities.`
      : "No locations yet — countries light up as people visit.";
  }

  // ---- load everything ----
  if (!API || !KEY) {
    note.textContent = "Stats aren't connected yet.";
    return;
  }
  Promise.all([
    rpc("visit_summary"), rpc("visit_geo"), rpc("visit_countries"),
    rpc("visit_pages"), rpc("visit_referrers"), rpc("visit_browsers"),
    rpc("visit_devices"), rpc("visit_daily"),
  ]).then(([summary, geo, countries, pages, referrers, browsers, devices, daily]) => {
    const s = summary[0] || { total: 0, visitors: 0, countries: 0, cities: 0 };
    bignums(s);
    drawMap(geo, countries);
    list("countries", countries, (r) => `${flag(r.country_code)} ${esc(r.country)}`);
    list("pages", pages, (r) => esc(pageLabel(r.path)));
    // merge referrer variants (t./l.instagram.com → Instagram) into named sources
    const refAgg = {};
    referrers.forEach((r) => {
      const k = srcLabel(r.referrer);
      refAgg[k] = (refAgg[k] || 0) + (+r.visits || 0);
    });
    const refRows = Object.entries(refAgg)
      .map(([referrer, visits]) => ({ referrer, visits }))
      .sort((a, b) => b.visits - a.visits);
    list("referrers", refRows, (r) => esc(r.referrer));
    // devices summary line + browser bars share the one panel
    const devLine = devices.map((d) => `${esc(d.device)} ${d.visits}`).join(" · ");
    document.getElementById("devices").innerHTML =
      `<li class="devsum">${devLine || "—"}</li>` +
      browsers.slice(0, 6).map((b) => {
        const hi = Math.max(1, ...browsers.map((x) => +x.visits || 0));
        const v = +b.visits || 0;
        return `<li><span class="bar" style="width:${Math.round(v / hi * 100)}%"></span>
          <span class="lbl">${esc(b.browser)}</span><span class="cnt">${v}</span></li>`;
      }).join("");
    timeline(daily);
    note.textContent = s.since ? `Tracking since ${fmtDate(s.since)}.` : "";
  }).catch((e) => {
    note.textContent = "Couldn't load stats right now.";
    console.error(e);
  });
})();
