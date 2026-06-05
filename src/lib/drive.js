// src/lib/drive.js
// Escribe directo en Google Sheets via Edge Function de Supabase

const FUNCTION_URL = `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/log-to-drive`
const ANON_KEY     = process.env.REACT_APP_SUPABASE_ANON_KEY

async function callDrive(tipo, datos) {
  try {
    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`
      },
      body: JSON.stringify({ tipo, datos })
    })
    if (!res.ok) {
      const err = await res.text()
      console.warn('Drive error:', err)
    }
  } catch(e) {
    console.warn('Drive no disponible:', e.message)
  }
}

export async function logVenta(venta) {
  await callDrive('venta', venta)
}

export async function logActividad({ usuario, accion, detalle, tabla }) {
  await callDrive('log', { usuario, accion, detalle, tabla })
}

export async function logDespacho({ usuario, accion, cliente, producto, estado, ciudad }) {
  await callDrive('log', { usuario, accion, detalle: `${cliente} | ${producto} | ${ciudad} | ${estado}`, tabla: 'despachos' })
}

export async function logRetoma({ usuario, referencia, imei, valor, asesor }) {
  await callDrive('log', { usuario, accion: 'RETOMA', detalle: `Ref: ${referencia} | IMEI: ${imei||'—'} | $${valor||0} | ${asesor}`, tabla: 'retomas' })
}

export async function logInventario({ usuario, producto, imei, proveedor, costo, accion = 'INGRESO_INVENTARIO' }) {
  await callDrive('log', { usuario, accion, detalle: `${producto} | IMEI: ${imei||'—'} | ${proveedor||'—'} | $${costo||0}`, tabla: 'compras_proveedor' })
}

export async function logUsuario({ usuario, accion, emailAfectado, rolNuevo }) {
  await callDrive('log', { usuario, accion, detalle: `${emailAfectado} | Rol: ${rolNuevo||'—'}`, tabla: 'perfiles' })
}

export async function logAbono({ usuario, proveedor, valor, medio }) {
  await callDrive('log', { usuario, accion: 'ABONO_PROVEEDOR', detalle: `${proveedor} | $${valor} | ${medio}`, tabla: 'abonos_proveedor' })
}
