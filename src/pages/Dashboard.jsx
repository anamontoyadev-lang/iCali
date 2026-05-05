import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'

const fmt = n => n >= 1e9
  ? `$${(n/1e9).toFixed(2)}B`
  : n >= 1e6
  ? `$${(n/1e6).toFixed(1)}M`
  : `$${n?.toLocaleString('es-CO')}`

const MESES = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function KpiCard({ label, value, sub, color }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={{ color: color || 'var(--text)' }}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  )
}

export default function Dashboard() {
  const { isAdmin, perfil } = useAuth()
  const [ventas, setVentas]   = useState([])
  const [metas,  setMetas]    = useState([])
  const [pend,   setPend]     = useState([])
  const [loading, setLoading] = useState(true)

  const hoy    = new Date()
  const mesAct = hoy.getMonth() + 1
  const añoAct = hoy.getFullYear()

  useEffect(() => {
    async function load() {
      const [{ data: v }, { data: m }, { data: p }] = await Promise.all([
        supabase.from('v_ventas_resumen')
          .select('*')
          .eq('año', añoAct)
          .order('mes'),
        supabase.from('metas')
          .select('*')
          .eq('año', añoAct),
        supabase.from('v_pendientes_activos')
          .select('*')
          .order('fecha_vence')
          .limit(5)
      ])
      setVentas(v || [])
      setMetas(m || [])
      setPend(p || [])
      setLoading(false)
    }
    load()
  }, [añoAct])

  // KPIs del mes actual
  const ventasMes = ventas.filter(v => v.mes === mesAct)
  const totalEqMes  = ventasMes.reduce((s, v) => s + (v.equipos || 0), 0)
  const totalValMes = ventasMes.reduce((s, v) => s + (v.valor_total || 0), 0)
  const ticketMes   = totalEqMes > 0 ? Math.round(totalValMes / totalEqMes) : 0
  const metaEqMes   = metas.filter(m => m.mes === mesAct).reduce((s, m) => s + (m.meta_equipos || 0), 0)
  const pctMeta     = metaEqMes > 0 ? Math.round((totalEqMes / metaEqMes) * 100) : null
  const pendVencidos = pend.filter(p => p.vencido).length

  // Gráfica: ventas mensuales del año
  const chartData = Array.from({ length: mesAct }, (_, i) => {
    const m = i + 1
    const vMes = ventas.filter(v => v.mes === m)
    const mMes = metas.filter(v => v.mes === m)
    return {
      mes: MESES[m],
      ventas: Math.round(vMes.reduce((s, v) => s + (v.valor_total || 0), 0) / 1e6),
      meta:   Math.round(mMes.reduce((s, m) => s + (m.meta_valor || 0), 0) / 1e6),
      equipos: vMes.reduce((s, v) => s + (v.equipos || 0), 0),
    }
  })

  // Ranking asesores del mes
  const rankingMes = [...ventasMes]
    .sort((a, b) => (b.valor_total || 0) - (a.valor_total || 0))
    .slice(0, 8)

  const maxVal = rankingMes[0]?.valor_total || 1

  if (loading) return (
    <div style={{ padding:'2rem', display:'flex', justifyContent:'center' }}>
      <div className="spinner" style={{ width:32, height:32 }} />
    </div>
  )

  return (
    <div>
      {/* Topbar */}
      <div className="topbar">
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:600, fontSize:15 }}>Dashboard</div>
          <div style={{ fontSize:12, color:'var(--muted)' }}>
            {MESES[mesAct]} {añoAct} · {isAdmin ? 'Vista administrador' : `Hola, ${perfil?.nombre}`}
          </div>
        </div>
        {pendVencidos > 0 && (
          <span className="badge badge-danger">
            ⚠ {pendVencidos} pendiente{pendVencidos > 1 ? 's' : ''} vencido{pendVencidos > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="page-body">

        {/* KPIs */}
        <div className="grid-kpi">
          <KpiCard
            label={`Venta ${MESES[mesAct]}`}
            value={fmt(totalValMes)}
            sub={`${totalEqMes} equipos vendidos`}
            color="var(--dk)"
          />
          <KpiCard
            label="Ticket promedio"
            value={fmt(ticketMes)}
            sub="por transacción"
          />
          <KpiCard
            label="Cumplimiento meta"
            value={pctMeta !== null ? `${pctMeta}%` : '—'}
            sub={metaEqMes > 0 ? `Meta: ${metaEqMes} equipos` : 'Sin meta configurada'}
            color={pctMeta >= 100 ? 'var(--success)' : pctMeta >= 80 ? 'var(--warn)' : 'var(--danger)'}
          />
          <KpiCard
            label="Pendientes activos"
            value={pend.length}
            sub={pendVencidos > 0 ? `${pendVencidos} vencidos` : 'Al día'}
            color={pendVencidos > 0 ? 'var(--danger)' : 'var(--success)'}
          />
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:'1.25rem', alignItems:'start' }}>

          {/* Gráfica ventas vs meta */}
          <div className="card">
            <div className="section-title">Ventas {añoAct} vs meta (en millones $)</div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize:11, fill:'var(--muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:11, fill:'var(--muted)' }} axisLine={false} tickLine={false}
                  tickFormatter={v => `$${v}M`} />
                <Tooltip
                  formatter={(v, name) => [`$${v}M`, name === 'ventas' ? 'Ventas' : 'Meta']}
                  contentStyle={{ fontSize:12, borderRadius:8, border:'0.5px solid var(--border)' }}
                />
                <Bar dataKey="ventas" fill="var(--dk)"    radius={[4,4,0,0]} name="ventas" />
                <Bar dataKey="meta"   fill="var(--border)" radius={[4,4,0,0]} name="meta" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Ranking mes */}
          <div className="card">
            <div className="section-title">Ranking {MESES[mesAct]}</div>
            {rankingMes.length === 0
              ? <div className="empty-state"><p>Sin datos del mes</p></div>
              : rankingMes.map((v, i) => (
                <div key={v.nombre} style={{ marginBottom:12 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <span style={{
                      width:20, height:20, borderRadius:'50%', flexShrink:0,
                      background: i === 0 ? 'var(--dk)' : 'var(--border)',
                      color: i === 0 ? 'white' : 'var(--muted)',
                      fontSize:10, fontWeight:700,
                      display:'flex', alignItems:'center', justifyContent:'center'
                    }}>{i+1}</span>
                    <span style={{ flex:1, fontSize:13, fontWeight: i < 3 ? 500 : 400,
                      whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                      {v.nombre}
                    </span>
                    <span style={{ fontSize:12, color:'var(--muted)', flexShrink:0 }}>
                      {v.equipos} eq.
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{
                      width:`${Math.round((v.valor_total / maxVal) * 100)}%`,
                      background: i === 0 ? 'var(--dk)' : i < 3 ? 'var(--accent)' : 'var(--border)'
                    }} />
                  </div>
                  <div style={{ fontSize:11, color:'var(--muted)', textAlign:'right', marginTop:2 }}>
                    {fmt(v.valor_total)}
                  </div>
                </div>
              ))
            }
          </div>
        </div>

        {/* Pendientes vencidos */}
        {pend.length > 0 && (
          <div className="card" style={{ marginTop:'1.25rem' }}>
            <div className="section-title">Pendientes recientes</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Asesor</th>
                    <th>Descripción</th>
                    <th>Tipo</th>
                    <th>Saldo</th>
                    <th>Vence</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {pend.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight:500 }}>{p.asesor_nombre || '—'}</td>
                      <td style={{ maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {p.cliente_desc}
                      </td>
                      <td>
                        <span className={`badge ${
                          p.tipo === 'FALTANTE' ? 'badge-danger' :
                          p.tipo === 'PRÉSTAMO INTERNO' ? 'badge-info' :
                          p.tipo === 'SEPARADO/ABONO' ? 'badge-gray' : 'badge-warn'
                        }`} style={{ fontSize:10 }}>
                          {p.tipo}
                        </span>
                      </td>
                      <td style={{ fontWeight:600, color:'var(--danger)' }}>
                        {fmt(p.saldo)}
                      </td>
                      <td style={{ color: p.vencido ? 'var(--danger)' : 'var(--text)', fontSize:12 }}>
                        {p.fecha_vence || '—'}
                      </td>
                      <td>
                        <span className={`badge ${p.vencido ? 'badge-danger' : 'badge-warn'}`} style={{ fontSize:10 }}>
                          {p.vencido ? 'VENCIDO' : p.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
