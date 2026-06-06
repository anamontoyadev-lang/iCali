import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const fmt = n => new Intl.NumberFormat('es-CO', {
  style:'currency', currency:'COP', maximumFractionDigits:0
}).format(n || 0)

const ESTADOS_RETOMA = {
  recibida:        { label:'Recibida',        color:'#94a3b8' },
  en_verificacion: { label:'Verificando',     color:'#f59e0b' },
  verificada:      { label:'Verificada',      color:'#3b82f6' },
  disponible:      { label:'Disponible',      color:'#10b981' },
  en_reparacion:   { label:'En reparación',   color:'#8b5cf6' },
  vendida:         { label:'Vendida',         color:'#6b7280' },
}

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
  garantia:    { label:'Garantía',    color:'#3b82f6' },
  reparacion:  { label:'Reparación',  color:'#8b5cf6' },
  diagnostico: { label:'Diagnóstico', color:'#f59e0b' },
}

const REPUESTOS_CATALOGO = [
  'Batería','Display','Back cover','Cámara trasera','Cámara frontal',
  'Botón home','Botón power','Botones volumen','Conector carga',
  'Altavoz','Micrófono','Vibrador','Flex cable','Tornillos',
  'Marco/Chasis','Lente cámara','Otro'
]

const inp = {
  background:'#0a1628', border:'1px solid #1a2f52', borderRadius:6,
  padding:'7px 10px', color:'#fff', fontSize:13,
  width:'100%', boxSizing:'border-box', outline:'none'
}

const FORM_INIT = {
  tipo: 'reparacion',
  imei: '', producto: '', cliente: '', telefono: '',
  asesor: '', descripcion_falla: '', diagnostico: '', solucion: '',
  costo_mano_obra: '', estado: 'recibido', observaciones: '',
  fecha_recepcion: new Date().toISOString().split('T')[0],
  fecha_entrega_estimada: '', fecha_entrega_real: '',
  repuestos: [], costo_repuestos: 0,
}

export default function Laboratorio() {
  const { esAdmin, esLiderAdmin, esLiderCom } = useAuth()
  const [tab, setTab] = useState('garantias')

  // Retomas
  const [retomas, setRetomas]     = useState([])
  const [loadingR, setLoadingR]   = useState(true)
  const [editandoR, setEditandoR] = useState(null)
  const [editFormR, setEditFormR] = useState({})
  const [filtroR, setFiltroR]     = useState('')

  // Garantías
  const [garantias, setGarantias]   = useState([])
  const [loadingG, setLoadingG]     = useState(true)
  const [showFormG, setShowFormG]   = useState(false)
  const [editandoG, setEditandoG]   = useState(null)
  const [editFormG, setEditFormG]   = useState({})
  const [filtroG, setFiltroG]       = useState('')
  const [formG, setFormG]           = useState(FORM_INIT)
  const [savingG, setSavingG]       = useState(false)
  const [proveedores, setProveedores] = useState([])
  // Repuesto en edición
  const [nuevoRep, setNuevoRep]     = useState({ nombre:'', costo:'' })
  const [nuevoRepEdit, setNuevoRepEdit] = useState({ nombre:'', costo:'' })

  useEffect(() => { loadRetomas(); loadGarantias(); loadProveedores() }, [])

  async function loadRetomas() {
    const { data } = await supabase
      .from('retomas')
      .select('*, ventas(nombre_cliente, producto, asesor_nombre, fecha_venta)')
      .order('created_at', { ascending: false }).limit(300)
    setRetomas(data || [])
    setLoadingR(false)
  }

  async function loadGarantias() {
    const { data, error } = await supabase
      .from('garantias_reparaciones')
      .select('*')
      .order('created_at', { ascending: false }).limit(300)
    if (!error) setGarantias(data || [])
    setLoadingG(false)
  }

  async function loadProveedores() {
    const { data } = await supabase.from('proveedores').select('nombre').eq('activo', true).order('nombre')
    setProveedores(data || [])
  }

  async function guardarRetoma() {
    await supabase.from('retomas').update({
      imei_retoma: editFormR.imei_retoma, referencia: editFormR.referencia,
      capacidad_gb: editFormR.capacidad_gb, color: editFormR.color,
      porcentaje_bateria: Number(editFormR.porcentaje_bateria) || null,
      valor_retoma: Number(editFormR.valor_retoma) || 0,
      costo_estimado: Number(editFormR.costo_estimado) || 0,
      quien_tiene: editFormR.quien_tiene, punto_tienda: editFormR.punto_tienda,
      estado: editFormR.estado, observaciones: editFormR.observaciones,
    }).eq('id', editandoR)
    // Si el estado es en_reparacion, crear ingreso en garantias_reparaciones si no existe
    if (editFormR.estado === 'en_reparacion') {
      const retoma = retomas.find(r => r.id === editandoR)
      if (retoma) {
        // verificar si ya existe ingreso con este IMEI
        const { data: existe } = await supabase
          .from('garantias_reparaciones')
          .select('id')
          .eq('imei', editFormR.imei_retoma || retoma.imei_retoma || '')
          .eq('tipo', 'reparacion')
          .limit(1)
        if (!existe || existe.length === 0) {
          const user = (await supabase.auth.getUser()).data.user
          await supabase.from('garantias_reparaciones').insert({
            tipo: 'reparacion',
            imei: editFormR.imei_retoma || retoma.imei_retoma || '',
            producto: editFormR.referencia || retoma.referencia || '',
            cliente: retoma.ventas?.nombre_cliente || '',
            asesor: retoma.ventas?.asesor_nombre || '',
            descripcion_falla: editFormR.observaciones || 'Ingresado desde retoma',
            estado: 'en_reparacion',
            fecha_recepcion: new Date().toISOString().split('T')[0],
            registrado_por: user.id,
            repuestos: [],
            costo_repuestos: 0,
          })
        }
      }
    }
    setEditandoR(null); loadRetomas(); loadGarantias()
  }

  // Calcular total repuestos
  function calcTotalRep(reps) {
    return reps.reduce((a, r) => a + Number(r.costo || 0), 0)
  }

  function agregarRepuesto(nuevo, setNuevo, esForm = false) {
    if (!nuevo.nombre) return
    const rep = { nombre: nuevo.nombre, cantidad: Number(nuevo.cantidad) || 1, costo: Number(String(nuevo.costo).replace(/\D/g,'')) || 0 }
    if (esForm) {
      setFormG(f => {
        const nuevosReps = [...(f.repuestos || []), rep]
        return { ...f, repuestos: nuevosReps, costo_repuestos: calcTotalRep(nuevosReps) }
      })
    } else {
      setEditFormG(f => {
        const nuevosReps = [...(f.repuestos || []), rep]
        return { ...f, repuestos: nuevosReps, costo_repuestos: calcTotalRep(nuevosReps) }
      })
    }
    setNuevo({ nombre:'', costo:'', cantidad: 1 })
  }

  function quitarRepuesto(idx, esForm = false) {
    if (esForm) {
      const nuevos = formG.repuestos.filter((_,i) => i !== idx)
      setFormG(f => ({ ...f, repuestos: nuevos, costo_repuestos: calcTotalRep(nuevos) }))
    } else {
      const nuevos = editFormG.repuestos.filter((_,i) => i !== idx)
      setEditFormG(f => ({ ...f, repuestos: nuevos, costo_repuestos: calcTotalRep(nuevos) }))
    }
  }

  async function guardarNuevaGarantia(e) {
    e.preventDefault()
    setSavingG(true)
    const user = (await supabase.auth.getUser()).data.user
    const { error } = await supabase.from('garantias_reparaciones').insert({
      tipo: formG.tipo, imei: formG.imei, producto: formG.producto,
      cliente: formG.cliente, telefono: formG.telefono, asesor: formG.asesor,
      descripcion_falla: formG.descripcion_falla, diagnostico: formG.diagnostico,
      solucion: formG.solucion,
      costo_mano_obra: Number(formG.costo_mano_obra) || 0,
      costo_repuestos: formG.costo_repuestos,
      repuestos: formG.repuestos,
      estado: formG.estado, observaciones: formG.observaciones,
      fecha_recepcion: formG.fecha_recepcion,
      fecha_entrega_estimada: formG.fecha_entrega_estimada || null,
      fecha_entrega_real: formG.fecha_entrega_real || null,
      registrado_por: user.id,
    })
    setSavingG(false)
    if (!error) {
      setShowFormG(false)
      setFormG(FORM_INIT)
      setNuevoRep({ nombre:'', costo:'' })
      loadGarantias()
    }
  }

  async function actualizarGarantia() {
    await supabase.from('garantias_reparaciones').update({
      tipo: editFormG.tipo, diagnostico: editFormG.diagnostico,
      solucion: editFormG.solucion,
      costo_mano_obra: Number(editFormG.costo_mano_obra) || 0,
      costo_repuestos: editFormG.costo_repuestos,
      repuestos: editFormG.repuestos,
      estado: editFormG.estado, observaciones: editFormG.observaciones,
      fecha_entrega_estimada: editFormG.fecha_entrega_estimada || null,
      fecha_entrega_real: editFormG.fecha_entrega_real || null,
    }).eq('id', editandoG)
    setEditandoG(null); loadGarantias()
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

  function RepuestosWidget({ reps, onQuitar, nuevo, setNuevo, esForm }) {
    return (
      <div>
        <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:8 }}>
          Repuestos {reps.length > 0 && <span style={{ color:'#10b981' }}>({reps.length}) — Total: {fmt(calcTotalRep(reps))}</span>}
        </label>
        {reps.length > 0 && (
          <div style={{ marginBottom:8, display:'flex', flexDirection:'column', gap:4 }}>
            {reps.map((r, i) => (
              <div key={i} style={{ background:'#0a1628', border:'1px solid #1a2f52', borderRadius:6, padding:'6px 10px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                  <span style={{ color:'#e2e8f0', fontSize:12 }}>{r.nombre}</span>
                  {r.cantidad > 1 && <span style={{ color:'#8aabcc', fontSize:11 }}>x{r.cantidad}</span>}
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ color:'#10b981', fontSize:12, fontWeight:600 }}>{fmt(r.costo)}</span>
                  <button type="button" onClick={() => onQuitar(i)} style={{ background:'transparent', border:'none', color:'#ef4444', fontSize:14, cursor:'pointer', lineHeight:1 }}>×</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr auto', gap:6, alignItems:'end' }}>
          <div>
            <div style={{ color:'#5a7aaa', fontSize:10, marginBottom:4 }}>Repuesto</div>
            <select
              value={nuevo.nombre}
              onChange={e => setNuevo(n => ({ ...n, nombre: e.target.value }))}
              style={{ ...inp, cursor:'pointer' }}
            >
              <option value="">Seleccionar...</option>
              {REPUESTOS_CATALOGO.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <div style={{ color:'#5a7aaa', fontSize:10, marginBottom:4 }}>Cantidad</div>
            <input
              type="number"
              min="1"
              value={nuevo.cantidad || 1}
              onChange={e => setNuevo(n => ({ ...n, cantidad: e.target.value }))}
              style={{ ...inp }}
            />
          </div>
          <div>
            <div style={{ color:'#5a7aaa', fontSize:10, marginBottom:4 }}>Valor $</div>
            <input
              value={nuevo.costo}
              onChange={e => setNuevo(n => ({ ...n, costo: e.target.value }))}
              placeholder="0"
              style={{ ...inp }}
            />
          </div>
          <button
            type="button"
            onClick={() => agregarRepuesto(nuevo, setNuevo, esForm)}
            disabled={!nuevo.nombre}
            style={{ padding:'9px 14px', background: nuevo.nombre ? '#0066ff' : '#1e3058', border:'none', borderRadius:6, color:'#fff', fontSize:12, fontWeight:600, cursor: nuevo.nombre ? 'pointer' : 'default', whiteSpace:'nowrap' }}
          >
            + Agregar
          </button>
        </div>
      </div>
    )
  }

  const totalCostoG = (g) => (Number(g.costo_repuestos)||0) + (Number(g.costo_mano_obra)||0)

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
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:16 }}>
            {Object.entries(ESTADOS_RETOMA).map(([k,v]) => {
              const n = retomas.filter(r => r.estado === k).length
              if (!n) return null
              return (
                <div key={k} style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:8, padding:'8px 14px', display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:v.color }} />
                  <span style={{ color:'#8aabcc', fontSize:12 }}>{v.label}</span>
                  <span style={{ color:'#fff', fontSize:14, fontWeight:600 }}>{n}</span>
                </div>
              )
            })}
          </div>
          <input placeholder="Buscar por IMEI, referencia o cliente..." value={filtroR} onChange={e => setFiltroR(e.target.value)}
            style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:8, padding:'8px 14px', color:'#fff', fontSize:13, outline:'none', width:340, boxSizing:'border-box', marginBottom:12 }} />
          <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:12, overflow:'auto' }}>
            {loadingR ? <div style={{ padding:40, color:'#4a6a8a', textAlign:'center' }}>Cargando...</div>
            : filtradas_r.length === 0 ? <div style={{ padding:40, color:'#4a6a8a', textAlign:'center' }}>No hay retomas</div>
            : (
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:800 }}>
                <thead><tr>
                  <th style={th}>Estado</th><th style={th}>Referencia</th><th style={th}>IMEI</th>
                  <th style={th}>Batería</th><th style={th}>Valor retoma</th><th style={th}>Costo est.</th>
                  <th style={th}>Ubicación</th><th style={th}>Cliente origen</th><th style={th}>Fecha</th>
                  {(esAdmin||esLiderAdmin||esLiderCom) && <th style={th}>Editar</th>}
                </tr></thead>
                <tbody>
                  {filtradas_r.map(r => (
                    <tr key={r.id}>
                      <td style={td}><span style={{ background:(ESTADOS_RETOMA[r.estado]?.color||'#94a3b8')+'22', color:ESTADOS_RETOMA[r.estado]?.color||'#94a3b8', fontSize:11, padding:'3px 8px', borderRadius:4, fontWeight:500 }}>{ESTADOS_RETOMA[r.estado]?.label||r.estado}</span></td>
                      <td style={td}><div style={{ fontWeight:500, color:'#e2e8f0' }}>{r.referencia}</div>{r.capacidad_gb && <div style={{ color:'#4a6a8a', fontSize:11 }}>{r.capacidad_gb} · {r.color}</div>}</td>
                      <td style={{ ...td, fontSize:12, color:'#8aabcc', fontFamily:'monospace' }}>{r.imei_retoma||'—'}</td>
                      <td style={td}>{r.porcentaje_bateria!=null ? (
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <div style={{ width:40, height:6, background:'#1a2f52', borderRadius:3, overflow:'hidden' }}>
                            <div style={{ width:r.porcentaje_bateria+'%', height:'100%', background:r.porcentaje_bateria>80?'#10b981':r.porcentaje_bateria>60?'#f59e0b':'#ef4444', borderRadius:3 }} />
                          </div>
                          <span style={{ fontSize:12, color:'#8aabcc' }}>{r.porcentaje_bateria}%</span>
                        </div>
                      ) : '—'}</td>
                      <td style={{ ...td, fontWeight:600, color:'#fff', whiteSpace:'nowrap' }}>{fmt(r.valor_retoma)}</td>
                      <td style={{ ...td, color:'#10b981', whiteSpace:'nowrap' }}>{r.costo_estimado?fmt(r.costo_estimado):'—'}</td>
                      <td style={{ ...td, fontSize:12 }}>{r.quien_tiene||r.punto_tienda||'—'}</td>
                      <td style={td}><div style={{ fontSize:12 }}>{r.ventas?.nombre_cliente||'—'}</div><div style={{ color:'#4a6a8a', fontSize:11 }}>{r.ventas?.asesor_nombre}</div></td>
                      <td style={{ ...td, fontSize:12, whiteSpace:'nowrap' }}>{r.fecha_recepcion?new Date(r.fecha_recepcion+'T12:00').toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'}):'—'}</td>
                      {(esAdmin||esLiderAdmin||esLiderCom) && (
                        <td style={td}><button onClick={() => { setEditandoR(r.id); setEditFormR({ imei_retoma:r.imei_retoma||'', referencia:r.referencia||'', capacidad_gb:r.capacidad_gb||'', color:r.color||'', porcentaje_bateria:r.porcentaje_bateria||'', valor_retoma:r.valor_retoma||'', costo_estimado:r.costo_estimado||'', quien_tiene:r.quien_tiene||'', punto_tienda:r.punto_tienda||'', estado:r.estado, observaciones:r.observaciones||'' }) }} style={{ background:'#1a2f52', border:'none', borderRadius:6, color:'#8aabcc', fontSize:12, padding:'5px 10px', cursor:'pointer' }}>Editar</button></td>
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
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:16 }}>
            {[
              { label:'Total', n:garantias.length, color:'#3b82f6' },
              { label:'Garantías', n:garantias.filter(g=>g.tipo==='garantia').length, color:'#0066ff' },
              { label:'Reparaciones', n:garantias.filter(g=>g.tipo==='reparacion').length, color:'#8b5cf6' },
              ...Object.entries(ESTADOS_GAR).map(([k,v]) => ({ label:v.label, n:garantias.filter(g=>g.estado===k).length, color:v.color })).filter(k=>k.n>0),
            ].filter(k=>k.n>0).map(k => (
              <div key={k.label} style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:8, padding:'8px 14px', display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:k.color }} />
                <span style={{ color:'#8aabcc', fontSize:12 }}>{k.label}</span>
                <span style={{ color:'#fff', fontSize:14, fontWeight:600 }}>{k.n}</span>
              </div>
            ))}
          </div>
          <input placeholder="Buscar por IMEI, producto o cliente..." value={filtroG} onChange={e => setFiltroG(e.target.value)}
            style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:8, padding:'8px 14px', color:'#fff', fontSize:13, outline:'none', width:340, boxSizing:'border-box', marginBottom:12 }} />
          <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:12, overflow:'auto' }}>
            {loadingG ? <div style={{ padding:40, color:'#4a6a8a', textAlign:'center' }}>Cargando...</div>
            : filtradas_g.length === 0 ? (
              <div style={{ padding:60, color:'#4a6a8a', textAlign:'center' }}>
                <div style={{ fontSize:32, marginBottom:12 }}>🔧</div>
                <div style={{ color:'#fff', fontSize:14, fontWeight:500, marginBottom:6 }}>Sin ingresos al laboratorio</div>
                <div style={{ fontSize:12 }}>Usa el botón + para registrar una garantía o reparación</div>
              </div>
            ) : (
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:1000 }}>
                <thead><tr>
                  <th style={th}>Tipo</th><th style={th}>Estado</th><th style={th}>Producto</th>
                  <th style={th}>IMEI</th><th style={th}>Cliente</th><th style={th}>Falla</th>
                  <th style={th}>Repuestos</th><th style={th}>Mano obra</th><th style={th}>Total</th>
                  <th style={th}>Ingreso</th><th style={th}>Entrega est.</th><th style={th}>Entrega real</th>
                  <th style={th}>Asesor</th>
                  {(esAdmin||esLiderAdmin||esLiderCom) && <th style={th}>Editar</th>}
                </tr></thead>
                <tbody>
                  {filtradas_g.map(g => (
                    <tr key={g.id}>
                      <td style={td}><span style={{ background:(TIPO_GAR[g.tipo]?.color||'#3b82f6')+'22', color:TIPO_GAR[g.tipo]?.color||'#3b82f6', fontSize:11, padding:'3px 8px', borderRadius:4, fontWeight:500 }}>{TIPO_GAR[g.tipo]?.label||g.tipo}</span></td>
                      <td style={td}><span style={{ background:(ESTADOS_GAR[g.estado]?.color||'#94a3b8')+'22', color:ESTADOS_GAR[g.estado]?.color||'#94a3b8', fontSize:11, padding:'3px 8px', borderRadius:4, fontWeight:500 }}>{ESTADOS_GAR[g.estado]?.label||g.estado}</span></td>
                      <td style={{ ...td, fontSize:12, color:'#e2e8f0', maxWidth:130 }}>{g.producto||'—'}</td>
                      <td style={{ ...td, fontSize:11, fontFamily:'monospace', color:'#8aabcc' }}>{g.imei||'—'}</td>
                      <td style={td}><div style={{ fontSize:12, color:'#e2e8f0' }}>{g.cliente||'—'}</div><div style={{ color:'#4a6a8a', fontSize:11 }}>{g.telefono}</div></td>
                      <td style={{ ...td, fontSize:12, maxWidth:140, color:'#f59e0b' }}>{g.descripcion_falla||'—'}</td>
                      <td style={td}>
                        {Array.isArray(g.repuestos) && g.repuestos.length > 0 ? (
                          <div>
                            {g.repuestos.map((r,i) => <div key={i} style={{ fontSize:11, color:'#cbd5e1' }}>{r.nombre} <span style={{ color:'#10b981' }}>{fmt(r.costo)}</span></div>)}
                            <div style={{ color:'#10b981', fontSize:11, fontWeight:600, marginTop:2 }}>= {fmt(g.costo_repuestos)}</div>
                          </div>
                        ) : '—'}
                      </td>
                      <td style={{ ...td, color:'#f59e0b', whiteSpace:'nowrap' }}>{g.costo_mano_obra?fmt(g.costo_mano_obra):'—'}</td>
                      <td style={{ ...td, color:'#fff', fontWeight:700, whiteSpace:'nowrap' }}>{totalCostoG(g)?fmt(totalCostoG(g)):'—'}</td>
                      <td style={{ ...td, fontSize:12, whiteSpace:'nowrap' }}>{g.fecha_recepcion?new Date(g.fecha_recepcion+'T12:00').toLocaleDateString('es-CO',{day:'2-digit',month:'short'}):'—'}</td>
                      <td style={{ ...td, fontSize:12, whiteSpace:'nowrap', color:'#f59e0b' }}>{g.fecha_entrega_estimada?new Date(g.fecha_entrega_estimada+'T12:00').toLocaleDateString('es-CO',{day:'2-digit',month:'short'}):'—'}</td>
                      <td style={{ ...td, fontSize:12, whiteSpace:'nowrap', color:'#10b981' }}>{g.fecha_entrega_real?new Date(g.fecha_entrega_real+'T12:00').toLocaleDateString('es-CO',{day:'2-digit',month:'short'}):'—'}</td>
                      <td style={{ ...td, fontSize:12 }}>{g.asesor||'—'}</td>
                      {(esAdmin||esLiderAdmin||esLiderCom) && (
                        <td style={td}><button onClick={() => { setEditandoG(g.id); setEditFormG({ tipo:g.tipo, diagnostico:g.diagnostico||'', solucion:g.solucion||'', costo_mano_obra:g.costo_mano_obra||'', costo_repuestos:g.costo_repuestos||0, repuestos:Array.isArray(g.repuestos)?g.repuestos:[], estado:g.estado, observaciones:g.observaciones||'', fecha_entrega_estimada:g.fecha_entrega_estimada||'', fecha_entrega_real:g.fecha_entrega_real||'' }); setNuevoRepEdit({nombre:'',costo:''}) }} style={{ background:'#1a2f52', border:'none', borderRadius:6, color:'#8aabcc', fontSize:12, padding:'5px 10px', cursor:'pointer' }}>Editar</button></td>
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
          <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:14, padding:28, width:'100%', maxWidth:500, fontFamily:"'DM Sans',system-ui", maxHeight:'90vh', overflow:'auto' }}>
            <h3 style={{ color:'#fff', margin:'0 0 20px', fontSize:16 }}>Editar retoma</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px 14px' }}>
              {[['imei_retoma','IMEI'],['referencia','Referencia'],['capacidad_gb','GB'],['color','Color'],['porcentaje_bateria','Batería %'],['valor_retoma','Valor retoma $'],['costo_estimado','Costo estimado $'],['punto_tienda','Punto de tienda']].map(([k,label]) => (
                <div key={k}><label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>{label}</label><input style={inp} value={editFormR[k]} onChange={e => setEditFormR(f=>({...f,[k]:e.target.value}))} /></div>
              ))}
              <div>
                <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>¿Quién tiene?</label>
                <select style={{ ...inp, cursor:'pointer' }} value={editFormR.quien_tiene} onChange={e => setEditFormR(f=>({...f, quien_tiene:e.target.value}))}>
                  <option value="">Seleccionar...</option>
                  <option value="Laboratorio iCali">🔬 Laboratorio iCali</option>
                  {proveedores.map(p => <option key={p.nombre} value={p.nombre}>{p.nombre}</option>)}
                </select>
              </div>
              <div><label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Estado</label>
                <select style={{ ...inp, cursor:'pointer' }} value={editFormR.estado} onChange={e => setEditFormR(f=>({...f,estado:e.target.value}))}>
                  {Object.entries(ESTADOS_RETOMA).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div style={{ gridColumn:'span 2' }}><label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Observaciones</label><textarea style={{ ...inp, resize:'vertical', minHeight:60 }} value={editFormR.observaciones} onChange={e => setEditFormR(f=>({...f,observaciones:e.target.value}))} /></div>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:20, justifyContent:'flex-end' }}>
              <button onClick={() => setEditandoR(null)} style={{ padding:'9px 20px', background:'transparent', border:'1px solid #1a2f52', borderRadius:8, color:'#6b8ab0', fontSize:13, cursor:'pointer' }}>Cancelar</button>
              <button onClick={guardarRetoma} style={{ padding:'9px 24px', background:'linear-gradient(135deg,#0066ff,#0044bb)', border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVA GARANTÍA */}
      {showFormG && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:14, padding:28, width:'100%', maxWidth:620, fontFamily:"'DM Sans',system-ui", maxHeight:'93vh', overflow:'auto' }}>
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
                      <button key={k} type="button" onClick={() => setFormG(f=>({...f,tipo:k}))} style={{ flex:1, padding:'10px 8px', border:`2px solid ${formG.tipo===k?v.color:'#1a2f52'}`, borderRadius:8, cursor:'pointer', background:formG.tipo===k?v.color+'22':'transparent', color:formG.tipo===k?v.color:'#4a6a8a', fontWeight:600, fontSize:13 }}>{v.label}</button>
                    ))}
                  </div>
                </div>

                <div><label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>IMEI del equipo</label><input style={inp} value={formG.imei} onChange={e=>setFormG(f=>({...f,imei:e.target.value}))} placeholder="15 dígitos" /></div>
                <div><label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Producto / Referencia</label><input style={inp} value={formG.producto} onChange={e=>setFormG(f=>({...f,producto:e.target.value}))} placeholder="iPhone 15 Pro..." /></div>
                <div><label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Cliente</label><input style={inp} value={formG.cliente} onChange={e=>setFormG(f=>({...f,cliente:e.target.value}))} /></div>
                <div><label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Teléfono</label><input style={inp} value={formG.telefono} onChange={e=>setFormG(f=>({...f,telefono:e.target.value}))} /></div>
                <div><label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Asesor responsable</label><input style={inp} value={formG.asesor} onChange={e=>setFormG(f=>({...f,asesor:e.target.value}))} /></div>
                <div><label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Estado inicial</label>
                  <select style={{ ...inp, cursor:'pointer' }} value={formG.estado} onChange={e=>setFormG(f=>({...f,estado:e.target.value}))}>
                    {Object.entries(ESTADOS_GAR).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div><label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Fecha de ingreso</label><input type="date" style={inp} value={formG.fecha_recepcion} onChange={e=>setFormG(f=>({...f,fecha_recepcion:e.target.value}))} /></div>
                <div><label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Entrega estimada</label><input type="date" style={inp} value={formG.fecha_entrega_estimada} onChange={e=>setFormG(f=>({...f,fecha_entrega_estimada:e.target.value}))} /></div>

                <div style={{ gridColumn:'span 2' }}><label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Descripción de la falla *</label><textarea required style={{ ...inp, resize:'vertical', minHeight:56 }} value={formG.descripcion_falla} onChange={e=>setFormG(f=>({...f,descripcion_falla:e.target.value}))} placeholder="¿Qué problema reporta el cliente?" /></div>
                <div style={{ gridColumn:'span 2' }}><label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Diagnóstico técnico</label><textarea style={{ ...inp, resize:'vertical', minHeight:56 }} value={formG.diagnostico} onChange={e=>setFormG(f=>({...f,diagnostico:e.target.value}))} placeholder="Diagnóstico del técnico..." /></div>

                {/* Repuestos */}
                <div style={{ gridColumn:'span 2' }}>
                  <RepuestosWidget
                    reps={formG.repuestos}
                    onQuitar={(i) => quitarRepuesto(i, true)}
                    nuevo={nuevoRep}
                    setNuevo={setNuevoRep}
                    esForm={true}
                  />
                </div>

                <div><label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Costo mano de obra $</label><input style={inp} value={formG.costo_mano_obra} onChange={e=>setFormG(f=>({...f,costo_mano_obra:e.target.value}))} placeholder="0" /></div>
                <div style={{ display:'flex', alignItems:'flex-end' }}>
                  <div style={{ background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.25)', borderRadius:8, padding:'8px 14px', width:'100%' }}>
                    <div style={{ color:'#5a7aaa', fontSize:10, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Total estimado</div>
                    <div style={{ color:'#10b981', fontSize:18, fontWeight:700 }}>
                      {fmt((Number(formG.costo_mano_obra)||0) + (formG.costo_repuestos||0))}
                    </div>
                  </div>
                </div>

                <div style={{ gridColumn:'span 2' }}><label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Observaciones</label><textarea style={{ ...inp, resize:'vertical', minHeight:48 }} value={formG.observaciones} onChange={e=>setFormG(f=>({...f,observaciones:e.target.value}))} /></div>
              </div>

              <div style={{ display:'flex', gap:10, marginTop:20, justifyContent:'flex-end' }}>
                <button type="button" onClick={() => setShowFormG(false)} style={{ padding:'9px 20px', background:'transparent', border:'1px solid #1a2f52', borderRadius:8, color:'#6b8ab0', fontSize:13, cursor:'pointer' }}>Cancelar</button>
                <button type="submit" disabled={savingG} style={{ padding:'9px 24px', background:savingG?'#1e3058':'linear-gradient(135deg,#0066ff,#0044bb)', border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                  {savingG?'Guardando...':'Registrar ingreso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR GARANTÍA */}
      {editandoG && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:14, padding:28, width:'100%', maxWidth:580, fontFamily:"'DM Sans',system-ui", maxHeight:'92vh', overflow:'auto' }}>
            <h3 style={{ color:'#fff', margin:'0 0 20px', fontSize:16 }}>Actualizar — Garantía / Reparación</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px 14px' }}>
              <div style={{ gridColumn:'span 2' }}>
                <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Tipo</label>
                <select style={{ ...inp, cursor:'pointer' }} value={editFormG.tipo} onChange={e=>setEditFormG(f=>({...f,tipo:e.target.value}))}>
                  {Object.entries(TIPO_GAR).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div><label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Estado</label>
                <select style={{ ...inp, cursor:'pointer' }} value={editFormG.estado} onChange={e=>setEditFormG(f=>({...f,estado:e.target.value}))}>
                  {Object.entries(ESTADOS_GAR).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div><label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Entrega estimada</label><input type="date" style={inp} value={editFormG.fecha_entrega_estimada} onChange={e=>setEditFormG(f=>({...f,fecha_entrega_estimada:e.target.value}))} /></div>
              <div><label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Entrega real</label><input type="date" style={inp} value={editFormG.fecha_entrega_real} onChange={e=>setEditFormG(f=>({...f,fecha_entrega_real:e.target.value}))} /></div>
              <div style={{ gridColumn:'span 2' }}><label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Diagnóstico técnico</label><textarea style={{ ...inp, resize:'vertical', minHeight:56 }} value={editFormG.diagnostico} onChange={e=>setEditFormG(f=>({...f,diagnostico:e.target.value}))} /></div>
              <div style={{ gridColumn:'span 2' }}><label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Solución aplicada</label><textarea style={{ ...inp, resize:'vertical', minHeight:56 }} value={editFormG.solucion} onChange={e=>setEditFormG(f=>({...f,solucion:e.target.value}))} /></div>

              {/* Repuestos edición */}
              <div style={{ gridColumn:'span 2' }}>
                <RepuestosWidget
                  reps={editFormG.repuestos||[]}
                  onQuitar={(i) => quitarRepuesto(i, false)}
                  nuevo={nuevoRepEdit}
                  setNuevo={setNuevoRepEdit}
                  esForm={false}
                />
              </div>

              <div><label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Costo mano de obra $</label><input style={inp} value={editFormG.costo_mano_obra} onChange={e=>setEditFormG(f=>({...f,costo_mano_obra:e.target.value}))} /></div>
              <div style={{ display:'flex', alignItems:'flex-end' }}>
                <div style={{ background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.25)', borderRadius:8, padding:'8px 14px', width:'100%' }}>
                  <div style={{ color:'#5a7aaa', fontSize:10, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Total</div>
                  <div style={{ color:'#10b981', fontSize:18, fontWeight:700 }}>{fmt((Number(editFormG.costo_mano_obra)||0)+(editFormG.costo_repuestos||0))}</div>
                </div>
              </div>

              <div style={{ gridColumn:'span 2' }}><label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Observaciones</label><textarea style={{ ...inp, resize:'vertical', minHeight:48 }} value={editFormG.observaciones} onChange={e=>setEditFormG(f=>({...f,observaciones:e.target.value}))} /></div>
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
