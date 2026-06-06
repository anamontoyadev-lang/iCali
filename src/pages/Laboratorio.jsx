import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const fmt = n => new Intl.NumberFormat('es-CO', {
  style:'currency', currency:'COP', maximumFractionDigits:0
}).format(n || 0)

// ── RETOMAS ──
const ESTADOS_RETOMA = {
  recibida:        { label:'Recibida',        color:'#94a3b8' },
  en_verificacion: { label:'Verificando',     color:'#f59e0b' },
  verificada:      { label:'Verificada',      color:'#3b82f6' },
  disponible:      { label:'Disponible',      color:'#10b981' },
  en_reparacion:   { label:'En reparación',   color:'#8b5cf6' },
  vendida:         { label:'Vendida',         color:'#6b7280' },
}

// ── GARANTÍAS Y REPARACIONES ──
const ESTADOS_GAR = {
  recibido:        { label:'Recibido',        color:'#94a3b8' },
  diagnostico:     { label:'Diagnóstico',     color:'#f59e0b' },
  en_reparacion:   { label:'En reparación',   color:'#8b5cf6' },
  esperando_parte: { label:'Esp. repuesto',   color:'#f97316' },
  listo:           { label:'Listo',           color:'#10b981' },
  entregado:       { label:'Entregado',       color:'#6b7280' },
  sin_solucion:    { label:'Sin solución',    color:'#ef4444' },
}

const TIPO_GAR = {
  garantia:    { label:'Garantía',      color:'#3b82f6' },
  reparacion:  { label:'Reparación',    color:'#8b5cf6' },
  diagnostico: { label:'Diagnóstico',   color:'#f59e0b' },
}

const inp = {
  background:'#0a1628', border:'1px solid #1a2f52', borderRadius:6,
  padding:'7px 10px', color:'#fff', fontSize:13, width:'100%', boxSizing:'border-box', outline:'none'
}

export default function Laboratorio() {
  const { esAdmin, esLiderAdmin, esLiderCom } = useAuth()
  const [tab, setTab] = useState('retomas')

  // ── RETOMAS state ──
  const [retomas, setRetomas]     = useState([])
  const [loadingR, setLoadingR]   = useState(true)
  const [editandoR, setEditandoR] = useState(null)
  const [editFormR, setEditFormR] = useState({})
  const [filtroR, setFiltroR]     = useState('')

  // ── GARANTÍAS state ──
  const [garantias, setGarantias]   = useState([])
  const [loadingG, setLoadingG]     = useState(true)
  const [showFormG, setShowFormG]   = useState(false)
  const [editandoG, setEditandoG]   = useState(null)
  const [editFormG, setEditFormG]   = useState({})
  const [filtroG, setFiltroG]       = useState('')
  const [formG, setFormG]           = useState({
    tipo: 'garantia', imei: '', producto: '', cliente: '', telefono: '',
    asesor: '', descripcion_falla: '', diagnostico: '', solucion: '',
    costo_reparacion: '', estado: 'recibido', observaciones: '',
    fecha_recepcion: new Date().toISOString().split('T')[0],
  })
  const [savingG, setSavingG] = useState(false)

  useEffect(() => { loadRetomas(); loadGarantias() }, [])

  // ── RETOMAS ──
  async function loadRetomas() {
    const { data } = await supabase
      .from('retomas')
      .select('*, ventas(nombre_cliente, producto, asesor_nombre, fecha_venta)')
      .order('created_at', { ascending: false })
      .limit(300)
    setRetomas(data || [])
    setLoadingR(false)
  }

  async function guardarRetoma() {
    await supabase.from('retomas').update({
      imei_retoma:        editFormR.imei_retoma,
      referencia:         editFormR.referencia,
      capacidad_gb:       editFormR.capacidad_gb,
      color:              editFormR.color,
      porcentaje_bateria: Number(editFormR.porcentaje_bateria) || null,
      valor_retoma:       Number(editFormR.valor_retoma) || 0,
      costo_estimado:     Number(editFormR.costo_estimado) || 0,
      quien_tiene:        editFormR.quien_tiene,
      punto_tienda:       editFormR.punto_tienda,
      estado:             editFormR.estado,
      observaciones:      editFormR.observaciones,
    }).eq('id', editandoR)
    setEditandoR(null)
    loadRetomas()
  }

  // ── GARANTÍAS ──
  async function loadGarantias() {
    const { data, error } = await supabase
      .from('garantias_reparaciones')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300)
    // Si la tabla no existe aún, no romper
    if (!error) setGarantias(data || [])
    setLoadingG(false)
  }

  async function guardarNuevaGarantia(e) {
    e.preventDefault()
    setSavingG(true)
    const user = (await supabase.auth.getUser()).data.user
    const { error } = await supabase.from('garantias_reparaciones').insert({
      tipo:               formG.tipo,
      imei:               formG.imei,
      producto:           formG.producto,
      cliente:            formG.cliente,
      telefono:           formG.telefono,
      asesor:             formG.asesor,
      descripcion_falla:  formG.descripcion_falla,
      diagnostico:        formG.diagnostico,
      solucion:           formG.solucion,
      costo_reparacion:   Number(formG.costo_reparacion) || 0,
      estado:             formG.estado,
      observaciones:      formG.observaciones,
      fecha_recepcion:    formG.fecha_recepcion,
      registrado_por:     user.id,
    })
    setSavingG(false)
    if (!error) {
      setShowFormG(false)
      setFormG({ tipo:'garantia', imei:'', producto:'', cliente:'', telefono:'', asesor:'', descripcion_falla:'', diagnostico:'', solucion:'', costo_reparacion:'', estado:'recibido', observaciones:'', fecha_recepcion: new Date().toISOString().split('T')[0] })
      loadGarantias()
    }
  }

  async function actualizarGarantia() {
    await supabase.from('garantias_reparaciones').update({
      tipo:              editFormG.tipo,
      diagnostico:       editFormG.diagnostico,
      solucion:          editFormG.solucion,
      costo_reparacion:  Number(editFormG.costo_reparacion) || 0,
      estado:            editFormG.estado,
      observaciones:     editFormG.observaciones,
    }).eq('id', editandoG)
    setEditandoG(null)
    loadGarantias()
  }

  const filtradas_r = retomas.filter(r => {
    if (!filtroR) return true
    const s = filtroR.toLowerCase()
    return `${r.imei_retoma} ${r.referencia} ${r.ventas?.nombre_cliente}`.toLowerCase().includes(s)
  })

  const filtradas_g = garantias.filter(g => {
    if (!filtroG) return true
    const s = filtroG.toLowerCase()
    return `${g.imei} ${g.producto} ${g.cliente}`.toLowerCase().includes(s)
  })

  const th = { color:'#4a6a8a', fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', padding:'10px 14px', textAlign:'left', borderBottom:'1px solid #1a2f52', whiteSpace:'nowrap' }
  const td = { padding:'10px 14px', color:'#cbd5e1', fontSize:13, borderBottom:'1px solid #0f1e36' }

  // KPIs retomas
  const kpisR = Object.entries(ESTADOS_RETOMA).map(([k,v]) => ({ ...v, n: retomas.filter(r => r.estado === k).length })).filter(k => k.n > 0)
  // KPIs garantías
  const kpisG = Object.entries(ESTADOS_GAR).map(([k,v]) => ({ ...v, n: garantias.filter(g => g.estado === k).length })).filter(k => k.n > 0)

  return (
    <div style={{ padding:'32px 36px', fontFamily:"'DM Sans', system-ui" }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ color:'#fff', fontSize:20, fontWeight:600, margin:'0 0 4px' }}>🔬 Laboratorio</h1>
          <p style={{ color:'#4a6a8a', fontSize:13, margin:0 }}>Retomas · Garantías y Reparaciones</p>
        </div>
        {tab === 'garantias' && (esAdmin || esLiderAdmin || esLiderCom) && (
          <button onClick={() => setShowFormG(true)} style={{ padding:'10px 20px', background:'linear-gradient(135deg,#0066ff,#0044bb)', border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
            + Nuevo ingreso
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:20, borderBottom:'1px solid #1a2f52', paddingBottom:12 }}>
        {[
          { key:'retomas',   label:`🔄 Retomas (${retomas.length})` },
          { key:'garantias', label:`🔧 Garantías y Reparaciones (${garantias.length})` },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding:'8px 18px', borderRadius:8, border:'none', cursor:'pointer', fontSize:13, fontWeight:600,
            background: tab === t.key ? 'linear-gradient(135deg,#0066ff,#0044bb)' : '#0d1a35',
            color: tab === t.key ? '#fff' : '#8aabcc',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── RETOMAS ── */}
      {tab === 'retomas' && (
        <>
          {/* KPIs */}
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:16 }}>
            {kpisR.map(k => (
              <div key={k.label} style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:8, padding:'8px 14px', display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background: k.color }} />
                <span style={{ color:'#8aabcc', fontSize:12 }}>{k.label}</span>
                <span style={{ color:'#fff', fontSize:14, fontWeight:600 }}>{k.n}</span>
              </div>
            ))}
          </div>

          <div style={{ marginBottom:12 }}>
            <input placeholder="Buscar por IMEI, referencia o cliente..."
              value={filtroR} onChange={e => setFiltroR(e.target.value)}
              style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:8, padding:'8px 14px', color:'#fff', fontSize:13, outline:'none', width:340, boxSizing:'border-box' }} />
          </div>

          <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:12, overflow:'auto' }}>
            {loadingR ? <div style={{ padding:40, color:'#4a6a8a', textAlign:'center', fontSize:13 }}>Cargando...</div>
            : filtradas_r.length === 0 ? <div style={{ padding:40, color:'#4a6a8a', textAlign:'center', fontSize:13 }}>No hay retomas</div>
            : (
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:800 }}>
                <thead>
                  <tr>
                    <th style={th}>Estado</th>
                    <th style={th}>Referencia</th>
                    <th style={th}>IMEI</th>
                    <th style={th}>Batería</th>
                    <th style={th}>Valor retoma</th>
                    <th style={th}>Costo est.</th>
                    <th style={th}>Ubicación</th>
                    <th style={th}>Cliente origen</th>
                    <th style={th}>Fecha</th>
                    {(esAdmin || esLiderAdmin || esLiderCom) && <th style={th}>Editar</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtradas_r.map(r => (
                    <tr key={r.id}>
                      <td style={td}>
                        <span style={{ background:(ESTADOS_RETOMA[r.estado]?.color||'#94a3b8')+'22', color:ESTADOS_RETOMA[r.estado]?.color||'#94a3b8', fontSize:11, padding:'3px 8px', borderRadius:4, fontWeight:500 }}>
                          {ESTADOS_RETOMA[r.estado]?.label || r.estado}
                        </span>
                      </td>
                      <td style={td}>
                        <div style={{ fontWeight:500, color:'#e2e8f0' }}>{r.referencia}</div>
                        {r.capacidad_gb && <div style={{ color:'#4a6a8a', fontSize:11 }}>{r.capacidad_gb} · {r.color}</div>}
                      </td>
                      <td style={{ ...td, fontSize:12, color:'#8aabcc', fontFamily:'monospace' }}>{r.imei_retoma || '—'}</td>
                      <td style={td}>
                        {r.porcentaje_bateria != null ? (
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <div style={{ width:40, height:6, background:'#1a2f52', borderRadius:3, overflow:'hidden' }}>
                              <div style={{ width:r.porcentaje_bateria+'%', height:'100%', background: r.porcentaje_bateria>80?'#10b981':r.porcentaje_bateria>60?'#f59e0b':'#ef4444', borderRadius:3 }} />
                            </div>
                            <span style={{ fontSize:12, color:'#8aabcc' }}>{r.porcentaje_bateria}%</span>
                          </div>
                        ) : '—'}
                      </td>
                      <td style={{ ...td, fontWeight:600, color:'#fff', whiteSpace:'nowrap' }}>{fmt(r.valor_retoma)}</td>
                      <td style={{ ...td, color:'#10b981', whiteSpace:'nowrap' }}>{r.costo_estimado ? fmt(r.costo_estimado) : '—'}</td>
                      <td style={{ ...td, fontSize:12 }}>{r.quien_tiene || r.punto_tienda || '—'}</td>
                      <td style={td}>
                        <div style={{ fontSize:12 }}>{r.ventas?.nombre_cliente || '—'}</div>
                        <div style={{ color:'#4a6a8a', fontSize:11 }}>{r.ventas?.asesor_nombre}</div>
                      </td>
                      <td style={{ ...td, fontSize:12, whiteSpace:'nowrap' }}>
                        {r.fecha_recepcion ? new Date(r.fecha_recepcion+'T12:00').toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'}) : '—'}
                      </td>
                      {(esAdmin || esLiderAdmin || esLiderCom) && (
                        <td style={td}>
                          <button onClick={() => { setEditandoR(r.id); setEditFormR({ imei_retoma:r.imei_retoma||'', referencia:r.referencia||'', capacidad_gb:r.capacidad_gb||'', color:r.color||'', porcentaje_bateria:r.porcentaje_bateria||'', valor_retoma:r.valor_retoma||'', costo_estimado:r.costo_estimado||'', quien_tiene:r.quien_tiene||'', punto_tienda:r.punto_tienda||'', estado:r.estado, observaciones:r.observaciones||'' }) }}
                            style={{ background:'#1a2f52', border:'none', borderRadius:6, color:'#8aabcc', fontSize:12, padding:'5px 10px', cursor:'pointer' }}>Editar</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ── GARANTÍAS Y REPARACIONES ── */}
      {tab === 'garantias' && (
        <>
          {/* KPIs */}
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:16 }}>
            {[
              { label:'Total', n: garantias.length, color:'#3b82f6' },
              { label:'Garantías', n: garantias.filter(g=>g.tipo==='garantia').length, color:'#0066ff' },
              { label:'Reparaciones', n: garantias.filter(g=>g.tipo==='reparacion').length, color:'#8b5cf6' },
              ...kpisG,
            ].filter(k => k.n > 0).map(k => (
              <div key={k.label} style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:8, padding:'8px 14px', display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background: k.color }} />
                <span style={{ color:'#8aabcc', fontSize:12 }}>{k.label}</span>
                <span style={{ color:'#fff', fontSize:14, fontWeight:600 }}>{k.n}</span>
              </div>
            ))}
          </div>

          <div style={{ marginBottom:12 }}>
            <input placeholder="Buscar por IMEI, producto o cliente..."
              value={filtroG} onChange={e => setFiltroG(e.target.value)}
              style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:8, padding:'8px 14px', color:'#fff', fontSize:13, outline:'none', width:340, boxSizing:'border-box' }} />
          </div>

          <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:12, overflow:'auto' }}>
            {loadingG ? <div style={{ padding:40, color:'#4a6a8a', textAlign:'center', fontSize:13 }}>Cargando...</div>
            : filtradas_g.length === 0 ? (
              <div style={{ padding:60, color:'#4a6a8a', textAlign:'center', fontSize:13 }}>
                <div style={{ fontSize:32, marginBottom:12 }}>🔧</div>
                <div style={{ color:'#fff', fontSize:14, fontWeight:500, marginBottom:6 }}>Sin ingresos al laboratorio</div>
                <div style={{ fontSize:12 }}>Usa el botón + para registrar una garantía o reparación</div>
              </div>
            ) : (
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:900 }}>
                <thead>
                  <tr>
                    <th style={th}>Tipo</th>
                    <th style={th}>Estado</th>
                    <th style={th}>Producto</th>
                    <th style={th}>IMEI</th>
                    <th style={th}>Cliente</th>
                    <th style={th}>Falla</th>
                    <th style={th}>Diagnóstico</th>
                    <th style={th}>Costo rep.</th>
                    <th style={th}>Asesor</th>
                    <th style={th}>Fecha</th>
                    {(esAdmin || esLiderAdmin || esLiderCom) && <th style={th}>Editar</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtradas_g.map(g => (
                    <tr key={g.id}>
                      <td style={td}>
                        <span style={{ background:(TIPO_GAR[g.tipo]?.color||'#3b82f6')+'22', color:TIPO_GAR[g.tipo]?.color||'#3b82f6', fontSize:11, padding:'3px 8px', borderRadius:4, fontWeight:500 }}>
                          {TIPO_GAR[g.tipo]?.label || g.tipo}
                        </span>
                      </td>
                      <td style={td}>
                        <span style={{ background:(ESTADOS_GAR[g.estado]?.color||'#94a3b8')+'22', color:ESTADOS_GAR[g.estado]?.color||'#94a3b8', fontSize:11, padding:'3px 8px', borderRadius:4, fontWeight:500 }}>
                          {ESTADOS_GAR[g.estado]?.label || g.estado}
                        </span>
                      </td>
                      <td style={{ ...td, fontSize:12, color:'#e2e8f0', maxWidth:140 }}>{g.producto || '—'}</td>
                      <td style={{ ...td, fontSize:11, fontFamily:'monospace', color:'#8aabcc' }}>{g.imei || '—'}</td>
                      <td style={td}>
                        <div style={{ fontSize:12, color:'#e2e8f0' }}>{g.cliente || '—'}</div>
                        <div style={{ color:'#4a6a8a', fontSize:11 }}>{g.telefono}</div>
                      </td>
                      <td style={{ ...td, fontSize:12, maxWidth:160, color:'#f59e0b' }}>{g.descripcion_falla || '—'}</td>
                      <td style={{ ...td, fontSize:12, maxWidth:160 }}>{g.diagnostico || '—'}</td>
                      <td style={{ ...td, color:'#10b981', whiteSpace:'nowrap' }}>{g.costo_reparacion ? fmt(g.costo_reparacion) : '—'}</td>
                      <td style={{ ...td, fontSize:12 }}>{g.asesor || '—'}</td>
                      <td style={{ ...td, fontSize:12, whiteSpace:'nowrap' }}>
                        {g.fecha_recepcion ? new Date(g.fecha_recepcion+'T12:00').toLocaleDateString('es-CO',{day:'2-digit',month:'short'}) : '—'}
                      </td>
                      {(esAdmin || esLiderAdmin || esLiderCom) && (
                        <td style={td}>
                          <button onClick={() => { setEditandoG(g.id); setEditFormG({ tipo:g.tipo, diagnostico:g.diagnostico||'', solucion:g.solucion||'', costo_reparacion:g.costo_reparacion||'', estado:g.estado, observaciones:g.observaciones||'' }) }}
                            style={{ background:'#1a2f52', border:'none', borderRadius:6, color:'#8aabcc', fontSize:12, padding:'5px 10px', cursor:'pointer' }}>Editar</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* MODAL EDITAR RETOMA */}
      {editandoR && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:14, padding:28, width:'100%', maxWidth:500, fontFamily:"'DM Sans', system-ui", maxHeight:'90vh', overflow:'auto' }}>
            <h3 style={{ color:'#fff', margin:'0 0 20px', fontSize:16 }}>Editar retoma</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px 14px' }}>
              {[['imei_retoma','IMEI'],['referencia','Referencia'],['capacidad_gb','GB'],['color','Color'],['porcentaje_bateria','Batería %'],['valor_retoma','Valor retoma $'],['costo_estimado','Costo estimado $'],['quien_tiene','¿Quién tiene?'],['punto_tienda','Punto de tienda']].map(([k,label]) => (
                <div key={k}>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>{label}</label>
                  <input style={inp} value={editFormR[k]} onChange={e => setEditFormR(f=>({...f,[k]:e.target.value}))} />
                </div>
              ))}
              <div>
                <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Estado</label>
                <select style={{ ...inp, cursor:'pointer' }} value={editFormR.estado} onChange={e => setEditFormR(f=>({...f,estado:e.target.value}))}>
                  {Object.entries(ESTADOS_RETOMA).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div style={{ gridColumn:'span 2' }}>
                <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Observaciones</label>
                <textarea style={{ ...inp, resize:'vertical', minHeight:60 }} value={editFormR.observaciones} onChange={e => setEditFormR(f=>({...f,observaciones:e.target.value}))} />
              </div>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:20, justifyContent:'flex-end' }}>
              <button onClick={() => setEditandoR(null)} style={{ padding:'9px 20px', background:'transparent', border:'1px solid #1a2f52', borderRadius:8, color:'#6b8ab0', fontSize:13, cursor:'pointer' }}>Cancelar</button>
              <button onClick={guardarRetoma} style={{ padding:'9px 24px', background:'linear-gradient(135deg,#0066ff,#0044bb)', border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVA GARANTÍA/REPARACIÓN */}
      {showFormG && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:14, padding:28, width:'100%', maxWidth:580, fontFamily:"'DM Sans', system-ui", maxHeight:'92vh', overflow:'auto' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <h3 style={{ color:'#fff', margin:0, fontSize:16 }}>Nuevo ingreso al laboratorio</h3>
              <button onClick={() => setShowFormG(false)} style={{ background:'transparent', border:'none', color:'#4a6a8a', fontSize:20, cursor:'pointer' }}>×</button>
            </div>
            <form onSubmit={guardarNuevaGarantia}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px 14px' }}>

                {/* Tipo */}
                <div style={{ gridColumn:'span 2' }}>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:8 }}>Tipo de ingreso</label>
                  <div style={{ display:'flex', gap:8 }}>
                    {Object.entries(TIPO_GAR).map(([k,v]) => (
                      <button key={k} type="button" onClick={() => setFormG(f=>({...f,tipo:k}))} style={{
                        flex:1, padding:'10px 8px', border:`2px solid ${formG.tipo===k?v.color:'#1a2f52'}`,
                        borderRadius:8, cursor:'pointer', background: formG.tipo===k?v.color+'22':'transparent',
                        color: formG.tipo===k?v.color:'#4a6a8a', fontWeight:600, fontSize:13,
                      }}>{v.label}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>IMEI del equipo</label>
                  <input style={inp} value={formG.imei} onChange={e=>setFormG(f=>({...f,imei:e.target.value}))} placeholder="15 dígitos" />
                </div>
                <div>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Producto / Referencia</label>
                  <input style={inp} value={formG.producto} onChange={e=>setFormG(f=>({...f,producto:e.target.value}))} placeholder="iPhone 15 Pro..." />
                </div>
                <div>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Cliente</label>
                  <input style={inp} value={formG.cliente} onChange={e=>setFormG(f=>({...f,cliente:e.target.value}))} />
                </div>
                <div>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Teléfono</label>
                  <input style={inp} value={formG.telefono} onChange={e=>setFormG(f=>({...f,telefono:e.target.value}))} />
                </div>
                <div>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Asesor responsable</label>
                  <input style={inp} value={formG.asesor} onChange={e=>setFormG(f=>({...f,asesor:e.target.value}))} />
                </div>
                <div>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Fecha de recepción</label>
                  <input type="date" style={inp} value={formG.fecha_recepcion} onChange={e=>setFormG(f=>({...f,fecha_recepcion:e.target.value}))} />
                </div>
                <div style={{ gridColumn:'span 2' }}>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Descripción de la falla *</label>
                  <textarea required style={{ ...inp, resize:'vertical', minHeight:60 }} value={formG.descripcion_falla} onChange={e=>setFormG(f=>({...f,descripcion_falla:e.target.value}))} placeholder="¿Qué problema reporta el cliente?" />
                </div>
                <div style={{ gridColumn:'span 2' }}>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Diagnóstico técnico</label>
                  <textarea style={{ ...inp, resize:'vertical', minHeight:60 }} value={formG.diagnostico} onChange={e=>setFormG(f=>({...f,diagnostico:e.target.value}))} placeholder="Diagnóstico del técnico..." />
                </div>
                <div>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Costo reparación $</label>
                  <input style={inp} value={formG.costo_reparacion} onChange={e=>setFormG(f=>({...f,costo_reparacion:e.target.value}))} placeholder="0" />
                </div>
                <div>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Estado inicial</label>
                  <select style={{ ...inp, cursor:'pointer' }} value={formG.estado} onChange={e=>setFormG(f=>({...f,estado:e.target.value}))}>
                    {Object.entries(ESTADOS_GAR).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn:'span 2' }}>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Observaciones</label>
                  <textarea style={{ ...inp, resize:'vertical', minHeight:48 }} value={formG.observaciones} onChange={e=>setFormG(f=>({...f,observaciones:e.target.value}))} />
                </div>
              </div>
              <div style={{ display:'flex', gap:10, marginTop:20, justifyContent:'flex-end' }}>
                <button type="button" onClick={() => setShowFormG(false)} style={{ padding:'9px 20px', background:'transparent', border:'1px solid #1a2f52', borderRadius:8, color:'#6b8ab0', fontSize:13, cursor:'pointer' }}>Cancelar</button>
                <button type="submit" disabled={savingG} style={{ padding:'9px 24px', background: savingG?'#1e3058':'linear-gradient(135deg,#0066ff,#0044bb)', border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                  {savingG ? 'Guardando...' : 'Registrar ingreso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR GARANTÍA */}
      {editandoG && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:14, padding:28, width:'100%', maxWidth:480, fontFamily:"'DM Sans', system-ui", maxHeight:'90vh', overflow:'auto' }}>
            <h3 style={{ color:'#fff', margin:'0 0 20px', fontSize:16 }}>Actualizar garantía / reparación</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px 14px' }}>
              <div style={{ gridColumn:'span 2' }}>
                <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Tipo</label>
                <select style={{ ...inp, cursor:'pointer' }} value={editFormG.tipo} onChange={e=>setEditFormG(f=>({...f,tipo:e.target.value}))}>
                  {Object.entries(TIPO_GAR).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div style={{ gridColumn:'span 2' }}>
                <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Diagnóstico técnico</label>
                <textarea style={{ ...inp, resize:'vertical', minHeight:60 }} value={editFormG.diagnostico} onChange={e=>setEditFormG(f=>({...f,diagnostico:e.target.value}))} />
              </div>
              <div style={{ gridColumn:'span 2' }}>
                <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Solución aplicada</label>
                <textarea style={{ ...inp, resize:'vertical', minHeight:60 }} value={editFormG.solucion} onChange={e=>setEditFormG(f=>({...f,solucion:e.target.value}))} />
              </div>
              <div>
                <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Costo reparación $</label>
                <input style={inp} value={editFormG.costo_reparacion} onChange={e=>setEditFormG(f=>({...f,costo_reparacion:e.target.value}))} />
              </div>
              <div>
                <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Estado</label>
                <select style={{ ...inp, cursor:'pointer' }} value={editFormG.estado} onChange={e=>setEditFormG(f=>({...f,estado:e.target.value}))}>
                  {Object.entries(ESTADOS_GAR).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div style={{ gridColumn:'span 2' }}>
                <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Observaciones</label>
                <textarea style={{ ...inp, resize:'vertical', minHeight:48 }} value={editFormG.observaciones} onChange={e=>setEditFormG(f=>({...f,observaciones:e.target.value}))} />
              </div>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:20, justifyContent:'flex-end' }}>
              <button onClick={() => setEditandoG(null)} style={{ padding:'9px 20px', background:'transparent', border:'1px solid #1a2f52', borderRadius:8, color:'#6b8ab0', fontSize:13, cursor:'pointer' }}>Cancelar</button>
              <button onClick={actualizarGarantia} style={{ padding:'9px 24px', background:'linear-gradient(135deg,#0066ff,#0044bb)', border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
