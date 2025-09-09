const db = window._supabase;

// Utilidad: formatea "10:00" y "dd/mm/aaaa"
function fmtHora(ts) {
  try { return new Date(ts).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'}); }
  catch { return ts; }
}
function fmtFecha(ts) {
  try { return new Date(ts).toLocaleDateString('es-CL'); }
  catch { return ts; }
}

// LISTAR CITAS (con join a vehiculo y cliente)
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
    cont.innerHTML = `<div class="p-4 bg-white rounded-2xl shadow text-red-700">Error al cargar citas: ${error.message}</div>`;
    return;
  }

  if (!data || data.length === 0) {
    cont.innerHTML = `<div class="p-4 bg-white rounded-2xl shadow text-stone-600">Sin citas registradas todavía.</div>`;
    return;
  }

  cont.innerHTML = data.map(c => {
    const marca = c.vehiculos?.marca ?? '—';
    const modelo = c.vehiculos?.modelo ?? '';
    const cliente = c.vehiculos?.clientes?.nombre ?? 'Cliente';
    return `
      <div class="p-4 bg-white rounded-2xl shadow">
        <p class="font-medium">${fmtHora(c.fecha_hora)} — ${marca} ${modelo} <span class="text-stone-500 text-sm">(${fmtFecha(c.fecha_hora)})</span></p>
        <p class="text-sm text-stone-600">Cliente: ${cliente} • ${c.servicio ?? ''} • Estado: ${c.estado}</p>
      </div>
    `;
  }).join('');
}

// CREAR CITA RÁPIDA (crea cliente → vehículo → cita)
async function crearCitaRapida() {
  const nombre = prompt('Nombre del cliente:');
  if (!nombre) return;

  const marca = prompt('Marca del vehículo (p.ej. Toyota):') || 'Toyota';
  const modelo = prompt('Modelo (p.ej. Yaris):') || 'Yaris';
  const anioStr = prompt('Año (p.ej. 2019):') || '2019';
  const anio = parseInt(anioStr, 10) || 2019;

  const fechaStr = prompt('Fecha y hora (YYYY-MM-DD HH:MM, ej. 2025-09-09 10:00):');
  const fecha_hora = fechaStr ? new Date(fechaStr.replace(' ', 'T')) : new Date(Date.now() + 24*60*60*1000);

  const servicio = prompt('Servicio (p.ej. Mantención 10k):') || 'Mantención 10k';

  // 1) Cliente
  let { data: cte, error: e1 } = await db
    .from('clientes')
    .insert({ nombre })
    .select()
    .single();
  if (e1) { alert('Error creando cliente: ' + e1.message); return; }

  // 2) Vehículo
  let { data: veh, error: e2 } = await db
    .from('vehiculos')
    .insert({ cliente_id: cte.id, marca, modelo, anio })
    .select()
    .single();
  if (e2) { alert('Error creando vehículo: ' + e2.message); return; }

  // 3) Cita
  let { error: e3 } = await db
    .from('citas')
    .insert({
      vehiculo_id: veh.id,
      fecha_hora: fecha_hora.toISOString(),
      servicio,
      estado: 'confirmada'
    });
  if (e3) { alert('Error creando cita: ' + e3.message); return; }

  alert('✅ Cita creada');
  listarCitas();
}

// Carga inicial
window.addEventListener('DOMContentLoaded', () => {
  listarCitas();
  // Expone funciones al HTML:
  window.crearCitaRapida = crearCitaRapida;
});

