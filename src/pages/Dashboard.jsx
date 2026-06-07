import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'

const fmt  = n => new Intl.NumberFormat('es-CO',{ style:'currency', currency:'COP', maximumFractionDigits:0 }).format(n||0)
const fmtK = n => {
  if (!n) return '$0'
  if (n >= 1_000_000_000) return '$'+(n/1_000_000_000).toFixed(1)+'B'
  if (n >= 1_000_000)     return '$'+(n/1_000_000).toFixed(1)+'M'
  if (n >= 1_000)         return '$'+(n/1_000).toFixed(0)+'K'
  return '$'+n
}
const DIAS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export default function Dashboard() {
  const { perfil, esAsesor, esAdmin, esLiderCom, esLiderAdmin, puedeVerFinancieras } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [stats, setStats]     = useState({
    ventasHoy:0, ventasMes:0, valorMes:0, utilidadMes:0,
    despachosPendientes:0, labActivos:0, inventarioDisponible:0,
    valorStock:0, financierasPendientes:0,
  })
  const [ventasSemana, setVentasSemana]   = useState([])
  const [ventasMesLine, setVentasMesLine] = useState([])
  const [topAsesores, setTopAsesores]     = useState([])
  const [actividadReciente, setActividadReciente] = useState([])
  const [alertas, setAlertas]             = useState([])

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const hoy    = new Date().toISOString().split('T')[0]
    const mes    = hoy.slice(0,7)+'-01'
    const user   = (await supabase.auth.getUser()).data.user

    // Últimos 7 días
    const hace7  = new Date(Date.now() - 6*24*60*60*1000).toISOString().split('T')[0]

    let qHoy = supabase.from('ventas').select('id,valor_venta,costo_equipo',{count:'exact'}).eq('fecha_venta',hoy).neq('estado','anulada')
    let qMes = supabase.from('ventas').select('id,valor_venta,costo_equipo,fecha_venta,asesor_nombre',{count:'exact'}).gte('fecha_venta',mes).neq('estado','anulada')
    let qSem = supabase.from('ventas').select('id,valor_venta,fecha_venta').gte('fecha_venta',hace7).neq('estado','anulada')
    let qRec = supabase.from('ventas').select('fecha_venta,nombre_cliente,producto,valor_venta,asesor_nombre,estado').order('created_at',{ascending:false}).limit(5)

    if (esAsesor && user) {
      qHoy = qHoy.eq('asesor_id', user.id)
      qMes = qMes.eq('asesor_id', user.id)
      qSem = qSem.eq('asesor_id', user.id)
      qRec = qRec.eq('asesor_id', user.id)
    }

    const [
      { data: dHoy, count: cHoy },
      { data: dMes, count: cMes },
      { data: dSem },
      { count: cDesp },
      { count: cLab },
      { data: dInv },
      { data: dRec },
      { count: cFin },
    ] = await Promise.all([
      qHoy,
      qMes,
      qSem,
      supabase.from('despachos').select('id',{count:'exact',head:true}).in('estado',['pendiente','en_preparacion','en_transito','recogido']),
      supabase.from('garantias_reparaciones').select('id',{count:'exact',head:true}).in('estado',['recibido','diagnostico','en_reparacion','esperando_parte']),
      supabase.from('compras_proveedor').select('costo,estado').eq('estado','disponible'),
      qRec,
      puedeVerFinancieras
        ? supabase.from('financieras_pagos').select('id',{count:'exact',head:true}).eq('estado_desembolso','pendiente')
        : Promise.resolve({count:0}),
    ])

    const valorMes    = (dMes||[]).reduce((a,v)=>a+Number(v.valor_venta||0),0)
    const costMes     = (dMes||[]).reduce((a,v)=>a+Number(v.costo_equipo||0),0)
    const valorStock  = (dInv||[]).reduce((a,v)=>a+Number(v.costo||0),0)

    setStats({
      ventasHoy:   cHoy||0, ventasMes: cMes||0,
      valorMes, utilidadMes: valorMes-costMes,
      despachosPendientes: cDesp||0,
      labActivos: cLab||0,
      inventarioDisponible: (dInv||[]).length,
      valorStock, financierasPendientes: cFin||0,
    })

    // Ventas por día últimos 7 días
    const byDia = {}
    for (let i=6; i>=0; i--) {
      const d = new Date(Date.now()-i*24*60*60*1000)
      const key = d.toISOString().split('T')[0]
      byDia[key] = { dia: DIAS[d.getDay()], ventas:0, valor:0, fecha:key }
    }
    ;(dSem||[]).forEach(v => {
      if (byDia[v.fecha_venta]) {
        byDia[v.fecha_venta].ventas++
        byDia[v.fecha_venta].valor += Number(v.valor_venta||0)
      }
    })
    setVentasSemana(Object.values(byDia))

    // Ventas por día del mes actual
    const byDiaMes = {}
    ;(dMes||[]).forEach(v => {
      const d = v.fecha_venta?.slice(8,10)||'01'
      if (!byDiaMes[d]) byDiaMes[d] = { dia:Number(d), ventas:0 }
      byDiaMes[d].ventas++
    })
    setVentasMesLine(Object.values(byDiaMes).sort((a,b)=>a.dia-b.dia))

    // Top asesores del mes
    const byAsesor = {}
    ;(dMes||[]).forEach(v => {
      const k = v.asesor_nombre||'Sin asignar'
      if (!byAsesor[k]) byAsesor[k] = { asesor:k, ventas:0, valor:0 }
      byAsesor[k].ventas++
      byAsesor[k].valor += Number(v.valor_venta||0)
    })
    setTopAsesores(Object.values(byAsesor).sort((a,b)=>b.ventas-a.ventas).slice(0,5))

    setActividadReciente(dRec||[])

    // Alertas
    const al = []
    if ((cDesp||0) > 0) al.push({ tipo:'warning', msg:`${cDesp} despacho${cDesp>1?'s':''} pendiente${cDesp>1?'s':''}`, path:'/despachos' })
    if ((cLab||0) > 0)  al.push({ tipo:'info',    msg:`${cLab} equipo${cLab>1?'s':''} en laboratorio`, path:'/laboratorio' })
    if ((cFin||0) > 0 && puedeVerFinancieras) al.push({ tipo:'error', msg:`${cFin} cobro${cFin>1?'s':''} pendiente${cFin>1?'s':''}`, path:'/financieras' })
    setAlertas(al)

    setLoading(false)
  }

  const fecha  = new Date().toLocaleDateString('es-CO',{ weekday:'long', year:'numeric', month:'long', day:'numeric' })
  const mesAct = MESES[new Date().getMonth()] + ' ' + new Date().getFullYear()

  const tooltip = {
    contentStyle:{ background:'#0a1628', border:'1px solid #1a2f52', borderRadius:8, fontSize:12 },
    labelStyle:{ color:'#fff' }, itemStyle:{ color:'#8aabcc' }
  }

  return (
    <div style={{ padding:'28px 32px', fontFamily:"'DM Sans', system-ui", background:'#060d1f', minHeight:'100vh' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:28 }}>
        <div>
          <h1 style={{ color:'#fff', fontSize:24, fontWeight:700, margin:'0 0 4px', letterSpacing:'-0.5px' }}>
            Hola, {perfil?.nombre?.split(' ')[0] || perfil?.nombre_completo?.split(' ')[0] || 'bienvenido'} 👋
          </h1>
          <p style={{ color:'#4a6a8a', fontSize:13, margin:0, textTransform:'capitalize' }}>{fecha}</p>
        </div>
        <button onClick={() => navigate('/ventas/nueva')} style={{
          padding:'11px 22px', background:'linear-gradient(135deg,#0066ff,#0044bb)',
          border:'none', borderRadius:10, color:'#fff', fontSize:13, fontWeight:700,
          cursor:'pointer', display:'flex', alignItems:'center', gap:8,
          boxShadow:'0 4px 16px rgba(0,102,255,0.35)'
        }}>
          <span style={{ fontSize:16 }}>+</span> Nueva venta
        </button>
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
          {alertas.map((a,i) => (
            <div key={i} onClick={() => navigate(a.path)} style={{
              padding:'8px 14px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:500,
              background: a.tipo==='error'?'rgba(244,63,94,0.1)':a.tipo==='warning'?'rgba(245,158,11,0.1)':'rgba(59,130,246,0.1)',
              border: `1px solid ${a.tipo==='error'?'rgba(244,63,94,0.3)':a.tipo==='warning'?'rgba(245,158,11,0.3)':'rgba(59,130,246,0.3)'}`,
              color: a.tipo==='error'?'#f87171':a.tipo==='warning'?'#f59e0b':'#60a5fa',
              display:'flex', alignItems:'center', gap:6
            }}>
              {a.tipo==='error'?'⚠':a.tipo==='warning'?'⏳':'ℹ'} {a.msg} →
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ color:'#4a6a8a', fontSize:13, padding:40, textAlign:'center' }}>Cargando dashboard...</div>
      ) : (
        <>
          {/* KPIs fila 1 */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:14, marginBottom:20 }}>
            {[
              { label:'Ventas hoy',        val: stats.ventasHoy,              sub: esAsesor?'Tus ventas':'Todo el equipo', color:'#0066ff', big:true },
              { label:'Ventas del mes',     val: stats.ventasMes,              sub: mesAct,                                 color:'#00aaff', big:true },
              { label:'Valor del mes',      val: fmtK(stats.valorMes),         sub: fmt(stats.valorMes),                   color:'#10b981' },
              { label:'Utilidad bruta',     val: fmtK(stats.utilidadMes),      sub: fmt(stats.utilidadMes),                color:'#34d399' },
              { label:'Inventario',         val: stats.inventarioDisponible,   sub: `Stock: ${fmtK(stats.valorStock)}`,    color:'#8b5cf6' },
              { label:'Despachos activos',  val: stats.despachosPendientes,    sub: 'Pendientes de entrega',               color:'#f59e0b' },
              { label:'En laboratorio',     val: stats.labActivos,             sub: 'Reparaciones activas',                color:'#f97316' },
              puedeVerFinancieras && { label:'Cobros pendientes', val: stats.financierasPendientes, sub:'Sin desembolsar', color:'#f43f5e' },
            ].filter(Boolean).map(k => (
              <div key={k.label} onClick={() => {}} style={{
                background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:12,
                padding:'18px 20px', cursor:'default',
                transition:'border-color .15s',
              }}>
                <div style={{ color:'#5a7aaa', fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>{k.label}</div>
                <div style={{ color:'#fff', fontSize: k.big ? 36 : 26, fontWeight:800, letterSpacing:'-1px', lineHeight:1 }}>{k.val}</div>
                <div style={{ color:'#4a6a8a', fontSize:11, marginTop:6 }}>{k.sub}</div>
                <div style={{ height:3, background:k.color, borderRadius:2, marginTop:14, opacity:.6 }} />
              </div>
            ))}
          </div>

          {/* Gráficas */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:20 }}>

            {/* Ventas últimos 7 días */}
            <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:12, padding:'18px 20px' }}>
              <div style={{ color:'#8aabcc', fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:14 }}>
                Ventas — últimos 7 días
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={ventasSemana} margin={{ left:0, right:8, top:4, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2f52" />
                  <XAxis dataKey="dia" tick={{ fill:'#4a6a8a', fontSize:11 }} />
                  <YAxis tick={{ fill:'#4a6a8a', fontSize:11 }} allowDecimals={false} />
                  <Tooltip {...tooltip} formatter={v=>[v+' ventas']} />
                  <Bar dataKey="ventas" fill="#0066ff" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Tendencia del mes */}
            <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:12, padding:'18px 20px' }}>
              <div style={{ color:'#8aabcc', fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:14 }}>
                Tendencia {mesAct}
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={ventasMesLine} margin={{ left:0, right:8, top:4, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2f52" />
                  <XAxis dataKey="dia" tick={{ fill:'#4a6a8a', fontSize:11 }} />
                  <YAxis tick={{ fill:'#4a6a8a', fontSize:11 }} allowDecimals={false} />
                  <Tooltip {...tooltip} formatter={v=>[v+' ventas']} />
                  <Line type="monotone" dataKey="ventas" stroke="#10b981" strokeWidth={2} dot={{ fill:'#10b981', r:3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Fila inferior: top asesores + actividad reciente */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:20 }}>

            {/* Top asesores */}
            {!esAsesor && (
              <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:12, padding:'18px 20px' }}>
                <div style={{ color:'#8aabcc', fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:14 }}>
                  Top asesores — {mesAct}
                </div>
                {topAsesores.length === 0
                  ? <div style={{ color:'#4a6a8a', fontSize:12, textAlign:'center', padding:20 }}>Sin datos este mes</div>
                  : topAsesores.map((a,i) => (
                    <div key={a.asesor} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                      <div style={{ width:24, height:24, borderRadius:'50%', background:'#1a2f52', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#8aabcc', flexShrink:0 }}>
                        {i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ color:'#e2e8f0', fontSize:12, fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{a.asesor}</div>
                        <div style={{ height:4, background:'#1a2f52', borderRadius:2, marginTop:4, overflow:'hidden' }}>
                          <div style={{ height:'100%', background:'linear-gradient(90deg,#0066ff,#00c6ff)', borderRadius:2, width:`${Math.round((a.ventas/(topAsesores[0]?.ventas||1))*100)}%`, transition:'width .4s ease' }} />
                        </div>
                      </div>
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        <div style={{ color:'#fff', fontSize:14, fontWeight:700 }}>{a.ventas}</div>
                        <div style={{ color:'#4a6a8a', fontSize:10 }}>{fmtK(a.valor)}</div>
                      </div>
                    </div>
                  ))
                }
              </div>
            )}

            {/* Actividad reciente */}
            <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:12, padding:'18px 20px', gridColumn: esAsesor ? 'span 2' : undefined }}>
              <div style={{ color:'#8aabcc', fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:14 }}>
                Ventas recientes
              </div>
              {actividadReciente.length === 0
                ? <div style={{ color:'#4a6a8a', fontSize:12, textAlign:'center', padding:20 }}>Sin ventas recientes</div>
                : actividadReciente.map((v,i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom: i < actividadReciente.length-1 ? '1px solid #0f1e36' : 'none' }}>
                    <div style={{ width:36, height:36, borderRadius:8, background:'#1a2f52', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>📱</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ color:'#e2e8f0', fontSize:12, fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{v.nombre_cliente}</div>
                      <div style={{ color:'#4a6a8a', fontSize:11, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{v.producto}</div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ color:'#10b981', fontSize:12, fontWeight:600 }}>{fmtK(v.valor_venta)}</div>
                      <div style={{ color:'#4a6a8a', fontSize:10 }}>{v.asesor_nombre?.split('.')[0]}</div>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>

          {/* Accesos rápidos */}
          <div>
            <div style={{ color:'#8aabcc', fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:12 }}>Accesos rápidos</div>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
              {[
                { label:'Nueva venta',    icon:'🛍️', path:'/ventas/nueva',  primary:true  },
                { label:'Despachos',      icon:'🚚', path:'/despachos'                    },
                { label:'Laboratorio',    icon:'🔬', path:'/laboratorio'                  },
                { label:'Inventario',     icon:'📦', path:'/inventario'                   },
                { label:'Proveedores',    icon:'🏭', path:'/proveedores'                  },
                { label:'Reportes',       icon:'📊', path:'/reportes'                     },
                puedeVerFinancieras && { label:'Financieras', icon:'💳', path:'/financieras' },
              ].filter(Boolean).map(a => (
                <button key={a.label} onClick={() => navigate(a.path)} style={{
                  display:'flex', alignItems:'center', gap:8,
                  padding:'10px 18px',
                  background: a.primary ? 'linear-gradient(135deg,#0066ff,#0044bb)' : '#0d1a35',
                  border: a.primary ? 'none' : '1px solid #1a2f52',
                  borderRadius:9, color:'#fff', fontSize:13, fontWeight: a.primary ? 700 : 400,
                  cursor:'pointer',
                  boxShadow: a.primary ? '0 4px 14px rgba(0,102,255,0.3)' : 'none',
                }}>
                  <span>{a.icon}</span> {a.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
