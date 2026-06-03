import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const ESTADOS_DESPACHO = {
  pendiente:       { label:'Pendiente',      color:'#94a3b8' },
  en_preparacion:  { label:'En preparación', color:'#f59e0b' },
  recogido:        { label:'Recogido',       color:'#3b82f6' },
  en_transito:     { label:'En tránsito',    color:'#8b5cf6' },
  entregado:       { label:'Entregado',      color:'#10b981' },
  novedad:         { label:'Novedad',        color:'#ef4444' },
  devuelto:        { label:'Devuelto',       color:'#f97316' }
}

const TRANSPORTADORAS = [
  'coordinadora','servientrega','interrapidisimo','deprisa','mensajero_icali','otra'
]

const fmt = n => new Intl.NumberFormat('es-CO', {
  style:'currency', currency:'COP', maximumFractionDigits:0
}).format(n || 0)

export default function Despachos() {
  const { esLiderAdmin, esAdmin, esAsesor } = useAuth()
  const [despachos, setDespachos] = useState([])
  const [loading, setLoading]     = useState(true)
  const [filtro, setFiltro]       = useState({ tipo:'', estado:'' })
  const [editando, setEditando]   = useState(null)
  const [editForm, setEditForm]   = useState({})

  useEffect(() => { loadDespachos() }, [])

  async function loadDespachos() {
    const { data } = await supabase
      .from('v_despachos_activos')
      .select('*')
      .order('fecha_venta', { ascending: false })
      .limit(200)
    setDespachos(data || [])
    setLoading(false)
  }

  async function loadTodos() {
    const { data } = await supabase
      .from('despachos')
      .select(`*, ventas(nombre_cliente,producto,imei,asesor_nombre,fecha_venta,telefono_cliente)`)
      .order('created_at', { ascending: false })
      .limit(200)
    setDespachos((data || []).map(d => ({
      ...d,
      nombre_cliente:  d.ventas?.nombre_cliente,
      producto:        d.ventas?.producto,
      imei:            d.ventas?.imei,
      asesor_nombre:   d.ventas?.asesor_nombre,
      telefono_cliente:d.ventas?.telefono_cliente,
      fecha_venta:     d.ventas?.fecha_venta
    })))
  }

  async function guardarEdicion() {
    const { error } = await supabase
      .from('despachos')
      .update({
        estado:           editForm.estado,
        mensajero:        editForm.mensajero,
        transportadora:   editForm.transportadora,
        numero_guia:      editForm.numero_guia,
        valor_flete:      Number(editForm.valor_flete) || 0,
        quien_paga_flete: editForm.quien_paga_flete,
        fecha_despacho:   editForm.fecha_despacho || null,
        novedad_descripcion: editForm.novedad_descripcion,
        observaciones:    editForm.observaciones
      })
      .eq('id', editando)
    if (!error) { setEditando(null); loadDespachos() }
  }

  const filtrados = despachos.filter(d => {
    if (filtro.tipo   && d.tipo_envio !== filtro.tipo)   return false
    if (filtro.estado && d.estado     !== filtro.estado) return false
    return true
  })

  const th = {
    color:'#4a6a8a', fontSize:11, fontWeight:600,
    textTransform:'uppercase', letterSpacing:'0.06em',
    padding:'10px 14px', textAlign:'left',
    borderBottom:'1px solid #1a2f52', whiteSpace:'nowrap'
  }
  const td = { padding:'10px 14px', color:'#cbd5e1', fontSize:13, borderBottom:'1px solid #0f1e36' }
  const inp = {
    background:'#0a1628', border:'1px solid #1a2f52', borderRadius:6,
    padding:'7px 10px', color:'#fff', fontSize:13, width:'100%', boxSizing:'border-box'
  }

  return (
    <div style={{ padding:'32px 36px', fontFamily:"'DM Sans', system-ui" }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ color:'#fff', fontSize:20, fontWeight:600, margin:'0 0 4px' }}>
            Logística y despachos
          </h1>
          <p style={{ color:'#4a6a8a', fontSize:13, margin:0 }}>
            {filtrados.length} despachos
          </p>
        </div>
        {(esAdmin || esLiderAdmin) && (
          <button onClick={loadTodos} style={{
            padding:'8px 16px', background:'#0d1a35',
            border:'1px solid #1a2f52', borderRadius:8,
            color:'#8aabcc', fontSize:12, cursor:'pointer'
          }}>Ver historial completo</button>
        )}
      </div>

      {/* Filtros */}
      <div style={{ display:'flex', gap:10, marginBottom:20 }}>
        <select value={filtro.tipo} onChange={e => setFiltro(f => ({ ...f, tipo: e.target.value }))}
          style={{
            background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:8,
            padding:'8px 12px', color: filtro.tipo ? '#fff' : '#4a6a8a', fontSize:13, cursor:'pointer'
          }}>
          <option value="">Todos los tipos</option>
          <option value="domicilio_cali">Domicilio Cali</option>
          <option value="nacional">Nacional</option>
        </select>
        <select value={filtro.estado} onChange={e => setFiltro(f => ({ ...f, estado: e.target.value }))}
          style={{
            background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:8,
            padding:'8px 12px', color: filtro.estado ? '#fff' : '#4a6a8a', fontSize:13, cursor:'pointer'
          }}>
          <option value="">Todos los estados</option>
          {Object.entries(ESTADOS_DESPACHO).map(([k,v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Tabla */}
      <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:12, overflow:'auto' }}>
        {loading ? (
          <div style={{ padding:40, color:'#4a6a8a', textAlign:'center', fontSize:13 }}>
            Cargando despachos...
          </div>
        ) : filtrados.length === 0 ? (
          <div style={{ padding:40, color:'#4a6a8a', textAlign:'center', fontSize:13 }}>
            No hay despachos activos
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:900 }}>
            <thead>
              <tr>
                <th style={th}>Estado</th>
                <th style={th}>Cliente</th>
                <th style={th}>Producto</th>
                <th style={th}>Tipo</th>
                <th style={th}>Ciudad</th>
                <th style={th}>Logística</th>
                <th style={th}>Flete</th>
                <th style={th}>Asesor</th>
                {(esAdmin || esLiderAdmin) && <th style={th}>Editar</th>}
              </tr>
            </thead>
            <tbody>
              {filtrados.map(d => (
                <tr key={d.despacho_id || d.id}>
                  <td style={td}>
                    <span style={{
                      background: (ESTADOS_DESPACHO[d.estado]?.color || '#94a3b8') + '22',
                      color: ESTADOS_DESPACHO[d.estado]?.color || '#94a3b8',
                      fontSize:11, padding:'3px 8px', borderRadius:4, fontWeight:500
                    }}>
                      {ESTADOS_DESPACHO[d.estado]?.label || d.estado}
                    </span>
                  </td>
                  <td style={td}>
                    <div style={{ fontWeight:500, color:'#e2e8f0' }}>{d.nombre_cliente}</div>
                    <div style={{ color:'#4a6a8a', fontSize:11 }}>{d.telefono_cliente}</div>
                  </td>
                  <td style={{ ...td, maxWidth:160 }}>
                    <div style={{ fontSize:12, color:'#e2e8f0' }}>{d.producto}</div>
                    <div style={{ color:'#4a6a8a', fontSize:11 }}>{d.imei}</div>
                  </td>
                  <td style={td}>
                    <span style={{
                      background: d.tipo_envio === 'domicilio_cali' ? '#1e3a5f' : '#2d1e5f',
                      color: d.tipo_envio === 'domicilio_cali' ? '#60a5fa' : '#a78bfa',
                      fontSize:11, padding:'2px 8px', borderRadius:4
                    }}>
                      {d.tipo_envio === 'domicilio_cali' ? '📍 Cali' : '🚀 Nacional'}
                    </span>
                  </td>
                  <td style={td}>{d.ciudad_destino}</td>
                  <td style={td}>
                    {d.tipo_envio === 'domicilio_cali'
                      ? <span style={{ color:'#8aabcc' }}>{d.mensajero || '—'}</span>
                      : <div>
                          <div style={{ fontSize:12 }}>{d.transportadora || '—'}</div>
                          {d.numero_guia && (
                            <div style={{ color:'#4a6a8a', fontSize:11 }}>
                              Guía: {d.numero_guia}
                            </div>
                          )}
                        </div>
                    }
                  </td>
                  <td style={{ ...td, whiteSpace:'nowrap' }}>
                    {d.valor_flete ? fmt(d.valor_flete) : '—'}
                  </td>
                  <td style={{ ...td, fontSize:12 }}>{d.asesor_nombre}</td>
                  {(esAdmin || esLiderAdmin) && (
                    <td style={td}>
                      <button
                        onClick={() => {
                          setEditando(d.despacho_id || d.id)
                          setEditForm({
                            estado:         d.estado,
                            mensajero:      d.mensajero || '',
                            transportadora: d.transportadora || '',
                            numero_guia:    d.numero_guia || '',
                            valor_flete:    d.valor_flete || '',
                            quien_paga_flete: d.quien_paga_flete || '',
                            fecha_despacho: d.fecha_despacho?.slice(0,10) || '',
                            novedad_descripcion: d.novedad_descripcion || '',
                            observaciones:  d.observaciones || ''
                          })
                        }}
                        style={{
                          background:'#1a2f52', border:'none', borderRadius:6,
                          color:'#8aabcc', fontSize:12, padding:'5px 10px', cursor:'pointer'
                        }}
                      >
                        Editar
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal edición despacho */}
      {editando && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.7)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000
        }}>
          <div style={{
            background:'#0d1a35', border:'1px solid #1a2f52',
            borderRadius:14, padding:28, width:'100%', maxWidth:480,
            fontFamily:"'DM Sans', system-ui"
          }}>
            <h3 style={{ color:'#fff', margin:'0 0 20px', fontSize:16 }}>
              Actualizar despacho
            </h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px 14px' }}>
              <div style={{ gridColumn:'span 2' }}>
                <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500,
                  textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>
                  Estado
                </label>
                <select style={{ ...inp, cursor:'pointer' }} value={editForm.estado}
                  onChange={e => setEditForm(f => ({ ...f, estado: e.target.value }))}>
                  {Object.entries(ESTADOS_DESPACHO).map(([k,v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500,
                  textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>
                  Mensajero (Cali)
                </label>
                <input style={inp} value={editForm.mensajero}
                  onChange={e => setEditForm(f => ({ ...f, mensajero: e.target.value }))}
                  placeholder="Julián, Luis..." />
              </div>
              <div>
                <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500,
                  textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>
                  Transportadora
                </label>
                <select style={{ ...inp, cursor:'pointer' }} value={editForm.transportadora}
                  onChange={e => setEditForm(f => ({ ...f, transportadora: e.target.value }))}>
                  <option value="">Ninguna</option>
                  {TRANSPORTADORAS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500,
                  textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>
                  # Guía
                </label>
                <input style={inp} value={editForm.numero_guia}
                  onChange={e => setEditForm(f => ({ ...f, numero_guia: e.target.value }))} />
              </div>
              <div>
                <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500,
                  textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>
                  Flete $
                </label>
                <input style={inp} value={editForm.valor_flete}
                  onChange={e => setEditForm(f => ({ ...f, valor_flete: e.target.value }))} />
              </div>
              <div>
                <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500,
                  textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>
                  ¿Quién paga flete?
                </label>
                <select style={{ ...inp, cursor:'pointer' }} value={editForm.quien_paga_flete}
                  onChange={e => setEditForm(f => ({ ...f, quien_paga_flete: e.target.value }))}>
                  <option value="">—</option>
                  <option value="cliente">Cliente</option>
                  <option value="icali">iCali</option>
                </select>
              </div>
              <div>
                <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500,
                  textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>
                  Fecha despacho
                </label>
                <input type="date" style={inp} value={editForm.fecha_despacho}
                  onChange={e => setEditForm(f => ({ ...f, fecha_despacho: e.target.value }))} />
              </div>
              {editForm.estado === 'novedad' && (
                <div style={{ gridColumn:'span 2' }}>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500,
                    textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>
                    Descripción novedad
                  </label>
                  <textarea style={{ ...inp, resize:'vertical', minHeight:60 }}
                    value={editForm.novedad_descripcion}
                    onChange={e => setEditForm(f => ({ ...f, novedad_descripcion: e.target.value }))} />
                </div>
              )}
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
              <button onClick={guardarEdicion} style={{
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
