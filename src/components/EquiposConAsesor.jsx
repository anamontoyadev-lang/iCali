import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const fmt = n => new Intl.NumberFormat('es-CO',{ style:'currency', currency:'COP', maximumFractionDigits:0 }).format(n||0)

export default function EquiposConAsesor() {
  const { perfil, esAdmin, esLiderAdmin, esLiderCom } = useAuth()
  const [equipos, setEquipos] = useState([])
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => { loadEquipos() }, [])

  async function loadEquipos() {
    let q = supabase.from('compras_proveedor')
      .select('*, proveedores(nombre)')
      .eq('estado', 'con_asesor')
      .order('fecha_prestamo', { ascending: false })

    // Asesor solo ve los suyos — buscar por nombre o apellido
    if (!esAdmin && !esLiderAdmin && !esLiderCom && perfil) {
      const nombre = perfil.nombre || ''
      const apellido = perfil.apellido || ''
      // Buscar por nombre o apellido parcial
      if (nombre) {
        q = q.ilike('con_asesor', `%${nombre}%`)
      }
    }

    const { data } = await q
    setEquipos(data || [])
    setLoading(false)
  }

  async function solicitarDevolucion(equipo) {
    setEnviando(true)
    const user = (await supabase.auth.getUser()).data.user
    await supabase.from('notificaciones').insert({
      tipo: 'DEVOLUCION_EQUIPO',
      mensaje: `Asesor solicita recogida de equipo`,
      datos: {
        imei: equipo.imei,
        producto: equipo.producto,
        asesor: equipo.con_asesor,
        equipo_id: equipo.id,
      },
      creado_por: user.id,
      creado_por_nombre: equipo.con_asesor,
      destinatario_rol: 'inventario',
    })
    setEnviando(false)
    alert('✓ Solicitud de recogida enviada a inventario')
  }

  if (loading) return null
  if (equipos.length === 0) return null

  return (
    <div style={{ margin:'20px 0', background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.25)', borderRadius:12, padding:'16px 18px', fontFamily:"'DM Sans', system-ui" }}>
      <div style={{ color:'#f59e0b', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:12 }}>
        📦 Equipos contigo ({equipos.length})
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {equipos.map(eq => (
          <div key={eq.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, background:'#ffffff', borderRadius:8, padding:'10px 14px', flexWrap:'wrap' }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ color:'#e2e8f0', fontSize:13, fontWeight:500 }}>{eq.producto}</div>
              <div style={{ display:'flex', gap:10, marginTop:3, flexWrap:'wrap' }}>
                <span style={{ color:'#8aabcc', fontSize:11, fontFamily:'monospace' }}>IMEI: {eq.imei}</span>
                {eq.color && <span style={{ color:'#8aabcc', fontSize:11 }}>{eq.color}</span>}
                {eq.con_asesor && <span style={{ color:'#f59e0b', fontSize:11 }}>👤 {eq.con_asesor}</span>}
                {eq.fecha_prestamo && <span style={{ color:'#4a6a8a', fontSize:10 }}>{new Date(eq.fecha_prestamo).toLocaleDateString('es-CO',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</span>}
              </div>
            </div>
            <button onClick={() => solicitarDevolucion(eq)} disabled={enviando}
              style={{ padding:'7px 14px', background:'transparent', border:'1px solid #f59e0b', borderRadius:7, color:'#f59e0b', fontSize:11, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
              📤 Solicitar recogida
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
