import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { PrivateRoute } from './components/PrivateRoute'
import Login       from './pages/Login'
import Dashboard   from './pages/Dashboard'
import SubirDatos  from './pages/SubirDatos'
import './styles/global.css'

// Placeholders para módulos futuros
const Placeholder = ({ title }) => (
  <div>
    <div className="topbar">
      <div style={{ fontWeight:600, fontSize:15 }}>{title}</div>
    </div>
    <div className="page-body">
      <div className="card">
        <div className="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14l-5-4.87 6.91-1.01L12 2z"/>
          </svg>
          <p style={{ fontSize:15, fontWeight:500, marginBottom:6 }}>Módulo en construcción</p>
          <p>Este módulo estará disponible en la próxima versión del portal.</p>
        </div>
      </div>
    </div>
  </div>
)

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/" element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          } />

          <Route path="/ventas" element={
            <PrivateRoute>
              <Placeholder title="Ventas y equipos" />
            </PrivateRoute>
          } />

          <Route path="/comisiones" element={
            <PrivateRoute>
              <Placeholder title="Comisiones" />
            </PrivateRoute>
          } />

          <Route path="/cuadre" element={
            <PrivateRoute adminOnly>
              <Placeholder title="Cuadre diario" />
            </PrivateRoute>
          } />

          <Route path="/pendientes" element={
            <PrivateRoute>
              <Placeholder title="Pendientes" />
            </PrivateRoute>
          } />

          <Route path="/medios-pago" element={
            <PrivateRoute adminOnly>
              <Placeholder title="Medios de pago" />
            </PrivateRoute>
          } />

          <Route path="/contraentregas" element={
            <PrivateRoute>
              <Placeholder title="Contraentregas" />
            </PrivateRoute>
          } />

          <Route path="/horas-extras" element={
            <PrivateRoute>
              <Placeholder title="Horas extras" />
            </PrivateRoute>
          } />

          <Route path="/equipo" element={
            <PrivateRoute adminOnly>
              <Placeholder title="Equipo" />
            </PrivateRoute>
          } />

          <Route path="/subir-datos" element={
            <PrivateRoute adminOnly>
              <SubirDatos />
            </PrivateRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
