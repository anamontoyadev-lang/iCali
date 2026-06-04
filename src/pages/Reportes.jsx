import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line
} from 'recharts'

const fmt = n => new Intl.NumberFormat('es-CO', {
  style:'currency', currency:'COP', maximumFractionDigits:0
}).format(n || 0)

const fmtK = n => {
  if (!n) return '$0'
  if (n >= 1_000_000_000) return '$' + (n/1_000_000_000).toFixed(1) + 'B'
  if (n >= 1_000_000)     return '$' + (n/1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)         return '$' + (n/1_000).toFixed(0) + 'K'
  return '$' + String(n)
}

const COLORS = ['#0066ff','#10b981','#f59e0b','#8b5cf6','#ec4899','#14b8a6','#f97316','#ef4444']

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export default function Reportes() {
  const { esAsesor, perfil } = useAuth()
  const [periodo, setPeriodo]   = useState(new Date().toISOString().slice(0,7))
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  const [totales, setTotales]           = useState({ ventas:0, valor:0, utilidad:0, domicilios:0, retomas:0 })
  const [resumenAsesores, setResumenAsesores] = useState([])
  const [porCanal, setPorCanal]         = useState([])
  const [porMetodo, setPorMetodo]       = useState([])
  const [topProductos, setTopProductos] = useState([])
  const [tendencia, setTendencia]       = useState([])
  const [porCiudad, setPorCiudad]       = useState([])

  useEffect(() => { loadData() }, [periodo])

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const desde = periodo + '-01'
      const hasta = periodo + '-31'

      let query = supabase
        .from('ventas')
        .select('id,fecha_venta,asesor_nombre,canal,metodo_pago,producto,valor_venta,costo_equipo,es_domicilio,tiene_retoma,estado,ciudad_cliente')
        .gte('fecha_venta', desde)
        .lte('fecha_venta', hasta)
        .neq('estado', 'anulada')

      // Si es asesor solo ve sus propias ventas
      if (esAsesor && perfil) {
        query = query.eq('asesor_nombre', `${perfil.nombre} ${perfil.apellido || ''}`.trim())
      }

      const { data, error: err } = await query
      if (err) throw new Error(err.message)

      const ventas = data || []

      // ── TOTALES ──
      const totalValor   = ventas.reduce((a,v) => a + Number(v.valor_venta||0), 0)
      const totalCosto   = ventas.reduce((a,v) => a + Number(v.costo_equipo||0), 0)
      setTotales({
        ventas:    ventas.length,
        valor:     totalValor,
        utilidad:  totalValor - totalCosto,
        domicilios:ventas.filter(v => v.es_domicilio).length,
        retomas:   ventas.filter(v => v.tiene_retoma).length,
      })

      // ── RESUMEN POR ASESOR ──
      const byAsesor = {}
      ventas.forEach(v => {
        const k = v.asesor_nombre || 'Sin asignar'
        if (!byAsesor[k]) byAsesor[k] = { asesor:k, ventas:0, valor:0, costo:0 }
        byAsesor[k].ventas++
        byAsesor[k].valor  += Number(v.valor_venta||0)
        byAsesor[k].costo  += Number(v.costo_equipo||0)
      })
      setResumenAsesores(
        Object.values(byAsesor)
          .map(r => ({ ...r, utilidad: r.valor - r.costo, ticket: r.ventas ? Math.round(r.valor/r.ventas) : 0 }))
          .sort((a,b) => b.ventas - a.ventas)
      )

      // ── POR CANAL ──
      const byCanal = {}
      ventas.forEach(v => {
        const k = v.canal === 'call_center' ? 'Call Center' : 'Mostrador'
        if (!byCanal[k]) byCanal[k] = { name:k, value:0, valor:0 }
        byCanal[k].value++
        byCanal[k].valor += Number(v.valor_venta||0)
      })
      setPorCanal(Object.values(byCanal))

      // ── POR MÉTODO DE PAGO ──
      const METODO_LABELS = {
        contado:'Contado', transferencia:'Transferencia', tarjeta:'Tarjeta',
        addi:'ADDI', credi_ya:'Credi Ya', brilla:'Brilla',
        banco_bogota:'Bco Bogotá', contraentrega:'Contraentrega', mixto:'Mixto'
      }
      const byMetodo = {}
      ventas.forEach(v => {
        const k = METODO_LABELS[v.metodo_pago] || v.metodo_pago || 'Otro'
        if (!byMetodo[k]) byMetodo[k] = { name:k, value:0 }
        byMetodo[k].value++
      })
      setPorMetodo(Object.values(byMetodo).sort((a,b) => b.value - a.value))

      // ── TOP PRODUCTOS ──
      const byProd = {}
      ventas.forEach(v => {
        const nombre = (v.producto || 'Otro').split(' - ')[0]
        if (!byProd[nombre]) byProd[nombre] = { name:nombre, ventas:0, valor:0 }
        byProd[nombre].ventas++
        byProd[nombre].valor += Number(v.valor_venta||0)
      })
      setTopProductos(Object.values(byProd).sort((a,b) => b.ventas - a.ventas).slice(0,8))

      // ── TENDENCIA DIARIA (últimos 30 días del mes) ──
      const byDia = {}
      ventas.forEach(v => {
        const dia = v.fecha_venta?.slice(8,10) || '01'
        if (!byDia[dia]) byDia[dia] = { dia: Number(dia), ventas:0, valor:0 }
        byDia[dia].ventas++
        byDia[dia].valor += Number(v.valor_venta||0)
      })
      setTendencia(Object.values(byDia).sort((a,b) => a.dia - b.dia))

      // ── POR CIUDAD ──
      const byCiudad = {}
      ventas.forEach(v => {
        const k = v.ciudad_cliente || 'Sin ciudad'
        if (!byCiudad[k]) byCiudad[k] = { name:k, value:0 }
        byCiudad[k].value++
      })
      setPorCiudad(Object.values(byCiudad).sort((a,b) => b.value - a.value).slice(0,6))

    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  const mesLabel = () => {
    const [y, m] = periodo.split('-')
    return `${MESES[Number(m)-1]} ${y}`
  }

  const tooltipStyle = {
    contentStyle:{ background:'#0a1628', border:'1px solid #1a2f52', borderRadius:8 },
    labelStyle:{ color:'#fff', fontSize:12 },
    itemStyle:{ color:'#8aabcc', fontSize:12 }
  }

  const chartCard = (titulo, children) => (
    <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:12, padding:'18px 20px' }}>
      <div style={{ color:'#8aabcc', fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:14 }}>{titulo}</div>
      {children}
    </div>
  )

  return (
    <div style={{ padding:'32px 36px', fontFamily:"'DM Sans', system-ui", maxWidth:1140 }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ color:'#fff', fontSize:20, fontWeight:600, margin:'0 0 4px' }}>Reportes</h1>
          <p style={{ color:'#4a6a8a', fontSize:13, margin:0 }}>{mesLabel()}</p>
        </div>
        <input type="month" value={periodo} onChange={e => setPeriodo(e.target.value)}
          style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:8,
            padding:'8px 12px', color:'#fff', fontSize:13, cursor:'pointer' }} />
      </div>

      {/* Error */}
      {error && (
        <div style={{ marginBottom:20, padding:'12px 16px', background:'rgba(244,63,94,0.1)', border:'1px solid rgba(244,63,94,0.3)', borderRadius:8, color:'#f87171', fontSize:13 }}>
          ⚠ Error al cargar datos: {error}
        </div>
      )}

      {loading ? (
        <div style={{ color:'#4a6a8a', fontSize:13, padding:40, textAlign:'center' }}>Calculando reportes...</div>
      ) : (
        <>
          {/* KPIs */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12, marginBottom:24 }}>
            {[
              { label:'Total ventas',    val: totales.ventas,              sub:'del período',         color:'#0066ff' },
              { label:'Valor total',     val: fmtK(totales.valor),         sub: fmt(totales.valor),    color:'#00aaff' },
              { label:'Utilidad bruta',  val: fmtK(totales.utilidad),      sub: fmt(totales.utilidad), color:'#10b981' },
              { label:'Con domicilio',   val: totales.domicilios,           sub:'despachos',            color:'#8b5cf6' },
              { label:'Con retoma',      val: totales.retomas,              sub:'equipos',              color:'#f59e0b' },
            ].map(k => (
              <div key={k.label} style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:12, padding:'16px 20px' }}>
                <div style={{ color:'#5a7aaa', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>{k.label}</div>
                <div style={{ color:'#fff', fontSize:24, fontWeight:700, letterSpacing:'-0.3px' }}>{k.val}</div>
                <div style={{ color:'#4a6a8a', fontSize:11, marginTop:3 }}>{k.sub}</div>
                <div style={{ height:3, background:k.color, borderRadius:2, marginTop:12, opacity:0.5 }} />
              </div>
            ))}
          </div>

          {/* Sin datos */}
          {totales.ventas === 0 && !error && (
            <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:12, padding:40, textAlign:'center', marginBottom:20 }}>
              <div style={{ fontSize:32, marginBottom:12 }}>📊</div>
              <div style={{ color:'#fff', fontSize:15, fontWeight:500, marginBottom:6 }}>Sin ventas en {mesLabel()}</div>
              <div style={{ color:'#4a6a8a', fontSize:13 }}>Registra ventas para ver los reportes aquí</div>
            </div>
          )}

          {totales.ventas > 0 && (
            <>
              {/* Gráficas fila 1 */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>

                {/* Tendencia diaria */}
                {chartCard('Ventas por día', (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={tendencia} margin={{ left:0, right:10, top:5, bottom:0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a2f52" />
                      <XAxis dataKey="dia" tick={{ fill:'#4a6a8a', fontSize:11 }} />
                      <YAxis tick={{ fill:'#4a6a8a', fontSize:11 }} allowDecimals={false} />
                      <Tooltip {...tooltipStyle} formatter={v => [v + ' ventas']} />
                      <Line type="monotone" dataKey="ventas" stroke="#0066ff" strokeWidth={2} dot={{ fill:'#0066ff', r:3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ))}

                {/* Canal */}
                {chartCard('Ventas por canal', (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={porCanal} dataKey="value" nameKey="name"
                        cx="50%" cy="50%" outerRadius={70}
                        label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                        {porCanal.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip {...tooltipStyle} formatter={v => [v + ' ventas']} />
                    </PieChart>
                  </ResponsiveContainer>
                ))}
              </div>

              {/* Gráficas fila 2 */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>

                {/* Método de pago */}
                {chartCard('Método de pago', (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={porMetodo} layout="vertical" margin={{ left:70, right:20, top:0, bottom:0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a2f52" />
                      <XAxis type="number" tick={{ fill:'#4a6a8a', fontSize:11 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={{ fill:'#8aabcc', fontSize:11 }} width={70} />
                      <Tooltip {...tooltipStyle} formatter={v => [v + ' ventas']} />
                      <Bar dataKey="value" fill="#0066ff" radius={[0,4,4,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ))}

                {/* Ciudad */}
                {chartCard('Ventas por ciudad', (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={porCiudad} layout="vertical" margin={{ left:70, right:20, top:0, bottom:0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a2f52" />
                      <XAxis type="number" tick={{ fill:'#4a6a8a', fontSize:11 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={{ fill:'#8aabcc', fontSize:11 }} width={70} />
                      <Tooltip {...tooltipStyle} formatter={v => [v + ' ventas']} />
                      <Bar dataKey="value" fill="#10b981" radius={[0,4,4,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ))}
              </div>

              {/* Top productos */}
              {chartCard('Top productos vendidos', (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={topProductos} margin={{ left:0, right:20, top:0, bottom:60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a2f52" />
                    <XAxis dataKey="name" tick={{ fill:'#8aabcc', fontSize:10 }} angle={-35} textAnchor="end" interval={0} />
                    <YAxis tick={{ fill:'#4a6a8a', fontSize:11 }} allowDecimals={false} />
                    <Tooltip {...tooltipStyle} formatter={v => [v + ' unidades']} />
                    <Bar dataKey="ventas" fill="#8b5cf6" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              ))}

              {/* Ranking asesores */}
              <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:12, overflow:'auto', marginTop:14 }}>
                <div style={{ padding:'14px 20px', borderBottom:'1px solid #1a2f52',
                  color:'#8aabcc', fontSize:11, fontWeight:600,
                  textTransform:'uppercase', letterSpacing:'0.06em' }}>
                  Ranking asesores — {mesLabel()}
                </div>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr>
                      {['#','Asesor','Ventas','Valor total','Utilidad','Ticket prom.'].map(h => (
                        <th key={h} style={{ color:'#4a6a8a', fontSize:11, fontWeight:600,
                          textTransform:'uppercase', letterSpacing:'0.06em',
                          padding:'10px 16px', textAlign:'left',
                          borderBottom:'1px solid #1a2f52' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resumenAsesores.map((r, i) => (
                      <tr key={r.asesor}>
                        <td style={{ padding:'11px 16px', color:'#4a6a8a', fontSize:13, borderBottom:'1px solid #0f1e36' }}>
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                        </td>
                        <td style={{ padding:'11px 16px', color:'#e2e8f0', fontSize:13, fontWeight:500, borderBottom:'1px solid #0f1e36' }}>{r.asesor}</td>
                        <td style={{ padding:'11px 16px', color:'#fff', fontSize:16, fontWeight:700, borderBottom:'1px solid #0f1e36' }}>{r.ventas}</td>
                        <td style={{ padding:'11px 16px', color:'#fff', fontWeight:600, fontSize:13, borderBottom:'1px solid #0f1e36', whiteSpace:'nowrap' }}>{fmt(r.valor)}</td>
                        <td style={{ padding:'11px 16px', color:'#10b981', fontWeight:600, fontSize:13, borderBottom:'1px solid #0f1e36', whiteSpace:'nowrap' }}>{fmt(r.utilidad)}</td>
                        <td style={{ padding:'11px 16px', color:'#8aabcc', fontSize:13, borderBottom:'1px solid #0f1e36', whiteSpace:'nowrap' }}>{fmt(r.ticket)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
