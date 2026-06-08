import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import EquiposConAsesor from '../components/EquiposConAsesor'

const fmt  = n => new Intl.NumberFormat('es-CO',{ style:'currency', currency:'COP', maximumFractionDigits:0 }).format(n||0)
const fmtK = n => {
  if (!n) return '$0'
  if (n >= 1_000_000_000) return '$'+(n/1_000_000_000).toFixed(1)+'B'
  if (n >= 1_000_000)     return '$'+(n/1_000_000).toFixed(1)+'M'
  if (n >= 1_000)         return '$'+(n/1_000).toFixed(0)+'K'
  return '$'+n
}

export default function Dashboard() {
  const { perfil, esAsesor, esAsesorCall, esAsesorMostrador, esAdmin,
          esLiderCom, esLiderAdmin, esContadora, esGarantias,
          puedeVerFinancieras, puedeVerDespachos } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [contadores, setContadores] = useState({})
  const [notifs, setNotifs] = useState([])
  const [resumen, setResumen] = useState({})

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    try {
      // Fecha en hora Colombia (UTC-5)
      const ahora = new Date()
      const bogota = new Date(ahora.getTime() - 5 * 60 * 60 * 1000)
      const hoy  = bogota.toISOString().split('T')[0]
      const mes  = hoy.slice(0,7)+'-01'
      const user = (await supabase.auth.getUser()).data.user

      const esAsesorPuro = (esAsesorCall || esAsesorMostrador) && !esAdmin && !esLiderAdmin && !esLiderCom

      // Ventas hoy
      let qHoy = supabase.from('ventas').select('id').eq('fecha_venta', hoy).neq('estado','anulada')
      if (esAsesorPuro && user) qHoy = qHoy.eq('asesor_id', user.id)
      const { data: dHoy } = await qHoy

      // Ventas mes
      let qMes = supabase.from('ventas').select('id,valor_venta,costo_equipo,asesor_nombre,fecha_venta').gte('fecha_venta', mes).neq('estado','anulada')
      if (esAsesorPuro && user) qMes = qMes.eq('asesor_id', user.id)
      const { data: dMes } = await qMes

      // Ventas recientes
      let qRec = supabase.from('ventas').select('fecha_venta,nombre_cliente,producto,valor_venta,asesor_nombre,canal').order('created_at',{ascending:false}).limit(6)
      if (esAsesorPuro && user) qRec = qRec.eq('asesor_id', user.id)
      const { data: dRec } = await qRec

      // Despachos
      const { data: dDesp } = await supabase.from('despachos').select('id,estado')
      // Lab
      const { data: dLab } = await supabase.from('garantias_reparaciones').select('id,estado')
      // Inventario
      const { data: dInv } = await supabase.from('compras_proveedor').select('id,costo').eq('estado','disponible')
      // Notificaciones
      // Notificaciones: admins ven todas, asesores solo las suyas
      const esAdminNot = esAdmin || esLiderAdmin || esLiderCom
      let qNotifs = supabase.from('notificaciones').select('*').order('created_at',{ascending:false}).limit(10)
      if (!esAdminNot && user) {
        // Asesores ven: las que crearon + las respuestas dirigidas a ellos
        qNotifs = qNotifs.or(`creado_por.eq.${user.id},destinatario_rol.eq.asesor`)
      }
      const { data: dNotifs } = await qNotifs

      const valorMes  = (dMes||[]).reduce((a,v)=>a+Number(v.valor_venta||0),0)
      const costoMes  = (dMes||[]).reduce((a,v)=>a+Number(v.costo_equipo||0),0)
      const valorStock = (dInv||[]).reduce((a,v)=>a+Number(v.costo||0),0)
      const despachosPend = (dDesp||[]).filter(d=>['pendiente','en_preparacion','en_transito','recogido'].includes(d.estado)).length
      const labActivos = (dLab||[]).filter(g=>['recibido','diagnostico','en_reparacion','esperando_parte'].includes(g.estado)).length

      setContadores({
        ventasHoy:    (dHoy||[]).length,
        ventasMes:    (dMes||[]).length,
        valorMes, utilidadMes: valorMes - costoMes,
        despachos:    (dDesp||[]).length,
        despachosPend,
        lab:          labActivos,
        inventario:   (dInv||[]).length,
        valorStock,
        finPendientes: 0,
      })
      setNotifs(dNotifs||[])
      setResumen({ ventasRecientes: dRec||[] })

      // Financieras por separado para no bloquear si falla
      if (puedeVerFinancieras) {
        try {
          const { data: dFin } = await supabase.from('financieras_pagos').select('id').eq('estado_desembolso','pendiente')
          setContadores(prev => ({ ...prev, finPendientes: (dFin||[]).length }))
        } catch(_) {}
      }
    } catch(err) {
      console.error('Dashboard loadAll error:', err)
    }
    setLoading(false)
  }

    async function responderNotif(id, respuesta) {
    const user = (await supabase.auth.getUser()).data.user
    await supabase.from('notificaciones').update({
      respondida: true, respuesta,
      respondido_por: user?.email||'',
    }).eq('id', id)
    setNotifs(n => n.map(x => x.id===id ? {...x, respondida:true, respuesta} : x))
  }

  async function confirmarRecogidaDashboard(notif) {
    const d = notif.datos || {}
    if (d.imei) {
      await supabase.from('compras_proveedor').update({
        estado: 'disponible', con_asesor: null, fecha_prestamo: null,
      }).eq('imei', d.imei)
    }
    await responderNotif(notif.id, 'recogido')
  }

  const fecha = new Date().toLocaleDateString('es-CO',{ weekday:'long', year:'numeric', month:'long', day:'numeric' })
  const nombre = perfil?.nombre?.split(' ')[0] || perfil?.nombre_completo?.split(' ')[0] || 'bienvenido'

  // Módulos según rol
  const modulos = [
    { key:'ventas',      label:'Ventas',              icon:'🛍️', path:'/ventas',       badge: contadores.ventasHoy, badgeLabel:'hoy', color:'#0066ff',  show: true },
    { key:'despachos',   label:'Despachos',            icon:'🚚', path:'/despachos',    badge: contadores.despachosPend, badgeLabel:'activos', color:'#f59e0b', show: puedeVerDespachos || esAdmin || esLiderCom || esLiderAdmin },
    { key:'laboratorio', label:'Laboratorio',          icon:'🔬', path:'/laboratorio',  badge: contadores.lab, badgeLabel:'en proceso', color:'#8b5cf6', show: true },
    { key:'inventario',  label:'Inventario',           icon:'📦', path:'/inventario',   badge: contadores.inventario, badgeLabel:'disponibles', color:'#10b981', show: esAdmin || esLiderAdmin || esLiderCom },
    { key:'proveedores', label:'Proveedores',          icon:'🏭', path:'/proveedores',  badge: null, badgeLabel:'', color:'#14b8a6', show: esAdmin || esLiderAdmin },
    { key:'financieras', label:'Financieras',          icon:'💳', path:'/financieras',  badge: contadores.finPendientes||null, badgeLabel:'pendientes', color:'#f43f5e', show: puedeVerFinancieras },
    { key:'extractos',   label:'Extractos',            icon:'📄', path:'/extractos',    badge: null, badgeLabel:'', color:'#6366f1', show: puedeVerFinancieras },
    { key:'reportes',    label:'Reportes',             icon:'📊', path:'/reportes',     badge: null, badgeLabel:'', color:'#0ea5e9', show: esAdmin || esLiderAdmin || esLiderCom || esContadora },
    { key:'usuarios',    label:'Usuarios',             icon:'👥', path:'/usuarios',     badge: null, badgeLabel:'', color:'#ec4899', show: esAdmin },
  ].filter(m => m.show)

  // Resumen según rol
  const kpis = [
    esAdmin || esLiderCom || esLiderAdmin || esAsesor || esAsesorCall || esAsesorMostrador
      ? { label:'Ventas hoy',     val: contadores.ventasHoy,          color:'#0066ff', big:true }
      : null,
    esAdmin || esLiderCom || esLiderAdmin || esAsesor || esAsesorCall || esAsesorMostrador
      ? { label:'Ventas del mes', val: contadores.ventasMes,          color:'#00aaff', big:true }
      : null,
    esAdmin || esLiderCom || esLiderAdmin
      ? { label:'Valor del mes',  val: fmtK(contadores.valorMes),     color:'#10b981' }
      : null,
    esAdmin || esLiderCom || esLiderAdmin
      ? { label:'Utilidad bruta', val: fmtK(contadores.utilidadMes),  color:'#34d399' }
      : null,
    esAdmin || esLiderAdmin
      ? { label:'Stock disponible', val: contadores.inventario,       color:'#8b5cf6', sub: fmtK(contadores.valorStock) }
      : null,
    puedeVerFinancieras && contadores.finPendientes > 0
      ? { label:'Cobros pendientes', val: contadores.finPendientes,   color:'#f43f5e' }
      : null,
  ].filter(Boolean)

  return (
    <div style={{ padding:'clamp(16px, 4vw, 32px) clamp(12px, 4vw, 32px) 80px', fontFamily:"'DM Sans', system-ui", minHeight:'100vh', background:'#060d1f' }}>

      {/* Header */}
      <div style={{ marginBottom:28 }}>
        <h1 style={{ color:'#fff', fontSize:22, fontWeight:700, margin:'0 0 4px', letterSpacing:'-0.3px' }}>
          Hola, {nombre} 👋
        </h1>
        <p style={{ color:'#4a6a8a', fontSize:13, margin:0, textTransform:'capitalize' }}>{fecha}</p>
      </div>

      {/* MÓDULOS */}
      <div style={{ marginBottom:28 }}>
        <div style={{ color:'#3a5a7a', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:12 }}>Módulos</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(120px, 1fr))', gap:10 }}>
          {modulos.map(m => (
            <button key={m.key} onClick={() => navigate(m.path)} style={{
              background:'#0d1a35', border:`1px solid #1a2f52`,
              borderRadius:12, padding:'16px 14px',
              cursor:'pointer', textAlign:'left',
              transition:'all .15s',
              position:'relative', overflow:'hidden',
            }}
            onMouseEnter={e => { e.currentTarget.style.border=`1px solid ${m.color}55`; e.currentTarget.style.background='#0f1e3a' }}
            onMouseLeave={e => { e.currentTarget.style.border='1px solid #1a2f52'; e.currentTarget.style.background='#0d1a35' }}
            >
              {/* Barra color arriba */}
              <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:m.color, opacity:.7 }} />
              <div style={{ fontSize:24, marginBottom:8 }}>{m.icon}</div>
              <div style={{ color:'#fff', fontSize:13, fontWeight:600, marginBottom:4 }}>{m.label}</div>
              {m.badge != null && m.badge > 0 ? (
                <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <span style={{ background: m.color+'22', color: m.color, fontSize:11, fontWeight:700, padding:'2px 7px', borderRadius:4 }}>{m.badge}</span>
                  <span style={{ color:'#4a6a8a', fontSize:10 }}>{m.badgeLabel}</span>
                </div>
              ) : (
                <div style={{ color:'#3a5a7a', fontSize:10 }}>Ver módulo →</div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* NOTIFICACIONES - fuera del loading para mostrar siempre */}
      {notifs.length > 0 && (
        <div style={{ marginBottom:28 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <div style={{ color:'#3a5a7a', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em' }}>
              Notificaciones
              {notifs.filter(n=>!n.respondida).length > 0 && (
                <span style={{ marginLeft:8, background:'#ef4444', color:'#fff', fontSize:9, fontWeight:700, padding:'2px 6px', borderRadius:10 }}>
                  {notifs.filter(n=>!n.respondida).length} nueva{notifs.filter(n=>!n.respondida).length>1?'s':''}
                </span>
              )}
            </div>
            <span style={{ color:'#4a6a8a', fontSize:11 }}>Últimas {notifs.length}</span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {notifs.map(n => {
              const pendiente = !n.respondida
              const icono = n.tipo==='EQUIPO_LISTO_LABORATORIO'?'🔬':n.tipo==='SOLICITUD_EQUIPO'?'🔔':'📌'
              const borderColor = pendiente
                ? (n.tipo==='EQUIPO_LISTO_LABORATORIO'?'#10b981':n.tipo==='SOLICITUD_EQUIPO'?'#f59e0b':'#3b82f6')
                : '#1a2f52'
              return (
                <div key={n.id} style={{
                  background: pendiente ? '#0d1a35' : '#080f20',
                  border: `1px solid ${borderColor}`,
                  borderRadius:10, padding:'10px 12px',
                  display:'flex', flexDirection:'column', gap:8,
                  opacity: pendiente ? 1 : 0.6,
                }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
                    <span style={{ fontSize:16, flexShrink:0 }}>{icono}</span>
                    <div style={{ minWidth:0, flex:1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                        <span style={{ color: pendiente?'#fff':'#8aabcc', fontSize:12, fontWeight: pendiente?500:400 }}>{n.mensaje}</span>
                        {pendiente
                          ? <span style={{ background:'#f59e0b22', color:'#f59e0b', fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:4 }}>PENDIENTE</span>
                          : <span style={{ background:'#10b98122', color:'#10b981', fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:4 }}>
                              {n.respuesta==='ingresado'?'INGRESADO':n.respuesta==='si'?'ATENDIDO':n.respuesta==='no'?'NO DISPONIBLE':'LEÍDA'}
                            </span>
                        }
                      </div>
                      <div style={{ color:'#4a6a8a', fontSize:10, marginTop:2 }}>
                        {n.datos?.producto && <span>{n.datos.producto}</span>}
                        {n.datos?.imei && <span style={{ fontFamily:'monospace' }}> · {n.datos.imei}</span>}
                        <span style={{ marginLeft:4 }}>{new Date(n.created_at).toLocaleDateString('es-CO',{day:'2-digit',month:'short'})}</span>
                      </div>
                    </div>
                  </div>
                  {pendiente && (
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                      {n.tipo === 'SOLICITUD_EQUIPO' && (
                        <>
                          <button onClick={() => responderNotif(n.id,'no')} style={{ padding:'5px 10px', background:'transparent', border:'1px solid #ef4444', borderRadius:6, color:'#ef4444', fontSize:11, fontWeight:600, cursor:'pointer' }}>✗ No</button>
                          <button onClick={() => responderNotif(n.id,'si')} style={{ padding:'5px 10px', background:'#10b981', border:'none', borderRadius:6, color:'#fff', fontSize:11, fontWeight:600, cursor:'pointer' }}>✓ Voy</button>
                        </>
                      )}
                      {n.tipo === 'EQUIPO_LISTO_LABORATORIO' && (
                        <button onClick={() => navigate('/laboratorio')} style={{ padding:'5px 10px', background:'#10b981', border:'none', borderRadius:6, color:'#fff', fontSize:11, fontWeight:600, cursor:'pointer' }}>Ver lab →</button>
                      )}
                      {n.tipo === 'DEVOLUCION_EQUIPO' && (esAdmin || esLiderAdmin) && (
                        <button onClick={() => confirmarRecogidaDashboard(n)} style={{ padding:'5px 10px', background:'#10b981', border:'none', borderRadius:6, color:'#fff', fontSize:11, fontWeight:600, cursor:'pointer' }}>✓ Confirmé recogida</button>
                      )}
                      {!['SOLICITUD_EQUIPO','EQUIPO_LISTO_LABORATORIO','DEVOLUCION_EQUIPO'].includes(n.tipo) && (
                        <button onClick={() => responderNotif(n.id,'leida')} style={{ padding:'5px 10px', background:'#1a2f52', border:'none', borderRadius:6, color:'#8aabcc', fontSize:11, cursor:'pointer' }}>✓ Leída</button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <EquiposConAsesor />

      {loading ? (
        <div style={{ color:'#4a6a8a', fontSize:13, textAlign:'center', padding:20 }}>Cargando...</div>
      ) : (
        <>
          {/* notificaciones movidas arriba del loading */}

          {/* RESUMEN DE GESTIÓN */}
          {kpis.length > 0 && (
            <div style={{ marginBottom:28 }}>
              <div style={{ color:'#3a5a7a', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:12 }}>
                Tu resumen — {new Date().toLocaleDateString('es-CO',{month:'long', year:'numeric'})}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:10, marginBottom:20 }}>
                {kpis.map(k => (
                  <div key={k.label} style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:12, padding:'16px 18px' }}>
                    <div style={{ color:'#5a7aaa', fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:8 }}>{k.label}</div>
                    <div style={{ color:'#fff', fontSize: k.big?32:22, fontWeight:800, letterSpacing:'-1px', lineHeight:1 }}>{k.val}</div>
                    {k.sub && <div style={{ color:'#4a6a8a', fontSize:11, marginTop:4 }}>{k.sub}</div>}
                    <div style={{ height:3, background:k.color, borderRadius:2, marginTop:12, opacity:.6 }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VENTAS RECIENTES */}
          {resumen.ventasRecientes?.length > 0 && (
            <div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                <div style={{ color:'#3a5a7a', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em' }}>Ventas recientes</div>
                <button onClick={() => navigate('/ventas')} style={{ background:'transparent', border:'none', color:'#0066ff', fontSize:12, cursor:'pointer' }}>Ver todas →</button>
              </div>
              <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:12, overflow:'hidden' }}>
                {resumen.ventasRecientes.map((v,i) => (
                  <div key={i} style={{
                    display:'flex', alignItems:'center', gap:12, padding:'12px 16px',
                    borderBottom: i < resumen.ventasRecientes.length-1 ? '1px solid #0f1e36' : 'none',
                  }}>
                    <div style={{ width:36, height:36, borderRadius:8, background:'linear-gradient(135deg,#0066ff22,#0066ff11)', border:'1px solid #1a2f52', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>📱</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ color:'#e2e8f0', fontSize:13, fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{v.nombre_cliente}</div>
                      <div style={{ color:'#4a6a8a', fontSize:11, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{v.producto}</div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ color:'#10b981', fontSize:13, fontWeight:700 }}>{fmtK(v.valor_venta)}</div>
                      <div style={{ color:'#4a6a8a', fontSize:10 }}>{v.asesor_nombre?.split('.')[0]} · {v.canal==='mostrador'?'Mostrador':'Call'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
