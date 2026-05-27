// T812 archive — front-end configuration.
//
// The anon/public key is SAFE to put here and commit: it is meant to live in
// the browser, and the Supabase Row-Level Security rules (see supabase/setup.sql)
// are what actually protect your data. Never put the service_role/secret key here.
window.T812_CONFIG = {
  SUPABASE_URL: "https://zrvebgtkhzosfybejnpv.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable__aGwrCO3lDzFzjmdxZwhxw_k6wlrtaA",
};
