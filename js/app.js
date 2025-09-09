const db = window._supabase;

// Utilidades de formato
const fmtHora = (ts) => new Date(ts).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'});
const fmtFecha = (ts) => new Date(ts).toLocaleDateString('es-CL');

// Render de la lista de citas
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
    console.error(error);
    cont.innerHTML = `<div class="p-4 bg-white rounded-2xl shadow text-red-700">Error al cargar: ${error.message}</div>`;
    return;
  }

  if (!data || data.length === 0) {
    cont.innerHTML = `<div class="p-4 bg-white rounded-2xl shadow text-stone-600">Sin citas registradas aún.</div>`;
    return;
  }

  cont.innerHTML = data.map(c => {
    const marca = c.vehiculos?.marca ?? '—';
    const modelo = c.vehiculos?.modelo ?? '';
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

// Crear cita a partir del formulario
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

  // Refrescar lista
  listarCitas();
}

// Wiring
window.addEventListener('DOMContentLoaded', () => {
  // Listado inicial
  listarCitas();

  // Submit form
  const btn = document.getElementById('btn-crear');
  if (btn) btn.addEventListener('click', crearCitaDesdeForm);
});


