import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

function KPICard({ label, value, sub, color = '#0066ff' }) {
  return (
    <div style={{
      background:'#0d1a35', border:'1px solid #1a2f52',
      borderRadius:12, padding:'20px 24px'
    }}>
      <div style={{ color:'#5a7aaa', fontSize:12, fontWeight:500,
        textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>
        {label}
      </div>
      <div style={{ color:'#fff', fontSize:28, fontWeight:700, letterSpacing:'-0.5px' }}>
        {value}
      </div>
      {sub && <div style={{ color:'#4a6a8a', fontSize:12, marginTop:4 }}>{sub}</div>}
      <div style={{
        height:3, background: color, borderRadius:2,
        marginTop:16, opacity:0.6
      }} />
    </div>
  )
}

export default function Dashboard() {
  const { perfil, rol, esAsesor, puedeVerFinancieras } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    ventasHoy: 0, ventasMes: 0, despachosPendientes: 0,
    retomasActivas: 0, financierasPendientes: 0, valorMes: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadStats() }, [])

  async function loadStats() {
    const hoy   = new Date().toISOString().split('T')[0]
    const mes   = hoy.slice(0, 7) + '-01'

    // Construir queries según rol
    let qVentasHoy = supabase.from('ventas').select('id', { count:'exact', head:true })
      .eq('fecha_venta', hoy)
    let qVentasMes = supabase.from('ventas').select('id,valor_venta', { count:'exact' })
      .gte('fecha_venta', mes)

    if (esAsesor) {
      const uid = (await supabase.auth.getUser()).data.user?.id
      qVentasHoy = qVentasHoy.eq('asesor_id', uid)
      qVentasMes = qVentasMes.eq('asesor_id', uid)
    }

    const [
      { count: ventasHoy },
      { data: ventasMesData, count: ventasMes },
      { count: despachosPendientes },
      { count: retomasActivas },
      { count: financierasPendientes }
    ] = await Promise.all([
      qVentasHoy,
      qVentasMes,
      supabase.from('despachos').select('id', { count:'exact', head:true })
        .in('estado', ['pendiente','en_preparacion','en_transito','recogido']),
      supabase.from('retomas').select('id', { count:'exact', head:true })
        .in('estado', ['recibida','en_verificacion','verificada','disponible']),
      puedeVerFinancieras
        ? supabase.from('financieras_pagos').select('id', { count:'exact', head:true })
            .eq('estado_desembolso', 'pendiente')
        : Promise.resolve({ count: 0 })
    ])

    const valorMes = (ventasMesData || []).reduce((a, v) => a + Number(v.valor_venta || 0), 0)

    setStats({
      ventasHoy:   ventasHoy  || 0,
      ventasMes:   ventasMes  || 0,
      despachosPendientes: despachosPendientes || 0,
      retomasActivas: retomasActivas || 0,
      financierasPendientes: financierasPendientes || 0,
      valorMes
    })
    setLoading(false)
  }

  const fmt = n => new Intl.NumberFormat('es-CO', {
    style:'currency', currency:'COP', maximumFractionDigits:0
  }).format(n)

  const fecha = new Date().toLocaleDateString('es-CO', {
    weekday:'long', year:'numeric', month:'long', day:'numeric'
  })

  return (
    <div style={{ padding:'32px 36px', maxWidth:1100 }}>
      {/* Header */}
      <div style={{ marginBottom:32 }}>
        <h1 style={{
          color:'#fff', fontSize:22, fontWeight:600,
          margin:'0 0 4px', letterSpacing:'-0.3px'
        }}>
          Hola, {perfil?.nombre_completo?.split(' ')[0] || 'bienvenido'} 👋
        </h1>
        <p style={{ color:'#4a6a8a', fontSize:13, margin:0, textTransform:'capitalize' }}>
          {fecha}
        </p>
      </div>

      {/* KPIs */}
      {loading ? (
        <div style={{ color:'#4a6a8a', fontSize:13 }}>Cargando datos...</div>
      ) : (
        <div style={{
          display:'grid',
          gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))',
          gap:16, marginBottom:32
        }}>
          <KPICard
            label="Ventas hoy"
            value={stats.ventasHoy}
            sub={esAsesor ? 'Tus ventas de hoy' : 'Total del equipo'}
            color="#0066ff"
          />
          <KPICard
            label="Ventas del mes"
            value={stats.ventasMes}
            sub={fmt(stats.valorMes)}
            color="#00aaff"
          />
          <KPICard
            label="Despachos activos"
            value={stats.despachosPendientes}
            sub="Pendientes de entrega"
            color="#f59e0b"
          />
          <KPICard
            label="Retomas activas"
            value={stats.retomasActivas}
            sub="En proceso o disponibles"
            color="#10b981"
          />
          {puedeVerFinancieras && (
            <KPICard
              label="Cobros pendientes"
              value={stats.financierasPendientes}
              sub="Desembolsos sin recibir"
              color="#f43f5e"
            />
          )}
        </div>
      )}

      {/* Acciones rápidas */}
      <div>
        <h2 style={{
          color:'#8aabcc', fontSize:11, fontWeight:600,
          textTransform:'uppercase', letterSpacing:'0.08em',
          margin:'0 0 14px'
        }}>Acciones rápidas</h2>
        <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
          <ActionBtn
            label="Registrar venta"
            icon="🛍️"
            onClick={() => navigate('/ventas/nueva')}
            primary
          />
          <ActionBtn
            label="Ver despachos"
            icon="🚚"
            onClick={() => navigate('/despachos')}
          />
          <ActionBtn
            label="Ver retomas"
            icon="🔄"
            onClick={() => navigate('/retomas')}
          />
          {puedeVerFinancieras && (
            <ActionBtn
              label="Financieras"
              icon="💳"
              onClick={() => navigate('/financieras')}
            />
          )}
          <ActionBtn
            label="Reportes"
            icon="📊"
            onClick={() => navigate('/reportes')}
          />
        </div>
      </div>
    </div>
  )
}

function ActionBtn({ label, icon, onClick, primary }) {
  return (
    <button onClick={onClick} style={{
      display:'flex', alignItems:'center', gap:8,
      padding:'10px 18px',
      background: primary ? 'linear-gradient(135deg,#0066ff,#0044bb)' : '#0d1a35',
      border: primary ? 'none' : '1px solid #1a2f52',
      borderRadius:8, color:'#fff', fontSize:13, fontWeight:500,
      cursor:'pointer', transition:'opacity 0.2s'
    }}>
      <span>{icon}</span> {label}
    </button>
  )
}
