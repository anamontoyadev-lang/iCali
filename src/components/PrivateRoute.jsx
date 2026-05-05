import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Sidebar from './Sidebar'

export function PrivateRoute({ children, adminOnly = false }) {
  const { session, perfil, loading, isAdmin } = useAuth()

  if (loading) return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div className="spinner" style={{ width:32, height:32 }} />
    </div>
  )

  if (!session) return <Navigate to="/login" replace />
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />

  return (
    <div className="layout">
      <Sidebar />
      <div className="main-content">
        {children}
      </div>
    </div>
  )
}
