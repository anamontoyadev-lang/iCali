import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Correo o contraseña incorrectos')
    setLoading(false)
  }

  return (
    <div style={{
      minHeight:'100vh', display:'flex', alignItems:'center',
      justifyContent:'center', background:'#060d1f',
      fontFamily:"'DM Sans', system-ui, sans-serif"
    }}>
      <div style={{
        background:'#0d1a35', border:'1px solid #1e3058',
        borderRadius:16, padding:'48px 40px', width:'100%', maxWidth:400
      }}>
        <div style={{ textAlign:'center', marginBottom:36 }}>
          <div style={{
            display:'inline-flex', alignItems:'center', justifyContent:'center',
            width:56, height:56, borderRadius:14,
            background:'linear-gradient(135deg,#0066ff,#0044bb)', marginBottom:16
          }}>
            <span style={{ fontSize:24, color:'#fff', fontWeight:700 }}>i</span>
          </div>
          <h1 style={{ color:'#fff', fontSize:22, fontWeight:600, margin:'0 0 4px' }}>
            iCali Portal
          </h1>
          <p style={{ color:'#5a7aaa', fontSize:13, margin:0 }}>
            Sistema de gestión comercial
          </p>
        </div>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom:16 }}>
            <label style={{ display:'block', color:'#8aabcc', fontSize:12,
              fontWeight:500, marginBottom:6, textTransform:'uppercase',
              letterSpacing:'0.06em' }}>Correo</label>
            <input type="email" value={email} required
              onChange={e => setEmail(e.target.value)}
              style={{ width:'100%', boxSizing:'border-box',
                background:'#0a1628', border:'1px solid #1e3058',
                borderRadius:8, padding:'10px 14px', color:'#fff', fontSize:14 }} />
          </div>
          <div style={{ marginBottom:24 }}>
            <label style={{ display:'block', color:'#8aabcc', fontSize:12,
              fontWeight:500, marginBottom:6, textTransform:'uppercase',
              letterSpacing:'0.06em' }}>Contraseña</label>
            <input type="password" value={password} required
              onChange={e => setPassword(e.target.value)}
              style={{ width:'100%', boxSizing:'border-box',
                background:'#0a1628', border:'1px solid #1e3058',
                borderRadius:8, padding:'10px 14px', color:'#fff', fontSize:14 }} />
          </div>
          {error && (
            <div style={{ background:'rgba(255,60,60,0.1)',
              border:'1px solid rgba(255,60,60,0.25)',
              borderRadius:8, padding:'10px 14px',
              color:'#ff6b6b', fontSize:13, marginBottom:16 }}>{error}</div>
          )}
          <button type="submit" disabled={loading} style={{
            width:'100%', padding:'12px',
            background: loading ? '#1e3058' : 'linear-gradient(135deg,#0066ff,#0044bb)',
            border:'none', borderRadius:8, color:'#fff',
            fontSize:15, fontWeight:600, cursor: loading ? 'not-allowed' : 'pointer'
          }}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}