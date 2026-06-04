import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'

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
  const [saldos, setSaldos]           = useState([])
  const [pagos, setPagos]             = useState([])
  const [ventasFinanciera, setVentasFinanciera] = useState([])
  const [entidadActiva, setEntidadActiva] = useState(null)
  const [tabActiva, setTabActiva]     = useState('ventas') // 'ventas' | 'pagos' | 'cruce'
  const [loading, setLoading]         = useState(true)
  const [showForm, setShowForm]       = useState(false)
  const [cruceResultado, setCruceResultado] = useState(null)
  const [procesandoExcel, setProcesandoExcel] = useState(false)
  const [form, setForm] = useState({
    entidad:'addi', imei:'', producto:'', nombre_cliente:'',
    cedula_cliente:'', valor_venta:'', porcentaje_retencion:'',
    estado_desembolso:'pendiente', fecha_pago:'',
    medio_pago:'', referencia_pago:'', observaciones:''
  })
  const [saving, setSaving] = useState(false)
  const fileRef = useRef()

  useEffect(() => { loadSaldos() }, [])
  useEffect(() => {
    if (entidadActiva) {
      loadPagos(entidadActiva)
      loadVentasFinanciera(entidadActiva)
    }
  }, [entidadActiva])

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

  async function loadVentasFinanciera(entidad) {
    // Ventas cuyo método de pago corresponde a esta financiera
    const metodoMap = {
      addi: 'addi', credi_ya: 'credi_ya', brilla: 'brilla',
      banco_bogota: 'banco_bogota'
    }
    const metodo = metodoMap[entidad]
    if (!metodo) { setVentasFinanciera([]); return }

    const { data } = await supabase
      .from('ventas')
      .select('id,fecha_venta,nombre_cliente,cedula_cliente,producto,imei,valor_venta,cuota_inicial,asesor_nombre,estado')
      .eq('metodo_pago', metodo)
      .order('fecha_venta', { ascending: false })
    setVentasFinanciera(data || [])
  }

  async function registrarPago(e) {
    e.preventDefault()
    setSaving(true)
    const user = (await supabase.auth.getUser()).data.user
    await supabase.from('financieras_pagos').insert({
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
    setShowForm(false)
    loadSaldos()
    if (entidadActiva) { loadPagos(entidadActiva); loadVentasFinanciera(entidadActiva) }
  }

  async function marcarPagado(id) {
    await supabase.from('financieras_pagos')
      .update({ estado_desembolso: 'desembolsado', fecha_pago: new Date().toISOString().split('T')[0] })
      .eq('id', id)
    loadSaldos()
    if (entidadActiva) loadPagos(entidadActiva)
  }

  // CRUCE EXCEL: leer archivo de la financiera y cruzar con ventas
  async function procesarExcelFinanciera(e) {
    const file = e.target.files[0]
    if (!file) return
    setProcesandoExcel(true)
    setCruceResultado(null)

    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })

      // Buscar columnas por nombres comunes (IMEI, cédula, valor)
      const sample = rows[0] || {}
      const keys = Object.keys(sample)
      const findCol = (...terms) => keys.find(k =>
        terms.some(t => k.toLowerCase().includes(t.toLowerCase()))
      )

      const colImei   = findCol('imei','serial','serie')
      const colCedula = findCol('cedula','identificacion','cc','documento')
      const colValor  = findCol('valor','monto','precio','desembolso')
      const colNombre = findCol('nombre','cliente','titular')
      const colRef    = findCol('referencia','producto','equipo','modelo')

      const equiposExcel = rows.map(r => ({
        imei:    String(r[colImei]   || '').trim(),
        cedula:  String(r[colCedula] || '').trim(),
        valor:   Number(r[colValor]  || 0),
        nombre:  String(r[colNombre] || '').trim(),
        ref:     String(r[colRef]    || '').trim(),
      })).filter(r => r.imei || r.cedula)

      // Cruzar con ventas de la financiera activa
      const imeis  = equiposExcel.map(e => e.imei).filter(Boolean)
      const cedulas = equiposExcel.map(e => e.cedula).filter(Boolean)

      const { data: ventasCruce } = await supabase
        .from('ventas')
        .select('id,imei,cedula_cliente,nombre_cliente,producto,valor_venta,asesor_nombre,fecha_venta')
        .or(`imei.in.(${imeis.map(i=>`"${i}"`).join(',')}),cedula_cliente.in.(${cedulas.map(c=>`"${c}"`).join(',')})`)

      const ventasMap = {}
      ;(ventasCruce || []).forEach(v => {
        ventasMap[v.imei] = v
        ventasMap[v.cedula_cliente] = v
      })

      const encontrados  = equiposExcel.filter(e => ventasMap[e.imei] || ventasMap[e.cedula])
      const noEncontrados = equiposExcel.filter(e => !ventasMap[e.imei] && !ventasMap[e.cedula])

      // Marcar como desembolsados los que coincidan
      for (const eq of encontrados) {
        const venta = ventasMap[eq.imei] || ventasMap[eq.cedula]
        if (venta) {
          // Registrar o actualizar pago
          await supabase.from('financieras_pagos').upsert({
            entidad:           entidadActiva,
            venta_id:          venta.id,
            imei:              venta.imei,
            producto:          venta.producto,
            nombre_cliente:    venta.nombre_cliente,
            cedula_cliente:    venta.cedula_cliente,
            valor_venta:       eq.valor || venta.valor_venta,
            estado_desembolso: 'desembolsado',
            fecha_pago:        new Date().toISOString().split('T')[0],
            registrado_por:    (await supabase.auth.getUser()).data.user?.id
          }, { onConflict: 'venta_id,entidad' }).catch(() => {})
        }
      }

      setCruceResultado({
        total:           equiposExcel.length,
        encontrados:     encontrados.length,
        noEncontrados:   noEncontrados.length,
        detalleEncontrados: encontrados.map(e => ({
          ...e, venta: ventasMap[e.imei] || ventasMap[e.cedula]
        })),
        detalleNoEncontrados: noEncontrados,
        columnas: { colImei, colCedula, colValor, colNombre, colRef }
      })

      loadSaldos()
      if (entidadActiva) { loadPagos(entidadActiva); loadVentasFinanciera(entidadActiva) }
    } catch (err) {
      alert('Error al procesar el archivo: ' + err.message)
    }
    setProcesandoExcel(false)
    e.target.value = ''
  }

  const th = {
    color:'#4a6a8a', fontSize:11, fontWeight:600, textTransform:'uppercase',
    letterSpacing:'0.06em', padding:'10px 14px', textAlign:'left',
    borderBottom:'1px solid #1a2f52', whiteSpace:'nowrap'
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
          <h1 style={{ color:'#fff', fontSize:20, fontWeight:600, margin:'0 0 4px' }}>Financieras y pagos</h1>
          <p style={{ color:'#4a6a8a', fontSize:13, margin:0 }}>Desembolsos y cruce de pagos</p>
        </div>
        <button onClick={() => setShowForm(true)} style={{
          padding:'10px 20px', background:'linear-gradient(135deg,#0066ff,#0044bb)',
          border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer'
        }}>+ Registrar operación</button>
      </div>

      {/* Cards por entidad */}
      {loading ? (
        <div style={{ color:'#4a6a8a', fontSize:13 }}>Cargando...</div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px,1fr))', gap:12, marginBottom:24 }}>
          {ENTIDADES.map(ent => {
            const s = saldos.find(x => x.entidad === ent.value)
            const activa = entidadActiva === ent.value
            return (
              <div key={ent.value}
                onClick={() => { setEntidadActiva(activa ? null : ent.value); setTabActiva('ventas'); setCruceResultado(null) }}
                style={{
                  background: activa ? '#102040' : '#0d1a35',
                  border: `1px solid ${activa ? ent.color : '#1a2f52'}`,
                  borderRadius:12, padding:'16px 18px', cursor:'pointer', transition:'all .15s'
                }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                  <div style={{ width:10, height:10, borderRadius:'50%', background:ent.color }} />
                  <span style={{ color:'#fff', fontWeight:600, fontSize:13 }}>{ent.label}</span>
                </div>
                {s ? (
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px 0' }}>
                    <div>
                      <div style={{ color:'#4a6a8a', fontSize:10, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:2 }}>Pendiente</div>
                      <div style={{ color:'#f59e0b', fontWeight:700, fontSize:13 }}>{fmt(s.pendiente_cobro)}</div>
                    </div>
                    <div>
                      <div style={{ color:'#4a6a8a', fontSize:10, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:2 }}>Cobrado</div>
                      <div style={{ color:'#10b981', fontWeight:700, fontSize:13 }}>{fmt(s.ya_cobrado)}</div>
                    </div>
                    <div style={{ gridColumn:'span 2', marginTop:4 }}>
                      <span style={{ color:'#8aabcc', fontSize:11 }}>{s.ops_pendientes} pendientes · {s.ops_cobradas} cobradas</span>
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

      {/* Detalle entidad activa */}
      {entidadActiva && (
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <div style={{ display:'flex', gap:4 }}>
              {[['ventas','Ventas con esta financiera'],['pagos','Pagos registrados'],['cruce','Cruzar extracto']].map(([k,l]) => (
                <button key={k} onClick={() => setTabActiva(k)} style={{
                  padding:'7px 14px', borderRadius:7,
                  background: tabActiva === k ? '#1a2f52' : 'transparent',
                  border: tabActiva === k ? '1px solid #2a4f82' : '1px solid #1a2f52',
                  color: tabActiva === k ? '#fff' : '#4a6a8a',
                  fontSize:12, cursor:'pointer'
                }}>{l}</button>
              ))}
            </div>
          </div>

          {/* TAB: VENTAS CON FINANCIERA */}
          {tabActiva === 'ventas' && (
            <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:12, overflow:'auto' }}>
              {ventasFinanciera.length === 0 ? (
                <div style={{ padding:32, textAlign:'center', color:'#4a6a8a', fontSize:13 }}>
                  No hay ventas registradas con {ENTIDADES.find(e=>e.value===entidadActiva)?.label}
                </div>
              ) : (
                <table style={{ width:'100%', borderCollapse:'collapse', minWidth:800 }}>
                  <thead>
                    <tr>
                      <th style={th}>Fecha</th>
                      <th style={th}>Cliente</th>
                      <th style={th}>Cédula</th>
                      <th style={th}>Producto</th>
                      <th style={th}>IMEI</th>
                      <th style={th}>Valor venta</th>
                      <th style={th}>Asesor</th>
                      <th style={th}>Estado venta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ventasFinanciera.map(v => (
                      <tr key={v.id}>
                        <td style={{ ...td, fontSize:12, whiteSpace:'nowrap' }}>
                          {new Date(v.fecha_venta+'T12:00').toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'})}
                        </td>
                        <td style={{ ...td, fontWeight:500, color:'#e2e8f0' }}>{v.nombre_cliente}</td>
                        <td style={{ ...td, fontSize:12, color:'#8aabcc' }}>{v.cedula_cliente}</td>
                        <td style={{ ...td, fontSize:12 }}>{v.producto}</td>
                        <td style={{ ...td, fontSize:11, fontFamily:'monospace', color:'#8aabcc' }}>{v.imei}</td>
                        <td style={{ ...td, fontWeight:600, color:'#fff', whiteSpace:'nowrap' }}>{fmt(v.valor_venta)}</td>
                        <td style={{ ...td, fontSize:12 }}>{v.asesor_nombre}</td>
                        <td style={td}>
                          <span style={{
                            background: v.estado==='entregada' ? '#0f3d2a' : '#1a2f52',
                            color: v.estado==='entregada' ? '#10b981' : '#8aabcc',
                            fontSize:11, padding:'2px 8px', borderRadius:4
                          }}>{v.estado}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TAB: PAGOS REGISTRADOS */}
          {tabActiva === 'pagos' && (
            <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:12, overflow:'auto' }}>
              {pagos.length === 0 ? (
                <div style={{ padding:32, textAlign:'center', color:'#4a6a8a', fontSize:13 }}>
                  No hay pagos registrados. Usa "Cruzar extracto" para importar desde Excel.
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
                        <td style={{ ...td, fontWeight:600, color:'#fff', whiteSpace:'nowrap' }}>{fmt(p.valor_venta)}</td>
                        <td style={{ ...td, color:'#f59e0b', whiteSpace:'nowrap' }}>
                          {p.porcentaje_retencion}% ({fmt(p.valor_retencion)})
                        </td>
                        <td style={{ ...td, fontWeight:600, color:'#10b981', whiteSpace:'nowrap' }}>{fmt(p.valor_neto)}</td>
                        <td style={td}>
                          <span style={{
                            background: (ESTADOS_DESEMBOLSO[p.estado_desembolso]?.color||'#94a3b8') + '22',
                            color: ESTADOS_DESEMBOLSO[p.estado_desembolso]?.color||'#94a3b8',
                            fontSize:11, padding:'3px 8px', borderRadius:4, fontWeight:500
                          }}>{ESTADOS_DESEMBOLSO[p.estado_desembolso]?.label}</span>
                        </td>
                        <td style={{ ...td, fontSize:12 }}>
                          {p.fecha_pago ? new Date(p.fecha_pago+'T12:00').toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'}) : '—'}
                        </td>
                        <td style={td}>
                          {p.estado_desembolso !== 'desembolsado' && (
                            <button onClick={() => marcarPagado(p.id)} style={{
                              background:'#0f3d2a', border:'1px solid #10b981',
                              borderRadius:6, color:'#10b981', fontSize:11, padding:'4px 10px', cursor:'pointer'
                            }}>✓ Marcar pagado</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TAB: CRUZAR EXTRACTO EXCEL */}
          {tabActiva === 'cruce' && (
            <div>
              <div style={{
                background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:12,
                padding:'24px 28px', marginBottom:16
              }}>
                <div style={{ color:'#fff', fontSize:14, fontWeight:500, marginBottom:8 }}>
                  Subir extracto de {ENTIDADES.find(e=>e.value===entidadActiva)?.label}
                </div>
                <div style={{ color:'#4a6a8a', fontSize:13, marginBottom:16, lineHeight:1.6 }}>
                  Sube el archivo Excel del reporte de la financiera. El sistema cruzará automáticamente
                  los equipos pagados con las ventas registradas usando IMEI o cédula del cliente.
                  Los que coincidan quedarán marcados como <strong style={{color:'#10b981'}}>desembolsados</strong>.
                </div>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv"
                  style={{ display:'none' }} onChange={procesarExcelFinanciera} />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={procesandoExcel}
                  style={{
                    padding:'10px 24px',
                    background: procesandoExcel ? '#1e3058' : 'linear-gradient(135deg,#0066ff,#0044bb)',
                    border:'none', borderRadius:8, color:'#fff',
                    fontSize:13, fontWeight:600, cursor: procesandoExcel ? 'wait' : 'pointer'
                  }}>
                  {procesandoExcel ? '⏳ Procesando...' : '📂 Seleccionar archivo Excel'}
                </button>
              </div>

              {/* Resultado del cruce */}
              {cruceResultado && (
                <div>
                  <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
                    {[
                      { label:'Total en extracto', val: cruceResultado.total, color:'#8b5cf6' },
                      { label:'Encontrados en portal', val: cruceResultado.encontrados, color:'#10b981' },
                      { label:'No encontrados', val: cruceResultado.noEncontrados, color:'#ef4444' },
                    ].map(k => (
                      <div key={k.label} style={{
                        background:'#0d1a35', border:'1px solid #1a2f52',
                        borderRadius:8, padding:'12px 18px', flex:1, minWidth:140
                      }}>
                        <div style={{ color:k.color, fontSize:22, fontWeight:700 }}>{k.val}</div>
                        <div style={{ color:'#8aabcc', fontSize:12, marginTop:2 }}>{k.label}</div>
                      </div>
                    ))}
                  </div>

                  {cruceResultado.detalleEncontrados.length > 0 && (
                    <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:12, overflow:'auto', marginBottom:12 }}>
                      <div style={{ padding:'12px 16px', borderBottom:'1px solid #1a2f52', color:'#10b981', fontSize:13, fontWeight:500 }}>
                        ✓ Equipos cruzados exitosamente ({cruceResultado.encontrados})
                      </div>
                      <table style={{ width:'100%', borderCollapse:'collapse' }}>
                        <thead>
                          <tr>
                            <th style={th}>Cliente</th>
                            <th style={th}>IMEI extracto</th>
                            <th style={th}>Producto portal</th>
                            <th style={th}>Valor extracto</th>
                            <th style={th}>Valor venta</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cruceResultado.detalleEncontrados.map((e, i) => (
                            <tr key={i}>
                              <td style={td}>{e.venta?.nombre_cliente || e.nombre || '—'}</td>
                              <td style={{ ...td, fontSize:11, fontFamily:'monospace', color:'#8aabcc' }}>{e.imei || '—'}</td>
                              <td style={{ ...td, fontSize:12 }}>{e.venta?.producto || '—'}</td>
                              <td style={{ ...td, color:'#10b981', fontWeight:500 }}>{fmt(e.valor)}</td>
                              <td style={{ ...td, color:'#fff', fontWeight:600 }}>{fmt(e.venta?.valor_venta)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {cruceResultado.detalleNoEncontrados.length > 0 && (
                    <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:12, overflow:'auto' }}>
                      <div style={{ padding:'12px 16px', borderBottom:'1px solid #1a2f52', color:'#ef4444', fontSize:13, fontWeight:500 }}>
                        ⚠ No encontrados en el portal ({cruceResultado.noEncontrados}) — revisar manualmente
                      </div>
                      <table style={{ width:'100%', borderCollapse:'collapse' }}>
                        <thead>
                          <tr>
                            <th style={th}>Nombre</th>
                            <th style={th}>IMEI</th>
                            <th style={th}>Cédula</th>
                            <th style={th}>Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cruceResultado.detalleNoEncontrados.map((e, i) => (
                            <tr key={i}>
                              <td style={td}>{e.nombre || '—'}</td>
                              <td style={{ ...td, fontSize:11, fontFamily:'monospace', color:'#8aabcc' }}>{e.imei || '—'}</td>
                              <td style={{ ...td, fontSize:12 }}>{e.cedula || '—'}</td>
                              <td style={{ ...td, color:'#f59e0b' }}>{fmt(e.valor)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
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
            <h3 style={{ color:'#fff', margin:'0 0 20px', fontSize:16 }}>Registrar operación financiera</h3>
            <form onSubmit={registrarPago}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px 14px' }}>
                <div style={{ gridColumn:'span 2' }}>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500,
                    textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Entidad *</label>
                  <select style={{ ...inp, cursor:'pointer' }} value={form.entidad}
                    onChange={e => setForm(f=>({...f, entidad:e.target.value}))}>
                    {ENTIDADES.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                  </select>
                </div>
                {[['nombre_cliente','Cliente'],['cedula_cliente','Cédula'],
                  ['producto','Producto'],['imei','IMEI'],
                  ['valor_venta','Valor venta $'],['porcentaje_retencion','% Retención'],
                  ['medio_pago','Medio de pago'],['referencia_pago','Referencia pago']
                ].map(([k,l]) => (
                  <div key={k}>
                    <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500,
                      textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>{l}</label>
                    <input style={inp} value={form[k]}
                      onChange={e => setForm(f=>({...f,[k]:e.target.value}))} />
                  </div>
                ))}
                <div>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500,
                    textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Estado</label>
                  <select style={{ ...inp, cursor:'pointer' }} value={form.estado_desembolso}
                    onChange={e => setForm(f=>({...f, estado_desembolso:e.target.value}))}>
                    {Object.entries(ESTADOS_DESEMBOLSO).map(([k,v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500,
                    textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Fecha de pago</label>
                  <input type="date" style={inp} value={form.fecha_pago}
                    onChange={e => setForm(f=>({...f, fecha_pago:e.target.value}))} />
                </div>
                <div style={{ gridColumn:'span 2' }}>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500,
                    textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Observaciones</label>
                  <textarea style={{ ...inp, resize:'vertical', minHeight:60 }}
                    value={form.observaciones}
                    onChange={e => setForm(f=>({...f, observaciones:e.target.value}))} />
                </div>
              </div>
              <div style={{ display:'flex', gap:10, marginTop:20, justifyContent:'flex-end' }}>
                <button type="button" onClick={() => setShowForm(false)} style={{
                  padding:'9px 20px', background:'transparent', border:'1px solid #1a2f52',
                  borderRadius:8, color:'#6b8ab0', fontSize:13, cursor:'pointer'
                }}>Cancelar</button>
                <button type="submit" disabled={saving} style={{
                  padding:'9px 24px', background:'linear-gradient(135deg,#0066ff,#0044bb)',
                  border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer'
                }}>{saving ? 'Guardando...' : 'Registrar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}