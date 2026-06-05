// src/lib/drive.js
// Envía logs y datos a Google Drive via Supabase Edge Function

const FOLDER_ID    = '1BaCrhYG7YdpGi86WQxDaaUPfkB8hdPw1'
const FUNCTION_URL = `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/log-to-drive`
const ANON_KEY     = process.env.REACT_APP_SUPABASE_ANON_KEY

async function callDrive(tipo, datos) {
  try {
    await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`
      },
      body: JSON.stringify({ tipo, datos, folder_id: FOLDER_ID })
    })
  } catch {
    // No bloquear el portal si Drive falla
  }
}

// ── VENTAS ──
export async function logVenta(venta) {
  await callDrive('venta', venta)
}

// ── LOG GENERAL DE ACTIVIDAD ──
export async function logActividad({ usuario, accion, detalle, tabla }) {
  await callDrive('log', { usuario, accion, detalle, tabla })
}

// ── DESPACHOS ──
export async function logDespacho({ usuario, accion, cliente, producto, estado, ciudad }) {
  await callDrive('log', {
    usuario,
    accion,
    detalle: `${cliente} | ${producto} | ${ciudad} | Estado: ${estado}`,
    tabla:   'despachos'
  })
}

// ── RETOMAS ──
export async function logRetoma({ usuario, referencia, imei, valor, asesor }) {
  await callDrive('log', {
    usuario,
    accion:  'RETOMA',
    detalle: `Ref: ${referencia} | IMEI: ${imei || '—'} | Valor: $${valor || 0} | Asesor: ${asesor}`,
    tabla:   'retomas'
  })
}

// ── INVENTARIO ──
export async function logInventario({ usuario, producto, imei, proveedor, costo, accion = 'INGRESO_INVENTARIO' }) {
  await callDrive('log', {
    usuario,
    accion,
    detalle: `${producto} | IMEI: ${imei || '—'} | Proveedor: ${proveedor || '—'} | Costo: $${costo || 0}`,
    tabla:   'compras_proveedor'
  })
}

// ── USUARIOS ──
export async function logUsuario({ usuario, accion, emailAfectado, rolNuevo }) {
  await callDrive('log', {
    usuario,
    accion,
    detalle: `Usuario: ${emailAfectado} | Rol: ${rolNuevo || '—'}`,
    tabla:   'perfiles'
  })
}

// ── PROVEEDORES / ABONOS ──
export async function logAbono({ usuario, proveedor, valor, medio }) {
  await callDrive('log', {
    usuario,
    accion:  'ABONO_PROVEEDOR',
    detalle: `Proveedor: ${proveedor} | Valor: $${valor} | Medio: ${medio}`,
    tabla:   'abonos_proveedor'
  })
}