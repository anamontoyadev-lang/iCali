import { useState } from 'react'
import { supabase } from '../lib/supabase'

const PRODUCTOS_BASE = [
  'iPhone 11','iPhone 12','iPhone 12 Mini','iPhone 13','iPhone 13 Mini',
  'iPhone 13 Pro','iPhone 13 Pro Max','iPhone 14','iPhone 14 Plus',
  'iPhone 14 Pro','iPhone 14 Pro Max','iPhone 15','iPhone 15 Plus',
  'iPhone 15 Pro','iPhone 15 Pro Max','iPhone 16','iPhone 16 Plus',
  'iPhone 16 Pro','iPhone 16 Pro Max','iPhone 16E',
  'iPhone 17','iPhone 17 Air','iPhone 17 Pro','iPhone 17 Pro Max',
]

const inp = {
  background:'#0a1628', border:'1px solid #1a2f52', borderRadius:6,
  padding:'7px 10px', color:'#fff', fontSize:12,
  width:'100%', boxSizing:'border-box', outline:'none'
}

const fmt = n => new Intl.NumberFormat('es-CO',{ style:'currency', currency:'COP', maximumFractionDigits:0 }).format(n||0)

export default function SolicitudEquiposPanel({
  equiposSolicitados, setEquiposSolicitados,
  solicitudEnviada, setSolicitudEnviada,
  enviandoNotif, setEnviandoNotif,
  asesorNombre, clienteNombre,
}) {
  const [busqueda, setBusqueda]   = useState('')
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando]   = useState(false)
  const [abierto, setAbierto]     = useState(false)

  async function buscarEquipos(texto) {
    setBusqueda(texto)
    if (texto.length < 3) { setResultados([]); return }
    setBuscando(true)
    const { data } = await supabase
      .from('compras_proveedor')
      .select('id, imei, producto, color, almacenamiento, bateria, sticker, estado_equipo, precio_venta_est, proveedores(nombre)')
      .eq('estado', 'disponible')
      .or(`producto.ilike.%${texto}%,imei.ilike.%${texto}%`)
      .order('created_at', { ascending: false })
      .limit(20)
    setResultados(data || [])
    setBuscando(false)
  }

  function agregarEquipo(eq) {
    if (equiposSolicitados.length >= 5) return
    if (equiposSolicitados.find(e => e.id === eq.id)) return
    setEquiposSolicitados(prev => [...prev, eq])
  }

  function quitarEquipo(id) {
    setEquiposSolicitados(prev => prev.filter(e => e.id !== id))
  }

  async function enviarSolicitud() {
    if (equiposSolicitados.length === 0 || enviandoNotif) return
    setEnviandoNotif(true)
    const user = (await supabase.auth.getUser()).data.user
    const { error } = await supabase.from('notificaciones').insert({
      tipo: 'SOLICITUD_EQUIPO',
      mensaje: `Solicitud de ${equiposSolicitados.length} equipo${equiposSolicitados.length>1?'s':''} para mostrar al cliente`,
      datos: {
        equipos: equiposSolicitados.map(e => ({
          id: e.id, imei: e.imei,
          producto: e.producto, color: e.color,
          sticker: e.sticker, bateria: e.bateria,
        })),
        asesor:    asesorNombre,
        asesor_id: user.id,
        cliente:   clienteNombre || 'Cliente en mostrador',
      },
      creado_por:        user.id,
      creado_por_nombre: asesorNombre,
      destinatario_rol:  'inventario',
    })
    if (!error) setSolicitudEnviada(true)
    setEnviandoNotif(false)
  }

  if (!abierto) {
    return (
      <div style={{ marginBottom:20 }}>
        <div style={{ color:'#4a7aaa', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', borderBottom:'1px solid #1a2f52', paddingBottom:8, marginBottom:12 }}>
          📦 Solicitar equipos a inventario
        </div>
        <button type="button" onClick={() => setAbierto(true)} style={{
          padding:'10px 18px', background:'transparent',
          border:'1px solid #f59e0b', borderRadius:8,
          color:'#f59e0b', fontSize:12, fontWeight:600, cursor:'pointer',
          display:'flex', alignItems:'center', gap:8,
        }}>
          🔔 Pedir equipos a inventario para mostrar al cliente
          <span style={{ background:'rgba(245,158,11,0.15)', borderRadius:4, padding:'1px 6px', fontSize:10 }}>hasta 5</span>
        </button>
      </div>
    )
  }

  return (
    <div style={{ marginBottom:20 }}>
      <div style={{ color:'#4a7aaa', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', borderBottom:'1px solid #1a2f52', paddingBottom:8, marginBottom:16 }}>
        📦 Solicitar equipos a inventario
      </div>

      <div style={{ background:'rgba(245,158,11,0.05)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:12, padding:'16px' }}>

        {/* Lista de equipos agregados */}
        {equiposSolicitados.length > 0 && (
          <div style={{ marginBottom:14 }}>
            <div style={{ color:'#f59e0b', fontSize:11, fontWeight:600, marginBottom:8 }}>
              Equipos en solicitud ({equiposSolicitados.length}/5)
              {solicitudEnviada && <span style={{ marginLeft:8, color:'#10b981' }}>✓ Solicitud enviada</span>}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {equiposSolicitados.map((e, i) => (
                <div key={e.id} style={{
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  background:'#0a1628', borderRadius:8, padding:'8px 12px', gap:8,
                }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ background:'#1a2f52', color:'#8aabcc', fontSize:10, fontWeight:700, width:18, height:18, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{i+1}</span>
                    <div>
                      <div style={{ color:'#e2e8f0', fontSize:12, fontWeight:500 }}>{e.producto}</div>
                      <div style={{ display:'flex', gap:8, marginTop:2 }}>
                        <span style={{ color:'#8aabcc', fontSize:10, fontFamily:'monospace' }}>IMEI: {e.imei}</span>
                        {e.color && <span style={{ color:'#8aabcc', fontSize:10 }}>{e.color}</span>}
                        {e.bateria && <span style={{ color: e.bateria>=80?'#10b981':'#f59e0b', fontSize:10 }}>{e.bateria}%</span>}
                        {e.sticker && <span style={{ color:'#f59e0b', fontSize:10 }}>{e.sticker}</span>}
                      </div>
                    </div>
                  </div>
                  {!solicitudEnviada && (
                    <button type="button" onClick={() => quitarEquipo(e.id)}
                      style={{ background:'transparent', border:'none', color:'#ef4444', fontSize:16, cursor:'pointer', flexShrink:0 }}>×</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Buscador — solo si no se ha enviado y hay cupo */}
        {!solicitudEnviada && equiposSolicitados.length < 5 && (
          <div style={{ marginBottom:12 }}>
            <div style={{ color:'#8aabcc', fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>
              Buscar equipo en inventario
            </div>
            <input
              value={busqueda}
              onChange={e => buscarEquipos(e.target.value)}
              placeholder="Escribe referencia o IMEI... (ej: iPhone 15, iPhone 13 Pro)"
              style={inp}
            />
            {/* Accesos rápidos por referencia */}
            <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:6 }}>
              {PRODUCTOS_BASE.slice(0,8).map(p => (
                <button key={p} type="button" onClick={() => buscarEquipos(p)}
                  style={{ padding:'2px 8px', background:'#1a2f52', border:'none', borderRadius:4, color:'#8aabcc', fontSize:10, cursor:'pointer' }}>
                  {p}
                </button>
              ))}
            </div>

            {/* Resultados */}
            {buscando && <div style={{ color:'#4a6a8a', fontSize:11, marginTop:8 }}>Buscando...</div>}
            {!buscando && busqueda.length >= 3 && resultados.length === 0 && (
              <div style={{ color:'#ef4444', fontSize:11, marginTop:8 }}>No hay equipos disponibles para "{busqueda}"</div>
            )}
            {resultados.length > 0 && (
              <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:4, maxHeight:220, overflowY:'auto' }}>
                {resultados.map(eq => {
                  const yaAgregado = !!equiposSolicitados.find(e => e.id === eq.id)
                  return (
                    <div key={eq.id} style={{
                      display:'flex', alignItems:'center', justifyContent:'space-between',
                      background: yaAgregado ? 'rgba(16,185,129,0.08)' : '#0a1628',
                      border: `1px solid ${yaAgregado ? '#10b981' : '#1a2f52'}`,
                      borderRadius:8, padding:'8px 12px', gap:8,
                    }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ color:'#e2e8f0', fontSize:12, fontWeight:500 }}>{eq.producto}</div>
                        <div style={{ display:'flex', gap:8, marginTop:2, flexWrap:'wrap' }}>
                          <span style={{ color:'#8aabcc', fontSize:10, fontFamily:'monospace' }}>IMEI: {eq.imei}</span>
                          {eq.color && <span style={{ color:'#8aabcc', fontSize:10 }}>{eq.color}</span>}
                          {eq.bateria != null && <span style={{ color: eq.bateria>=80?'#10b981':'#f59e0b', fontSize:10 }}>{eq.bateria}%</span>}
                          {eq.sticker && <span style={{ color:'#f59e0b', fontSize:10 }}>{eq.sticker}</span>}
                          {eq.precio_venta_est && <span style={{ color:'#10b981', fontSize:10, fontWeight:600 }}>{fmt(eq.precio_venta_est)}</span>}
                        </div>
                      </div>
                      {yaAgregado ? (
                        <span style={{ color:'#10b981', fontSize:11, flexShrink:0 }}>✓ Agregado</span>
                      ) : (
                        <button type="button" onClick={() => agregarEquipo(eq)}
                          disabled={equiposSolicitados.length >= 5}
                          style={{ padding:'6px 12px', background:'#f59e0b', border:'none', borderRadius:6, color:'#000', fontSize:11, fontWeight:700, cursor:'pointer', flexShrink:0 }}>
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

        {/* Botones acción */}
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          {!solicitudEnviada ? (
            <>
              <button type="button" onClick={() => { setAbierto(false); setEquiposSolicitados([]); setBusqueda(''); setResultados([]) }}
                style={{ padding:'8px 14px', background:'transparent', border:'1px solid #1a2f52', borderRadius:7, color:'#6b8ab0', fontSize:12, cursor:'pointer' }}>
                Cancelar
              </button>
              <button type="button" onClick={enviarSolicitud}
                disabled={equiposSolicitados.length === 0 || enviandoNotif}
                style={{ padding:'8px 18px', background: equiposSolicitados.length > 0 ? 'linear-gradient(135deg,#f59e0b,#d97706)' : '#1e3058', border:'none', borderRadius:7, color: equiposSolicitados.length > 0 ? '#000' : '#4a6a8a', fontSize:12, fontWeight:700, cursor: equiposSolicitados.length > 0 ? 'pointer' : 'default' }}>
                {enviandoNotif ? '⏳ Enviando...' : `🔔 Enviar solicitud (${equiposSolicitados.length} equipo${equiposSolicitados.length !== 1 ? 's' : ''})`}
              </button>
            </>
          ) : (
            <div style={{ color:'#10b981', fontSize:12, fontWeight:600 }}>
              ✓ Solicitud enviada — inventario está en camino
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
