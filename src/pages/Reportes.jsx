import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'

const fmt = n => new Intl.NumberFormat('es-CO', {
  style:'currency', currency:'COP', maximumFractionDigits:0
}).format(n || 0)

const fmtK = n => {
  if (n >= 1_000_000_000) return (n/1_000_000_000).toFixed(1) + 'B'
  if (n >= 1_000_000)     return (n/1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)         return (n/1_000).toFixed(0) + 'K'
  return String(n)
}

const COLORS = ['#0066ff','#10b981','#f59e0b','#8b5cf6','#ec4899','#14b8a6','#f97316']

export default function Reportes() {
  const { esAsesor } = useAuth()
  const [periodo, setPeriodo] = useState(new Date().toISOString().slice(0,7))
  const [resumen, setResumen] = useState([])
  const [porCanal, setPorCanal] = useState([])
  const [porMetodo, setPorMetodo] = useState([])
  const [topProductos, setTopProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [totales, setTotales] = useState({ ventas:0, valor:0, utilidad:0, domicilios:0 })

  useEffect(() => { loadData() }, [periodo])

  async function loadData() {
    setLoading(true)
    const desde = periodo + '-01'
    const hasta = periodo + '-31'

    const [
      { data: ventasData },
    ] = await Promise.all([
      supabase.from('ventas')
        .select('asesor_nombre,canal,metodo_pago,producto,valor_venta,costo_equipo,es_domicilio,estado')
        .gte('fecha_venta', desde)
        .lte('fecha_venta', hasta)
        .neq('estado', 'anulada')
    ])

    const data = ventasData || []

    // Totales
    const totalValor    = data.reduce((a, v) => a + Number(v.valor_venta || 0), 0)
    const totalCosto    = data.reduce((a, v) => a + Number(v.costo_equipo || 0), 0)
    const totalDom      = data.filter(v => v.es_domicilio).length
    setTotales({
      ventas: data.length,
      valor: totalValor,
      utilidad: totalValor - totalCosto,
      domicilios: totalDom
    })

    // Resumen por asesor
    const byAsesor = {}
    data.forEach(v => {
      if (!byAsesor[v.asesor_nombre]) byAsesor[v.asesor_nombre] = { asesor:v.asesor_nombre, ventas:0, valor:0, utilidad:0 }
      byAsesor[v.asesor_nombre].ventas++
      byAsesor[v.asesor_nombre].valor     += Number(v.valor_venta || 0)
      byAsesor[v.asesor_nombre].utilidad  += Number(v.valor_venta || 0) - Number(v.costo_equipo || 0)
    })
    setResumen(Object.values(byAsesor).sort((a,b) => b.ventas - a.ventas))

    // Por canal
    const byCanal = {}
    data.forEach(v => {
      const k = v.canal === 'mostrador' ? 'Mostrador' : 'Call Center'
      if (!byCanal[k]) byCanal[k] = { name: k, value: 0 }
      byCanal[k].value++
    })
    setPorCanal(Object.values(byCanal))

    // Por método de pago
    const byMetodo = {}
    data.forEach(v => {
      const k = v.metodo_pago?.replace('_',' ') || 'otro'
      if (!byMetodo[k]) byMetodo[k] = { name: k, value: 0 }
      byMetodo[k].value++
    })
    setPorMetodo(Object.values(byMetodo).sort((a,b) => b.value - a.value))

    // Top 10 productos
    const byProd = {}
    data.forEach(v => {
      if (!byProd[v.producto]) byProd[v.producto] = { name: v.producto, ventas: 0 }
      byProd[v.producto].ventas++
    })
    setTopProductos(Object.values(byProd).sort((a,b) => b.ventas - a.ventas).slice(0,10))

    setLoading(false)
  }

  const kpiCard = (label, value, sub, color='#0066ff') => (
    <div style={{
      background:'#0d1a35', border:'1px solid #1a2f52',
      borderRadius:12, padding:'18px 22px'
    }}>
      <div style={{ color:'#5a7aaa', fontSize:11, fontWeight:500,
        textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>
        {label}
      </div>
      <div style={{ color:'#fff', fontSize:26, fontWeight:700, letterSpacing:'-0.3px' }}>
        {value}
      </div>
      {sub && <div style={{ color:'#4a6a8a', fontSize:12, marginTop:4 }}>{sub}</div>}
      <div style={{ height:3, background:color, borderRadius:2, marginTop:14, opacity:0.5 }}/>
    </div>
  )

  const chartStyle = {
    background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:12, padding:'20px 24px'
  }

  return (
    <div style={{ padding:'32px 36px', fontFamily:"'DM Sans', system-ui", maxWidth:1100 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ color:'#fff', fontSize:20, fontWeight:600, margin:'0 0 4px' }}>
            Reportes
          </h1>
          <p style={{ color:'#4a6a8a', fontSize:13, margin:0 }}>
            Análisis de desempeño comercial
          </p>
        </div>
        <input
          type="month" value={periodo}
          onChange={e => setPeriodo(e.target.value)}
          style={{
            background:'#0d1a35', border:'1px solid #1a2f52',
            borderRadius:8, padding:'8px 12px',
            color:'#fff', fontSize:13, cursor:'pointer'
          }}
        />
      </div>

      {loading ? (
        <div style={{ color:'#4a6a8a', fontSize:13 }}>Calculando reportes...</div>
      ) : (
        <>
          {/* KPIs */}
          <div style={{
            display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px,1fr))',
            gap:14, marginBottom:28
          }}>
            {kpiCard('Total ventas', totales.ventas, 'del período', '#0066ff')}
            {kpiCard('Valor total', fmtK(totales.valor), fmt(totales.valor), '#00aaff')}
            {kpiCard('Utilidad bruta', fmtK(totales.utilidad), 'Ventas - costo', '#10b981')}
            {kpiCard('Con domicilio', totales.domicilios, 'ventas a domicilio', '#8b5cf6')}
          </div>

          {/* Gráficas fila 1 */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
            {/* Canal */}
            <div style={chartStyle}>
              <div style={{ color:'#8aabcc', fontSize:11, fontWeight:600,
                textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:16 }}>
                Ventas por canal
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={porCanal} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" outerRadius={70} label={({name,value}) => `${name}: ${value}`}
                    labelLine={false}>
                    {porCanal.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [v + ' ventas']} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Método de pago */}
            <div style={chartStyle}>
              <div style={{ color:'#8aabcc', fontSize:11, fontWeight:600,
                textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:16 }}>
                Método de pago
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={porMetodo} layout="vertical"
                  margin={{ left:60, right:20, top:0, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2f52" />
                  <XAxis type="number" tick={{ fill:'#4a6a8a', fontSize:11 }} />
                  <YAxis type="category" dataKey="name"
                    tick={{ fill:'#8aabcc', fontSize:11 }} width={60} />
                  <Tooltip
                    contentStyle={{ background:'#0a1628', border:'1px solid #1a2f52', borderRadius:8 }}
                    labelStyle={{ color:'#fff' }} itemStyle={{ color:'#8aabcc' }}
                  />
                  <Bar dataKey="value" fill="#0066ff" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top productos */}
          <div style={{ ...chartStyle, marginBottom:24 }}>
            <div style={{ color:'#8aabcc', fontSize:11, fontWeight:600,
              textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:16 }}>
              Top 10 productos vendidos
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topProductos} margin={{ left:0, right:20, top:0, bottom:60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2f52" />
                <XAxis dataKey="name" tick={{ fill:'#8aabcc', fontSize:10 }}
                  angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fill:'#4a6a8a', fontSize:11 }} />
                <Tooltip
                  contentStyle={{ background:'#0a1628', border:'1px solid #1a2f52', borderRadius:8 }}
                  labelStyle={{ color:'#fff' }} itemStyle={{ color:'#8aabcc' }}
                />
                <Bar dataKey="ventas" fill="#0066ff" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Tabla por asesor */}
          <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:12, overflow:'auto' }}>
            <div style={{ padding:'14px 20px', borderBottom:'1px solid #1a2f52',
              color:'#8aabcc', fontSize:11, fontWeight:600,
              textTransform:'uppercase', letterSpacing:'0.06em' }}>
              Ranking asesores
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  {['#','Asesor','Ventas','Valor total','Utilidad bruta','Ticket promedio'].map(h => (
                    <th key={h} style={{
                      color:'#4a6a8a', fontSize:11, fontWeight:600,
                      textTransform:'uppercase', letterSpacing:'0.06em',
                      padding:'10px 14px', textAlign:'left',
                      borderBottom:'1px solid #1a2f52'
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resumen.map((r, i) => (
                  <tr key={r.asesor}>
                    <td style={{ padding:'10px 14px', color:'#4a6a8a', fontSize:13,
                      borderBottom:'1px solid #0f1e36' }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </td>
                    <td style={{ padding:'10px 14px', color:'#e2e8f0', fontSize:13,
                      fontWeight:500, borderBottom:'1px solid #0f1e36' }}>
                      {r.asesor}
                    </td>
                    <td style={{ padding:'10px 14px', color:'#fff', fontSize:14,
                      fontWeight:700, borderBottom:'1px solid #0f1e36' }}>
                      {r.ventas}
                    </td>
                    <td style={{ padding:'10px 14px', color:'#fff', fontWeight:600,
                      fontSize:13, borderBottom:'1px solid #0f1e36', whiteSpace:'nowrap' }}>
                      {fmt(r.valor)}
                    </td>
                    <td style={{ padding:'10px 14px', color:'#10b981', fontWeight:600,
                      fontSize:13, borderBottom:'1px solid #0f1e36', whiteSpace:'nowrap' }}>
                      {fmt(r.utilidad)}
                    </td>
                    <td style={{ padding:'10px 14px', color:'#8aabcc',
                      fontSize:13, borderBottom:'1px solid #0f1e36', whiteSpace:'nowrap' }}>
                      {r.ventas > 0 ? fmt(Math.round(r.valor / r.ventas)) : '—'}
                    </td>
                  </tr>
                ))}
                {resumen.length === 0 && (
                  <tr><td colSpan={6} style={{ padding:32, textAlign:'center',
                    color:'#4a6a8a', fontSize:13 }}>
                    Sin ventas registradas en este período
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
