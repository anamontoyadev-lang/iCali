import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'

const ROLES_LABEL = {
  admin:              'Administrador',
  lider_comercial:    'Líder Comercial',
  lider_admin:        'Líder Administrativo',
  contadora:          'Contadora',
  asesor_mostrador:   'Asesor Mostrador',
  asesor_call_center: 'Asesor Call Center',
  garantias:          'Garantías',
  laboratorio:        'Laboratorio',
}

export default function Layout() {
  const { perfil, rol, esAdmin, puedeVerFinancieras, puedeVerDespachos } = useAuth()
  const navigate    = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  async function logout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const navStyle = ({ isActive }) => ({
    display:'flex', alignItems:'center', gap:10,
    padding:'10px 14px', borderRadius:8,
    color: isActive ? '#fff' : '#6b8ab0',
    background: isActive ? '#1a2f52' : 'transparent',
    textDecoration:'none', fontSize:13, fontWeight: isActive ? 600 : 400,
    transition:'all 0.15s'
  })

  const sectionLabel = (txt) => (
    <div style={{ color:'#3a5a7a', fontSize:10, fontWeight:600,
      textTransform:'uppercase', letterSpacing:'0.08em',
      padding:'12px 4px 6px', marginTop:4 }}>{txt}</div>
  )

  const NavItems = ({ onNav }) => (
    <>
      {sectionLabel('Principal')}
      <NavLink to="/" end style={navStyle} onClick={onNav}>
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
        Dashboard
      </NavLink>
      <NavLink to="/ventas" style={navStyle} onClick={onNav}>
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
        Ventas
      </NavLink>
      {puedeVerDespachos && (
        <NavLink to="/despachos" style={navStyle} onClick={onNav}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
          Despachos
        </NavLink>
      )}
      <NavLink to="/retomas" style={navStyle} onClick={onNav}>
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.6"/></svg>
        Retomas
      </NavLink>
      <NavLink to="/proveedores" style={navStyle} onClick={onNav}>
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
        Proveedores
      </NavLink>
      <NavLink to="/inventario" style={navStyle} onClick={onNav}>
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M5 8h14M5 8a2 2 0 1 0 0-4h14a2 2 0 1 0 0 4M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8"/></svg>
        Inventario
      </NavLink>

      {puedeVerFinancieras && <>
        {sectionLabel('Financiero')}
        <NavLink to="/financieras" style={navStyle} onClick={onNav}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          Financieras
        </NavLink>
        <NavLink to="/extractos" style={navStyle} onClick={onNav}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>
          Extractos
        </NavLink>
      </>}

      {sectionLabel('Análisis')}
      <NavLink to="/reportes" style={navStyle} onClick={onNav}>
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
        Reportes
      </NavLink>

      {esAdmin && <>
        {sectionLabel('Admin')}
        <NavLink to="/usuarios" style={navStyle} onClick={onNav}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          Usuarios
        </NavLink>
      </>}
    </>
  )

  const UserFooter = () => (
    <div style={{ padding:'16px 20px', borderTop:'1px solid #1a2f52' }}>
      <div style={{ marginBottom:10 }}>
        <div style={{ color:'#fff', fontSize:13, fontWeight:500 }}>
          {perfil?.nombre || 'Usuario'}
        </div>
        <div style={{ color:'#4a6a8a', fontSize:11, marginTop:2 }}>
          {ROLES_LABEL[rol] || rol}
        </div>
      </div>
      <button onClick={logout} style={{
        width:'100%', padding:'7px',
        background:'transparent', border:'1px solid #1e3058',
        borderRadius:6, color:'#6b8ab0', fontSize:12, cursor:'pointer'
      }}>Cerrar sesión</button>
    </div>
  )

  return (
    <div style={{
      display:'flex', minHeight:'100vh',
      background:'#060d1f', fontFamily:"'DM Sans', system-ui, sans-serif"
    }}>

      {/* ── SIDEBAR DESKTOP (oculto en móvil) ── */}
      <aside style={{
        width:220, flexShrink:0,
        background:'#0a1628', borderRight:'1px solid #1a2f52',
        display:'flex', flexDirection:'column',
        position:'sticky', top:0, height:'100vh', overflow:'auto'
      }}
        className="sidebar-desktop">
        <div style={{ padding:'20px 20px 16px', borderBottom:'1px solid #1a2f52' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{
              width:32, height:32, borderRadius:8,
              background:'linear-gradient(135deg,#0066ff,#0044bb)',
              display:'flex', alignItems:'center', justifyContent:'center',
              color:'#fff', fontWeight:700, fontSize:16, flexShrink:0
            }}>i</div>
            <div>
              <div style={{ color:'#fff', fontWeight:600, fontSize:14 }}>iCali</div>
              <div style={{ color:'#4a6a8a', fontSize:11 }}>Portal Comercial</div>
            </div>
          </div>
        </div>
        <nav style={{ padding:'12px 10px', flex:1, overflow:'auto' }}>
          <NavItems onNav={() => {}} />
        </nav>
        <UserFooter />
      </aside>

      {/* ── LAYOUT MÓVIL ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>

        {/* Topbar móvil */}
        <header style={{
          background:'#0a1628', borderBottom:'1px solid #1a2f52',
          padding:'12px 16px', display:'flex',
          alignItems:'center', justifyContent:'space-between'
        }} className="topbar-mobile">
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{
              width:28, height:28, borderRadius:7,
              background:'linear-gradient(135deg,#0066ff,#0044bb)',
              display:'flex', alignItems:'center', justifyContent:'center',
              color:'#fff', fontWeight:700, fontSize:14
            }}>i</div>
            <span style={{ color:'#fff', fontWeight:600, fontSize:14 }}>iCali Portal</span>
          </div>
          <button onClick={() => setMenuOpen(!menuOpen)} style={{
            background:'transparent', border:'none',
            color:'#8aabcc', fontSize:22, cursor:'pointer',
            padding:'4px 8px', lineHeight:1
          }}>
            {menuOpen ? '✕' : '☰'}
          </button>
        </header>

        {/* Drawer menú móvil */}
        {menuOpen && (
          <div style={{
            position:'fixed', inset:0, zIndex:999,
            display:'flex'
          }}>
            {/* Overlay */}
            <div onClick={() => setMenuOpen(false)} style={{
              position:'absolute', inset:0,
              background:'rgba(0,0,0,0.6)'
            }} />
            {/* Panel */}
            <div style={{
              position:'relative', zIndex:1000,
              width:260, background:'#0a1628',
              borderRight:'1px solid #1a2f52',
              display:'flex', flexDirection:'column',
              height:'100vh', overflow:'auto'
            }}>
              <div style={{ padding:'16px 20px', borderBottom:'1px solid #1a2f52',
                display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{
                    width:28, height:28, borderRadius:7,
                    background:'linear-gradient(135deg,#0066ff,#0044bb)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    color:'#fff', fontWeight:700, fontSize:14
                  }}>i</div>
                  <span style={{ color:'#fff', fontWeight:600, fontSize:14 }}>iCali Portal</span>
                </div>
                <button onClick={() => setMenuOpen(false)} style={{
                  background:'transparent', border:'none',
                  color:'#6b8ab0', fontSize:20, cursor:'pointer'
                }}>✕</button>
              </div>
              <nav style={{ padding:'12px 10px', flex:1 }}>
                <NavItems onNav={() => setMenuOpen(false)} />
              </nav>
              <UserFooter />
            </div>
          </div>
        )}

        {/* Contenido principal */}
        <main style={{ flex:1, overflow:'auto' }}>
          <Outlet />
        </main>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .sidebar-desktop { display: flex !important; }
          .topbar-mobile { display: none !important; }
        }
        @media (max-width: 767px) {
          .sidebar-desktop { display: none !important; }
          .topbar-mobile { display: flex !important; }
        }
      `}</style>
    </div>
  )
}