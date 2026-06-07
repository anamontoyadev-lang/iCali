import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'

const ROLES_LABEL = {
  admin:              'Administrador',
  lider_comercial:    'Líder Comercial',
  lider_admin:        'Líder Administrativo',
  contadora:          'Contadora',
  asesor_mostrador:   'Asesor Mostrador',
  asesor_call_center: 'Asesor Call Center',
  garantias:          'Garantías y Reparaciones',
  laboratorio:        'Laboratorio',
}

export default function Layout() {
  const { perfil, rol, esAdmin, esLiderAdmin, esLiderCom, esContadora,
          puedeVerFinancieras, puedeVerDespachos } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  async function logout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  // Nav items completos
  const navItems = [
    { to:'/',             label:'Dashboard',   icon: <IconDash />,      show: true },
    { to:'/ventas',       label:'Ventas',      icon: <IconVentas />,    show: true },
    { to:'/despachos',    label:'Despachos',   icon: <IconDesp />,      show: puedeVerDespachos || esAdmin || esLiderAdmin || esLiderCom },
    { to:'/laboratorio',  label:'Laboratorio', icon: <IconLab />,       show: true },
    { to:'/proveedores',  label:'Proveedores', icon: <IconProv />,      show: true },
    { to:'/inventario',   label:'Inventario',  icon: <IconInv />,       show: true },
    { to:'/financieras',  label:'Financieras', icon: <IconFin />,       show: puedeVerFinancieras },
    { to:'/extractos',    label:'Extractos',   icon: <IconDoc />,       show: puedeVerFinancieras },
    { to:'/reportes',     label:'Reportes',    icon: <IconReport />,    show: esAdmin || esLiderAdmin || esLiderCom || esContadora },
    { to:'/usuarios',     label:'Usuarios',    icon: <IconUsers />,     show: esAdmin },
  ].filter(i => i.show)

  // Bottom nav — 5 items más importantes para móvil
  const bottomItems = [
    { to:'/',            label:'Inicio',   icon:'🏠' },
    { to:'/ventas',      label:'Ventas',   icon:'🛍️' },
    { to:'/despachos',   label:'Despacho', icon:'🚚', show: puedeVerDespachos||esAdmin||esLiderAdmin||esLiderCom },
    { to:'/laboratorio', label:'Lab',      icon:'🔬' },
    { to:'/reportes',    label:'Reportes', icon:'📊', show: esAdmin||esLiderAdmin||esLiderCom||esContadora },
  ].filter(i => i.show !== false)

  const navStyle = ({ isActive }) => ({
    display:'flex', alignItems:'center', gap:10,
    padding:'10px 14px', borderRadius:8,
    color: isActive ? '#fff' : '#6b8ab0',
    background: isActive ? '#1a2f52' : 'transparent',
    textDecoration:'none', fontSize:13, fontWeight: isActive ? 600 : 400,
    transition:'all 0.15s', marginBottom:2
  })

  const SectionLabel = ({ txt }) => (
    <div style={{ color:'#3a5a7a', fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em', padding:'12px 4px 4px' }}>{txt}</div>
  )

  const SideNav = ({ onNav }) => (
    <div style={{ display:'flex', flexDirection:'column' }}>
      <SectionLabel txt="Principal" />
      {navItems.slice(0,6).map(item => (
        <NavLink key={item.to} to={item.to} end={item.to==='/'} style={navStyle} onClick={onNav}>
          {item.icon} {item.label}
        </NavLink>
      ))}
      {puedeVerFinancieras && <>
        <SectionLabel txt="Financiero" />
        {navItems.filter(i=>['/financieras','/extractos'].includes(i.to)).map(item => (
          <NavLink key={item.to} to={item.to} style={navStyle} onClick={onNav}>
            {item.icon} {item.label}
          </NavLink>
        ))}
      </>}
      <SectionLabel txt="Análisis" />
      {navItems.filter(i=>i.to==='/reportes').map(item => (
        <NavLink key={item.to} to={item.to} style={navStyle} onClick={onNav}>
          {item.icon} {item.label}
        </NavLink>
      ))}
      {esAdmin && <>
        <SectionLabel txt="Admin" />
        {navItems.filter(i=>i.to==='/usuarios').map(item => (
          <NavLink key={item.to} to={item.to} style={navStyle} onClick={onNav}>
            {item.icon} {item.label}
          </NavLink>
        ))}
      </>}
    </div>
  )

  const UserFooter = () => (
    <div style={{ padding:'14px 16px', borderTop:'1px solid #1a2f52' }}>
      <div style={{ color:'#fff', fontSize:13, fontWeight:500, marginBottom:2 }}>{perfil?.nombre || 'Usuario'}</div>
      <div style={{ color:'#4a6a8a', fontSize:11, marginBottom:10 }}>{ROLES_LABEL[rol] || rol}</div>
      <button onClick={logout} style={{ width:'100%', padding:'7px', background:'transparent', border:'1px solid #1e3058', borderRadius:6, color:'#6b8ab0', fontSize:12, cursor:'pointer' }}>
        Cerrar sesión
      </button>
    </div>
  )

  // ── MÓVIL ──
  if (isMobile) {
    const isActive = (path) => path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
    return (
      <div style={{ display:'flex', flexDirection:'column', minHeight:'100vh', background:'#060d1f', fontFamily:"'DM Sans', system-ui" }}>

        {/* Topbar */}
        <div style={{
          background:'#0a1628', borderBottom:'1px solid #1a2f52',
          padding:'0 16px', height:52,
          display:'flex', alignItems:'center', justifyContent:'space-between',
          position:'sticky', top:0, zIndex:100
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <img src="/logo192.png" alt="iCali" style={{ width:32, height:32, borderRadius:8, objectFit:'cover' }} />
            <div>
              <div style={{ color:'#fff', fontWeight:700, fontSize:15, lineHeight:1 }}>iCali</div>
              <div style={{ color:'#4a6a8a', fontSize:10 }}>Portal Comercial</div>
            </div>
          </div>
          <button onClick={() => setMenuOpen(true)} style={{ background:'transparent', border:'none', color:'#8aabcc', fontSize:24, cursor:'pointer', padding:'4px 8px', lineHeight:1 }}>☰</button>
        </div>

        {/* Drawer menú completo */}
        {menuOpen && (
          <div style={{ position:'fixed', inset:0, zIndex:999, display:'flex' }}>
            <div onClick={() => setMenuOpen(false)} style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.65)' }} />
            <div style={{
              position:'relative', zIndex:1, width:260,
              background:'#0a1628', borderRight:'1px solid #1a2f52',
              display:'flex', flexDirection:'column', height:'100vh',
              overflowY:'auto', animation:'slideIn 0.2s ease'
            }}>
              <div style={{ padding:'14px 16px', borderBottom:'1px solid #1a2f52', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <img src="/logo192.png" alt="iCali" style={{ width:28, height:28, borderRadius:7, objectFit:'cover' }} />
                  <span style={{ color:'#fff', fontWeight:700, fontSize:14 }}>iCali Portal</span>
                </div>
                <button onClick={() => setMenuOpen(false)} style={{ background:'transparent', border:'none', color:'#6b8ab0', fontSize:20, cursor:'pointer' }}>✕</button>
              </div>
              <nav style={{ padding:'8px 10px', flex:1 }}>
                <SideNav onNav={() => setMenuOpen(false)} />
              </nav>
              <UserFooter />
            </div>
          </div>
        )}

        {/* Contenido — padding bottom para la bottom nav */}
        <main style={{ flex:1, overflow:'auto', paddingBottom:64 }}>
          <Outlet />
        </main>

        {/* Bottom Navigation */}
        <div style={{
          position:'fixed', bottom:0, left:0, right:0,
          background:'#0a1628', borderTop:'1px solid #1a2f52',
          display:'flex', height:58, zIndex:100,
          paddingBottom:'env(safe-area-inset-bottom)',
        }}>
          {bottomItems.map(item => {
            const active = isActive(item.to)
            return (
              <button key={item.to} onClick={() => navigate(item.to)} style={{
                flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                gap:2, background:'transparent', border:'none', cursor:'pointer',
                color: active ? '#0066ff' : '#4a6a8a',
                transition:'color .15s',
              }}>
                <span style={{ fontSize:18, lineHeight:1 }}>{item.icon}</span>
                <span style={{ fontSize:9, fontWeight: active?700:400, letterSpacing:'.02em' }}>{item.label}</span>
                {active && <div style={{ position:'absolute', bottom:0, width:24, height:2, background:'#0066ff', borderRadius:2 }} />}
              </button>
            )
          })}
        </div>

        <style>{"@keyframes slideIn { from { transform: translateX(-100%) } to { transform: translateX(0) } }"}</style>
      </div>
    )
  }

  // ── DESKTOP ──
  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#060d1f', fontFamily:"'DM Sans', system-ui" }}>
      <aside style={{ width:220, flexShrink:0, background:'#0a1628', borderRight:'1px solid #1a2f52', display:'flex', flexDirection:'column', position:'sticky', top:0, height:'100vh', overflowY:'auto' }}>
        <div style={{ padding:'20px 20px 16px', borderBottom:'1px solid #1a2f52' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <img src="/logo192.png" alt="iCali" style={{ width:36, height:36, borderRadius:9, objectFit:'cover', flexShrink:0 }} />
            <div>
              <div style={{ color:'#fff', fontWeight:700, fontSize:15 }}>iCali</div>
              <div style={{ color:'#4a6a8a', fontSize:11 }}>Portal Comercial</div>
            </div>
          </div>
        </div>
        <nav style={{ padding:'12px 10px', flex:1, overflowY:'auto' }}>
          <SideNav onNav={() => {}} />
        </nav>
        <UserFooter />
      </aside>
      <main style={{ flex:1, overflow:'auto' }}>
        <Outlet />
      </main>
    </div>
  )
}

// ── Iconos SVG ──
function IconDash()   { return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> }
function IconVentas() { return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg> }
function IconDesp()   { return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> }
function IconLab()    { return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v11m0 0H3m6 0h12m0 0V9"/></svg> }
function IconProv()   { return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> }
function IconInv()    { return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M5 8h14M5 8a2 2 0 1 0 0-4h14a2 2 0 1 0 0 4M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8"/></svg> }
function IconFin()    { return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> }
function IconDoc()    { return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> }
function IconReport() { return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> }
function IconUsers()  { return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg> }
