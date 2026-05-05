import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const Icon = ({ path, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={path} />
  </svg>
)

const NAV_ITEMS = [
  {
    label: 'Principal',
    items: [
      { to: '/',            label: 'Dashboard',      icon: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z', adminOnly: false },
      { to: '/ventas',      label: 'Ventas',         icon: 'M3 3l18 0M3 3l4 13h10l4-13M9 17v4M15 17v4',           adminOnly: false },
      { to: '/comisiones',  label: 'Comisiones',     icon: 'M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14l-5-4.87 6.91-1.01L12 2z', adminOnly: false },
    ]
  },
  {
    label: 'Operativo',
    items: [
      { to: '/cuadre',        label: 'Cuadre diario',  icon: 'M9 7H6a2 2 0 00-2 2v9a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2h-3M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M9 7h6', adminOnly: true },
      { to: '/pendientes',    label: 'Pendientes',     icon: 'M12 8v4l3 3M12 2a10 10 0 100 20 10 10 0 000-20z',   adminOnly: false },
      { to: '/medios-pago',   label: 'Medios de pago', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z', adminOnly: true },
      { to: '/contraentregas',label: 'Contraentregas', icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 12h12l1-12',  adminOnly: false },
    ]
  },
  {
    label: 'Equipo',
    items: [
      { to: '/horas-extras',  label: 'Horas extras',   icon: 'M12 6v6l4 2M12 2a10 10 0 100 20 10 10 0 000-20z',   adminOnly: false },
      { to: '/equipo',        label: 'Equipo',          icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75', adminOnly: true },
      { to: '/subir-datos',   label: 'Subir Excel',     icon: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12', adminOnly: true },
    ]
  }
]

export default function Sidebar() {
  const { perfil, isAdmin, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const initials = perfil
    ? (perfil.nombre?.[0] || '') + (perfil.apellido?.[0] || perfil.nombre?.[1] || '')
    : '?'

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div style={{
        padding:'1.25rem 1rem 1rem',
        borderBottom:'1px solid rgba(255,255,255,.08)'
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{
            width:34, height:34, background:'rgba(255,255,255,.12)',
            borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white" opacity=".9">
              <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/>
            </svg>
          </div>
          <div>
            <div style={{ color:'white', fontWeight:700, fontSize:15, letterSpacing:'-.01em' }}>iCali</div>
            <div style={{ color:'rgba(255,255,255,.45)', fontSize:11 }}>Portal comercial</div>
          </div>
        </div>
      </div>

      {/* Navegación */}
      <nav style={{ flex:1, padding:'1rem 0', overflowY:'auto' }}>
        {NAV_ITEMS.map(group => (
          <div key={group.label} style={{ marginBottom:'1.5rem' }}>
            <div style={{
              fontSize:10, fontWeight:600, letterSpacing:'.08em',
              textTransform:'uppercase', color:'rgba(255,255,255,.3)',
              padding:'0 1rem', marginBottom:4
            }}>
              {group.label}
            </div>
            {group.items
              .filter(item => !item.adminOnly || isAdmin)
              .map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  style={({ isActive }) => ({
                    display:'flex', alignItems:'center', gap:10,
                    padding:'8px 1rem',
                    color: isActive ? 'white' : 'rgba(255,255,255,.55)',
                    background: isActive ? 'rgba(255,255,255,.1)' : 'transparent',
                    borderRadius:8, margin:'0 8px 2px',
                    fontSize:13, fontWeight: isActive ? 500 : 400,
                    transition:'all .15s'
                  })}
                >
                  <Icon path={item.icon} />
                  {item.label}
                </NavLink>
              ))
            }
          </div>
        ))}
      </nav>

      {/* Perfil usuario */}
      <div style={{
        padding:'1rem',
        borderTop:'1px solid rgba(255,255,255,.08)',
        display:'flex', alignItems:'center', gap:10
      }}>
        <div style={{
          width:32, height:32, borderRadius:'50%',
          background:'rgba(255,255,255,.15)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:12, fontWeight:600, color:'white', flexShrink:0
        }}>
          {initials.toUpperCase()}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ color:'white', fontSize:13, fontWeight:500,
            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
            {perfil?.nombre || 'Usuario'}
          </div>
          <div style={{ color:'rgba(255,255,255,.4)', fontSize:11 }}>
            {perfil?.rol === 'admin' ? 'Administrador' :
             perfil?.rol === 'administrativo' ? 'Administrativo' : 'Asesor'}
          </div>
        </div>
        <button
          onClick={handleLogout}
          title="Cerrar sesión"
          style={{
            background:'transparent', border:'none', padding:6,
            color:'rgba(255,255,255,.4)', cursor:'pointer', borderRadius:6,
            display:'flex', alignItems:'center',
            transition:'color .15s'
          }}
          onMouseOver={e => e.currentTarget.style.color='white'}
          onMouseOut={e => e.currentTarget.style.color='rgba(255,255,255,.4)'}
        >
          <Icon path="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </button>
      </div>
    </aside>
  )
}
