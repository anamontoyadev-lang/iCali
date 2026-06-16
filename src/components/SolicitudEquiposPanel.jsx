import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const inp = {
  background:'#f5f3ff', border:'1px solid #c7d2fe', borderRadius:6,
  padding:'7px 10px', color:'#fff', fontSize:12,
  width:'100%', boxSizing:'border-box', outline:'none'
}
const fmt = n => new Intl.NumberFormat('es-CO',{ style:'currency', currency:'COP', maximumFractionDigits:0 }).format(n||0)

const REFS_RAPIDAS = [
  'iPhone 11','iPhone 12','iPhone 13','iPhone 13 Pro',
  'iPhone 14','iPhone 14 Pro','iPhone 15','iPhone 15 Pro',
  'iPhone 16','iPhone 16 Pro','iPhone 16E','iPhone 17','iPhone 17 Air',
]

export default function SolicitudEquiposPanel({
  equiposSolicitados, setEquiposSolicitados,
  solicitudEnviada, setSolicitudEnviada,
  enviandoNotif, setEnviandoNotif,
  asesorNombre, clienteNombre,
  onSeleccionarParaVenta,
}) {
  const [busqueda, setBusqueda]       = useState('')
  const [resultados, setResultados]   = useState([])
  const [buscando, setBuscando]       = useState(false)
  const [abierto, setAbierto]         = useState(false)
  const [equiposConAsesor, setEquiposConAsesor] = useState([])
  // IMEIs que ya tienen solicitud pendiente
  const [imeisPendientes, setImeisPendientes] = useState(new Set())
  // Solicitud activa para polling
  const [notifId, setNotifId]         = useState(null)
  const [respuestaInv, setRespuestaInv] = useState(null) // null | 'parcial' | 'completa'

  useEffect(() => {
    if (asesorNombre) {
      loadEquiposConAsesor()
      loadSolicitudesPendientes()
    }
  }, [asesorNombre])

  // Polling — verificar si inventario respondió
  useEffect(() => {
    if (!notifId || respuestaInv === 'completa') return
    const interval = setInterval(async () => {
      const { data } = await supabase.from('notificaciones')
        .select('respondida,respuesta,datos')
        .eq('id', notifId).single()
      if (data?.respondida) {
        setRespuestaInv('completa')
        // Recargar equipos con asesor
        await loadEquiposConAsesor()
        clearInterval(interval)
      } else if (data?.datos?.equipos?.some(e => e.confirmado)) {
        setRespuestaInv('parcial')
        await loadEquiposConAsesor()
      }
    }, 4000)
    return () => clearInterval(interval)
  }, [notifId, respuestaInv])

  async function loadEquiposConAsesor() {
    if (!asesorNombre) return
    const { data } = await supabase
      .from('compras_proveedor')
      .select('id,imei,producto,color,bateria,sticker,costo,estado_equipo,proveedores(nombre)')
      .eq('estado', 'con_asesor')
      .ilike('con_asesor', `%${asesorNombre.split('.')[0]}%`)
    setEquiposConAsesor(data || [])
  }

  async function loadSolicitudesPendientes() {
    // Cargar IMEIs que ya tienen solicitud pendiente de este asesor
    const { data } = await supabase
      .from('notificaciones')
      .select('datos')
      .eq('tipo', 'SOLICITUD_EQUIPO')
      .eq('respondida', false)
      .eq('creado_por_nombre', asesorNombre)
    const imeis = new Set()
    ;(data || []).forEach(n => {
      const equipos = Array.isArray(n.datos?.equipos) ? n.datos.equipos : n.datos?.imei ? [{ imei: n.datos.imei }] : []
      equipos.forEach(e => { if (e.imei) imeis.add(e.imei) })
    })
    setImeisPendientes(imeis)
  }

  async function buscarEquipos(texto) {
    setBusqueda(texto)
    if (texto.length < 2) { setResultados([]); return }
    setBuscando(true)
    const { data } = await supabase
      .from('compras_proveedor')
      .select('id,imei,producto,color,almacenamiento,bateria,sticker,estado_equipo,costo,precio_venta_est,proveedores(nombre)')
      .eq('estado', 'disponible')
      .or(`producto.ilike.%${texto}%,imei.ilike.%${texto}%`)
      .order('created_at', { ascending: false })
      .limit(15)
    setResultados(data || [])
    setBuscando(false)
  }

  function agregarEquipo(eq) {
    if (equiposSolicitados.length >= 5) return
    if (equiposSolicitados.find(e => e.id === eq.id)) return
    if (imeisPendientes.has(eq.imei)) return // ya tiene solicitud pendiente
    setEquiposSolicitados(prev => [...prev, eq])
  }

  function quitarEquipo(id) {
    setEquiposSolicitados(prev => prev.filter(e => e.id !== id))
  }

  async function enviarSolicitud() {
    if (equiposSolicitados.length === 0 || enviandoNotif) return
    setEnviandoNotif(true)
    const user = (await supabase.auth.getUser()).data.user
    const { data, error } = await supabase.from('notificaciones').insert({
      tipo: 'SOLICITUD_EQUIPO',
      mensaje: `Solicitud de ${equiposSolicitados.length} equipo${equiposSolicitados.length>1?'s':''} para mostrar al cliente`,
      datos: {
        equipos: equiposSolicitados.map(e => ({
          id: e.id, imei: e.imei,
          producto: e.producto, color: e.color,
          sticker: e.sticker, bateria: e.bateria,
        })),
        asesor: asesorNombre,
        asesor_id: user.id,
        cliente: clienteNombre || 'Cliente en mostrador',
      },
      creado_por:        user.id,
      creado_por_nombre: asesorNombre,
      destinatario_rol:  'inventario',
    }).select().single()
    if (!error && data) {
      setNotifId(data.id)
      setSolicitudEnviada(true)
      setAbierto(false)
      setBusqueda('')
      setResultados([])
      // Actualizar IMEIs pendientes
      setImeisPendientes(prev => {
        const nuevo = new Set(prev)
        equiposSolicitados.forEach(e => nuevo.add(e.imei))
        return nuevo
      })
    }
    setEnviandoNotif(false)
  }

  const tieneEquiposConAsesor = equiposConAsesor.length > 0

  return (
    <div style={{ marginBottom:8 }}>

      {/* Equipos que ya tiene el asesor — selección para venta */}
      {tieneEquiposConAsesor && (
        <div style={{ background:'rgba(16,185,129,0.06)', border:'1px solid rgba(16,185,129,0.2)', borderRadius:10, padding:'12px 14px', marginBottom:10 }}>
          <div style={{ color:'#10b981', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>
            📦 Equipos contigo ({equiposConAsesor.length}) — selecciona el que el cliente eligió
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {equiposConAsesor.map(eq => (
              <div key={eq.id} style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                background:'#f5f3ff', borderRadius:8, padding:'8px 12px', gap:8, flexWrap:'wrap'
              }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ color:'#e2e8f0', fontSize:12, fontWeight:500 }}>{eq.producto}</div>
                  <div style={{ display:'flex', gap:8, marginTop:2, flexWrap:'wrap' }}>
                    <span style={{ color:'#8aabcc', fontSize:10, fontFamily:'monospace' }}>IMEI: {eq.imei}</span>
                    {eq.color && <span style={{ color:'#8aabcc', fontSize:10 }}>{eq.color}</span>}
                    {eq.bateria != null && <span style={{ color:eq.bateria>=80?'#10b981':'#f59e0b', fontSize:10 }}>{eq.bateria}%</span>}
                    {eq.sticker && <span style={{ color:'#f59e0b', fontSize:10 }}>{eq.sticker}</span>}
                    {eq.precio_venta_est && <span style={{ color:'#10b981', fontSize:10, fontWeight:600 }}>{fmt(eq.precio_venta_est)}</span>}
                  </div>
                </div>
                <button type="button" onClick={() => onSeleccionarParaVenta && onSeleccionarParaVenta(eq)}
                  style={{ padding:'7px 14px', background:'linear-gradient(135deg,#10b981,#059669)', border:'none', borderRadius:7, color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer', flexShrink:0 }}>
                  ✓ El cliente lo quiere
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Estado de solicitud enviada */}
      {solicitudEnviada && equiposSolicitados.length > 0 && (
        <div style={{ background: respuestaInv === 'completa' ? 'rgba(16,185,129,0.06)' : 'rgba(245,158,11,0.06)', border:`1px solid ${respuestaInv==='completa'?'rgba(16,185,129,0.25)':'rgba(245,158,11,0.2)'}`, borderRadius:10, padding:'12px 14px', marginBottom:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
            {respuestaInv === 'completa'
              ? <span style={{ color:'#10b981', fontSize:11, fontWeight:700 }}>✅ Inventario confirmó — equipos en camino</span>
              : respuestaInv === 'parcial'
              ? <span style={{ color:'#f59e0b', fontSize:11, fontWeight:700 }}>⏳ Inventario está bajando los equipos...</span>
              : <span style={{ color:'#f59e0b', fontSize:11, fontWeight:700 }}>⏳ Esperando que inventario confirme...</span>
            }
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {equiposSolicitados.map((e,i) => (
              <div key={e.id} style={{ display:'flex', alignItems:'center', gap:8, background:'#f5f3ff', borderRadius:6, padding:'5px 10px' }}>
                <span style={{ color:'#8aabcc', fontSize:10, width:14 }}>{i+1}.</span>
                <span style={{ color:'#e2e8f0', fontSize:11 }}>{e.producto}</span>
                <span style={{ color:'#8aabcc', fontSize:10, fontFamily:'monospace' }}>· {e.imei}</span>
                {e.color && <span style={{ color:'#8aabcc', fontSize:10 }}>· {e.color}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Botón abrir buscador — solo si no hay solicitud activa pendiente */}
      {!solicitudEnviada && (
        <div>
          {!abierto ? (
            <button type="button" onClick={() => setAbierto(true)} style={{
              padding:'8px 16px', background:'transparent',
              border:'1px solid #3b82f6', borderRadius:7,
              color:'#60a5fa', fontSize:11, fontWeight:600, cursor:'pointer',
              display:'flex', alignItems:'center', gap:6,
            }}>
              🔔 Pedir equipos a inventario
              <span style={{ background:'rgba(59,130,246,0.15)', borderRadius:4, padding:'1px 5px', fontSize:10 }}>hasta 5</span>
            </button>
          ) : (
            <div style={{ background:'rgba(59,130,246,0.05)', border:'1px solid rgba(59,130,246,0.2)', borderRadius:10, padding:'14px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                <div style={{ color:'#60a5fa', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em' }}>
                  🔔 Solicitar equipos a inventario
                </div>
                <button type="button" onClick={() => { setAbierto(false); setBusqueda(''); setResultados([]) }}
                  style={{ background:'transparent', border:'none', color:'#4a6a8a', fontSize:18, cursor:'pointer' }}>×</button>
              </div>

              {/* Lista de equipos en la solicitud */}
              {equiposSolicitados.length > 0 && (
                <div style={{ marginBottom:10 }}>
                  <div style={{ color:'#8aabcc', fontSize:10, fontWeight:600, marginBottom:6 }}>En solicitud ({equiposSolicitados.length}/5):</div>
                  {equiposSolicitados.map((e,i) => (
                    <div key={e.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'#f5f3ff', borderRadius:6, padding:'6px 10px', marginBottom:4 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ color:'#3b82f6', fontSize:10, fontWeight:700 }}>{i+1}</span>
                        <div>
                          <span style={{ color:'#e2e8f0', fontSize:11 }}>{e.producto}</span>
                          <span style={{ color:'#8aabcc', fontSize:10, fontFamily:'monospace', marginLeft:6 }}>IMEI: {e.imei}</span>
                          {e.color && <span style={{ color:'#8aabcc', fontSize:10, marginLeft:4 }}>{e.color}</span>}
                        </div>
                      </div>
                      <button type="button" onClick={() => quitarEquipo(e.id)}
                        style={{ background:'transparent', border:'none', color:'#ef4444', fontSize:16, cursor:'pointer' }}>×</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Buscador */}
              {equiposSolicitados.length < 5 && (
                <div style={{ marginBottom:10 }}>
                  <input
                    value={busqueda}
                    onChange={e => buscarEquipos(e.target.value)}
                    placeholder="Buscar por referencia o IMEI..."
                    style={inp}
                    autoFocus
                  />
                  <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:6 }}>
                    {REFS_RAPIDAS.map(r => (
                      <button key={r} type="button" onClick={() => buscarEquipos(r)}
                        style={{ padding:'2px 7px', background:'#1a2f52', border:'none', borderRadius:4, color:'#8aabcc', fontSize:10, cursor:'pointer' }}>
                        {r}
                      </button>
                    ))}
                  </div>
                  {buscando && <div style={{ color:'#4a6a8a', fontSize:11, marginTop:6 }}>Buscando...</div>}
                  {!buscando && busqueda.length >= 2 && resultados.length === 0 && (
                    <div style={{ color:'#ef4444', fontSize:11, marginTop:6 }}>Sin equipos disponibles para "{busqueda}"</div>
                  )}
                  {resultados.length > 0 && (
                    <div style={{ marginTop:8, maxHeight:200, overflowY:'auto', display:'flex', flexDirection:'column', gap:4 }}>
                      {resultados.map(eq => {
                        const yaAgregado = !!equiposSolicitados.find(e => e.id === eq.id)
                        const pendiente  = imeisPendientes.has(eq.imei)
                        return (
                          <div key={eq.id} style={{
                            display:'flex', alignItems:'center', justifyContent:'space-between',
                            background: yaAgregado?'rgba(16,185,129,0.08)':pendiente?'rgba(107,114,128,0.08)':'#0a1628',
                            border:`1px solid ${yaAgregado?'#10b981':pendiente?'#374151':'#1a2f52'}`,
                            borderRadius:7, padding:'7px 10px', gap:8,
                            opacity: pendiente ? 0.6 : 1,
                          }}>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ color:'#e2e8f0', fontSize:11, fontWeight:500 }}>{eq.producto}</div>
                              <div style={{ display:'flex', gap:6, marginTop:2, flexWrap:'wrap' }}>
                                <span style={{ color:'#8aabcc', fontSize:10, fontFamily:'monospace' }}>IMEI: {eq.imei}</span>
                                {eq.color && <span style={{ color:'#8aabcc', fontSize:10 }}>{eq.color}</span>}
                                {eq.bateria!=null && <span style={{ color:eq.bateria>=80?'#10b981':'#f59e0b', fontSize:10 }}>{eq.bateria}%</span>}
                                {eq.sticker && <span style={{ color:'#f59e0b', fontSize:10 }}>{eq.sticker}</span>}
                                {eq.precio_venta_est && <span style={{ color:'#10b981', fontSize:10, fontWeight:600 }}>{fmt(eq.precio_venta_est)}</span>}
                              </div>
                            </div>
                            {pendiente ? (
                              <span style={{ color:'#9ca3af', fontSize:10, flexShrink:0, whiteSpace:'nowrap' }}>⏳ Solicitud pendiente</span>
                            ) : yaAgregado ? (
                              <span style={{ color:'#10b981', fontSize:10, flexShrink:0 }}>✓</span>
                            ) : (
                              <button type="button" onClick={() => agregarEquipo(eq)}
                                style={{ padding:'5px 10px', background:'#3b82f6', border:'none', borderRadius:5, color:'#fff', fontSize:10, fontWeight:700, cursor:'pointer', flexShrink:0 }}>
                                + Agregar
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Botones */}
              <div style={{ display:'flex', gap:8 }}>
                <button type="button" onClick={() => { setAbierto(false); setBusqueda(''); setResultados([]) }}
                  style={{ padding:'7px 14px', background:'transparent', border:'1px solid #1a2f52', borderRadius:6, color:'#6b8ab0', fontSize:12, cursor:'pointer' }}>
                  Cancelar
                </button>
                <button type="button" onClick={enviarSolicitud}
                  disabled={equiposSolicitados.length === 0 || enviandoNotif}
                  style={{ flex:1, padding:'7px 14px', background: equiposSolicitados.length>0?'linear-gradient(135deg,#3b82f6,#1d4ed8)':'#1e3058', border:'none', borderRadius:6, color:'#fff', fontSize:12, fontWeight:700, cursor: equiposSolicitados.length>0?'pointer':'default' }}>
                  {enviandoNotif ? '⏳ Enviando...' : `🔔 Enviar solicitud (${equiposSolicitados.length})`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
