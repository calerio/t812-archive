// T812 visit beacon — logs one aggregate-only pageview to Supabase.
// Privacy-light: stores coarse geo (country/city), browser/device, NO raw IP.
// Fire-and-forget; never blocks the page and silently no-ops on any failure.
(function () {
  const cfg = window.T812_CONFIG || {};
  const URL = (cfg.SUPABASE_URL || "").replace(/\/$/, "");
  const KEY = cfg.SUPABASE_ANON_KEY || "";
  if (!URL || !KEY) return;

  // don't log local dev
  const host = location.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "") return;

  // rough, anonymous visitor id (not tied to any identity)
  let vid;
  try {
    vid = localStorage.getItem("t812_vid");
    if (!vid) {
      vid = (crypto.randomUUID && crypto.randomUUID()) ||
            Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("t812_vid", vid);
    }
  } catch { vid = null; }

  const ua = navigator.userAgent || "";
  const m = (re) => (re.test(ua));
  const browser =
    m(/Edg\//) ? "Edge" :
    m(/OPR\/|Opera/) ? "Opera" :
    m(/Firefox\//) ? "Firefox" :
    m(/Chrome\//) && !m(/Edg\/|OPR\//) ? "Chrome" :
    m(/Safari\//) && m(/Version\//) ? "Safari" : "Other";
  const os =
    m(/iPhone|iPad|iPod/) ? "iOS" :
    m(/Android/) ? "Android" :
    m(/Mac OS X/) ? "macOS" :
    m(/Windows/) ? "Windows" :
    m(/Linux/) ? "Linux" : "Other";
  const device =
    m(/iPad|Tablet/) ? "tablet" :
    m(/Mobi|iPhone|Android.*Mobile/) ? "mobile" : "desktop";

  const page = (location.pathname.split("/").pop() || "index.html") || "index.html";
  const ref = (document.referrer && document.referrer.indexOf(location.host) === -1)
    ? document.referrer.slice(0, 300) : "";

  let lang = "", tz = "", screenSize = "";
  try { lang = (navigator.language || "").slice(0, 20); } catch {}
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch {}
  try { screenSize = `${screen.width}x${screen.height}`; } catch {}

  function send(geo) {
    const row = {
      visitor: vid, path: page, referrer: ref,
      browser, os, device, screen: screenSize, lang, tz,
      country: geo.country || null, country_code: geo.country_code || null,
      city: geo.city || null, region: geo.region || null,
      lat: geo.lat ?? null, lon: geo.lon ?? null,
    };
    fetch(`${URL}/rest/v1/visits`, {
      method: "POST",
      headers: { apikey: KEY, Authorization: "Bearer " + KEY,
                 "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(row),
      keepalive: true,
    }).catch(() => {});
  }

  // Coarse geo from GeoJS — free, keyless, browser-CORS-friendly. The lookup's
  // response includes our IP but we never store it; no-referrer also keeps the
  // unlisted site URL out of GeoJS's logs.
  const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
  fetch("https://get.geojs.io/v1/ip/geo.json", { referrerPolicy: "no-referrer" })
    .then((r) => r.json())
    .then((g) => send(g && (g.country || g.latitude) ? {
      country: g.country, country_code: g.country_code,
      region: g.region, city: g.city,
      lat: num(g.latitude), lon: num(g.longitude),
    } : {}))
    .catch(() => send({}));   // still log the visit, just without geo
})();
