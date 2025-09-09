/***** app.js — Mecánica Inteligente 360 *****/
// === DIAGNÓSTICO VISUAL (muestra resultados en la página) ===
async function diagMostrar(msg, color='stone') {
  const p = document.getElementById('estado-app');
  if (!p) return;
  const map = { stone:'text-stone-700', red:'text-red-700', green:'text-green-700', blue:'text-blue-700' };
  p.className = `text-sm ${map[color]||map.stone}`;
  p.textContent = msg;
}

async function diagnosticoConexion() {
  try {
    const URL = (typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : (window._supabase?.url || ''));
    if (!URL) {
      await diagMostrar('❌ No hay SUPABASE_URL / _supabase.url. Revisa supabaseClient.js y el orden de scripts.', 'red');
      return;
    }

    // 1) Ping simple a Auth (no requiere headers). Si esto falla, es red/DNS/CORS del navegador.
    await diagMostrar('🔎 Test 1/3: ping a /auth/v1/health…', 'blue');
    const r1 = await fetch(`${URL}/auth/v1/health`);
    const t1 = await r1.text();
    if (!r1.ok) { await diagMostrar(`❌ Test 1/3 falló: ${r1.status} ${t1.slice(0,60)}`, 'red'); return; }

    // 2) Llamada REST a /rest/v1/citas (con headers). Prueba CORS + credenciales.
    await diagMostrar('🔎 Test 2/3: REST /rest/v1/citas?select=id…', 'blue');
    const key = (typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : window._supabase?.supabaseKey);
    const r2 = await fetch(`${URL}/rest/v1/citas?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }
    });
    const t2 = await r2.text();
    if (!r2.ok) {
      await diagMostrar(`❌ Test 2/3 falló: ${r2.status} ${t2.slice(0,120)}`, 'red');
      return;
    }

    // 3) Cliente JS oficial (supabase-js) – select real usando la librería.
    await diagMostrar('🔎 Test 3/3: cliente supabase-js select citas…', 'blue');
    if (!window._supabase) {
      await diagMostrar('❌ Test 3/3: _supabase no está inicializado (revisa orden de scripts).', 'red');
      return;
    }
    const { data, error } = await window._supabase.from('citas').select('id').limit(1);
    if (error) {
      await diagMostrar(`❌ Test 3/3 error cliente: ${error.message}`, 'red');
      return;
    }

    await diagMostrar('✅ Conexión OK: tests 1/3, 2/3 y 3/3 pasaron. Si aún falla crear/listar, es lógica del form.', 'green');
  } catch (e) {
    await diagMostrar(`❌ Excepción de red: ${e}`, 'red');
  }
}
// Lanza diagnóstico al cargar
window.addEventListener('DOMContentLoaded', diagnosticoConexion);

/* Espera a que supabaseClient.js inicialice window._supabase */
let db = null;
async function waitForSupabase(maxTries = 20, delayMs = 150) {
  for (let i = 0; i < maxTries; i++) {
    if (window._supabase) {
      db = window._supabase;
      return true;
    }
    await new Promise(r => setTimeout(r, delayMs));
  }
  return false;
}

/* Utilidades de formato */
const fmtHora  = ts => new Date(ts).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'});
const fmtFecha = ts => new Date(ts).toLocaleDateString('es-CL');

/* Render de la lista de citas */
async function listarCitas() {
  const cont = document.getElementById('lista-citas');
  if (!cont) return;

  cont.innerHTML = '<div class="p-4 bg-white rounded-2xl shadow text-sm text-stone-600">Cargando citas…</div>';

  const { data, error } = await db
    .from('citas')
    .select(`
      id, fecha_hora, servicio, estado,
      vehiculos (
        marca, modelo,
        clientes ( nombre )
      )
    `)
    .order('fecha_hora', { ascending: true })
    .limit(50);

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

/* Crear cita a partir del formulario (cliente → vehículo → cita) */
async function crearCitaDesdeForm() {
  const msg = document.getElementById('msg-cita');
  const btn = document.getElementById('btn-crear');

  const nombre   = document.getElementById('f-nombre').value.trim();
  const telefono = document.getElementById('f-telefono').value.trim() || null;
  const marca    = document.getElementById('f-marca').value.trim();
  const modelo   = document.getElementById('f-modelo').value.trim();
  const anio     = parseInt(document.getElementById('f-anio').value, 10);
  const fechaStr = document.getElementById('f-fecha').value; // "YYYY-MM-DDTHH:MM"
  const servicio = document.getElementById('f-servicio').value.trim();

  msg.textContent = '';
  msg.className = 'text-sm';

  // Validaciones mínimas
  if (!nombre || !marca || !modelo || !anio || !fechaStr || !servicio) {
    msg.textContent = 'Completa todos los campos obligatorios.';
    msg.classList.add('text-red-700');
    return;
  }

  const fechaISO = new Date(fechaStr).toISOString();

  // Bloquear botón mientras insertamos
  btn.disabled = true;
  btn.textContent = 'Creando...';

  // 1) Cliente
  const { data: cte, error: e1 } = await db
    .from('clientes')
    .insert({ nombre, telefono })
    .select()
    .single();
  if (e1) {
    msg.textContent = 'Error cliente: ' + e1.message;
    msg.classList.add('text-red-700'); btn.disabled = false; btn.textContent = 'Crear cita'; return;
  }

  // 2) Vehículo
  const { data: veh, error: e2 } = await db
    .from('vehiculos')
    .insert({ cliente_id: cte.id, marca, modelo, anio })
    .select()
    .single();
  if (e2) {
    msg.textContent = 'Error vehículo: ' + e2.message;
    msg.classList.add('text-red-700'); btn.disabled = false; btn.textContent = 'Crear cita'; return;
  }

  // 3) Cita
  const { error: e3 } = await db
    .from('citas')
    .insert({ vehiculo_id: veh.id, fecha_hora: fechaISO, servicio, estado: 'confirmada' });
  if (e3) {
    msg.textContent = 'Error cita: ' + e3.message;
    msg.classList.add('text-red-700'); btn.disabled = false; btn.textContent = 'Crear cita'; return;
  }

  // Éxito
  msg.textContent = '✅ Cita creada';
  msg.classList.add('text-green-700');
  document.getElementById('form-cita').reset();
  btn.disabled = false; btn.textContent = 'Crear cita';

  // Refrescar listado
  listarCitas();
}

/* Inicio: espera Supabase, luego arma eventos y carga lista */
window.addEventListener('DOMContentLoaded', async () => {
  const ok = await waitForSupabase();
  if (!ok) {
    // Mensaje visible si algo falló con la carga del cliente
    const cont = document.getElementById('lista-citas');
    if (cont) cont.innerHTML = `<div class="p-4 bg-white rounded-2xl shadow text-red-700">
      Supabase no está inicializado. Revisa que en index.html se cargue
      primero <code>js/supabaseClient.js</code> y luego <code>js/app.js</code>.
    </div>`;
    return;
  }

  // Listado inicial
  await listarCitas();

  // Submit form
  const btn = document.getElementById('btn-crear');
  if (btn) btn.addEventListener('click', crearCitaDesdeForm);
});
