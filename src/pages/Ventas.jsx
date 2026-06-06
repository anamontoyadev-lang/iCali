import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { logActividad } from '../lib/drive'

const ESTADOS = {
  registrada:  { label:'Registrada',   color:'#3b82f6' },
  en_proceso:  { label:'En proceso',   color:'#f59e0b' },
  entregada:   { label:'Entregada',    color:'#10b981' },
  anulada:     { label:'Anulada',      color:'#ef4444' },
  desistida:   { label:'Desistida',    color:'#6b7280' },
}

const fmt = n => new Intl.NumberFormat('es-CO', {
  style:'currency', currency:'COP', maximumFractionDigits:0
}).format(n || 0)

export default function Ventas() {
  const { esAdmin, esLiderCom, esLiderAdmin, esAsesorCall, esAsesorMostrador, perfil } = useAuth()
  const navigate = useNavigate()
  const [ventas, setVentas]   = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro]   = useState({ canal:'', estado:'', buscar:'' })
  const [confirmDesistir, setConfirmDesistir] = useState(null) // venta a desistir

  useEffect(() => { loadVentas() }, [])

  async function loadVentas() {
    let q = supabase.from('ventas')
      .select('id,fecha_venta,asesor_nombre,asesor_id,canal,nombre_cliente,cedula_cliente,producto,imei,valor_venta,costo_equipo,metodo_pago,estado,es_domicilio,tiene_retoma,ciudad_cliente')
      .order('fecha_venta', { ascending: false })
      .limit(300)

    // Asesor call y mostrador solo ven sus propias ventas
    if (esAsesorCall || esAsesorMostrador) {
      const user = (await supabase.auth.getUser()).data.user
      q = q.eq('asesor_id', user.id)
    }

    const { data } = await q
    setVentas(data || [])
    setLoading(false)
  }

  async function cambiarEstado(venta, nuevoEstado) {
    await supabase.from('ventas').update({ estado: nuevoEstado }).eq('id', venta.id)

    // Log Drive
    const user = (await supabase.auth.getUser()).data.user
    await logActividad({
      usuario: perfil?.nombre || user?.email || '',
      accion: 'CAMBIO_ESTADO_VENTA',
      detalle: `${venta.producto} | ${venta.nombre_cliente} | ${ESTADOS[venta.estado]?.label} → ${ESTADOS[nuevoEstado]?.label}`,
      tabla: 'ventas'
    })

    loadVentas()
  }

  async function desistirVenta(venta) {
    await supabase.from('ventas').update({ estado: 'desistida' }).eq('id', venta.id)

    // Liberar el equipo en inventario si tenía IMEI asignado
    if (venta.imei?.trim().length >= 10) {
      await supabase.from('compras_proveedor')
        .update({ estado: 'disponible', venta_id: null })
        .eq('imei', venta.imei.trim())
        .eq('estado', 'vendido')
    }

    const user = (await supabase.auth.getUser()).data.user
    await logActividad({
      usuario: perfil?.nombre || user?.email || '',
      accion: 'VENTA_DESISTIDA',
      detalle: `${venta.producto} | ${venta.nombre_cliente} | IMEI: ${venta.imei || '—'}`,
      tabla: 'ventas'
    })

    setConfirmDesistir(null)
    loadVentas()
  }

  // Quién puede cambiar estado
  function puedeGestionarEstado(venta) {
    if (esAdmin || esLiderCom || esLiderAdmin) return true
    if (esAsesorCall && venta.canal === 'call_center') return true
    if (esAsesorMostrador && (venta.canal === 'mostrador' || venta.canal === 'call_center')) return true
    return false
  }

  // Estados disponibles según rol
  function estadosDisponibles(venta) {
    if (esAdmin || esLiderCom || esLiderAdmin) return Object.entries(ESTADOS)
    if (esAsesorCall) return Object.entries(ESTADOS).filter(([k]) => ['registrada','en_proceso','entregada'].includes(k))
    if (esAsesorMostrador) return Object.entries(ESTADOS).filter(([k]) => ['registrada','en_proceso','entregada'].includes(k))
    return []
  }

  const filtradas = ventas.filter(v => {
    if (filtro.canal   && v.canal   !== filtro.canal)   return false
    if (filtro.estado  && v.estado  !== filtro.estado)  return false
    if (filtro.buscar) {
      const s = filtro.buscar.toLowerCase()
      if (!`${v.nombre_cliente} ${v.cedula_cliente} ${v.imei} ${v.producto}`.toLowerCase().includes(s)) return false
    }
    return true
  })

  const th = { color:'#4a6a8a', fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', padding:'10px 14px', textAlign:'left', borderBottom:'1px solid #1a2f52', whiteSpace:'nowrap' }
  const td = { padding:'11px 14px', color:'#cbd5e1', fontSize:13, borderBottom:'1px solid #0f1e36' }

  return (
    <div style={{ padding:'32px 36px', fontFamily:"'DM Sans', system-ui" }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ color:'#fff', fontSize:20, fontWeight:600, margin:'0 0 4px' }}>Ventas</h1>
          <p style={{ color:'#4a6a8a', fontSize:13, margin:0 }}>{filtradas.length} registros</p>
        </div>
        <button onClick={() => navigate('/ventas/nueva')} style={{ padding:'10px 20px', background:'linear-gradient(135deg,#0066ff,#0044bb)', border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
          + Nueva venta
        </button>
      </div>

      {/* Filtros */}
      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
        <input
          placeholder="Buscar cliente, IMEI, producto..."
          style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:8, padding:'8px 12px', color:'#fff', fontSize:13, outline:'none', flex:1, minWidth:200 }}
          value={filtro.buscar}
          onChange={e => setFiltro(f => ({ ...f, buscar: e.target.value }))}
        />
        <select style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:8, padding:'8px 12px', color: filtro.canal ? '#fff' : '#4a6a8a', fontSize:13, cursor:'pointer' }}
          value={filtro.canal} onChange={e => setFiltro(f => ({ ...f, canal: e.target.value }))}>
          <option value="">Todos los canales</option>
          <option value="mostrador">Mostrador</option>
          <option value="call_center">Call Center</option>
        </select>
        <select style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:8, padding:'8px 12px', color: filtro.estado ? '#fff' : '#4a6a8a', fontSize:13, cursor:'pointer' }}
          value={filtro.estado} onChange={e => setFiltro(f => ({ ...f, estado: e.target.value }))}>
          <option value="">Todos los estados</option>
          {Object.entries(ESTADOS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Tabla */}
      <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:12, overflow:'auto' }}>
        {loading ? (
          <div style={{ padding:40, color:'#4a6a8a', textAlign:'center', fontSize:13 }}>Cargando ventas...</div>
        ) : filtradas.length === 0 ? (
          <div style={{ padding:40, color:'#4a6a8a', textAlign:'center', fontSize:13 }}>No hay ventas con los filtros aplicados</div>
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
                <th style={th}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map(v => (
                <tr key={v.id}>
                  <td style={td}>
                    {new Date(v.fecha_venta + 'T12:00').toLocaleDateString('es-CO', { day:'2-digit', month:'short' })}
                  </td>
                  <td style={td}>
                    <div style={{ fontWeight:500, color:'#e2e8f0' }}>{v.nombre_cliente}</div>
                    <div style={{ color:'#4a6a8a', fontSize:11 }}>{v.cedula_cliente}</div>
                  </td>
                  <td style={td}>
                    <div style={{ color:'#e2e8f0', maxWidth:180, fontSize:12 }}>{v.producto}</div>
                    <div style={{ color:'#4a6a8a', fontSize:11, fontFamily:'monospace' }}>{v.imei}</div>
                  </td>
                  <td style={{ ...td, whiteSpace:'nowrap' }}>{v.asesor_nombre}</td>
                  <td style={td}>
                    <span style={{ background: v.canal==='mostrador' ? '#1e3a5f' : '#1e3a2f', color: v.canal==='mostrador' ? '#60a5fa' : '#34d399', fontSize:11, padding:'2px 8px', borderRadius:4, fontWeight:500 }}>
                      {v.canal === 'mostrador' ? 'Mostrador' : 'Call Center'}
                    </span>
                  </td>
                  <td style={{ ...td, whiteSpace:'nowrap', fontWeight:600, color:'#fff' }}>{fmt(v.valor_venta)}</td>
                  <td style={{ ...td, fontSize:11, color:'#8aabcc' }}>{v.metodo_pago?.replace('_',' ')}</td>
                  <td style={td}>
                    <span style={{ background: ESTADOS[v.estado]?.color + '22', color: ESTADOS[v.estado]?.color, fontSize:11, padding:'3px 8px', borderRadius:4, fontWeight:500 }}>
                      {ESTADOS[v.estado]?.label}
                    </span>
                  </td>
                  <td style={td}>
                    <div style={{ display:'flex', gap:4 }}>
                      {v.es_domicilio  && <span title="Domicilio" style={{ fontSize:14 }}>🚚</span>}
                      {v.tiene_retoma  && <span title="Tiene retoma" style={{ fontSize:14 }}>🔄</span>}
                    </div>
                  </td>
                  <td style={td}>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>

                      {/* Cambiar estado */}
                      {puedeGestionarEstado(v) && !['anulada','desistida'].includes(v.estado) && (
                        <select
                          value={v.estado}
                          onChange={e => cambiarEstado(v, e.target.value)}
                          style={{ background:'#0a1628', border:'1px solid #1a2f52', borderRadius:6, padding:'4px 8px', color:'#fff', fontSize:11, cursor:'pointer' }}
                        >
                          {estadosDisponibles(v).map(([k, est]) => (
                            <option key={k} value={k}>{est.label}</option>
                          ))}
                        </select>
                      )}

                      {/* Continuar venta — solo si está registrada y no tiene IMEI completo */}
                      {puedeGestionarEstado(v) && v.estado === 'registrada' && (
                        <button
                          onClick={() => navigate(`/ventas/editar/${v.id}`)}
                          style={{ padding:'4px 10px', background:'#1a2f52', border:'1px solid #3b82f6', borderRadius:6, color:'#60a5fa', fontSize:11, cursor:'pointer', whiteSpace:'nowrap' }}
                        >
                          ✏️ Continuar
                        </button>
                      )}

                      {/* Desistir */}
                      {puedeGestionarEstado(v) && !['anulada','desistida','entregada'].includes(v.estado) && (
                        <button
                          onClick={() => setConfirmDesistir(v)}
                          style={{ padding:'4px 10px', background:'transparent', border:'1px solid #ef4444', borderRadius:6, color:'#ef4444', fontSize:11, cursor:'pointer', whiteSpace:'nowrap' }}
                        >
                          ✗ Desistir
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL CONFIRMAR DESISTIR */}
      {confirmDesistir && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.82)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:14, padding:28, width:'100%', maxWidth:420, fontFamily:"'DM Sans', system-ui" }}>
            <div style={{ fontSize:32, textAlign:'center', marginBottom:12 }}>⚠️</div>
            <h3 style={{ color:'#fff', textAlign:'center', margin:'0 0 8px', fontSize:16 }}>¿Confirmar desistimiento?</h3>
            <p style={{ color:'#8aabcc', textAlign:'center', fontSize:13, margin:'0 0 20px' }}>
              La venta de <strong style={{ color:'#fff' }}>{confirmDesistir.nombre_cliente}</strong> — {confirmDesistir.producto} quedará como desistida y el equipo volverá al inventario.
            </p>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setConfirmDesistir(null)} style={{ flex:1, padding:'10px 0', background:'transparent', border:'1px solid #1a2f52', borderRadius:8, color:'#6b8ab0', fontSize:13, cursor:'pointer' }}>
                Cancelar
              </button>
              <button onClick={() => desistirVenta(confirmDesistir)} style={{ flex:1, padding:'10px 0', background:'linear-gradient(135deg,#ef4444,#dc2626)', border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                Sí, desistir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
