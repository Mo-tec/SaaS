// MO SaaS Supabase configuration.
// Weka Project URL na anon public key kutoka Supabase Dashboard > Project Settings > API.
window.MO_SUPABASE_CONFIG = {
  url: 'https://sipzwwlrdycpvfswvszc.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpcHp3d2xyZHljcHZmc3d2c3pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2ODA4MTEsImV4cCI6MjA5NjI1NjgxMX0.LnfYSLx8ReGcMDIR7csg02zLR3ERYFGfnndl36fyXfg',
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
