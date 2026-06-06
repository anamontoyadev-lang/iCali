import Usuarios from './pages/Usuarios'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import Login       from './pages/Login'
import Layout      from './components/Layout'
import Dashboard   from './pages/Dashboard'
import Ventas      from './pages/Ventas'
import NuevaVenta  from './pages/NuevaVenta'
import Despachos   from './pages/Despachos'
import Retomas     from './pages/Retomas'
import Financieras from './pages/Financieras'
import Extractos   from './pages/Extractos'
import Reportes    from './pages/Reportes'
import Proveedores from './pages/Proveedores'
import Inventario  from './pages/Inventario'
import NotificacionesInventario from './components/NotificacionesInventario'

function ProtectedRoute({ children, roles }) {
  const { session, perfil, loading } = useAuth()
  if (loading) return (
    <div style={{
      height:'100vh', display:'flex', alignItems:'center',
      justifyContent:'center', background:'#0a0f1e', color:'#fff',
      fontFamily:'system-ui', fontSize:14
    }}>
      Cargando...
    </div>
  )
  if (!session) return <Navigate to="/login" replace />
  if (roles && perfil && !roles.includes(perfil.rol)) return <Navigate to="/" replace />
  return children
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={
            <ProtectedRoute><Layout /></ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="ventas" element={<Ventas />} />
            <Route path="ventas/nueva" element={<NuevaVenta />} />
            <Route path="despachos" element={<Despachos />} />
            <Route path="retomas" element={<Retomas />} />
            <Route path="inventario" element={<Inventario />} />
            <Route path="financieras" element={
              <ProtectedRoute roles={['admin','lider_admin','contadora','lider_comercial']}>
                <Financieras />
              </ProtectedRoute>
            } />
            <Route path="extractos" element={
              <ProtectedRoute roles={['admin','lider_admin','contadora']}>
                <Extractos />
              </ProtectedRoute>
            } />
            <Route path="proveedores" element={<Proveedores />} />
            <Route path="reportes" element={<Reportes />} />
            <Route path="usuarios" element={
              <ProtectedRoute roles={['admin']}>
                <Usuarios />
              </ProtectedRoute>
            } />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <NotificacionesInventario />
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
