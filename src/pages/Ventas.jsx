import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const ESTADOS = {
  registrada:  { label:'Registrada',   color:'#3b82f6' },
  en_proceso:  { label:'En proceso',   color:'#f59e0b' },
  entregada:   { label:'Entregada',    color:'#10b981' },
  anulada:     { label:'Anulada',      color:'#ef4444' }
}

const fmt = n => new Intl.NumberFormat('es-CO', {
  style:'currency', currency:'COP', maximumFractionDigits:0
}).format(n || 0)

export default function Ventas() {
  const { esAsesor, esAdmin, esLiderCom } = useAuth()
  const navigate = useNavigate()
  const [ventas, setVentas] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro]   = useState({ canal:'', estado:'', buscar:'' })

  useEffect(() => { loadVentas() }, [])

  async function loadVentas() {
    let q = supabase.from('ventas')
      .select('id,fecha_venta,asesor_nombre,canal,nombre_cliente,cedula_cliente,producto,imei,valor_venta,costo_equipo,metodo_pago,estado,es_domicilio,tiene_retoma,ciudad_cliente')
      .order('fecha_venta', { ascending: false })
      .limit(200)

    const { data } = await q
    setVentas(data || [])
    setLoading(false)
  }

  async function cambiarEstado(id, estado) {
    await supabase.from('ventas').update({ estado }).eq('id', id)
    loadVentas()
  }

  const filtradas = ventas.filter(v => {
    if (filtro.canal   && v.canal   !== filtro.canal)   return false
    if (filtro.estado  && v.estado  !== filtro.estado)  return false
    if (filtro.buscar) {
      const s = filtro.buscar.toLowerCase()
      if (!`${v.nombre_cliente} ${v.cedula_cliente} ${v.imei} ${v.producto}`.toLowerCase().includes(s))
        return false
    }
    return true
  })

  const th = {
    color:'#4a6a8a', fontSize:11, fontWeight:600,
    textTransform:'uppercase', letterSpacing:'0.06em',
    padding:'10px 14px', textAlign:'left',
    borderBottom:'1px solid #1a2f52', whiteSpace:'nowrap'
  }
  const td = {
    padding:'11px 14px', color:'#cbd5e1', fontSize:13,
    borderBottom:'1px solid #0f1e36'
  }

  return (
    <div style={{ padding:'32px 36px', fontFamily:"'DM Sans', system-ui" }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center',
        justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ color:'#fff', fontSize:20, fontWeight:600, margin:'0 0 4px' }}>
            Ventas
          </h1>
          <p style={{ color:'#4a6a8a', fontSize:13, margin:0 }}>
            {filtradas.length} registros
          </p>
        </div>
        <button onClick={() => navigate('/ventas/nueva')} style={{
          padding:'10px 20px',
          background:'linear-gradient(135deg,#0066ff,#0044bb)',
          border:'none', borderRadius:8,
          color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer'
        }}>+ Nueva venta</button>
      </div>

      {/* Filtros */}
      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
        <input
          placeholder="Buscar cliente, IMEI, producto..."
          style={{
            background:'#0d1a35', border:'1px solid #1a2f52',
            borderRadius:8, padding:'8px 12px',
            color:'#fff', fontSize:13, outline:'none', flex:1, minWidth:200
          }}
          value={filtro.buscar}
          onChange={e => setFiltro(f => ({ ...f, buscar: e.target.value }))}
        />
        <select
          style={{
            background:'#0d1a35', border:'1px solid #1a2f52',
            borderRadius:8, padding:'8px 12px',
            color: filtro.canal ? '#fff' : '#4a6a8a', fontSize:13, cursor:'pointer'
          }}
          value={filtro.canal}
          onChange={e => setFiltro(f => ({ ...f, canal: e.target.value }))}
        >
          <option value="">Todos los canales</option>
          <option value="mostrador">Mostrador</option>
          <option value="call_center">Call Center</option>
        </select>
        <select
          style={{
            background:'#0d1a35', border:'1px solid #1a2f52',
            borderRadius:8, padding:'8px 12px',
            color: filtro.estado ? '#fff' : '#4a6a8a', fontSize:13, cursor:'pointer'
          }}
          value={filtro.estado}
          onChange={e => setFiltro(f => ({ ...f, estado: e.target.value }))}
        >
          <option value="">Todos los estados</option>
          {Object.entries(ESTADOS).map(([k,v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Tabla */}
      <div style={{
        background:'#0d1a35', border:'1px solid #1a2f52',
        borderRadius:12, overflow:'auto'
      }}>
        {loading ? (
          <div style={{ padding:40, color:'#4a6a8a', textAlign:'center', fontSize:13 }}>
            Cargando ventas...
          </div>
        ) : filtradas.length === 0 ? (
          <div style={{ padding:40, color:'#4a6a8a', textAlign:'center', fontSize:13 }}>
            No hay ventas con los filtros aplicados
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Fecha</th>
                <th style={th}>Cliente</th>
                <th style={th}>Producto</th>
                <th style={th}>Asesor</th>
                <th style={th}>Canal</th>
                <th style={th}>Valor</th>
                <th style={th}>Método</th>
                <th style={th}>Estado</th>
                <th style={th}>Flags</th>
                {(esAdmin || esLiderCom) && <th style={th}>Acción</th>}
              </tr>
            </thead>
            <tbody>
              {filtradas.map(v => (
                <tr key={v.id} style={{ cursor:'default' }}>
                  <td style={td}>
                    {new Date(v.fecha_venta + 'T12:00').toLocaleDateString('es-CO', {
                      day:'2-digit', month:'short'
                    })}
                  </td>
                  <td style={td}>
                    <div style={{ fontWeight:500, color:'#e2e8f0' }}>{v.nombre_cliente}</div>
                    <div style={{ color:'#4a6a8a', fontSize:11 }}>{v.cedula_cliente}</div>
                  </td>
                  <td style={td}>
                    <div style={{ color:'#e2e8f0', maxWidth:180, fontSize:12 }}>{v.producto}</div>
                    <div style={{ color:'#4a6a8a', fontSize:11 }}>{v.imei}</div>
                  </td>
                  <td style={{ ...td, whiteSpace:'nowrap' }}>{v.asesor_nombre}</td>
                  <td style={td}>
                    <span style={{
                      background: v.canal === 'mostrador' ? '#1e3a5f' : '#1e3a2f',
                      color: v.canal === 'mostrador' ? '#60a5fa' : '#34d399',
                      fontSize:11, padding:'2px 8px', borderRadius:4, fontWeight:500
                    }}>
                      {v.canal === 'mostrador' ? 'Mostrador' : 'Call Center'}
                    </span>
                  </td>
                  <td style={{ ...td, whiteSpace:'nowrap', fontWeight:600, color:'#fff' }}>
                    {fmt(v.valor_venta)}
                  </td>
                  <td style={{ ...td, fontSize:11, color:'#8aabcc' }}>
                    {v.metodo_pago?.replace('_',' ')}
                  </td>
                  <td style={td}>
                    <span style={{
                      background: ESTADOS[v.estado]?.color + '22',
                      color: ESTADOS[v.estado]?.color,
                      fontSize:11, padding:'3px 8px', borderRadius:4, fontWeight:500
                    }}>
                      {ESTADOS[v.estado]?.label}
                    </span>
                  </td>
                  <td style={td}>
                    <div style={{ display:'flex', gap:4 }}>
                      {v.es_domicilio && (
                        <span title="Domicilio" style={{ fontSize:14 }}>🚚</span>
                      )}
                      {v.tiene_retoma && (
                        <span title="Tiene retoma" style={{ fontSize:14 }}>🔄</span>
                      )}
                    </div>
                  </td>
                  {(esAdmin || esLiderCom) && (
                    <td style={td}>
                      <select
                        value={v.estado}
                        onChange={e => cambiarEstado(v.id, e.target.value)}
                        style={{
                          background:'#0a1628', border:'1px solid #1a2f52',
                          borderRadius:6, padding:'4px 8px',
                          color:'#fff', fontSize:11, cursor:'pointer'
                        }}
                      >
                        {Object.entries(ESTADOS).map(([k, est]) => (
                          <option key={k} value={k}>{est.label}</option>
                        ))}
                      </select>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
