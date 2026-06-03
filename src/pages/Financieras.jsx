import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const ENTIDADES = [
  { value:'addi',          label:'ADDI',           color:'#8b5cf6' },
  { value:'credi_ya',      label:'Credi Ya',        color:'#3b82f6' },
  { value:'brilla',        label:'Brilla',          color:'#f59e0b' },
  { value:'banco_bogota',  label:'Banco de Bogotá', color:'#10b981' },
  { value:'alo_credit',    label:'Alo Credit',      color:'#ec4899' },
  { value:'superCreditos', label:'SuperCréditos',   color:'#14b8a6' },
  { value:'crediaguas',    label:'Crediaguas',      color:'#f97316' },
  { value:'renting',       label:'Renting',         color:'#6366f1' },
  { value:'otro',          label:'Otro',            color:'#94a3b8' }
]

const ESTADOS_DESEMBOLSO = {
  pendiente:    { label:'Pendiente',    color:'#f59e0b' },
  parcial:      { label:'Parcial',      color:'#3b82f6' },
  desembolsado: { label:'Desembolsado', color:'#10b981' },
  rechazado:    { label:'Rechazado',    color:'#ef4444' },
  en_revision:  { label:'En revisión',  color:'#8b5cf6' }
}

const fmt = n => new Intl.NumberFormat('es-CO', {
  style:'currency', currency:'COP', maximumFractionDigits:0
}).format(n || 0)

export default function Financieras() {
  const [saldos, setSaldos]     = useState([])
  const [pagos, setPagos]       = useState([])
  const [entidadActiva, setEntidadActiva] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState({
    entidad:'addi', imei:'', producto:'', nombre_cliente:'',
    cedula_cliente:'', valor_venta:'', porcentaje_retencion:'',
    estado_desembolso:'pendiente', fecha_pago:'',
    medio_pago:'', referencia_pago:'', observaciones:''
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadSaldos() }, [])
  useEffect(() => { if (entidadActiva) loadPagos(entidadActiva) }, [entidadActiva])

  async function loadSaldos() {
    const { data } = await supabase.from('v_financieras_saldo').select('*')
    setSaldos(data || [])
    setLoading(false)
  }

  async function loadPagos(entidad) {
    const { data } = await supabase
      .from('financieras_pagos')
      .select('*')
      .eq('entidad', entidad)
      .order('created_at', { ascending: false })
    setPagos(data || [])
  }

  async function registrarPago(e) {
    e.preventDefault()
    setSaving(true)
    const user = (await supabase.auth.getUser()).data.user
    const { error } = await supabase.from('financieras_pagos').insert({
      registrado_por:      user.id,
      entidad:             form.entidad,
      imei:                form.imei,
      producto:            form.producto,
      nombre_cliente:      form.nombre_cliente,
      cedula_cliente:      form.cedula_cliente,
      valor_venta:         Number(form.valor_venta) || 0,
      porcentaje_retencion:Number(form.porcentaje_retencion) || 0,
      estado_desembolso:   form.estado_desembolso,
      fecha_pago:          form.fecha_pago || null,
      medio_pago:          form.medio_pago,
      referencia_pago:     form.referencia_pago,
      observaciones:       form.observaciones
    })
    setSaving(false)
    if (!error) {
      setShowForm(false)
      loadSaldos()
      if (entidadActiva) loadPagos(entidadActiva)
    }
  }

  async function cambiarEstadoPago(id, estado_desembolso) {
    await supabase.from('financieras_pagos').update({ estado_desembolso }).eq('id', id)
    loadSaldos()
    if (entidadActiva) loadPagos(entidadActiva)
  }

  const th = {
    color:'#4a6a8a', fontSize:11, fontWeight:600,
    textTransform:'uppercase', letterSpacing:'0.06em',
    padding:'10px 14px', textAlign:'left', borderBottom:'1px solid #1a2f52', whiteSpace:'nowrap'
  }
  const td = { padding:'10px 14px', color:'#cbd5e1', fontSize:13, borderBottom:'1px solid #0f1e36' }
  const inp = {
    background:'#0a1628', border:'1px solid #1a2f52', borderRadius:6,
    padding:'7px 10px', color:'#fff', fontSize:13, width:'100%', boxSizing:'border-box'
  }

  return (
    <div style={{ padding:'32px 36px', fontFamily:"'DM Sans', system-ui" }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ color:'#fff', fontSize:20, fontWeight:600, margin:'0 0 4px' }}>
            Financieras y pagos
          </h1>
          <p style={{ color:'#4a6a8a', fontSize:13, margin:0 }}>
            Desembolsos por entidad
          </p>
        </div>
        <button onClick={() => setShowForm(true)} style={{
          padding:'10px 20px',
          background:'linear-gradient(135deg,#0066ff,#0044bb)',
          border:'none', borderRadius:8,
          color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer'
        }}>+ Registrar operación</button>
      </div>

      {/* Cards por entidad */}
      {loading ? (
        <div style={{ color:'#4a6a8a', fontSize:13 }}>Cargando...</div>
      ) : (
        <div style={{
          display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px,1fr))',
          gap:14, marginBottom:28
        }}>
          {ENTIDADES.map(ent => {
            const s = saldos.find(x => x.entidad === ent.value)
            const activa = entidadActiva === ent.value
            return (
              <div
                key={ent.value}
                onClick={() => setEntidadActiva(activa ? null : ent.value)}
                style={{
                  background: activa ? '#102040' : '#0d1a35',
                  border: `1px solid ${activa ? ent.color : '#1a2f52'}`,
                  borderRadius:12, padding:'18px 20px', cursor:'pointer',
                  transition:'all 0.15s'
                }}
              >
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                  <div style={{
                    width:10, height:10, borderRadius:'50%', background: ent.color
                  }} />
                  <span style={{ color:'#fff', fontWeight:600, fontSize:14 }}>{ent.label}</span>
                </div>
                {s ? (
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px 0' }}>
                    <div>
                      <div style={{ color:'#4a6a8a', fontSize:10, textTransform:'uppercase',
                        letterSpacing:'0.06em', marginBottom:2 }}>Pendiente</div>
                      <div style={{ color:'#f59e0b', fontWeight:700, fontSize:15 }}>
                        {fmt(s.pendiente_cobro)}
                      </div>
                    </div>
                    <div>
                      <div style={{ color:'#4a6a8a', fontSize:10, textTransform:'uppercase',
                        letterSpacing:'0.06em', marginBottom:2 }}>Cobrado</div>
                      <div style={{ color:'#10b981', fontWeight:700, fontSize:15 }}>
                        {fmt(s.ya_cobrado)}
                      </div>
                    </div>
                    <div style={{ gridColumn:'span 2' }}>
                      <div style={{ color:'#4a6a8a', fontSize:10, textTransform:'uppercase',
                        letterSpacing:'0.06em', marginBottom:2 }}>Ops pendientes</div>
                      <div style={{ color:'#8aabcc', fontSize:13 }}>
                        {s.ops_pendientes} / {s.total_ops} operaciones
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ color:'#4a6a8a', fontSize:12 }}>Sin operaciones</div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Detalle de la entidad activa */}
      {entidadActiva && (
        <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:12, overflow:'auto' }}>
          <div style={{ padding:'16px 20px', borderBottom:'1px solid #1a2f52' }}>
            <span style={{ color:'#fff', fontWeight:600, fontSize:15 }}>
              {ENTIDADES.find(e => e.value === entidadActiva)?.label} — Operaciones
            </span>
          </div>
          {pagos.length === 0 ? (
            <div style={{ padding:32, color:'#4a6a8a', textAlign:'center', fontSize:13 }}>
              No hay operaciones registradas para esta entidad
            </div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:800 }}>
              <thead>
                <tr>
                  <th style={th}>Cliente</th>
                  <th style={th}>Producto / IMEI</th>
                  <th style={th}>Valor bruto</th>
                  <th style={th}>Retención</th>
                  <th style={th}>Valor neto</th>
                  <th style={th}>Estado</th>
                  <th style={th}>Fecha pago</th>
                  <th style={th}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {pagos.map(p => (
                  <tr key={p.id}>
                    <td style={td}>
                      <div style={{ fontWeight:500, color:'#e2e8f0' }}>{p.nombre_cliente || '—'}</div>
                      <div style={{ color:'#4a6a8a', fontSize:11 }}>{p.cedula_cliente}</div>
                    </td>
                    <td style={td}>
                      <div style={{ fontSize:12 }}>{p.producto || '—'}</div>
                      <div style={{ color:'#4a6a8a', fontSize:11, fontFamily:'monospace' }}>{p.imei}</div>
                    </td>
                    <td style={{ ...td, fontWeight:600, color:'#fff', whiteSpace:'nowrap' }}>
                      {fmt(p.valor_venta)}
                    </td>
                    <td style={{ ...td, color:'#f59e0b', whiteSpace:'nowrap' }}>
                      {p.porcentaje_retencion}% ({fmt(p.valor_retencion)})
                    </td>
                    <td style={{ ...td, fontWeight:600, color:'#10b981', whiteSpace:'nowrap' }}>
                      {fmt(p.valor_neto)}
                    </td>
                    <td style={td}>
                      <span style={{
                        background: (ESTADOS_DESEMBOLSO[p.estado_desembolso]?.color || '#94a3b8') + '22',
                        color: ESTADOS_DESEMBOLSO[p.estado_desembolso]?.color || '#94a3b8',
                        fontSize:11, padding:'3px 8px', borderRadius:4, fontWeight:500
                      }}>
                        {ESTADOS_DESEMBOLSO[p.estado_desembolso]?.label}
                      </span>
                    </td>
                    <td style={{ ...td, fontSize:12 }}>
                      {p.fecha_pago
                        ? new Date(p.fecha_pago + 'T12:00').toLocaleDateString('es-CO', {
                            day:'2-digit', month:'short', year:'numeric'
                          })
                        : '—'}
                    </td>
                    <td style={td}>
                      {p.estado_desembolso !== 'desembolsado' && (
                        <button
                          onClick={() => cambiarEstadoPago(p.id, 'desembolsado')}
                          style={{
                            background:'#0f3d2a', border:'1px solid #10b981',
                            borderRadius:6, color:'#10b981', fontSize:11,
                            padding:'4px 10px', cursor:'pointer'
                          }}
                        >✓ Marcar pagado</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modal nuevo pago */}
      {showForm && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.75)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000
        }}>
          <div style={{
            background:'#0d1a35', border:'1px solid #1a2f52',
            borderRadius:14, padding:28, width:'100%', maxWidth:540,
            fontFamily:"'DM Sans', system-ui", maxHeight:'90vh', overflow:'auto'
          }}>
            <h3 style={{ color:'#fff', margin:'0 0 20px', fontSize:16 }}>
              Registrar operación financiera
            </h3>
            <form onSubmit={registrarPago}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px 14px' }}>
                <div style={{ gridColumn:'span 2' }}>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500,
                    textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>
                    Entidad *
                  </label>
                  <select style={{ ...inp, cursor:'pointer' }} value={form.entidad}
                    onChange={e => setForm(f => ({ ...f, entidad: e.target.value }))}>
                    {ENTIDADES.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                  </select>
                </div>
                {[
                  ['nombre_cliente','Cliente'],['cedula_cliente','Cédula'],
                  ['producto','Producto'],['imei','IMEI'],
                  ['valor_venta','Valor venta $'],['porcentaje_retencion','% Retención'],
                  ['medio_pago','Medio de pago'],['referencia_pago','Referencia pago']
                ].map(([k, label]) => (
                  <div key={k}>
                    <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500,
                      textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>
                      {label}
                    </label>
                    <input style={inp} value={form[k]}
                      onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
                  </div>
                ))}
                <div>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500,
                    textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>
                    Estado desembolso
                  </label>
                  <select style={{ ...inp, cursor:'pointer' }} value={form.estado_desembolso}
                    onChange={e => setForm(f => ({ ...f, estado_desembolso: e.target.value }))}>
                    {Object.entries(ESTADOS_DESEMBOLSO).map(([k,v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500,
                    textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>
                    Fecha de pago
                  </label>
                  <input type="date" style={inp} value={form.fecha_pago}
                    onChange={e => setForm(f => ({ ...f, fecha_pago: e.target.value }))} />
                </div>
                <div style={{ gridColumn:'span 2' }}>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500,
                    textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>
                    Observaciones
                  </label>
                  <textarea style={{ ...inp, resize:'vertical', minHeight:60 }}
                    value={form.observaciones}
                    onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} />
                </div>
              </div>
              <div style={{ display:'flex', gap:10, marginTop:20, justifyContent:'flex-end' }}>
                <button type="button" onClick={() => setShowForm(false)} style={{
                  padding:'9px 20px', background:'transparent',
                  border:'1px solid #1a2f52', borderRadius:8,
                  color:'#6b8ab0', fontSize:13, cursor:'pointer'
                }}>Cancelar</button>
                <button type="submit" disabled={saving} style={{
                  padding:'9px 24px',
                  background: saving ? '#1e3058' : 'linear-gradient(135deg,#0066ff,#0044bb)',
                  border:'none', borderRadius:8,
                  color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer'
                }}>
                  {saving ? 'Guardando...' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
