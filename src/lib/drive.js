// src/lib/drive.js
// Envía logs y ventas a Google Drive via Supabase Edge Function

const FOLDER_ID = '1BaCrhYG7YdpGi86WQxDaaUPfkB8hdPw1'
const FUNCTION_URL = `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/log-to-drive`
const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY

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

export async function logActividad({ usuario, accion, detalle, tabla }) {
  await callDrive('log', { usuario, accion, detalle, tabla })
}

export async function logVenta(venta) {
  await callDrive('venta', venta)
}
