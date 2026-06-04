import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const ROLES = [
  { value:'admin',              label:'Administrador',      color:'#8b5cf6' },
  { value:'lider_comercial',    label:'Líder Comercial',    color:'#10b981' },
  { value:'lider_admin',        label:'Líder Administrativo', color:'#f59e0b' },
  { value:'contadora',          label:'Contadora',          color:'#3b82f6' },
  { value:'asesor_mostrador',   label:'Asesor Mostrador',   color:'#94a3b8' },
  { value:'asesor_call_center', label:'Asesor Call Center', color:'#64748b' },
  { value:'garantias',          label:'Garantías',            color:'#ec4899' },
  { value:'laboratorio',        label:'Laboratorio',          color:'#f97316' },
]

const SUPABASE_URL  = process.env.REACT_APP_SUPABASE_URL
const SUPABASE_ANON = process.env.REACT_APP_SUPABASE_ANON_KEY

// Llama a una Edge Function de Supabase para operaciones admin
// Como alternativa usamos la API REST de admin directamente
async function adminFetch(path, method, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON,
      'Authorization': `Bearer ${SUPABASE_ANON}`
    },
    body: body ? JSON.stringify(body) : undefined
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || data.error || 'Error en API')
  return data
}

const inp = {
  background:'#0a1628', border:'1px solid #1a2f52', borderRadius:8,
  padding:'9px 12px', color:'#fff', fontSize:13,
  width:'100%', boxSizing:'border-box', outline:'none'
}
const sel = { ...inp, cursor:'pointer' }

function RolBadge({ rol }) {
  const r = ROLES.find(x => x.value === rol) || { label: rol, color:'#94a3b8' }
  return (
    <span style={{
      background: r.color + '22', color: r.color,
      fontSize:11, padding:'3px 9px', borderRadius:4, fontWeight:500
    }}>{r.label}</span>
  )
}

export default function Usuarios() {
  const { esAdmin } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading]   = useState(true)
  const [buscar, setBuscar]     = useState('')
  const [filtroRol, setFiltroRol] = useState('')

  // Modales
  const [modalCrear, setModalCrear]     = useState(false)
  const [modalEditar, setModalEditar]   = useState(null) // perfil seleccionado
  const [modalPass, setModalPass]       = useState(null) // {id, email}
  const [saving, setSaving]             = useState(false)
  const [msgExito, setMsgExito]         = useState('')
  const [msgError, setMsgError]         = useState('')

  const [formCrear, setFormCrear] = useState({
    email:'', password:'', nombre:'', apellido:'', rol:'asesor_mostrador'
  })
  const [formEditar, setFormEditar] = useState({ nombre:'', apellido:'', rol:'' })
  const [nuevaPass, setNuevaPass]   = useState('')
  const [confirmaPass, setConfirmaPass] = useState('')

  useEffect(() => { if (esAdmin) loadUsuarios() }, [esAdmin])

  async function loadUsuarios() {
    const { data } = await supabase
      .from('perfiles')
      .select('id, nombre, apellido, email, rol, fecha_ingreso, sede')
      .order('rol')
    setUsuarios(data || [])
    setLoading(false)
  }

  // CREAR USUARIO
  async function crearUsuario(e) {
    e.preventDefault()
    setSaving(true)
    setMsgError('')
    try {
      // 1. Crear en Supabase Auth via API admin
      const authUser = await adminFetch('/users', 'POST', {
        email:         formCrear.email,
        password:      formCrear.password,
        email_confirm: true
      })

      // 2. Insertar perfil
      const { error: errPerfil } = await supabase.from('perfiles').insert({
        id:       authUser.id,
        nombre:   formCrear.nombre,
        apellido: formCrear.apellido,
        email:    formCrear.email,
        rol:      formCrear.rol
      })

      if (errPerfil) throw new Error(errPerfil.message)

      setMsgExito(`Usuario ${formCrear.email} creado exitosamente`)
      setModalCrear(false)
      setFormCrear({ email:'', password:'', nombre:'', apellido:'', rol:'asesor_mostrador' })
      loadUsuarios()
    } catch (err) {
      setMsgError(err.message)
    }
    setSaving(false)
    setTimeout(() => { setMsgExito(''); setMsgError('') }, 4000)
  }

  // EDITAR USUARIO
  async function editarUsuario(e) {
    e.preventDefault()
    setSaving(true)
    setMsgError('')
    try {
      const { error } = await supabase.from('perfiles').update({
        nombre:   formEditar.nombre,
        apellido: formEditar.apellido,
        rol:      formEditar.rol
      }).eq('id', modalEditar.id)
      if (error) throw new Error(error.message)
      setMsgExito('Usuario actualizado')
      setModalEditar(null)
      loadUsuarios()
    } catch (err) {
      setMsgError(err.message)
    }
    setSaving(false)
    setTimeout(() => { setMsgExito(''); setMsgError('') }, 4000)
  }

  // CAMBIAR CONTRASEÑA
  async function cambiarPassword(e) {
    e.preventDefault()
    if (nuevaPass !== confirmaPass) { setMsgError('Las contraseñas no coinciden'); return }
    if (nuevaPass.length < 8) { setMsgError('Mínimo 8 caracteres'); return }
    setSaving(true)
    setMsgError('')
    try {
      await adminFetch(`/users/${modalPass.id}`, 'PUT', { password: nuevaPass })
      setMsgExito(`Contraseña de ${modalPass.email} actualizada`)
      setModalPass(null)
      setNuevaPass('')
      setConfirmaPass('')
    } catch (err) {
      setMsgError(err.message)
    }
    setSaving(false)
    setTimeout(() => { setMsgExito(''); setMsgError('') }, 4000)
  }

  // ELIMINAR USUARIO
  async function eliminarUsuario(uid, email) {
    if (!window.confirm(`¿Eliminar usuario ${email}? Esta acción no se puede deshacer.`)) return
    setSaving(true)
    try {
      await adminFetch(`/users/${uid}`, 'DELETE')
      await supabase.from('perfiles').delete().eq('id', uid)
      setMsgExito(`Usuario ${email} eliminado`)
      loadUsuarios()
    } catch (err) {
      setMsgError(err.message)
    }
    setSaving(false)
    setTimeout(() => { setMsgExito(''); setMsgError('') }, 4000)
  }

  const filtrados = usuarios.filter(u => {
    if (filtroRol && u.rol !== filtroRol) return false
    if (buscar) {
      const s = buscar.toLowerCase()
      if (!`${u.nombre} ${u.apellido} ${u.email}`.toLowerCase().includes(s)) return false
    }
    return true
  })

  // Agrupar por rol para mostrar secciones
  const grupos = ROLES.map(r => ({
    ...r,
    usuarios: filtrados.filter(u => u.rol === r.value)
  })).filter(g => g.usuarios.length > 0)

  if (!esAdmin) return (
    <div style={{ padding:40, color:'#4a6a8a', textAlign:'center', fontSize:14,
      fontFamily:"'DM Sans', system-ui" }}>
      No tienes permisos para acceder a este módulo.
    </div>
  )

  return (
    <div style={{ padding:'32px 36px', fontFamily:"'DM Sans', system-ui" }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ color:'#fff', fontSize:20, fontWeight:600, margin:'0 0 4px' }}>
            Gestión de usuarios
          </h1>
          <p style={{ color:'#4a6a8a', fontSize:13, margin:0 }}>
            {usuarios.length} usuarios · {filtrados.length} mostrados
          </p>
        </div>
        <button onClick={() => { setModalCrear(true); setMsgError('') }} style={{
          padding:'10px 20px',
          background:'linear-gradient(135deg,#0066ff,#0044bb)',
          border:'none', borderRadius:8,
          color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer'
        }}>+ Crear usuario</button>
      </div>

      {/* Mensajes */}
      {msgExito && (
        <div style={{
          marginBottom:16, padding:'10px 16px',
          background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.3)',
          borderRadius:8, color:'#10b981', fontSize:13
        }}>✓ {msgExito}</div>
      )}
      {msgError && (
        <div style={{
          marginBottom:16, padding:'10px 16px',
          background:'rgba(244,63,94,0.1)', border:'1px solid rgba(244,63,94,0.3)',
          borderRadius:8, color:'#f87171', fontSize:13
        }}>⚠ {msgError}</div>
      )}

      {/* Filtros */}
      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
        <input
          placeholder="Buscar por nombre o correo..."
          value={buscar} onChange={e => setBuscar(e.target.value)}
          style={{
            background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:8,
            padding:'8px 12px', color:'#fff', fontSize:13, outline:'none', flex:1, minWidth:200
          }}
        />
        <select value={filtroRol} onChange={e => setFiltroRol(e.target.value)} style={{
          background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:8,
          padding:'8px 12px', color: filtroRol ? '#fff' : '#4a6a8a', fontSize:13, cursor:'pointer'
        }}>
          <option value="">Todos los roles</option>
          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      {/* Lista por grupos */}
      {loading ? (
        <div style={{ color:'#4a6a8a', fontSize:13 }}>Cargando usuarios...</div>
      ) : grupos.length === 0 ? (
        <div style={{ color:'#4a6a8a', fontSize:13 }}>No se encontraron usuarios.</div>
      ) : (
        grupos.map(grupo => (
          <div key={grupo.value} style={{ marginBottom:24 }}>
            <div style={{
              display:'flex', alignItems:'center', gap:8,
              marginBottom:10
            }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:grupo.color }} />
              <span style={{ color:'#8aabcc', fontSize:11, fontWeight:600,
                textTransform:'uppercase', letterSpacing:'0.08em' }}>
                {grupo.label} ({grupo.usuarios.length})
              </span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {grupo.usuarios.map(u => (
                <div key={u.id} style={{
                  background:'#0d1a35', border:'1px solid #1a2f52',
                  borderRadius:10, padding:'14px 18px',
                  display:'flex', alignItems:'center', gap:14
                }}>
                  {/* Avatar */}
                  <div style={{
                    width:38, height:38, borderRadius:'50%',
                    background: grupo.color + '33',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    color: grupo.color, fontWeight:600, fontSize:14, flexShrink:0
                  }}>
                    {(u.nombre?.[0] || '?').toUpperCase()}
                    {(u.apellido?.[0] || '').toUpperCase()}
                  </div>

                  {/* Info */}
                  <div style={{ flex:1 }}>
                    <div style={{ color:'#fff', fontSize:14, fontWeight:500 }}>
                      {u.nombre} {u.apellido}
                    </div>
                    <div style={{ color:'#4a6a8a', fontSize:12, marginTop:2 }}>{u.email}</div>
                  </div>

                  {/* Rol badge */}
                  <RolBadge rol={u.rol} />

                  {/* Acciones */}
                  <div style={{ display:'flex', gap:6 }}>
                    <button
                      onClick={() => {
                        setModalEditar(u)
                        setFormEditar({ nombre: u.nombre || '', apellido: u.apellido || '', rol: u.rol })
                        setMsgError('')
                      }}
                      style={{
                        background:'#1a2f52', border:'none', borderRadius:6,
                        color:'#8aabcc', fontSize:12, padding:'6px 12px', cursor:'pointer'
                      }}>
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => { setModalPass({ id: u.id, email: u.email }); setMsgError('') }}
                      style={{
                        background:'#1a2f52', border:'none', borderRadius:6,
                        color:'#8aabcc', fontSize:12, padding:'6px 12px', cursor:'pointer'
                      }}>
                      🔑 Contraseña
                    </button>
                    <button
                      onClick={() => eliminarUsuario(u.id, u.email)}
                      style={{
                        background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)',
                        borderRadius:6, color:'#ef4444', fontSize:12,
                        padding:'6px 12px', cursor:'pointer'
                      }}>
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* ===== MODAL CREAR USUARIO ===== */}
      {modalCrear && (
        <Modal titulo="Crear nuevo usuario" onClose={() => setModalCrear(false)}>
          <form onSubmit={crearUsuario}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px 14px' }}>
              <FormField label="Nombre *">
                <input required style={inp} value={formCrear.nombre}
                  onChange={e => setFormCrear(f=>({...f, nombre:e.target.value}))} />
              </FormField>
              <FormField label="Apellido *">
                <input required style={inp} value={formCrear.apellido}
                  onChange={e => setFormCrear(f=>({...f, apellido:e.target.value}))} />
              </FormField>
              <FormField label="Correo electrónico *" span={2}>
                <input required type="email" style={inp} value={formCrear.email}
                  onChange={e => setFormCrear(f=>({...f, email:e.target.value}))}
                  placeholder="nombre@icali.co" />
              </FormField>
              <FormField label="Contraseña *" span={2}>
                <input required type="password" style={inp} value={formCrear.password}
                  onChange={e => setFormCrear(f=>({...f, password:e.target.value}))}
                  placeholder="Mínimo 8 caracteres" minLength={8} />
              </FormField>
              <FormField label="Rol *" span={2}>
                <select required style={sel} value={formCrear.rol}
                  onChange={e => setFormCrear(f=>({...f, rol:e.target.value}))}>
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </FormField>
            </div>
            {msgError && <ErrMsg msg={msgError} />}
            <BotonesModal onCancel={() => setModalCrear(false)} saving={saving} labelOk="Crear usuario" />
          </form>
        </Modal>
      )}

      {/* ===== MODAL EDITAR USUARIO ===== */}
      {modalEditar && (
        <Modal titulo={`Editar: ${modalEditar.nombre} ${modalEditar.apellido}`} onClose={() => setModalEditar(null)}>
          <form onSubmit={editarUsuario}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px 14px' }}>
              <FormField label="Nombre *">
                <input required style={inp} value={formEditar.nombre}
                  onChange={e => setFormEditar(f=>({...f, nombre:e.target.value}))} />
              </FormField>
              <FormField label="Apellido *">
                <input required style={inp} value={formEditar.apellido}
                  onChange={e => setFormEditar(f=>({...f, apellido:e.target.value}))} />
              </FormField>
              <FormField label="Rol *" span={2}>
                <select required style={sel} value={formEditar.rol}
                  onChange={e => setFormEditar(f=>({...f, rol:e.target.value}))}>
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </FormField>
            </div>
            <div style={{ marginTop:12, padding:'10px 14px',
              background:'rgba(59,130,246,0.08)', border:'1px solid rgba(59,130,246,0.2)',
              borderRadius:8, color:'#8aabcc', fontSize:12 }}>
              📧 {modalEditar.email}
            </div>
            {msgError && <ErrMsg msg={msgError} />}
            <BotonesModal onCancel={() => setModalEditar(null)} saving={saving} labelOk="Guardar cambios" />
          </form>
        </Modal>
      )}

      {/* ===== MODAL CAMBIAR CONTRASEÑA ===== */}
      {modalPass && (
        <Modal titulo="Cambiar contraseña" onClose={() => { setModalPass(null); setNuevaPass(''); setConfirmaPass('') }}>
          <form onSubmit={cambiarPassword}>
            <div style={{ marginBottom:16, padding:'10px 14px',
              background:'rgba(59,130,246,0.08)', border:'1px solid rgba(59,130,246,0.2)',
              borderRadius:8, color:'#8aabcc', fontSize:12 }}>
              📧 {modalPass.email}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <FormField label="Nueva contraseña *">
                <input required type="password" style={inp} value={nuevaPass}
                  onChange={e => setNuevaPass(e.target.value)}
                  placeholder="Mínimo 8 caracteres" minLength={8} />
              </FormField>
              <FormField label="Confirmar contraseña *">
                <input required type="password" style={inp} value={confirmaPass}
                  onChange={e => setConfirmaPass(e.target.value)}
                  placeholder="Repite la contraseña" />
              </FormField>
            </div>
            {msgError && <ErrMsg msg={msgError} />}
            <BotonesModal
              onCancel={() => { setModalPass(null); setNuevaPass(''); setConfirmaPass('') }}
              saving={saving} labelOk="Cambiar contraseña" />
          </form>
        </Modal>
      )}
    </div>
  )
}

/* ── Componentes auxiliares ── */
function Modal({ titulo, onClose, children }) {
  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.75)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000
    }}>
      <div style={{
        background:'#0d1a35', border:'1px solid #1a2f52',
        borderRadius:14, padding:28, width:'100%', maxWidth:480,
        fontFamily:"'DM Sans', system-ui", maxHeight:'90vh', overflow:'auto'
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <h3 style={{ color:'#fff', margin:0, fontSize:16 }}>{titulo}</h3>
          <button onClick={onClose} style={{
            background:'transparent', border:'none', color:'#4a6a8a',
            fontSize:20, cursor:'pointer', lineHeight:1
          }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function FormField({ label, children, span }) {
  return (
    <div style={{ gridColumn: span ? `span ${span}` : undefined }}>
      <label style={{
        display:'block', color:'#8aabcc', fontSize:11, fontWeight:500,
        textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:5
      }}>{label}</label>
      {children}
    </div>
  )
}

function ErrMsg({ msg }) {
  return (
    <div style={{
      marginTop:12, padding:'10px 14px',
      background:'rgba(244,63,94,0.1)', border:'1px solid rgba(244,63,94,0.3)',
      borderRadius:8, color:'#f87171', fontSize:13
    }}>⚠ {msg}</div>
  )
}

function BotonesModal({ onCancel, saving, labelOk }) {
  return (
    <div style={{ display:'flex', gap:10, marginTop:20, justifyContent:'flex-end' }}>
      <button type="button" onClick={onCancel} style={{
        padding:'9px 20px', background:'transparent',
        border:'1px solid #1a2f52', borderRadius:8,
        color:'#6b8ab0', fontSize:13, cursor:'pointer'
      }}>Cancelar</button>
      <button type="submit" disabled={saving} style={{
        padding:'9px 24px',
        background: saving ? '#1e3058' : 'linear-gradient(135deg,#0066ff,#0044bb)',
        border:'none', borderRadius:8,
        color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer'
      }}>{saving ? 'Guardando...' : labelOk}</button>
    </div>
  )
}
