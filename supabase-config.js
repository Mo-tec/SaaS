// MO SaaS Supabase configuration.
// Weka Project URL na anon public key kutoka Supabase Dashboard > Project Settings > API.
window.MO_SUPABASE_CONFIG = {
  url: 'https://wlmnijgbyehnprwszeia.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsbW5pamdieWVobnByd3N6ZWlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3ODMwNzgsImV4cCI6MjEwMTM1OTA3OH0.99L1j9msgsi1RoLRsSYlfa09BzJZdQ1hz-swjNC31Ok',
  enabled: true
};

window.moSupabase = null;

if (
  window.supabase
  && window.MO_SUPABASE_CONFIG.enabled
  && !window.MO_SUPABASE_CONFIG.url.includes('WEKA_')
  && !window.MO_SUPABASE_CONFIG.anonKey.includes('WEKA_')
) {
  window.moSupabase = window.supabase.createClient(
    window.MO_SUPABASE_CONFIG.url,
    window.MO_SUPABASE_CONFIG.anonKey
  );
}

if (window.moSupabase) {
  console.info('Supabase client initialized successfully.');
} else if (window.MO_SUPABASE_CONFIG.enabled) {
  console.warn('Supabase config enabled but client was not created. Check the Supabase script and config.');
}
