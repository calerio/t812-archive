// Tiny Supabase REST client for the memory wall — no SDK, just fetch().
// Exposes window.Supa with: configured(), getMemories({photo}), postMemory({...}).
(function () {
  const cfg = window.T812_CONFIG || {};
  const URL = (cfg.SUPABASE_URL || "").replace(/\/$/, "");
  const KEY = cfg.SUPABASE_ANON_KEY || "";
  const ready = Boolean(URL && KEY);

  const headers = {
    apikey: KEY,
    Authorization: "Bearer " + KEY,
  };

  async function getMemories({ photo } = {}) {
    if (!ready) return [];
    let q = `${URL}/rest/v1/memories?approved=eq.true` +
            `&select=name,message,photo,chapter,created_at&order=created_at.desc`;
    if (photo) q += `&photo=eq.${encodeURIComponent(photo)}`;
    const r = await fetch(q, { headers });
    if (!r.ok) throw new Error("read failed: " + r.status);
    return r.json();
  }

  async function postMemory({ name, message, photo, chapter }) {
    if (!ready) throw new Error("not-configured");
    const r = await fetch(`${URL}/rest/v1/memories`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        name: (name || "").trim() || null,
        message: (message || "").trim(),
        photo: photo || null,
        chapter: chapter || null,
      }),
    });
    if (!r.ok) throw new Error("post failed: " + r.status);
  }

  window.Supa = { configured: () => ready, getMemories, postMemory };
})();
