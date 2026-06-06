import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { logActividad } from '../lib/drive'

const ASESORES = {
  call_center: [
    'Kevin David. Call','Alberto. Call','Gloria Steffany. Call',
    'Brayan O. Call','Ana Sofia. Call','Carlos Andres. Call',
    'Emanuel. Call','Diana. Call','Sergio. Call'
  ],
  mostrador: [
    'Alexandra. Mostrador','Valentina. Mostrador','Maria Alejandra. Mostrador',
    'Laura. Mostrador','Carolina. Mostrador','Alejandro M. Mostrador',
    'Felipe. Mostrador','Juan Felipe. Mostrador','Cristian. Mostrador'
  ]
}
const TODOS_ASESORES = [...ASESORES.call_center, ...ASESORES.mostrador]

const METODOS = [
  { value:'contado',       label:'Contado' },
  { value:'transferencia', label:'Transferencia' },
  { value:'tarjeta',       label:'Tarjeta / Datáfono' },
  { value:'addi',          label:'ADDI' },
  { value:'credi_ya',      label:'Credi Ya' },
  { value:'brilla',        label:'Brilla' },
  { value:'banco_bogota',  label:'Banco de Bogotá' },
  { value:'contraentrega', label:'Contraentrega' },
  { value:'mixto',         label:'Mixto' },
]

const inp = {
  background:'#0a1628', border:'1px solid #1a2f52',
  borderRadius:8, padding:'9px 12px', color:'#fff',
  fontSize:13, width:'100%', boxSizing:'border-box', outline:'none'
}
const sel = { ...inp, cursor:'pointer' }

function Field({ label, children, required, span }) {
  return (
    <div style={{ gridColumn: span ? `span ${span}` : undefined }}>
      <label style={{ display:'block', color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:5 }}>
        {label}{required && <span style={{ color:'#f43f5e' }}> *</span>}
      </label>
      {children}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom:28 }}>
      <div style={{ color:'#4a7aaa', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', borderBottom:'1px solid #1a2f52', paddingBottom:8, marginBottom:16 }}>{title}</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px,1fr))', gap:'14px 16px' }}>
        {children}
      </div>
    </div>
  )
}

export default function EditarVenta() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const [form, setForm]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState(false)
  const [proveedores, setProveedores] = useState([])

  useEffect(() => {
    loadVenta()
    supabase.from('proveedores').select('id,nombre').eq('activo',true).order('nombre')
      .then(({ data }) => setProveedores(data || []))
  }, [id])

  async function loadVenta() {
    const { data, error } = await supabase.from('ventas').select('*').eq('id', id).single()
    if (error || !data) { navigate('/ventas'); return }
    setForm(data)
    setLoading(false)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const num = v => Number(String(v).replace(/\./g,'').replace(/,/g,'.').replace(/[^\d.]/g,'')) || 0

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const { error: errUpdate } = await supabase.from('ventas').update({
      fecha_venta:       form.fecha_venta,
      fecha_entrega:     form.fecha_entrega || null,
      canal:             form.canal,
      asesor_nombre:     form.asesor_nombre,
      metodo_pago:       form.metodo_pago,
      pago_efectivo:     num(form.pago_efectivo),
      pago_transferencia:num(form.pago_transferencia),
      pago_tarjeta:      num(form.pago_tarjeta),
      cedula_cliente:    form.cedula_cliente,
      nombre_cliente:    form.nombre_cliente,
      telefono_cliente:  form.telefono_cliente,
      email_cliente:     form.email_cliente,
      ciudad_cliente:    form.ciudad_cliente,
      direccion_cliente: form.es_domicilio ? form.direccion_cliente : null,
      producto:          form.producto,
      color:             form.color,
      imei:              form.imei,
      proveedor:         form.proveedor,
      costo_equipo:      num(form.costo_equipo),
      no_factura:        form.no_factura,
      valor_venta:       num(form.valor_venta),
      cuota_inicial:     num(form.cuota_inicial),
      numero_cuotas:     Number(form.numero_cuotas) || 1,
      valor_cuota:       num(form.valor_cuota),
      comision_compartida: form.comision_compartida,
      asesor_compartido:   form.comision_compartida ? form.asesor_compartido : null,
      es_domicilio:      form.es_domicilio,
      observaciones:     form.observaciones,
    }).eq('id', id)

    if (errUpdate) { setError('Error al guardar: ' + errUpdate.message); setSaving(false); return }

    // Si ahora tiene IMEI y antes no — marcar en inventario
    if (form.imei?.trim().length >= 10) {
      await supabase.from('compras_proveedor')
        .update({ estado: 'vendido', venta_id: id })
        .eq('imei', form.imei.trim())
        .eq('estado', 'disponible')
    }

    const user = (await supabase.auth.getUser()).data.user
    await logActividad({
      usuario: perfil?.nombre || user?.email || '',
      accion: 'EDICION_VENTA',
      detalle: `${form.producto} | ${form.nombre_cliente} | $${num(form.valor_venta).toLocaleString('es-CO')}`,
      tabla: 'ventas'
    })

    setSuccess(true)
    setSaving(false)
    setTimeout(() => navigate('/ventas'), 1500)
  }

  if (loading) return (
    <div style={{ padding:80, textAlign:'center', color:'#4a6a8a', fontFamily:"'DM Sans', system-ui" }}>Cargando venta...</div>
  )

  if (success) return (
    <div style={{ padding:'80px 36px', textAlign:'center', fontFamily:"'DM Sans', system-ui" }}>
      <div style={{ fontSize:48, marginBottom:16 }}>✅</div>
      <h2 style={{ color:'#fff', margin:'0 0 8px' }}>Venta actualizada</h2>
      <p style={{ color:'#4a6a8a', fontSize:14 }}>Redirigiendo...</p>
    </div>
  )

  const asesoresFiltrados = form.canal === 'call_center' ? ASESORES.call_center : ASESORES.mostrador

  return (
    <div style={{ padding:'32px 36px', maxWidth:900, fontFamily:"'DM Sans', system-ui, sans-serif" }}>
      <div style={{ marginBottom:28 }}>
        <button onClick={() => navigate('/ventas')} style={{ background:'transparent', border:'none', color:'#4a6a8a', fontSize:13, cursor:'pointer', padding:0, marginBottom:12 }}>← Volver a ventas</button>
        <h1 style={{ color:'#fff', fontSize:20, fontWeight:600, margin:0 }}>Continuar venta</h1>
        <p style={{ color:'#4a6a8a', fontSize:13, margin:'4px 0 0' }}>Completa o corrige la información de esta venta</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:14, padding:'28px 32px' }}>

          <Section title="📅 Información general">
            <Field label="Fecha de venta" required>
              <input type="date" style={inp} value={form.fecha_venta || ''} onChange={e => set('fecha_venta', e.target.value)} required />
            </Field>
            <Field label="Fecha de entrega">
              <input type="date" style={inp} value={form.fecha_entrega || ''} onChange={e => set('fecha_entrega', e.target.value)} />
            </Field>
            <Field label="Canal" required>
              <select style={sel} value={form.canal || 'mostrador'} onChange={e => set('canal', e.target.value)}>
                <option value="mostrador">Mostrador</option>
                <option value="call_center">Call Center</option>
              </select>
            </Field>
            <Field label="Asesor" required>
              <select style={sel} value={form.asesor_nombre || ''} onChange={e => set('asesor_nombre', e.target.value)} required>
                <option value="">Seleccionar asesor...</option>
                {asesoresFiltrados.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </Field>
            <Field label="# Factura">
              <input style={inp} value={form.no_factura || ''} onChange={e => set('no_factura', e.target.value)} />
            </Field>
          </Section>

          <Section title="👤 Datos del cliente">
            <Field label="Cédula" required>
              <input style={inp} value={form.cedula_cliente || ''} onChange={e => set('cedula_cliente', e.target.value)} required />
            </Field>
            <Field label="Nombre completo" required span={2}>
              <input style={inp} value={form.nombre_cliente || ''} onChange={e => set('nombre_cliente', e.target.value)} required />
            </Field>
            <Field label="Teléfono">
              <input style={inp} value={form.telefono_cliente || ''} onChange={e => set('telefono_cliente', e.target.value)} />
            </Field>
            <Field label="Correo">
              <input type="email" style={inp} value={form.email_cliente || ''} onChange={e => set('email_cliente', e.target.value)} />
            </Field>
            <Field label="Ciudad" required>
              <input style={inp} value={form.ciudad_cliente || ''} onChange={e => set('ciudad_cliente', e.target.value)} required />
            </Field>
          </Section>

          <Section title="📱 Producto">
            <Field label="Producto" required span={2}>
              <input style={inp} value={form.producto || ''} onChange={e => set('producto', e.target.value)} required />
            </Field>
            <Field label="Color">
              <input style={inp} value={form.color || ''} onChange={e => set('color', e.target.value)} />
            </Field>
            <Field label="IMEI" required>
              <input style={inp} value={form.imei || ''} onChange={e => set('imei', e.target.value)} placeholder="15 dígitos" required />
            </Field>
            <Field label="Proveedor" required>
              <select style={sel} value={form.proveedor || ''} onChange={e => set('proveedor', e.target.value)} required>
                <option value="">Seleccionar...</option>
                {proveedores.map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
              </select>
            </Field>
            <Field label="Costo equipo $">
              <input style={inp} value={form.costo_equipo || ''} onChange={e => set('costo_equipo', e.target.value)} placeholder="0" />
            </Field>
          </Section>

          <Section title="💰 Valores">
            <Field label="Valor de venta $" required>
              <input style={inp} value={form.valor_venta || ''} onChange={e => set('valor_venta', e.target.value)} required />
            </Field>
            <Field label="Cuota inicial $">
              <input style={inp} value={form.cuota_inicial || '0'} onChange={e => set('cuota_inicial', e.target.value)} />
            </Field>
            <Field label="# Cuotas">
              <input type="number" min="1" style={inp} value={form.numero_cuotas || '1'} onChange={e => set('numero_cuotas', e.target.value)} />
            </Field>
            <Field label="Valor cuota $">
              <input style={inp} value={form.valor_cuota || '0'} onChange={e => set('valor_cuota', e.target.value)} />
            </Field>
          </Section>

          <Section title="💳 Método de pago">
            <Field label="Método" required>
              <select style={sel} value={form.metodo_pago || 'contado'} onChange={e => set('metodo_pago', e.target.value)}>
                {METODOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </Field>
            {['contado','mixto'].includes(form.metodo_pago) && (
              <Field label="Efectivo $"><input style={inp} value={form.pago_efectivo || ''} onChange={e => set('pago_efectivo', e.target.value)} /></Field>
            )}
            {['transferencia','mixto'].includes(form.metodo_pago) && (
              <Field label="Transferencia $"><input style={inp} value={form.pago_transferencia || ''} onChange={e => set('pago_transferencia', e.target.value)} /></Field>
            )}
            {['tarjeta','mixto'].includes(form.metodo_pago) && (
              <Field label="Tarjeta $"><input style={inp} value={form.pago_tarjeta || ''} onChange={e => set('pago_tarjeta', e.target.value)} /></Field>
            )}
          </Section>

          <Section title="⚙️ Opciones">
            <Field label="¿Es domicilio?">
              <label style={{ display:'flex', alignItems:'center', gap:8, color:'#fff', fontSize:13, cursor:'pointer' }}>
                <input type="checkbox" checked={form.es_domicilio || false} onChange={e => set('es_domicilio', e.target.checked)} />
                Sí, tiene despacho
              </label>
            </Field>
            {form.es_domicilio && (
              <Field label="Dirección" required span={2}>
                <input style={inp} value={form.direccion_cliente || ''} onChange={e => set('direccion_cliente', e.target.value)} placeholder="Dirección completa" required />
              </Field>
            )}
            <Field label="¿Comisión compartida?">
              <label style={{ display:'flex', alignItems:'center', gap:8, color:'#fff', fontSize:13, cursor:'pointer' }}>
                <input type="checkbox" checked={form.comision_compartida || false} onChange={e => set('comision_compartida', e.target.checked)} />
                Sí, compartida
              </label>
            </Field>
            {form.comision_compartida && (
              <Field label="Asesor compartido">
                <select style={sel} value={form.asesor_compartido || ''} onChange={e => set('asesor_compartido', e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {TODOS_ASESORES.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </Field>
            )}
            <Field label="Observaciones" span={2}>
              <textarea style={{ ...inp, resize:'vertical', minHeight:72 }} value={form.observaciones || ''} onChange={e => set('observaciones', e.target.value)} />
            </Field>
          </Section>
        </div>

        {error && (
          <div style={{ margin:'16px 0', padding:'12px 16px', background:'rgba(244,63,94,0.1)', border:'1px solid rgba(244,63,94,0.3)', borderRadius:8, color:'#f87171', fontSize:13 }}>{error}</div>
        )}

        <div style={{ display:'flex', gap:12, marginTop:20 }}>
          <button type="button" onClick={() => navigate('/ventas')} style={{ padding:'12px 24px', background:'transparent', border:'1px solid #1a2f52', borderRadius:8, color:'#6b8ab0', fontSize:14, cursor:'pointer' }}>Cancelar</button>
          <button type="submit" disabled={saving} style={{ padding:'12px 32px', background: saving ? '#1e3058' : 'linear-gradient(135deg,#0066ff,#0044bb)', border:'none', borderRadius:8, color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer' }}>
            {saving ? 'Guardando...' : 'Guardar cambios ✓'}
          </button>
        </div>
      </form>
    </div>
  )
}
