const { createClient } = supabase;

// ⚠️ Reemplaza con los valores de tu proyecto
const SUPABASE_URL = "https://wtnyddzpmawxgusbdolc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...."; // tu anon key completa

// Crear cliente Supabase y exponerlo globalmente
window._supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Mensaje en pantalla al cargar
window.addEventListener('DOMContentLoaded', () => {
  const s = document.getElementById('estado-app');
  if (s) s.textContent = `✅ Conectado a Supabase: ${SUPABASE_URL}`;
});
