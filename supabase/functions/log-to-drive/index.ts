// supabase/functions/log-to-drive/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const SERVICE_ACCOUNT = {
  client_email: "api-icali@icali-portal.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQC4jXv38AKT7NmW\n6qch/vhllEnySU/42X1ibnLwkCk14ytpRYFoJ+DMOsB1F/UyWwIPOErk9S0/qpQ5\nApEdSmBrZErd7eOL0PDzBLMYoB7vY5fiHTwSWJ+VcgEccYZYYjsv3hJHd5vY6Vl2\n0jpxspQpuyuzBL2uWMdmuRhcCkEGSfuk6US0lUyM0XX3Hc6CychBVEOTh4VWlmK/\nny+Bz5whZR7O8FKrCRbOPdnMdHi50MMROBky8IgqRO6iX/5Biavb41iMBGaoOGhC\nf5aIJQC3GZugHVotr20N8c1IVjv6a8mccEZkeFzF6SmO4HGGbH4l1CRxhRoAWHt/\nWehRJPUpAgMBAAECggEACa6gi5orpHOXWcfPQ2UTRo8ATyYB/FH6tkSJoq3Jf7J+\nl0wGdT6sWEKX0LzUSBNGuSIwqbDkMhQiqRgFoXYCt3egRuLhXnc0gOdk9vyFivUc\nZYg3m9XK74X24XViQTZMGR+LMXUot7lMUIPIfakLBWJ0sTRlOCWftnes+70s+qWl\nlNYV1s0bzXVEutgAdqjLP+Blu9aflBIm4eJtk3cJhl7AtnUi9isTTyIsYWtNeUs3\nzVo8HFQWE1qymS+PNgFWt4Dm8ndlFY+0PqGb4Ph/QezC6zSwHXFy31dbjGBD7MRi\nUyRjhw+YZLQWBZFTZiJyynmfdTsJAcyMgDgE2iMboQKBgQDvQ3Rhdz43GUiy0cph\nasJzsovejEdfztEarc9XjKgmPECUyn0f5Gk4Ung9d+1b5HAUvsVAGJr3Cgb7vtC0\nUkZqS9KdF1TJsi3obBACj/+CPedBYJDmNju49f2raCb3RW8ZqYsnsfp4W2T2ap8R\njeDfpTVaSvS9E7TLXmavmy7RsQKBgQDFdk+EHH16HIuPHGk81YUTUjhZsYGGjSIK\nBqhUKLTyfH35S6kEjY0DwIPiFsorLYUVQL5sk+z2cnCxxEt8OaQbgjUlKBUAHyzk\n4ykC2QOnumaKIE5jY+llTAmVggLVKzNxdZGfeTT78NGeJIvCZ8HsDfa1iX+cd3pc\nZq1WvgsA+QKBgQC1sKylAu8c2jdpi4Q6u96UC0bJpg7hQ2Vo9AoaurZJ6sFD/AxO\ndp4sZfvm+bYmbO9r4X5acRTkehnZfApylHPibleucTQywfq4n678syrdVXLSI6mF\nGDP7/dk3G61TYse+XhBNAYtpcEXYFhlbNDlKu+MrAPaeymMleDdULOy90QKBgQCC\n0iZONX3gF+dSEhWayy9WJKPWsKZKmVhS4iRFVY7EFDx1nG3G6WzibnoxoL2iK48/\nDFzcnIhiomENNSp5i8qwuuwwyMRZB057+g+iploolnL20f59FKV9ignTdoYf6nYz\nlhu7VtcGj36g0j+RtaIhnQK1NPpJlFKJwzDWBiROKQKBgQDR1qpQs2G1yiD3897X\nbG8hUD5wdRE+JWsEaP+awbG683IzWA1jElpfjOifLfXb/DmHOko0+9H2hVoLW1po\nlckdilg2JYX5lExdsOkFgxJOtAUKMXrz6J48mtrp1B4Y5YPDif/vXsie2MhcwELt\nCmzGbA/5tmimeEFE9UIBiCyKKA==\n-----END PRIVATE KEY-----\n"
}

// ID del Google Sheet de iCali
const SHEET_ID = "15rnxYFzC_ZT1y4TxG7A0WRi1nui-mXOlTTYvV6l1DsU"

async function getGoogleToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header  = { alg: "RS256", typ: "JWT" }
  const payload = {
    iss:   SERVICE_ACCOUNT.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud:   "https://oauth2.googleapis.com/token",
    exp:   now + 3600,
    iat:   now
  }
  const enc = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_")
  const unsigned = `${enc(header)}.${enc(payload)}`
  const pemKey = SERVICE_ACCOUNT.private_key
    .replace("-----BEGIN PRIVATE KEY-----","")
    .replace("-----END PRIVATE KEY-----","")
    .replace(/\n/g,"")
  const binaryKey = Uint8Array.from(atob(pemKey), c => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", binaryKey.buffer,
    { name:"RSASSA-PKCS1-v1_5", hash:"SHA-256" },
    false, ["sign"]
  )
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", cryptoKey,
    new TextEncoder().encode(unsigned)
  )
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_")
  const jwt = `${unsigned}.${sigB64}`
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type":"application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  })
  const data = await res.json()
  return data.access_token
}

async function ensureSheet(token: string, sheetName: string): Promise<void> {
  // Verificar si la hoja existe
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const data = await res.json()
  const exists = data.sheets?.some((s: any) => s.properties.title === sheetName)
  if (!exists) {
    // Crear la hoja
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`,
      {
        method: "POST",
        headers: { Authorization:`Bearer ${token}`, "Content-Type":"application/json" },
        body: JSON.stringify({
          requests: [{ addSheet: { properties: { title: sheetName } } }]
        })
      }
    )
  }
}

async function appendRow(token: string, sheetName: string, values: string[]): Promise<void> {
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(sheetName)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: { Authorization:`Bearer ${token}`, "Content-Type":"application/json" },
      body: JSON.stringify({ values: [values] })
    }
  )
}

async function ensureHeaders(token: string, sheetName: string, headers: string[]): Promise<void> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(sheetName)}!A1:Z1`,
    { headers: { Authorization:`Bearer ${token}` } }
  )
  const data = await res.json()
  if (!data.values || data.values[0]?.[0] !== headers[0]) {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(sheetName)}!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: "POST",
        headers: { Authorization:`Bearer ${token}`, "Content-Type":"application/json" },
        body: JSON.stringify({ values: [headers] })
      }
    )
  }
}

const bogota = (d: Date) => d.toLocaleString("es-CO", { timeZone:"America/Bogota" })

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, content-type" }
    })
  }

  try {
    const { tipo, datos } = await req.json()
    const token = await getGoogleToken()
    const now   = bogota(new Date())

    if (tipo === "venta") {
      const d = datos
      await ensureSheet(token, "Ventas")
      await ensureHeaders(token, "Ventas", [
        "Fecha","Hora registro","Asesor","Canal","Cliente","Cédula","Teléfono",
        "Ciudad","Producto","IMEI","Color","Método pago","Valor venta",
        "Costo equipo","Utilidad","Factura","Proveedor","Domicilio","Retoma","Observaciones"
      ])
      await appendRow(token, "Ventas", [
        d.fecha_venta||"", now,
        d.asesor_nombre||"", d.canal||"",
        d.nombre_cliente||"", d.cedula_cliente||"", d.telefono_cliente||"",
        d.ciudad_cliente||"", d.producto||"", d.imei||"", d.color||"",
        d.metodo_pago||"",
        String(d.valor_venta||0), String(d.costo_equipo||0),
        String((d.valor_venta||0)-(d.costo_equipo||0)),
        d.no_factura||"", d.proveedor||"",
        d.es_domicilio?"Sí":"No", d.tiene_retoma?"Sí":"No",
        d.observaciones||""
      ])
    }

    if (tipo === "log") {
      const d = datos
      // Determinar hoja según tabla/accion
      const tablaMap: Record<string, string> = {
        ventas:            "Ventas",
        despachos:         "Logs Despachos",
        retomas:           "Logs Retomas",
        compras_proveedor: "Logs Inventario",
        perfiles:          "Logs Usuarios",
        abonos_proveedor:  "Logs Proveedores",
      }
      const hoja = tablaMap[d.tabla||""] || "Logs Actividad"

      await ensureSheet(token, hoja)
      await ensureHeaders(token, hoja, ["Fecha y hora","Usuario","Acción","Detalle"])
      await appendRow(token, hoja, [now, d.usuario||"", d.accion||"", d.detalle||""])
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type":"application/json", "Access-Control-Allow-Origin":"*" }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { "Content-Type":"application/json", "Access-Control-Allow-Origin":"*" }
    })
  }
})
