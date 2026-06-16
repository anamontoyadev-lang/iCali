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
          esLiderCom, esLiderAdmin, esContadora, esGarantias, esInventarioRol, esRetomas,
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
      const esAdminNot = esAdmin || esLiderAdmin || esLiderCom || esInventarioRol
      let qNotifs = supabase.from('notificaciones').select('*').order('created_at',{ascending:false}).limit(10)
      if (!esAdminNot && user) {
        if (esRetomas) {
          // Diego ve notificaciones de retomas
          qNotifs = qNotifs.or(`destinatario_rol.eq.retomas,creado_por.eq.${user.id}`)
        } else if (esGarantias) {
          qNotifs = qNotifs.or(`destinatario_rol.eq.garantias,creado_por.eq.${user.id}`)
        } else {
          // Asesores ven las suyas + las dirigidas a ellos por ID (ej: Diego en camino)
          qNotifs = qNotifs.or(`creado_por.eq.${user.id},destinatario_rol.eq.asesor,destinatario_id.eq.${user.id}`)
        }
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

  async function diegoVaEnCamino(notif) {
    const d = notif.datos || {}
    const user = (await supabase.auth.getUser()).data.user
    // Notificar al asesor que Diego viene en camino
    if (d.asesor_id) {
      await supabase.from('notificaciones').insert({
        tipo:              'DIEGO_EN_CAMINO',
        mensaje:           `🔬 Diego viene en camino a valorar la retoma — ${d.referencia || ''}`,
        datos: {
          referencia:   d.referencia,
          asesor:       d.asesor,
          valorador:    user?.email || 'Diego',
        },
        creado_por:        user.id,
        creado_por_nombre: 'Diego (Retomas)',
        destinatario_rol:  null,
        destinatario_id:   d.asesor_id,
      })
    }
    await responderNotif(notif.id, 'en_camino')
  }

  const fecha = new Date().toLocaleDateString('es-CO',{ weekday:'long', year:'numeric', month:'long', day:'numeric' })
  const nombre = perfil?.nombre?.split(' ')[0] || perfil?.nombre_completo?.split(' ')[0] || 'bienvenido'

  // Módulos según rol
  const modulos = [
    { key:'ventas',      label:'Ventas',              icon:'🛍️', path:'/ventas',       badge: contadores.ventasHoy, badgeLabel:'hoy', color:'#0066ff',  show: true },
    { key:'despachos',   label:'Despachos',            icon:'🚚', path:'/despachos',    badge: contadores.despachosPend, badgeLabel:'activos', color:'#f59e0b', show: puedeVerDespachos || esAdmin || esLiderCom || esLiderAdmin },
    { key:'laboratorio', label:'Laboratorio',          icon:'🔬', path:'/laboratorio',  badge: contadores.lab, badgeLabel:'en proceso', color:'#8b5cf6', show: true },
    { key:'retomas',     label:'Retomas',              icon:'🔄', path:'/laboratorio',  badge: contadores.retomas, badgeLabel:'activas', color:'#a78bfa', show: esRetomas },
    { key:'inventario',  label:'Inventario',           icon:'📦', path:'/inventario',   badge: contadores.inventario, badgeLabel:'disponibles', color:'#10b981', show: esAdmin || esLiderAdmin || esLiderCom || esInventarioRol },
    { key:'proveedores', label:'Proveedores',          icon:'🏭', path:'/proveedores',  badge: null, badgeLabel:'', color:'#14b8a6', show: esAdmin || esLiderAdmin },
    { key:'financieras', label:'Financieras',          icon:'💳', path:'/financieras',  badge: contadores.finPendientes||null, badgeLabel:'pendientes', color:'#f43f5e', show: puedeVerFinancieras },
    { key:'extractos',   label:'Extractos',            icon:'📄', path:'/extractos',    badge: null, badgeLabel:'', color:'#6366f1', show: puedeVerFinancieras },
    { key:'reportes',    label:'Reportes',             icon:'📊', path:'/reportes',     badge: null, badgeLabel:'', color:'#0ea5e9', show: esAdmin || esLiderAdmin || esLiderCom || esContadora || esInventarioRol },
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
    <div style={{ padding:'clamp(16px,4vw,32px) clamp(12px,4vw,32px) 80px', fontFamily:"'DM Sans', system-ui", minHeight:'100vh' }}>

      {/* HEADER */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:28 }}>
        <div>
          <h1 style={{ color:'var(--color-text-primary)', fontSize:20, fontWeight:500, margin:'0 0 4px', letterSpacing:'-0.2px' }}>
            Hola, {nombre} 👋
          </h1>
          <p style={{ color:'var(--color-text-secondary)', fontSize:13, margin:0, textTransform:'capitalize' }}>{fecha}</p>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {notifs.filter(n=>!n.respondida).length > 0 && (
            <div style={{ position:'relative' }}>
              <div style={{ width:36, height:36, borderRadius:8, border:'0.5px solid var(--color-border-secondary)', background:'var(--color-background-primary)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'var(--color-text-secondary)', fontSize:18 }}>
                🔔
                <div style={{ position:'absolute', top:6, right:6, width:8, height:8, background:'#ef4444', borderRadius:'50%', border:'2px solid var(--color-background-primary)' }} />
              </div>
            </div>
          )}
          <button onClick={() => navigate('/ventas/nueva')} style={{ padding:'0 16px', height:36, borderRadius:8, border:'none', background:'linear-gradient(135deg,#4f46e5,#3730a3)', color:'#fff', fontSize:12, fontWeight:500, cursor:'pointer' }}>
            + Nueva venta
          </button>
        </div>
      </div>

      {/* KPIs */}
      {!loading && kpis.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:12, marginBottom:28 }}>
          {kpis.map(k => (
            <div key={k.label} style={{ background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:12, padding:'16px', position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:k.color, borderRadius:'12px 12px 0 0' }} />
              <div style={{ color:'var(--color-text-secondary)', fontSize:11, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>{k.label}</div>
              <div style={{ color:'var(--color-text-primary)', fontSize: k.big?28:22, fontWeight:500, lineHeight:1 }}>{k.val}</div>
              {k.sub && <div style={{ color:'var(--color-text-secondary)', fontSize:11, marginTop:6 }}>{k.sub}</div>}
            </div>
          ))}
        </div>
      )}

      {/* MÓDULOS */}
      <div style={{ marginBottom:28 }}>
        <div style={{ color:'var(--color-text-secondary)', fontSize:10, fontWeight:500, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:12 }}>Módulos</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(120px, 1fr))', gap:10 }}>
          {modulos.map(m => (
            <button key={m.key} onClick={() => navigate(m.path)}
              style={{ background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:12, padding:'14px', cursor:'pointer', textAlign:'left', transition:'border-color .15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = m.color}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-border-tertiary)'}
            >
              <div style={{ width:36, height:36, borderRadius:8, background:m.color+'18', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, marginBottom:10 }}>{m.icon}</div>
              <div style={{ color:'var(--color-text-primary)', fontSize:13, fontWeight:500, marginBottom:4 }}>{m.label}</div>
              {m.badge != null && m.badge > 0 ? (
                <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <span style={{ background:m.color+'22', color:m.color, fontSize:11, fontWeight:500, padding:'2px 7px', borderRadius:4 }}>{m.badge}</span>
                  <span style={{ color:'var(--color-text-secondary)', fontSize:10 }}>{m.badgeLabel}</span>
                </div>
              ) : (
                <div style={{ color:'var(--color-text-tertiary)', fontSize:11 }}>Ver módulo →</div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* GRID: NOTIFICACIONES + VENTAS RECIENTES */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:16, alignItems:'start' }}>

        {/* Ventas recientes */}
        <div style={{ background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:12, overflow:'hidden' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', borderBottom:'0.5px solid var(--color-border-tertiary)' }}>
            <div style={{ color:'var(--color-text-primary)', fontSize:13, fontWeight:500 }}>Ventas recientes</div>
            <button onClick={() => navigate('/ventas')} style={{ background:'transparent', border:'none', color:'#6366f1', fontSize:12, cursor:'pointer' }}>Ver todas →</button>
          </div>
          {loading ? (
            <div style={{ padding:32, textAlign:'center', color:'var(--color-text-secondary)', fontSize:13 }}>Cargando...</div>
          ) : resumen.ventasRecientes?.filter(v => v.nombre_cliente && v.nombre_cliente !== 'Borrador' && v.valor_venta > 0).length > 0 ? (
            resumen.ventasRecientes.filter(v => v.nombre_cliente && v.nombre_cliente !== 'Borrador' && v.valor_venta > 0).map((v,i,arr) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 16px', borderBottom: i < arr.length-1 ? '0.5px solid var(--color-border-tertiary)' : 'none' }}>
                <div style={{ width:34, height:34, borderRadius:8, background:'#eeedfe', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color:'#534ab7', fontSize:17 }}>📱</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ color:'var(--color-text-primary)', fontSize:13, fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    {v.producto || v.nombre_cliente}
                  </div>
                  <div style={{ color:'var(--color-text-secondary)', fontSize:11, marginTop:1 }}>
                    {v.nombre_cliente !== 'Borrador' ? `${v.nombre_cliente} · ` : ''}{v.asesor_nombre?.split('.')[0]} · {v.canal==='mostrador'?'Mostrador':'Call'}
                  </div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ color:'var(--color-text-primary)', fontSize:13, fontWeight:500 }}>{fmtK(v.valor_venta)}</div>
                  <span style={{
                    display:'inline-block', marginTop:3,
                    background: v.estado==='entregada'?'#eaf3de':v.estado==='registrada'?'#eeedfe':v.estado==='desistida'?'var(--color-background-secondary)':'#faeeda',
                    color: v.estado==='entregada'?'#3b6d11':v.estado==='registrada'?'#3c3489':v.estado==='desistida'?'var(--color-text-secondary)':'#633806',
                    fontSize:10, fontWeight:500, padding:'2px 7px', borderRadius:10
                  }}>
                    {v.estado==='entregada'?'Entregada':v.estado==='registrada'?'Registrada':v.estado==='en_proceso'?'En proceso':v.estado==='desistida'?'Desistida':v.estado}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div style={{ padding:32, textAlign:'center', color:'var(--color-text-secondary)', fontSize:13 }}>Sin ventas recientes</div>
          )}
        </div>

        {/* Notificaciones */}
        <div style={{ background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:12, overflow:'hidden' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', borderBottom:'0.5px solid var(--color-border-tertiary)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ color:'var(--color-text-primary)', fontSize:13, fontWeight:500 }}>Notificaciones</span>
              {notifs.filter(n=>!n.respondida).length > 0 && (
                <span style={{ background:'#4f46e5', color:'#fff', fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:10, letterSpacing:'.02em' }}>
                  {notifs.filter(n=>!n.respondida).length} nueva{notifs.filter(n=>!n.respondida).length>1?'s':''}
                </span>
              )}
            </div>
            <span style={{ color:'var(--color-text-secondary)', fontSize:11 }}>Últimas {notifs.length}</span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', maxHeight:480, overflowY:'auto' }}>
            {notifs.length === 0 ? (
              <div style={{ padding:24, textAlign:'center', color:'var(--color-text-secondary)', fontSize:13 }}>Sin notificaciones</div>
            ) : notifs.map(n => {
              const pendiente = !n.respondida
              const icono = n.tipo==='EQUIPO_LISTO_LABORATORIO'?'🔬':n.tipo==='SOLICITUD_EQUIPO'?'🔔':n.tipo==='DEVOLUCION_EQUIPO'?'📤':n.tipo==='VALORACION_RETOMA'?'🔄':n.tipo==='RECOGIDA_RETOMA'?'📦':n.tipo==='DIEGO_EN_CAMINO'?'🚶':n.tipo==='VALOR_RETOMA_CONFIRMADO'?'💰':'📌'
              const accentColor = pendiente
                ? (n.tipo==='SOLICITUD_EQUIPO'?'#f59e0b':n.tipo==='VALORACION_RETOMA'||n.tipo==='RECOGIDA_RETOMA'?'#8b5cf6':'#4f46e5')
                : 'transparent'
              return (
                <div key={n.id} style={{
                  padding:'10px 14px',
                  borderBottom:'0.5px solid var(--color-border-tertiary)',
                  background: pendiente ? 'var(--color-background-primary)' : 'var(--color-background-secondary)',
                  borderLeft: `3px solid ${accentColor}`,
                  opacity: pendiente ? 1 : 0.7,
                }}>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                    <span style={{ fontSize:14, flexShrink:0, marginTop:1 }}>{icono}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:6 }}>
                        <div style={{ color: pendiente?'var(--color-text-primary)':'var(--color-text-secondary)', fontSize:12, fontWeight: pendiente?500:400, lineHeight:1.4 }}>{n.mensaje}</div>
                        {pendiente ? (
                          <span style={{
                            background: n.tipo==='SOLICITUD_EQUIPO'?'#fef3c7':n.tipo?.includes('RETOMA')?'#ede9fe':'#dbeafe',
                            color: n.tipo==='SOLICITUD_EQUIPO'?'#92400e':n.tipo?.includes('RETOMA')?'#5b21b6':'#1e40af',
                            fontSize:9, fontWeight:600, padding:'2px 7px', borderRadius:10, flexShrink:0, letterSpacing:'.02em'
                          }}>
                            {n.tipo==='SOLICITUD_EQUIPO'?'Solicitud':n.tipo==='VALORACION_RETOMA'?'Valorar':n.tipo==='RECOGIDA_RETOMA'?'Recoger':n.tipo==='DEVOLUCION_EQUIPO'?'Devolución':'Nuevo'}
                          </span>
                        ) : (
                          <span style={{ background:'var(--color-background-tertiary)', color:'var(--color-text-tertiary)', fontSize:9, padding:'2px 6px', borderRadius:10, flexShrink:0 }}>
                            {n.respuesta==='si'?'✓ Atendido':n.respuesta==='recogido'?'✓ Recogido':n.respuesta==='en_camino'?'En camino':'Leída'}
                          </span>
                        )}
                      </div>
                      {(n.datos?.imei || n.datos?.producto || n.datos?.referencia || n.datos?.asesor) && (
                        <div style={{ color:'var(--color-text-secondary)', fontSize:10, marginTop:3, display:'flex', gap:4, flexWrap:'wrap' }}>
                          {n.datos?.asesor && <span style={{ fontWeight:500 }}>{n.datos.asesor?.split('.')[0]}</span>}
                          {n.datos?.referencia && <span>{(n.datos.asesor?'· ':'')+n.datos.referencia}</span>}
                          {n.datos?.producto && !n.datos?.referencia && <span>{n.datos.producto}</span>}
                          {n.datos?.imei && <span style={{ fontFamily:'monospace', color:'var(--color-text-tertiary)' }}>· {String(n.datos.imei).slice(0,10)}...</span>}
                        </div>
                      )}
                      <div style={{ color:'var(--color-text-tertiary)', fontSize:10, marginTop:3 }}>
                        {new Date(n.created_at).toLocaleDateString('es-CO',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}
                      </div>
                      {pendiente && (
                        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:8 }}>
                          {n.tipo === 'SOLICITUD_EQUIPO' && (
                            <>
                              <button onClick={() => responderNotif(n.id,'no')} style={{ padding:'4px 10px', background:'transparent', border:'0.5px solid #ef4444', borderRadius:6, color:'#ef4444', fontSize:11, cursor:'pointer' }}>✗ No disponible</button>
                              <button onClick={() => responderNotif(n.id,'si')} style={{ padding:'4px 10px', background:'#4f46e5', border:'none', borderRadius:6, color:'#fff', fontSize:11, cursor:'pointer' }}>✓ Bajé los equipos</button>
                            </>
                          )}
                          {n.tipo === 'VALORACION_RETOMA' && !n.respondida && (esRetomas || esAdmin || esLiderAdmin) && (
                            <button onClick={() => diegoVaEnCamino(n)} style={{ padding:'4px 10px', background:'#8b5cf6', border:'none', borderRadius:6, color:'#fff', fontSize:11, cursor:'pointer' }}>🚶 Voy en camino</button>
                          )}
                          {n.tipo === 'RECOGIDA_RETOMA' && (esRetomas || esAdmin || esLiderAdmin) && (
                            <button onClick={async () => { await responderNotif(n.id,'recogido'); navigate('/laboratorio') }} style={{ padding:'4px 10px', background:'#4f46e5', border:'none', borderRadius:6, color:'#fff', fontSize:11, cursor:'pointer' }}>✓ Fui a recoger →</button>
                          )}
                          {n.tipo === 'EQUIPO_LISTO_LABORATORIO' && (
                            <button onClick={() => navigate('/laboratorio')} style={{ padding:'4px 10px', background:'#4f46e5', border:'none', borderRadius:6, color:'#fff', fontSize:11, cursor:'pointer' }}>Ver lab →</button>
                          )}
                          {n.tipo === 'DEVOLUCION_EQUIPO' && (esAdmin || esLiderAdmin || esInventarioRol) && (
                            <button onClick={() => confirmarRecogidaDashboard(n)} style={{ padding:'4px 10px', background:'#4f46e5', border:'none', borderRadius:6, color:'#fff', fontSize:11, cursor:'pointer' }}>✓ Confirmé recogida</button>
                          )}
                          {n.tipo === 'VALOR_RETOMA_CONFIRMADO' && (
                            <button onClick={() => responderNotif(n.id,'leida')} style={{ padding:'4px 10px', background:'#8b5cf6', border:'none', borderRadius:6, color:'#fff', fontSize:11, cursor:'pointer' }}>✓ Entendido</button>
                          )}
                          {!['SOLICITUD_EQUIPO','EQUIPO_LISTO_LABORATORIO','DEVOLUCION_EQUIPO','VALORACION_RETOMA','RECOGIDA_RETOMA','VALOR_RETOMA_CONFIRMADO'].includes(n.tipo) && (
                            <button onClick={() => responderNotif(n.id,'leida')} style={{ padding:'4px 10px', background:'transparent', border:'0.5px solid var(--color-border-secondary)', borderRadius:6, color:'var(--color-text-secondary)', fontSize:11, cursor:'pointer' }}>✓ Leída</button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <EquiposConAsesor />

    </div>
  )
}
