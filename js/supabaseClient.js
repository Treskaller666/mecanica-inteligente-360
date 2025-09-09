// js/supabaseClient.js
const { createClient } = supabase;

// ⚠️ Pega aquí tus credenciales reales de Supabase
const SUPABASE_URL = "https://wtnyddzpmawxgusbdolc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0bnlkZHpwbWF3eGd1c2Jkb2xjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNzQxMzQsImV4cCI6MjA3Mjk1MDEzNH0.rROnx03jHeI-eqQqw223Sf-b6EyZuu3rfIL-_ltfs_c";

window.SUPABASE_URL = SUPABASE_URL;          // para diagnóstico
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY; // para diagnóstico

// Crear cliente y exponerlo globalmente
window._supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Mostrar conexión y largo de la key (para confirmar que no quedó “cortada”)
window.addEventListener('DOMContentLoaded', () => {
  const s = document.getElementById('estado-app');
  if (s) s.textContent = `✅ Conectado a Supabase: ${SUPABASE_URL} • anon len: ${SUPABASE_ANON_KEY.length}`;
});
