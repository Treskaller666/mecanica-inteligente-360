/***** app.js — Mecánica Inteligente 360 *****/

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
      id, fecha_hora, servicio, estado, notas,
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
    const notas   = c.notas ? `<div class="text-xs text-stone-500 mt-1">Notas: ${c.notas}</div>` : '';
    return `
      <div class="p-4 bg-white rounded-2xl shadow">
        <p class="font-medium">#${c.id} — ${fmtHora(c.fecha_hora)} — ${marca} ${modelo}
          <span class="text-stone-500 text-sm">(${fmtFecha(c.fecha_hora)})</span>
        </p>
        <p class="text-sm text-stone-600">Cliente: ${cliente} • ${c.servicio ?? ''} • Estado: ${c.estado}</p>
        ${notas}
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

/* ==== Marcar Recepción (actualiza estado y notas de la cita) ==== */
async function marcarRecepcion() {
  const msg = document.getElementById('msg-recepcion');
  const btn = document.getElementById('btn-recepcion');
  const citaId = parseInt(document.getElementById('r-cita-id').value, 10);
  const notas  = document.getElementById('r-notas').value.trim();

  msg.textContent = '';
  msg.className = 'text-sm text-stone-600';

  if (!citaId) {
    msg.textContent = 'Debes ingresar un ID de cita válido.';
    msg.className = 'text-sm text-red-700';
    return;
  }

  btn.disabled = true; 
  btn.textContent = 'Guardando…';

  try {
    const { error } = await withTimeout(
      db.from('citas').update({ estado: 'en_recepción', notas }).eq('id', citaId),
      15000,
      'marcar recepción'
    );

    if (error) throw error;

    msg.textContent = '✅ Cita marcada en recepción';
    msg.className = 'text-sm text-green-700';

    // refresca la lista para ver el nuevo estado
    await listarCitas();
  } catch (err) {
    msg.textContent = '❌ Error: ' + err.message;
    msg.className = 'text-sm text-red-700';
  } finally {
    btn.disabled = false; 
    btn.textContent = 'Marcar recepción';
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

  // Agenda: crear cita
  const btnCrear = document.getElementById('btn-crear');
  if (btnCrear) btnCrear.addEventListener('click', crearCitaDesdeForm);

  // Recepción: marcar recepción
  const btnRecepcion = document.getElementById('btn-recepcion');
  if (btnRecepcion) btnRecepcion.addEventListener('click', marcarRecepcion);
});
