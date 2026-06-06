import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function NotificacionesInventario() {
  const [notifs, setNotifs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadNotifs()
    // Polling cada 5 segundos
    const interval = setInterval(loadNotifs, 5000)
    return () => clearInterval(interval)
  }, [])

  async function loadNotifs() {
    const { data } = await supabase
      .from('notificaciones')
      .select('*')
      .eq('tipo', 'SOLICITUD_EQUIPO')
      .eq('respondida', false)
      .order('created_at', { ascending: false })
    setNotifs(data || [])
    setLoading(false)
  }

  async function responder(id, respuesta) {
    const user = (await supabase.auth.getUser()).data.user
    await supabase.from('notificaciones').update({
      respondida: true,
      respuesta,
      respondido_por: user?.email || 'inventario',
    }).eq('id', id)
    loadNotifs()
  }

  if (loading) return null
  if (notifs.length === 0) return null

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 900,
      display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360,
      fontFamily: "'DM Sans', system-ui",
    }}>
      {notifs.map(n => (
        <div key={n.id} style={{
          background: '#0d1a35', border: '1px solid #f59e0b',
          borderRadius: 12, padding: '14px 16px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
          animation: 'slideIn .3s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 18 }}>🔔</span>
            <div>
              <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>Solicitud de equipo</div>
              <div style={{ color: '#4a6a8a', fontSize: 11 }}>de {n.creado_por_nombre}</div>
            </div>
          </div>
          <div style={{ background: '#0a1628', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
            <div style={{ color: '#8aabcc', fontSize: 11, marginBottom: 4 }}>
              {n.datos?.producto}
            </div>
            {n.datos?.imei && (
              <div style={{ color: '#fff', fontFamily: 'monospace', fontSize: 12 }}>
                IMEI: {n.datos.imei}
              </div>
            )}
            {n.datos?.cliente && (
              <div style={{ color: '#4a6a8a', fontSize: 11, marginTop: 2 }}>
                Cliente: {n.datos.cliente}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => responder(n.id, 'no')} style={{
              flex: 1, padding: '8px 0', background: 'transparent',
              border: '1px solid #ef4444', borderRadius: 7,
              color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>✗ No disponible</button>
            <button onClick={() => responder(n.id, 'si')} style={{
              flex: 1, padding: '8px 0',
              background: 'linear-gradient(135deg,#10b981,#059669)',
              border: 'none', borderRadius: 7,
              color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>✓ Voy con el equipo</button>
          </div>
        </div>
      ))}
    </div>
  )
}
