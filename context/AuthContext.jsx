import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [perfil, setPerfil]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchPerfil(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session)
      if (session) fetchPerfil(session.user.id)
      else { setPerfil(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function fetchPerfil(uid) {
    const { data } = await supabase.from('perfiles').select('*').eq('id', uid).single()
    setPerfil(data)
    setLoading(false)
  }

  const rol = perfil?.rol ?? null

  // Helpers de permisos
  const esAdmin        = rol === 'admin'
  const esLiderAdmin   = ['admin','lider_admin'].includes(rol)
  const esLiderCom     = ['admin','lider_comercial'].includes(rol)
  const esContadora    = ['admin','contadora'].includes(rol)
  const esAsesor       = ['asesor_mostrador','asesor_call_center'].includes(rol)
  const puedeVerFinancieras = ['admin','lider_admin','contadora','lider_comercial'].includes(rol)
  const puedeVerDespachos   = ['admin','lider_admin','lider_comercial','contadora',
                               'asesor_mostrador','asesor_call_center'].includes(rol)

  return (
    <AuthContext.Provider value={{
      session, perfil, rol, loading,
      esAdmin, esLiderAdmin, esLiderCom, esContadora, esAsesor,
      puedeVerFinancieras, puedeVerDespachos
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
