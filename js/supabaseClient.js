const { createClient } = supabase;

// ⚠️ Reemplaza con los valores de tu proyecto
const SUPABASE_URL = "https://wtnyddzpmawxgusbdolc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0bnlkZHpwbWF3eGd1c2Jkb2xjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNzQxMzQsImV4cCI6MjA3Mjk1MDEzNH0.rROnx03jHeI-eqQqw223Sf-b6EyZuu3rfIL-_ltfs_c";

window._supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
;

/ Actualiza el indicador en pantalla (sin F12)
window.addEventListener('DOMContentLoaded', () => {
  const s = document.getElementById('estado-app');
  if (s) s.textContent = `✅ Conectado a Supabase: ${SUPABASE_URL}`;
});
