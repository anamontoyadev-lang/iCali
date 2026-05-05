import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const { login } = useAuth()
  const navigate   = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const err = await login(email, password)
    if (err) { setError('Email o contraseña incorrectos'); setLoading(false) }
    else navigate('/')
  }

  return (
    <div style={{
      minHeight:'100vh', background:'var(--bg)',
      display:'flex', alignItems:'center', justifyContent:'center',
      padding:'1rem'
    }}>
      <div style={{ width:'100%', maxWidth:400 }}>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:'2rem' }}>
          <div style={{
            width:52, height:52, background:'var(--dk)', borderRadius:14,
            display:'inline-flex', alignItems:'center', justifyContent:'center',
            marginBottom:12
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" fill="white" opacity=".9"/>
            </svg>
          </div>
          <div style={{ fontSize:22, fontWeight:700, color:'var(--dk)', letterSpacing:'-.02em' }}>
            iCali Portal
          </div>
          <div style={{ fontSize:13, color:'var(--muted)', marginTop:4 }}>
            Sistema comercial interno
          </div>
        </div>

        {/* Formulario */}
        <div className="card">
          <form onSubmit={handleSubmit}>
            {error && <div className="alert alert-danger">{error}</div>}

            <div className="form-group">
              <label className="label">Correo electrónico</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@icali.co"
                required
                autoFocus
              />
            </div>

            <div className="form-group" style={{ marginBottom:'1.5rem' }}>
              <label className="label">Contraseña</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width:'100%', justifyContent:'center', padding:'10px' }}
              disabled={loading}
            >
              {loading
                ? <span className="spinner" style={{ width:16, height:16 }} />
                : 'Ingresar'}
            </button>
          </form>
        </div>

        <p style={{ textAlign:'center', fontSize:12, color:'var(--hint)', marginTop:'1.5rem' }}>
          ¿No tienes cuenta? Pide acceso al administrador.
        </p>
      </div>
    </div>
  )
}
