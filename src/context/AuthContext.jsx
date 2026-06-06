import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession]   = useState(null)
  const [perfil,  setPerfil]    = useState(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) fetchPerfil(data.session.user.id)
      else setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchPerfil(session.user.id)
      else { setPerfil(null); setLoading(false) }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function fetchPerfil(userId) {
    const { data } = await supabase
      .from('perfiles')
      .select('*')
      .eq('id', userId)
      .single()
    setPerfil(data)
    setLoading(false)
  }

  async function login(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error
  }

  async function logout() {
    await supabase.auth.signOut()
    setPerfil(null)
  }

  const rol = perfil?.rol || ''

  const esAdmin         = rol === 'admin'
  const esLiderAdmin    = rol === 'lider_admin'
  const esLiderCom      = rol === 'lider_comercial'
  const esContadora     = rol === 'contadora'
  const esAsesor        = rol === 'asesor' || rol === 'asesor_mostrador' || rol === 'asesor_call_center'
  const esAsesorCall    = rol === 'asesor_call_center' || rol === 'asesor'
  const esAsesorMostrador = rol === 'asesor_mostrador'
  const esGarantias     = rol === 'garantias'

  // Compat con código viejo
  const isAdmin  = esAdmin
  const isAsesor = esAsesor

  return (
    <AuthContext.Provider value={{
      session, perfil, loading,
      esAdmin, esLiderAdmin, esLiderCom, esContadora,
      esAsesor, esAsesorCall, esAsesorMostrador, esGarantias,
      isAdmin, isAsesor,
      login, logout
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
