import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const TIPOS_VENTA = new Set(['FACTURA', 'FACTURA ELECTRONICA', 'RECIBO CAJA'])

// ── Parsear RptRecaudoDiario ─────────────────────────────────
function parsearRecaudo(wb, nombreArchivo) {
  const ws  = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json(ws, { header:1, defval:null })

  const headers = raw[6]
  if (!headers) throw new Error('Formato de recaudo no reconocido')

  const rows = raw.slice(7).map(row => {
    const obj = {}
    headers.forEach((h, i) => { obj[h] = row[i] })
    return obj
  })

  const ventas = rows.filter(r =>
    r['NUMERO'] && r['VALOR'] > 0 && TIPOS_VENTA.has(r['TIPO'])
  )

  // Agrupar por vendedor
  const porVendedor = {}
  for (const v of ventas) {
    const nombre = String(v['NOMBRE USUARIO'] || '').trim()
    if (!nombre) continue
    if (!porVendedor[nombre]) porVendedor[nombre] = { equipos: 0, valor: 0 }
    porVendedor[nombre].equipos++
    porVendedor[nombre].valor += Number(v['VALOR']) || 0
  }

  // Detectar mes/año del nombre de archivo
  const meses = { ENERO:1,FEBRERO:2,MARZO:3,ABRIL:4,MAYO:5,JUNIO:6,
                  JULIO:7,AGOSTO:8,SEPTIEMBRE:9,OCTUBRE:10,NOVIEMBRE:11,DICIEMBRE:12 }
  let mes = null, año = null
  for (const [k, v] of Object.entries(meses)) {
    if (nombreArchivo.toUpperCase().includes(k)) { mes = v; break }
  }
  const matchAño = nombreArchivo.match(/20\d\d/)
  año = matchAño ? parseInt(matchAño[0]) : new Date().getFullYear()

  return { porVendedor, mes, año, totalFilas: ventas.length }
}

// ── Guardar en Supabase ──────────────────────────────────────
async function guardarRecaudo(porVendedor, mes, año, userId) {
  const { data: asesores } = await supabase
    .from('asesores').select('id, nombre_recaudo')

  let guardados = 0, errores = 0

  for (const [nombreRecaudo, datos] of Object.entries(porVendedor)) {
    const asesor = asesores?.find(a =>
      a.nombre_recaudo?.trim().toLowerCase() === nombreRecaudo.trim().toLowerCase()
    )
    if (!asesor) { errores++; continue }

    const ticket = datos.equipos > 0 ? Math.round(datos.valor / datos.equipos) : 0

    const { error } = await supabase
      .from('ventas_mensuales')
      .upsert({
        asesor_id: asesor.id,
        año, mes,
        equipos:    datos.equipos,
        valor_total: datos.valor,
        ticket_prom: ticket,
        uploaded_by: userId
      }, { onConflict: 'asesor_id,año,mes' })

    if (error) errores++
    else guardados++
  }

  return { guardados, errores }
}

// ── Componente dropzone ──────────────────────────────────────
function Dropzone({ onFile }) {
  const onDrop = useCallback(files => {
    if (files[0]) onFile(files[0])
  }, [onFile])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    multiple: false
  })

  return (
    <div {...getRootProps()} style={{
      border: `2px dashed ${isDragActive ? 'var(--accent)' : 'var(--border)'}`,
      borderRadius: 'var(--radius)',
      padding: '2.5rem',
      textAlign: 'center',
      cursor: 'pointer',
      background: isDragActive ? 'var(--info-bg)' : 'var(--bg)',
      transition: 'all .2s'
    }}>
      <input {...getInputProps()} />
      <div style={{ fontSize:32, marginBottom:12, opacity:.4 }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--muted)"
          strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
        </svg>
      </div>
      <div style={{ fontWeight:500, marginBottom:4 }}>
        {isDragActive ? 'Suelta el archivo aquí' : 'Arrastra tu archivo Excel aquí'}
      </div>
      <div style={{ fontSize:12, color:'var(--muted)' }}>
        o haz clic para seleccionarlo · .xls · .xlsx
      </div>
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────
export default function SubirDatos() {
  const { perfil } = useAuth()
  const [estado,  setEstado]  = useState('idle')   // idle | procesando | ok | error
  const [mensaje, setMensaje] = useState('')
  const [detalle, setDetalle] = useState(null)
  const [tipoArchivo, setTipoArchivo] = useState('recaudo')

  async function procesarArchivo(file) {
    setEstado('procesando')
    setMensaje(`Leyendo ${file.name}…`)
    setDetalle(null)

    try {
      const buffer = await file.arrayBuffer()
      const wb     = XLSX.read(buffer, { type:'array' })

      if (tipoArchivo === 'recaudo') {
        const { porVendedor, mes, año, totalFilas } = parsearRecaudo(wb, file.name)

        if (!mes) {
          setEstado('error')
          setMensaje('No se pudo detectar el mes. Verifica que el nombre del archivo incluya el mes (ej: RptRecaudoDiario_MAYO_2026.xls)')
          return
        }

        setMensaje(`Guardando ${totalFilas} transacciones de ${Object.keys(porVendedor).length} asesores…`)
        const { guardados, errores } = await guardarRecaudo(porVendedor, mes, año, perfil.id)

        await supabase.from('uploads').insert({
          tipo:'recaudo', nombre_archivo:file.name, año, mes,
          filas_procesadas:totalFilas, errores, subido_por:perfil.id
        })

        setEstado('ok')
        setMensaje(`Archivo procesado correctamente`)
        setDetalle({
          asesores: guardados,
          errores,
          mes, año,
          vendors: Object.entries(porVendedor).map(([n, d]) => ({
            nombre: n, equipos: d.equipos, valor: d.valor
          })).sort((a, b) => b.valor - a.valor)
        })

      } else {
        setEstado('error')
        setMensaje('Carga de comisiones en desarrollo — disponible en la próxima versión')
      }

    } catch (err) {
      setEstado('error')
      setMensaje(`Error: ${err.message}`)
    }
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <div style={{ fontWeight:600, fontSize:15 }}>Subir datos Excel</div>
          <div style={{ fontSize:12, color:'var(--muted)' }}>
            Carga archivos de recaudo y comisiones para actualizar el portal
          </div>
        </div>
      </div>

      <div className="page-body">

        {/* Selector tipo */}
        <div className="card" style={{ marginBottom:'1.25rem' }}>
          <div className="section-title">Tipo de archivo</div>
          <div style={{ display:'flex', gap:10 }}>
            {[
              { key:'recaudo',    label:'RptRecaudoDiario', desc:'Ventas mensuales' },
              { key:'comisiones', label:'COMISIONES_icali', desc:'Planillas de comisiones' },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => { setTipoArchivo(t.key); setEstado('idle') }}
                className="btn"
                style={{
                  background: tipoArchivo === t.key ? 'var(--dk)' : 'var(--bg)',
                  color:      tipoArchivo === t.key ? 'white' : 'var(--muted)',
                  border:     `0.5px solid ${tipoArchivo === t.key ? 'var(--dk)' : 'var(--border)'}`,
                  flexDirection:'column', alignItems:'flex-start', padding:'10px 16px'
                }}
              >
                <span style={{ fontWeight:600, fontSize:13 }}>{t.label}</span>
                <span style={{ fontSize:11, opacity:.7 }}>{t.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Dropzone */}
        <div className="card" style={{ marginBottom:'1.25rem' }}>
          <Dropzone onFile={procesarArchivo} />
        </div>

        {/* Estado */}
        {estado === 'procesando' && (
          <div className="alert alert-warn" style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div className="spinner" />
            {mensaje}
          </div>
        )}

        {estado === 'error' && (
          <div className="alert alert-danger">{mensaje}</div>
        )}

        {estado === 'ok' && detalle && (
          <div>
            <div className="alert alert-success">
              ✓ {mensaje} · {detalle.asesores} asesores guardados
              {detalle.errores > 0 && ` · ${detalle.errores} sin cruzar (revisar nombre en BD)`}
            </div>

            <div className="card">
              <div className="section-title">
                Resumen cargado — {['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][detalle.mes]} {detalle.año}
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Asesor (nombre en recaudo)</th>
                      <th style={{ textAlign:'right' }}>Equipos</th>
                      <th style={{ textAlign:'right' }}>Valor total</th>
                      <th style={{ textAlign:'right' }}>Ticket prom.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalle.vendors.map(v => (
                      <tr key={v.nombre}>
                        <td style={{ fontFamily:'var(--mono)', fontSize:12 }}>{v.nombre}</td>
                        <td style={{ textAlign:'right', fontWeight:600 }}>{v.equipos}</td>
                        <td style={{ textAlign:'right' }}>
                          ${Math.round(v.valor).toLocaleString('es-CO')}
                        </td>
                        <td style={{ textAlign:'right', color:'var(--muted)' }}>
                          ${v.equipos > 0 ? Math.round(v.valor/v.equipos).toLocaleString('es-CO') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
