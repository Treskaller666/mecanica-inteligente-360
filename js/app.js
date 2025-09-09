/***** app.js — Mecánica Inteligente 360 *****/

/* ==== Diagnóstico visible (muestra mensajes en #estado-app) ==== */
async function diag(msg, color='stone') {
  const p = document.getElementById('estado-app');
  if (!p) return;
  const cls = { stone:'text-stone-700', red:'text-red-700', green:'text-green-700', blue:'text-blue-700' };
  p.className = 'text-sm ' + (cls[color]||cls.stone);
  p.textContent = msg;
}

/* Prueba de conectividad paso a paso (3 tests) */
async function diagnostico() {
  try {
    if (!window.SUPABASE_URL) { await diag('❌ No hay SUPABASE_URL. Revisa supabaseClient.js', 'red'); return; }

    // Test 1: endpoint público (sin headers)
   // Test 1: endpoint público (algunos proyectos devuelven 401, lo ignoramos)
await diag('🔎 Test 1/3: /auth/v1/health…', 'blue');
const r1 = await fetch(`${window.SUPABASE_URL}/auth/v1/health`);
if (!r1.ok && r1.status !== 401) { 
  await diag(`❌ Test 1/3: ${r1.status}`, 'red'); 
  return; 
}


    // Test 2: REST (con headers) — valida anon key y CORS
    await diag('🔎 Test 2/3: /rest/v1/citas?select=id…', 'blue');
    const r2 = await fetch(`${window.SUPABASE_URL}/rest/v1/citas?select=id&limit=1`, {
      headers: {
        apikey: window.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${window.SUPABASE_ANON_KEY}`
      }
    });
    const text2 = await r2.text();
    if (!r2.ok) { await diag(`❌ Test 2/3: ${r2.status} ${text2.slice(0,80)}`, 'red'); return; }

    // Test 3: cliente oficial supabase-js
    await diag('🔎 Test 3/3: supabase-js select…', 'blue');
    if (!window._supabase) { await diag('❌ Test 3/3: _supabase no inicializado (orden de scripts)', 'red'); return; }
    const { data, error } = await window._supabase.from('citas').select('id').limit(1);
    if (error) { await diag(`❌ Test 3/3: ${error.message}`, 'red'); return; }

    await diag('✅ Conexión OK (3/3).', 'green');
  } catch (e) {
    await diag(`❌ Excepción de red: ${e}`, 'red');
  }
}
window.addEventListener('DOMContentLoaded', diagnostico);

/* ==== Espera a que supabaseClient haya creado el cliente ==== */
let db = null;
async function waitForSupabase(maxTries = 20, delayMs = 150) {
  for (let i = 0; i < maxTries; i++) {
    if (window._supabase) { db = window._supabase; return true; }
    await new Promise(r => setTimeout(r, delayMs));
  }
  return false;
}

/* ==== Helper: timeout para evitar cuelgues en fetch/SDK ==== */
function withTimeout(promise, ms = 15000, label = 'operación') {
  let timer;
  const timeout = new Promise((_, rej) => {
    timer = setTimeout(() => rej(new Error(`⏳ Tiempo agotado en ${label}`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/* ==== Utilidades de formato ==== */
const fmtHora  = ts => new Date(ts).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'});
const fmtFecha = ts => new Date(ts).toLocaleDateString('es-CL');

/* ==== Listar citas ==== */
async function listarCitas() {
  const cont = document.getElementById('lista-citas');
  if (!cont) return;

  cont.innerHTML = '<div class="p-4 bg-white rounded-2xl shadow text-sm text-stone-600">Cargando citas…</div>';

  const { data, error } = await withTimeout(
    db.from('citas').select(`
      id, fecha_hora, servicio, estado,
      vehiculos (
        marca, modelo,
        clientes ( nombre )
      )
    `).order('fecha_hora', { ascending: true }).limit(50),
    15000,
    'listar citas'
  );

  if (error) {
    cont.innerHTML = `<div class="p-4 bg-white rounded-2xl shadow text-red-700">Error al cargar: ${error.message}</div>`;
    return;
  }

  if (!data || data.length === 0) {
    cont.innerHTML = `<div class="p-4 bg-white rounded-2xl shadow text-stone-600">Sin citas registradas aún.</div>`;
    return;
  }

  cont.innerHTML = data.map(c => {
    const marca   = c.vehiculos?.marca ?? '—';
    const modelo  = c.vehiculos?.modelo ?? '';
    const cliente = c.vehiculos?.clientes?.nombre ?? 'Cliente';
    return `
      <div class="p-4 bg-white rounded-2xl shadow">
        <p class="font-medium">${fmtHora(c.fecha_hora)} — ${marca} ${modelo}
          <span class="text-stone-500 text-sm">(${fmtFecha(c.fecha_hora)})</span>
        </p>
        <p class="text-sm text-stone-600">Cliente: ${cliente} • ${c.servicio ?? ''} • Estado: ${c.estado}</p>
      </div>
    `;
  }).join('');
}

/* ==== Crear cita (cliente → vehículo → cita) ==== */
async function crearCitaDesdeForm() {
  const msg = document.getElementById('msg-cita');
  const btn = document.getElementById('btn-crear');

  const nombre   = document.getElementById('f-nombre').value.trim();
  const telefono = document.getElementById('f-telefono').value.trim() || null;
  const marca    = document.getElementById('f-marca').value.trim();
  const modelo   = document.getElementById('f-modelo').value.trim();
  const anio     = parseInt(document.getElementById('f-anio').value, 10);
  const fechaStr = document.getElementById('f-fecha').value;
  const servicio = document.getElementById('f-servicio').value.trim();

  msg.textContent = '';
  msg.className = 'text-sm text-stone-600';

  if (!nombre || !marca || !modelo || !anio || !fechaStr || !servicio) {
    msg.textContent = 'Completa todos los campos obligatorios.';
    msg.className = 'text-sm text-red-700';
    return;
  }

  const fechaISO = new Date(fechaStr).toISOString();

  btn.disabled = true;
  btn.textContent = 'Creando...';

  try {
    if (!db) throw new Error('Supabase no está inicializado (orden de scripts)');

    // 1) Cliente
    msg.textContent = 'Creando cliente…';
    const { data: cte, error: e1 } = await withTimeout(
      db.from('clientes').insert({ nombre, telefono }).select().single(),
      15000,
      'crear cliente'
    );
    if (e1) throw new Error('Error cliente: ' + e1.message);

    // 2) Vehículo
    msg.textContent = 'Creando vehículo…';
    const { data: veh, error: e2 } = await withTimeout(
      db.from('vehiculos').insert({ cliente_id: cte.id, marca, modelo, anio }).select().single(),
      15000,
      'crear vehículo'
    );
    if (e2) throw new Error('Error vehículo: ' + e2.message);

    // 3) Cita
    msg.textContent = 'Creando cita…';
    const { error: e3 } = await withTimeout(
      db.from('citas').insert({ vehiculo_id: veh.id, fecha_hora: fechaISO, servicio, estado: 'confirmada' }),
      15000,
      'crear cita'
    );
    if (e3) throw new Error('Error cita: ' + e3.message);

    msg.textContent = '✅ Cita creada';
    msg.className = 'text-sm text-green-700';
    document.getElementById('form-cita').reset();
    await listarCitas();

  } catch (err) {
    msg.textContent = '❌ ' + (err?.message || String(err));
    msg.className = 'text-sm text-red-700';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Crear cita';
  }
}

/* ==== Inicio ==== */
window.addEventListener('DOMContentLoaded', async () => {
  const ok = await waitForSupabase();
  if (!ok) {
    const cont = document.getElementById('lista-citas');
    if (cont) cont.innerHTML = `<div class="p-4 bg-white rounded-2xl shadow text-red-700">
      Supabase no está inicializado. Revisa que en index.html se cargue primero
      <code>js/supabaseClient.js</code> y luego <code>js/app.js</code>.
    </div>`;
    return;
  }
  await listarCitas();

  const btn = document.getElementById('btn-crear');
  if (btn) btn.addEventListener('click', crearCitaDesdeForm);
});

