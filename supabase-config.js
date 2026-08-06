// MO SaaS Supabase configuration.
// Weka Project URL na anon public key kutoka Supabase Dashboard > Project Settings > API.
window.MO_SUPABASE_CONFIG = {
  url: 'https://wlmnijgbyehnprwszeia.supabase.co',
  anonKey: 'PASTE_YOUR_SUPABASE_ANON_KEY_HERE',
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
