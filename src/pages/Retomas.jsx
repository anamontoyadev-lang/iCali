import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const ESTADOS = {
  recibida:        { label:'Recibida',        color:'#94a3b8' },
  en_verificacion: { label:'Verificando',     color:'#f59e0b' },
  verificada:      { label:'Verificada',      color:'#3b82f6' },
  disponible:      { label:'Disponible',      color:'#10b981' },
  en_reparacion:   { label:'En reparación',   color:'#8b5cf6' },
  vendida:         { label:'Vendida',         color:'#6b7280' }
}

const fmt = n => new Intl.NumberFormat('es-CO', {
  style:'currency', currency:'COP', maximumFractionDigits:0
}).format(n || 0)

export default function Retomas() {
  const { esAdmin, esLiderAdmin, esLiderCom } = useAuth()
  const [retomas, setRetomas]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [editando, setEditando] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [filtro, setFiltro]     = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('retomas')
      .select('*, ventas(nombre_cliente, producto, asesor_nombre, fecha_venta)')
      .order('created_at', { ascending: false })
      .limit(200)
    setRetomas(data || [])
    setLoading(false)
  }

  async function guardar() {
    await supabase.from('retomas').update({
      imei_retoma:    editForm.imei_retoma,
      referencia:     editForm.referencia,
      capacidad_gb:   editForm.capacidad_gb,
      color:          editForm.color,
      porcentaje_bateria: Number(editForm.porcentaje_bateria) || null,
      valor_retoma:   Number(editForm.valor_retoma) || 0,
      costo_estimado: Number(editForm.costo_estimado) || 0,
      quien_tiene:    editForm.quien_tiene,
      punto_tienda:   editForm.punto_tienda,
      estado:         editForm.estado,
      observaciones:  editForm.observaciones
    }).eq('id', editando)
    setEditando(null); load()
  }

  const filtradas = retomas.filter(r => {
    if (!filtro) return true
    const s = filtro.toLowerCase()
    return `${r.imei_retoma} ${r.referencia} ${r.ventas?.nombre_cliente}`.toLowerCase().includes(s)
  })

  const th = {
    color:'#4a6a8a', fontSize:11, fontWeight:600,
    textTransform:'uppercase', letterSpacing:'0.06em',
    padding:'10px 14px', textAlign:'left', borderBottom:'1px solid #1a2f52'
  }
  const td = { padding:'10px 14px', color:'#cbd5e1', fontSize:13, borderBottom:'1px solid #0f1e36' }
  const inp = {
    background:'#0a1628', border:'1px solid #1a2f52', borderRadius:6,
    padding:'7px 10px', color:'#fff', fontSize:13, width:'100%', boxSizing:'border-box'
  }

  return (
    <div style={{ padding:'32px 36px', fontFamily:"'DM Sans', system-ui" }}>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ color:'#fff', fontSize:20, fontWeight:600, margin:'0 0 4px' }}>Retomas</h1>
        <p style={{ color:'#4a6a8a', fontSize:13, margin:0 }}>{filtradas.length} equipos</p>
      </div>

      <div style={{ marginBottom:16 }}>
        <input
          placeholder="Buscar por IMEI, referencia o cliente..."
          value={filtro}
          onChange={e => setFiltro(e.target.value)}
          style={{
            background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:8,
            padding:'8px 14px', color:'#fff', fontSize:13,
            outline:'none', width:320, boxSizing:'border-box'
          }}
        />
      </div>

      {/* Resumen por estado */}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:20 }}>
        {Object.entries(ESTADOS).map(([k, v]) => {
          const n = retomas.filter(r => r.estado === k).length
          return (
            <div key={k} style={{
              background:'#0d1a35', border:'1px solid #1a2f52',
              borderRadius:8, padding:'8px 14px',
              display:'flex', alignItems:'center', gap:8
            }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background: v.color }} />
              <span style={{ color:'#8aabcc', fontSize:12 }}>{v.label}</span>
              <span style={{ color:'#fff', fontSize:14, fontWeight:600 }}>{n}</span>
            </div>
          )
        })}
      </div>

      <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:12, overflow:'auto' }}>
        {loading ? (
          <div style={{ padding:40, color:'#4a6a8a', textAlign:'center', fontSize:13 }}>Cargando...</div>
        ) : filtradas.length === 0 ? (
          <div style={{ padding:40, color:'#4a6a8a', textAlign:'center', fontSize:13 }}>
            No hay retomas registradas
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:800 }}>
            <thead>
              <tr>
                <th style={th}>Estado</th>
                <th style={th}>Referencia</th>
                <th style={th}>IMEI</th>
                <th style={th}>Batería</th>
                <th style={th}>Valor retoma</th>
                <th style={th}>Costo est.</th>
                <th style={th}>Quién tiene</th>
                <th style={th}>Cliente origen</th>
                <th style={th}>Fecha</th>
                {(esAdmin || esLiderAdmin || esLiderCom) && <th style={th}>Editar</th>}
              </tr>
            </thead>
            <tbody>
              {filtradas.map(r => (
                <tr key={r.id}>
                  <td style={td}>
                    <span style={{
                      background: (ESTADOS[r.estado]?.color || '#94a3b8') + '22',
                      color: ESTADOS[r.estado]?.color || '#94a3b8',
                      fontSize:11, padding:'3px 8px', borderRadius:4, fontWeight:500
                    }}>
                      {ESTADOS[r.estado]?.label || r.estado}
                    </span>
                  </td>
                  <td style={td}>
                    <div style={{ fontWeight:500, color:'#e2e8f0' }}>{r.referencia}</div>
                    {r.capacidad_gb && (
                      <div style={{ color:'#4a6a8a', fontSize:11 }}>{r.capacidad_gb} · {r.color}</div>
                    )}
                  </td>
                  <td style={{ ...td, fontSize:12, color:'#8aabcc', fontFamily:'monospace' }}>
                    {r.imei_retoma}
                  </td>
                  <td style={td}>
                    {r.porcentaje_bateria != null ? (
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <div style={{
                          width:40, height:6, background:'#1a2f52', borderRadius:3, overflow:'hidden'
                        }}>
                          <div style={{
                            width: r.porcentaje_bateria + '%', height:'100%',
                            background: r.porcentaje_bateria > 80 ? '#10b981'
                              : r.porcentaje_bateria > 60 ? '#f59e0b' : '#ef4444',
                            borderRadius:3
                          }} />
                        </div>
                        <span style={{ fontSize:12, color:'#8aabcc' }}>{r.porcentaje_bateria}%</span>
                      </div>
                    ) : '—'}
                  </td>
                  <td style={{ ...td, fontWeight:600, color:'#fff', whiteSpace:'nowrap' }}>
                    {fmt(r.valor_retoma)}
                  </td>
                  <td style={{ ...td, color:'#10b981', whiteSpace:'nowrap' }}>
                    {r.costo_estimado ? fmt(r.costo_estimado) : '—'}
                  </td>
                  <td style={{ ...td, fontSize:12 }}>{r.quien_tiene || '—'}</td>
                  <td style={td}>
                    <div style={{ fontSize:12 }}>{r.ventas?.nombre_cliente || '—'}</div>
                    <div style={{ color:'#4a6a8a', fontSize:11 }}>{r.ventas?.asesor_nombre}</div>
                  </td>
                  <td style={{ ...td, fontSize:12, whiteSpace:'nowrap' }}>
                    {r.fecha_recepcion
                      ? new Date(r.fecha_recepcion + 'T12:00').toLocaleDateString('es-CO', {
                          day:'2-digit', month:'short', year:'numeric'
                        })
                      : '—'}
                  </td>
                  {(esAdmin || esLiderAdmin || esLiderCom) && (
                    <td style={td}>
                      <button
                        onClick={() => {
                          setEditando(r.id)
                          setEditForm({
                            imei_retoma:    r.imei_retoma || '',
                            referencia:     r.referencia  || '',
                            capacidad_gb:   r.capacidad_gb || '',
                            color:          r.color || '',
                            porcentaje_bateria: r.porcentaje_bateria || '',
                            valor_retoma:   r.valor_retoma || '',
                            costo_estimado: r.costo_estimado || '',
                            quien_tiene:    r.quien_tiene || '',
                            punto_tienda:   r.punto_tienda || '',
                            estado:         r.estado,
                            observaciones:  r.observaciones || ''
                          })
                        }}
                        style={{
                          background:'#1a2f52', border:'none', borderRadius:6,
                          color:'#8aabcc', fontSize:12, padding:'5px 10px', cursor:'pointer'
                        }}
                      >Editar</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal edición */}
      {editando && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.7)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000
        }}>
          <div style={{
            background:'#0d1a35', border:'1px solid #1a2f52',
            borderRadius:14, padding:28, width:'100%', maxWidth:500,
            fontFamily:"'DM Sans', system-ui", maxHeight:'90vh', overflow:'auto'
          }}>
            <h3 style={{ color:'#fff', margin:'0 0 20px', fontSize:16 }}>Editar retoma</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px 14px' }}>
              {[
                ['imei_retoma','IMEI'],['referencia','Referencia'],
                ['capacidad_gb','GB'],['color','Color'],
                ['porcentaje_bateria','Batería %'],['valor_retoma','Valor retoma $'],
                ['costo_estimado','Costo estimado $'],['quien_tiene','¿Quién tiene?'],
                ['punto_tienda','Punto de tienda']
              ].map(([k, label]) => (
                <div key={k}>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500,
                    textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>
                    {label}
                  </label>
                  <input style={inp} value={editForm[k]}
                    onChange={e => setEditForm(f => ({ ...f, [k]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500,
                  textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>
                  Estado
                </label>
                <select style={{ ...inp, cursor:'pointer' }} value={editForm.estado}
                  onChange={e => setEditForm(f => ({ ...f, estado: e.target.value }))}>
                  {Object.entries(ESTADOS).map(([k,v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ gridColumn:'span 2' }}>
                <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500,
                  textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>
                  Observaciones
                </label>
                <textarea style={{ ...inp, resize:'vertical', minHeight:60 }}
                  value={editForm.observaciones}
                  onChange={e => setEditForm(f => ({ ...f, observaciones: e.target.value }))} />
              </div>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:20, justifyContent:'flex-end' }}>
              <button onClick={() => setEditando(null)} style={{
                padding:'9px 20px', background:'transparent',
                border:'1px solid #1a2f52', borderRadius:8,
                color:'#6b8ab0', fontSize:13, cursor:'pointer'
              }}>Cancelar</button>
              <button onClick={guardar} style={{
                padding:'9px 24px',
                background:'linear-gradient(135deg,#0066ff,#0044bb)',
                border:'none', borderRadius:8,
                color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer'
              }}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
