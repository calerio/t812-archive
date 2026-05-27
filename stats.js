// T812 stats page — reads aggregate-only data (SECURITY DEFINER RPCs) and draws
// the headline numbers, a world map of visits, breakdown lists, and a timeline.
// No raw rows or personal data ever reach the browser.
(function () {
  const cfg = window.T812_CONFIG || {};
  const URL = (cfg.SUPABASE_URL || "").replace(/\/$/, "");
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

  async function rpc(fn) {
    const r = await fetch(`${URL}/rest/v1/rpc/${fn}`, {
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
    if (!rows.length) { el.innerHTML = `<p class="formnote">no visits yet</p>`; return; }
    const hi = Math.max(1, ...rows.map((r) => +r.visits || 0));
    el.innerHTML = rows.map((r) => {
      const v = +r.visits || 0;
      const lbl = new Date(r.day).toLocaleDateString(undefined, { day: "numeric", month: "short" });
      return `<div class="bar1" title="${lbl}: ${v} visit${v === 1 ? "" : "s"}">
        <span style="height:${Math.max(4, Math.round(v / hi * 100))}%"></span></div>`;
    }).join("");
  }

  async function drawMap(geo) {
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
    const NS = "http://www.w3.org/2000/svg";
    const pins = document.createElementNS(NS, "g");
    pins.setAttribute("class", "pins");
    const hi = Math.max(1, ...geo.map((g) => +g.visits || 0));
    geo.filter((g) => g.lat != null && g.lon != null)
       .sort((a, b) => (+b.visits) - (+a.visits))
       .forEach((g) => {
      const cx = projX(+g.lon), cy = projY(+g.lat);
      const v = +g.visits || 0;
      const r = 3 + Math.sqrt(v / hi) * 11;
      const halo = document.createElementNS(NS, "circle");
      halo.setAttribute("class", "pin-halo");
      halo.setAttribute("cx", cx); halo.setAttribute("cy", cy);
      halo.setAttribute("r", r + 4);
      const dot = document.createElementNS(NS, "circle");
      dot.setAttribute("class", "pin");
      dot.setAttribute("cx", cx); dot.setAttribute("cy", cy);
      dot.setAttribute("r", r);
      const title = document.createElementNS(NS, "title");
      const where = [g.city, g.country].filter(Boolean).join(", ") || "Somewhere";
      title.textContent = `${where} — ${v} visit${v === 1 ? "" : "s"}`;
      dot.appendChild(title);
      pins.appendChild(halo); pins.appendChild(dot);
    });
    svg.appendChild(pins);
    const places = geo.length;
    document.getElementById("mapcap").textContent =
      places ? `${places} place${places === 1 ? "" : "s"} on the map — hover a pin for the count.`
             : "No locations yet — pins will appear as people visit.";
  }

  // ---- load everything ----
  if (!URL || !KEY) {
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
    drawMap(geo);
    list("countries", countries, (r) => `${flag(r.country_code)} ${esc(r.country)}`);
    list("pages", pages, (r) => esc(r.path));
    list("referrers", referrers, (r) => esc(r.referrer));
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
