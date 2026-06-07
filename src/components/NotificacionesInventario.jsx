import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const fmt = n => new Intl.NumberFormat('es-CO',{ style:'currency', currency:'COP', maximumFractionDigits:0 }).format(n||0)

const ESTADOS_EQUIPO = [
  { value:'usado',          label:'Usado' },
  { value:'nuevo',          label:'Nuevo' },
  { value:'exhibicion',     label:'Exhibición' },
  { value:'para_reparar',   label:'Para reparar' },
]
const STICKERS = ['Very Good','Good','Mid']
const ALMACENAMIENTOS = ['64GB','128GB','256GB','512GB','1TB']

const inpS = {
  background:'#0a1628', border:'1px solid #1a2f52', borderRadius:6,
  padding:'7px 10px', color:'#fff', fontSize:12,
  width:'100%', boxSizing:'border-box', outline:'none'
}

export default function NotificacionesInventario() {
  const [notifs, setNotifs]       = useState([])
  const [formIngreso, setFormIngreso] = useState(null) // notif activa para ingresar
  const [campos, setCampos]       = useState({})
  const [guardando, setGuardando] = useState(false)
  const [proveedores, setProveedores] = useState([])

  useEffect(() => {
    loadNotifs()
    loadProveedores()
    const interval = setInterval(loadNotifs, 5000)
    return () => clearInterval(interval)
  }, [])

  async function loadNotifs() {
    const { data } = await supabase
      .from('notificaciones')
      .select('*')
      .in('tipo', ['SOLICITUD_EQUIPO', 'EQUIPO_LISTO_LABORATORIO', 'DEVOLUCION_EQUIPO'])
      .eq('respondida', false)
      .order('created_at', { ascending: false })
    setNotifs(data || [])
  }

  async function loadProveedores() {
    const { data } = await supabase.from('proveedores').select('id,nombre').eq('activo', true).order('nombre')
    setProveedores(data || [])
  }

  async function responderSolicitud(id, respuesta) {
    const user = (await supabase.auth.getUser()).data.user
    await supabase.from('notificaciones').update({
      respondida: true, respuesta,
      respondido_por: user?.email || 'inventario',
    }).eq('id', id)
    loadNotifs()
  }

  function abrirFormIngreso(notif) {
    setFormIngreso(notif)
    setCampos({
      color: '',
      almacenamiento: '128GB',
      costo: '',
      precio_venta_est: '',
      bateria: '',
      sticker: '',
      estado_equipo: 'usado',
      proveedor_id: proveedores.find(p => p.nombre.toLowerCase().includes('laboratorio'))?.id || proveedores[0]?.id || '',
      observaciones: '',
    })
  }

  async function confirmarBajarEquipos(notif) {
    const user = (await supabase.auth.getUser()).data.user
    const d = notif.datos || {}
    const equipos = d.equipos || (d.imei ? [{ imei: d.imei }] : [])
    for (const eq of equipos) {
      if (eq.imei) {
        await supabase.from('compras_proveedor').update({
          estado: 'con_asesor',
          con_asesor: d.asesor || notif.creado_por_nombre,
          fecha_prestamo: new Date().toISOString(),
        }).eq('imei', eq.imei).eq('estado', 'disponible')
      }
    }
    await supabase.from('notificaciones').update({
      respondida: true, respuesta: 'si',
      respondido_por: user?.email || 'inventario',
    }).eq('id', notif.id)
    loadNotifs()
  }

  async function confirmarRecogida(notif) {
    const user = (await supabase.auth.getUser()).data.user
    const d = notif.datos || {}
    if (d.imei) {
      await supabase.from('compras_proveedor').update({
        estado: 'disponible', con_asesor: null, fecha_prestamo: null,
      }).eq('imei', d.imei)
    }
    await supabase.from('notificaciones').update({
      respondida: true, respuesta: 'recogido',
      respondido_por: user?.email || 'inventario',
    }).eq('id', notif.id)
    loadNotifs()
  }

  async function confirmarIngreso(e) {
    e.preventDefault()
    setGuardando(true)
    const user = (await supabase.auth.getUser()).data.user
    const d    = formIngreso.datos || {}

    const { error } = await supabase.from('compras_proveedor').insert({
      proveedor_id:    campos.proveedor_id,
      producto:        d.producto || 'Equipo reparado',
      imei:            d.imei || '',
      color:           campos.color || '',
      almacenamiento:  campos.almacenamiento,
      costo:           Number(String(campos.costo).replace(/\D/g,'')) || 0,
      precio_venta_est: Number(String(campos.precio_venta_est).replace(/\D/g,'')) || 0,
      bateria:         campos.bateria ? Number(campos.bateria) : null,
      sticker:         campos.sticker || null,
      estado_equipo:   campos.estado_equipo,
      estado:          'disponible',
      fecha_compra:    new Date().toISOString().split('T')[0],
      observaciones:   `Lab: ${d.solucion || ''} ${campos.observaciones || ''}`.trim(),
      registrado_por:  user.id,
    })

    if (!error) {
      // Marcar garantía como entregada
      if (d.garantia_id) {
        await supabase.from('garantias_reparaciones').update({
          estado: 'entregado',
          fecha_entrega_real: new Date().toISOString().split('T')[0],
        }).eq('id', d.garantia_id)
      }
      // Cerrar notificación
      await supabase.from('notificaciones').update({
        respondida: true, respuesta: 'ingresado',
        respondido_por: user?.email || 'inventario',
      }).eq('id', formIngreso.id)

      setFormIngreso(null)
      loadNotifs()
    }
    setGuardando(false)
  }

  if (notifs.length === 0 && !formIngreso) return null

  return (
    <>
      {/* Notificaciones flotantes */}
      {!formIngreso && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 900,
          display: 'flex', flexDirection: 'column', gap: 10,
          maxWidth: 380, fontFamily: "'DM Sans', system-ui",
        }}>
          {notifs.map(n => (
            <div key={n.id} style={{
              background: '#0d1a35',
              border: `1px solid ${n.tipo === 'EQUIPO_LISTO_LABORATORIO' ? '#10b981' : '#f59e0b'}`,
              borderRadius: 12, padding: '14px 16px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
            }}>

              {/* SOLICITUD EQUIPO */}
              {n.tipo === 'SOLICITUD_EQUIPO' && (
                <>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                    <span style={{ fontSize:18 }}>🔔</span>
                    <div>
                      <div style={{ color:'#fff', fontSize:13, fontWeight:600 }}>{n.mensaje}</div>
                      <div style={{ color:'#f59e0b', fontSize:11 }}>de {n.creado_por_nombre} · {n.datos?.cliente}</div>
                    </div>
                  </div>
                  <div style={{ background:'#0a1628', borderRadius:8, padding:'8px 12px', marginBottom:10 }}>
                    {/* Solicitud múltiple */}
                    {Array.isArray(n.datos?.equipos) ? (
                      <div>
                        {n.datos.equipos.map((e,i) => (
                          <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 0', borderBottom: i < n.datos.equipos.length-1 ? '1px solid #1a2f52' : 'none' }}>
                            <span style={{ color:'#fff', fontFamily:'monospace', fontSize:11 }}>{e.imei}</span>
                            {e.color && <span style={{ color:'#8aabcc', fontSize:11 }}>{e.color}</span>}
                            {e.sticker && <span style={{ color:'#f59e0b', fontSize:10 }}>{e.sticker}</span>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div>
                        {n.datos?.imei && <div style={{ color:'#fff', fontFamily:'monospace', fontSize:12 }}>IMEI: {n.datos.imei}</div>}
                      </div>
                    )}
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={() => responderSolicitud(n.id, 'no')} style={{ flex:1, padding:'8px 0', background:'transparent', border:'1px solid #ef4444', borderRadius:7, color:'#ef4444', fontSize:12, fontWeight:600, cursor:'pointer' }}>✗ No puedo bajar</button>
                    <button onClick={() => confirmarBajarEquipos(n)} style={{ flex:2, padding:'8px 0', background:'linear-gradient(135deg,#f59e0b,#d97706)', border:'none', borderRadius:7, color:'#000', fontSize:12, fontWeight:700, cursor:'pointer' }}>✓ Voy a bajar los equipos</button>
                  </div>
                </>
              )}

              {/* EQUIPO LISTO LABORATORIO */}
              {n.tipo === 'EQUIPO_LISTO_LABORATORIO' && (
                <>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                    <span style={{ fontSize:18 }}>🔬</span>
                    <div>
                      <div style={{ color:'#fff', fontSize:13, fontWeight:600 }}>Equipo listo en laboratorio</div>
                      <div style={{ color:'#10b981', fontSize:11 }}>Ve a recoger el equipo</div>
                    </div>
                  </div>
                  <div style={{ background:'#0a1628', borderRadius:8, padding:'8px 12px', marginBottom:10 }}>
                    <div style={{ color:'#e2e8f0', fontSize:12, fontWeight:500, marginBottom:4 }}>{n.datos?.producto || '—'}</div>
                    {n.datos?.imei && <div style={{ color:'#8aabcc', fontFamily:'monospace', fontSize:11 }}>IMEI: {n.datos.imei}</div>}
                    {n.datos?.solucion && <div style={{ color:'#10b981', fontSize:11, marginTop:4 }}>✓ {n.datos.solucion}</div>}
                    {Array.isArray(n.datos?.repuestos) && n.datos.repuestos.length > 0 && (
                      <div style={{ marginTop:6, borderTop:'1px solid #1a2f52', paddingTop:6 }}>
                        {n.datos.repuestos.map((r,i) => (
                          <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#8aabcc' }}>
                            <span>{r.nombre}{r.cantidad > 1 ? ` x${r.cantidad}` : ''}</span>
                            <span style={{ color:'#10b981' }}>{fmt(r.costo)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => abrirFormIngreso(n)}
                    style={{ width:'100%', padding:'10px 0', background:'linear-gradient(135deg,#10b981,#059669)', border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}
                  >
                    📦 Ya tengo el equipo — Ingresar a inventario
                  </button>
                </>
              )}
              {/* DEVOLUCION EQUIPO */}
              {n.tipo === 'DEVOLUCION_EQUIPO' && (
                <>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                    <span style={{ fontSize:18 }}>📤</span>
                    <div>
                      <div style={{ color:'#fff', fontSize:13, fontWeight:600 }}>Solicitud de recogida</div>
                      <div style={{ color:'#f59e0b', fontSize:11 }}>{n.creado_por_nombre} quiere devolver un equipo</div>
                    </div>
                  </div>
                  <div style={{ background:'#0a1628', borderRadius:8, padding:'8px 12px', marginBottom:10 }}>
                    <div style={{ color:'#e2e8f0', fontSize:12 }}>{n.datos?.producto}</div>
                    {n.datos?.imei && <div style={{ color:'#8aabcc', fontFamily:'monospace', fontSize:11, marginTop:2 }}>IMEI: {n.datos.imei}</div>}
                  </div>
                  <button onClick={() => confirmarRecogida(n)} style={{ width:'100%', padding:'9px 0', background:'linear-gradient(135deg,#0066ff,#0044bb)', border:'none', borderRadius:7, color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                    ✓ Confirmé la recogida — devolver a inventario
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* MODAL INGRESO A INVENTARIO */}
      {formIngreso && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, fontFamily:"'DM Sans', system-ui" }}>
          <div style={{ background:'#0d1a35', border:'1px solid #10b981', borderRadius:14, padding:28, width:'100%', maxWidth:500, maxHeight:'90vh', overflow:'auto' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <div>
                <h3 style={{ color:'#fff', margin:'0 0 4px', fontSize:15 }}>📦 Ingresar equipo a inventario</h3>
                <div style={{ color:'#10b981', fontSize:12 }}>{formIngreso.datos?.producto} — IMEI: {formIngreso.datos?.imei || '—'}</div>
              </div>
              <button onClick={() => setFormIngreso(null)} style={{ background:'transparent', border:'none', color:'#4a6a8a', fontSize:20, cursor:'pointer' }}>×</button>
            </div>

            <form onSubmit={confirmarIngreso}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 12px' }}>

                <div style={{ gridColumn:'span 2' }}>
                  <label style={{ color:'#8aabcc', fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:4 }}>Proveedor / Origen *</label>
                  <select required style={{ ...inpS, cursor:'pointer' }} value={campos.proveedor_id} onChange={e => setCampos(c=>({...c, proveedor_id:e.target.value}))}>
                    <option value="">Seleccionar...</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ color:'#8aabcc', fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:4 }}>Color</label>
                  <input style={inpS} value={campos.color} onChange={e => setCampos(c=>({...c, color:e.target.value}))} placeholder="ej: Negro titanio" />
                </div>

                <div>
                  <label style={{ color:'#8aabcc', fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:4 }}>Almacenamiento</label>
                  <select style={{ ...inpS, cursor:'pointer' }} value={campos.almacenamiento} onChange={e => setCampos(c=>({...c, almacenamiento:e.target.value}))}>
                    {ALMACENAMIENTOS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ color:'#8aabcc', fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:4 }}>Batería %</label>
                  <input style={inpS} type="number" min="0" max="100" value={campos.bateria} onChange={e => setCampos(c=>({...c, bateria:e.target.value}))} placeholder="ej: 85" />
                </div>

                <div>
                  <label style={{ color:'#8aabcc', fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:4 }}>Condición</label>
                  <select style={{ ...inpS, cursor:'pointer' }} value={campos.estado_equipo} onChange={e => setCampos(c=>({...c, estado_equipo:e.target.value}))}>
                    {ESTADOS_EQUIPO.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ color:'#8aabcc', fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:4 }}>Costo $</label>
                  <input style={inpS} value={campos.costo} onChange={e => setCampos(c=>({...c, costo:e.target.value}))} placeholder="0" />
                </div>

                <div>
                  <label style={{ color:'#8aabcc', fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:4 }}>Precio venta est. $</label>
                  <input style={inpS} value={campos.precio_venta_est} onChange={e => setCampos(c=>({...c, precio_venta_est:e.target.value}))} placeholder="0" />
                </div>

                <div style={{ gridColumn:'span 2' }}>
                  <label style={{ color:'#8aabcc', fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:6 }}>Sticker de calidad</label>
                  <div style={{ display:'flex', gap:6 }}>
                    {STICKERS.map(s => (
                      <button key={s} type="button" onClick={() => setCampos(c=>({...c, sticker: c.sticker===s?'':s}))} style={{
                        flex:1, padding:'7px 6px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:600,
                        border: `2px solid ${campos.sticker===s ? (s==='Very Good'?'#10b981':s==='Good'?'#3b82f6':'#f59e0b') : '#1a2f52'}`,
                        background: campos.sticker===s ? (s==='Very Good'?'rgba(16,185,129,0.15)':s==='Good'?'rgba(59,130,246,0.15)':'rgba(245,158,11,0.15)') : 'transparent',
                        color: campos.sticker===s ? (s==='Very Good'?'#10b981':s==='Good'?'#3b82f6':'#f59e0b') : '#4a6a8a',
                      }}>{s}</button>
                    ))}
                  </div>
                </div>

                <div style={{ gridColumn:'span 2' }}>
                  <label style={{ color:'#8aabcc', fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:4 }}>Observaciones adicionales</label>
                  <textarea style={{ ...inpS, resize:'vertical', minHeight:52 }} value={campos.observaciones} onChange={e => setCampos(c=>({...c, observaciones:e.target.value}))} />
                </div>
              </div>

              <div style={{ display:'flex', gap:10, marginTop:18, justifyContent:'flex-end' }}>
                <button type="button" onClick={() => setFormIngreso(null)} style={{ padding:'9px 18px', background:'transparent', border:'1px solid #1a2f52', borderRadius:8, color:'#6b8ab0', fontSize:13, cursor:'pointer' }}>Cancelar</button>
                <button type="submit" disabled={guardando} style={{ padding:'9px 24px', background: guardando?'#1e3058':'linear-gradient(135deg,#10b981,#059669)', border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                  {guardando ? '⏳ Guardando...' : '✓ Confirmar ingreso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
