import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const PRODUCTOS = [
  'IPHONE 11 64GB - EXHIBICIÓN','IPHONE 11 128GB - EXHIBICIÓN',
  'IPHONE 11 PRO 64GB - EXHIBICIÓN','IPHONE 11 PRO MAX 256GB - EXHIBICIÓN',
  'IPHONE 11 PRO MAX 64GB - EXHIBICIÓN','IPHONE 12 128GB - EXHIBICIÓN',
  'IPHONE 12 256GB - EXHIBICIÓN','IPHONE 12 PRO 256GB - EXHIBICIÓN',
  'IPHONE 12 PRO MAX 128GB - EXHIBICIÓN','IPHONE 12 PRO MAX 256GB - EXHIBICIÓN',
  'IPHONE 13 128GB - EXHIBICIÓN','IPHONE 13 256GB - EXHIBICIÓN',
  'IPHONE 13 MINI 128GB - EXHIBICIÓN','IPHONE 13 PRO 128GB - EXHIBICIÓN',
  'IPHONE 13 PRO 256GB - EXHIBICIÓN','IPHONE 13 PRO MAX 128GB - EXHIBICIÓN',
  'IPHONE 13 PRO MAX 256GB - EXHIBICIÓN','IPHONE 14 128GB - EXHIBICIÓN',
  'IPHONE 14 PLUS 128GB - EXHIBICIÓN','IPHONE 14 PRO 128GB - EXHIBICIÓN',
  'IPHONE 14 PRO 256GB - EXHIBICIÓN','IPHONE 14 PRO MAX 128GB - EXHIBICIÓN',
  'IPHONE 14 PRO MAX 256GB - EXHIBICIÓN','IPHONE 14 PRO MAX 512GB - EXHIBICIÓN',
  'IPHONE 15 128GB - EXHIBICIÓN','IPHONE 15 256GB - EXHIBICIÓN',
  'IPHONE 15 PLUS 256GB - EXHIBICIÓN','IPHONE 15 PRO 128GB - EXHIBICIÓN',
  'IPHONE 15 PRO 256GB - EXHIBICIÓN','IPHONE 15 PRO MAX 256GB - EXHIBICIÓN',
  'IPHONE 15 PRO MAX 512GB - EXHIBICIÓN','IPHONE 15 PRO MAX 1TB - EXHIBICIÓN',
  'IPHONE 16 128GB - EXHIBICIÓN','IPHONE 16 256GB - EXHIBICIÓN',
  'IPHONE 16 PRO 128GB - EXHIBICIÓN','IPHONE 16 PRO 256GB - EXHIBICIÓN',
  'IPHONE 16 PRO MAX 256GB - EXHIBICIÓN','IPHONE 16 PRO MAX 512GB - EXHIBICIÓN',
  'IPHONE 16E 128GB - EXHIBICIÓN',
  'IPHONE 13 128GB - NUEVO','IPHONE 13 512GB - NUEVO',
  'IPHONE 14 128GB - NUEVO','IPHONE 15 128GB - NUEVO',
  'IPHONE 16 128GB - NUEVO','IPHONE 16 256GB - NUEVO',
  'IPHONE 16 PRO MAX 256GB - NUEVO','IPHONE 16 PRO MAX 512GB - NUEVO',
  'IPHONE 16E 128GB - NUEVO',
  'IPHONE 17 256GB - NUEVO','IPHONE 17 256GB - NUEVO FISICA',
  'IPHONE 17 AIR 256GB - NUEVO','IPHONE 17 AIR 512GB - NUEVO',
  'IPHONE 17 PRO 256GB - NUEVO','IPHONE 17 PRO 512GB - NUEVO',
  'IPHONE 17 PRO MAX 256GB - NUEVO','IPHONE 17 PRO MAX 512GB - NUEVO',
  'IPHONE 17 PRO MAX 1TB - NUEVO','IPHONE 17 PRO MAX 256GB - EXHIBICIÓN',
  'ZTEA56 PRO 6RAM 128 GB - NUEVO'
]

const PROVEEDORES = [
  'Monkey','Yamocel','Tecnocell','Master Case',
  'Oficina','Apple House','Punto Cali','Nasa','Juan Diego Rios'
]

const METODOS_PAGO = [
  { value:'contado',      label:'Contado' },
  { value:'transferencia',label:'Transferencia' },
  { value:'tarjeta',      label:'Tarjeta' },
  { value:'addi',         label:'ADDI' },
  { value:'credi_ya',     label:'Credi Ya' },
  { value:'brilla',       label:'Brilla' },
  { value:'banco_bogota', label:'Banco de Bogotá' },
  { value:'contraentrega',label:'Contraentrega' },
  { value:'mixto',        label:'Mixto' }
]

const CALL_CENTERS = [
  { value:'tofi',            label:'Tofi' },
  { value:'tierraphone',     label:'TierraPhone' },
  { value:'plug_connection', label:'Plug Connection' },
  { value:'directo',         label:'Directo' }
]

const INIT = {
  fecha_venta:'', fecha_entrega:'', canal:'mostrador',
  call_center_origen:'', metodo_pago:'contado',
  pago_efectivo:'', pago_transferencia:'', pago_tarjeta:'',
  asesor_nombre:'', cedula_cliente:'', nombre_cliente:'',
  telefono_cliente:'', email_cliente:'', ciudad_cliente:'',
  direccion_cliente:'', producto:'', color:'', imei:'',
  proveedor:'', costo_equipo:'', no_factura:'',
  valor_venta:'', cuota_inicial:'0', numero_cuotas:'1',
  valor_cuota:'0', comision_compartida:false, asesor_compartido:'',
  es_domicilio:false, tiene_retoma:false, observaciones:'',
  // retoma
  imei_retoma:'', referencia_retoma:'', valor_retoma:''
}

const inp = {
  background:'#0a1628', border:'1px solid #1a2f52',
  borderRadius:8, padding:'9px 12px',
  color:'#fff', fontSize:13, width:'100%',
  boxSizing:'border-box', outline:'none'
}

const sel = { ...inp, cursor:'pointer' }

function Field({ label, children, required, span }) {
  return (
    <div style={{ gridColumn: span ? `span ${span}` : undefined }}>
      <label style={{
        display:'block', color:'#8aabcc', fontSize:11, fontWeight:500,
        textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:5
      }}>
        {label}{required && <span style={{ color:'#f43f5e' }}> *</span>}
      </label>
      {children}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom:28 }}>
      <div style={{
        color:'#4a7aaa', fontSize:11, fontWeight:700,
        textTransform:'uppercase', letterSpacing:'0.1em',
        borderBottom:'1px solid #1a2f52', paddingBottom:8, marginBottom:16
      }}>{title}</div>
      <div style={{
        display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px,1fr))',
        gap:'14px 16px'
      }}>
        {children}
      </div>
    </div>
  )
}

export default function NuevaVenta() {
  const { perfil } = useAuth()
  const navigate   = useNavigate()
  const [form, setForm] = useState({
    ...INIT,
    asesor_nombre: perfil?.nombre_completo || '',
    fecha_venta: new Date().toISOString().split('T')[0]
  })
  const [saving, setSaving]  = useState(false)
  const [error, setError]    = useState('')
  const [success, setSuccess] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const num = v => Number(String(v).replace(/\D/g,'')) || 0

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)

    const user = (await supabase.auth.getUser()).data.user
    if (!user) { setError('Sesión expirada'); setSaving(false); return }

    const payload = {
      registrado_por:    user.id,
      fecha_venta:       form.fecha_venta,
      fecha_entrega:     form.fecha_entrega || null,
      canal:             form.canal,
      call_center_origen:form.canal === 'call_center' ? form.call_center_origen : null,
      metodo_pago:       form.metodo_pago,
      pago_efectivo:     num(form.pago_efectivo),
      pago_transferencia:num(form.pago_transferencia),
      pago_tarjeta:      num(form.pago_tarjeta),
      asesor_id:         user.id,
      asesor_nombre:     form.asesor_nombre,
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
      tiene_retoma:      form.tiene_retoma,
      estado:            'registrada',
      observaciones:     form.observaciones
    }

    const { data: venta, error: errVenta } = await supabase
      .from('ventas').insert(payload).select().single()

    if (errVenta) {
      setError('Error al guardar: ' + errVenta.message)
      setSaving(false)
      return
    }

    // Si tiene retoma, actualizar el registro auto-creado con los datos del formulario
    if (form.tiene_retoma && venta?.id) {
      await supabase.from('retomas')
        .update({
          imei_retoma:  form.imei_retoma || 'pendiente',
          referencia:   form.referencia_retoma || 'pendiente',
          valor_retoma: num(form.valor_retoma)
        })
        .eq('venta_id', venta.id)
    }

    setSuccess(true)
    setSaving(false)
    setTimeout(() => navigate('/ventas'), 1800)
  }

  if (success) return (
    <div style={{
      padding:'80px 36px', textAlign:'center',
      fontFamily:"'DM Sans', system-ui"
    }}>
      <div style={{ fontSize:48, marginBottom:16 }}>✅</div>
      <h2 style={{ color:'#fff', margin:'0 0 8px' }}>Venta registrada</h2>
      <p style={{ color:'#4a6a8a', fontSize:14 }}>Redirigiendo...</p>
    </div>
  )

  return (
    <div style={{
      padding:'32px 36px', maxWidth:900,
      fontFamily:"'DM Sans', system-ui, sans-serif"
    }}>
      <div style={{ marginBottom:28 }}>
        <button onClick={() => navigate('/ventas')} style={{
          background:'transparent', border:'none', color:'#4a6a8a',
          fontSize:13, cursor:'pointer', padding:0, marginBottom:12
        }}>← Volver a ventas</button>
        <h1 style={{ color:'#fff', fontSize:20, fontWeight:600, margin:0 }}>
          Registrar venta
        </h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{
          background:'#0d1a35', border:'1px solid #1a2f52',
          borderRadius:14, padding:'28px 32px'
        }}>

          {/* FECHAS Y CANAL */}
          <Section title="📅 Información general">
            <Field label="Fecha de venta" required>
              <input type="date" style={inp} value={form.fecha_venta}
                onChange={e => set('fecha_venta', e.target.value)} required />
            </Field>
            <Field label="Fecha de entrega">
              <input type="date" style={inp} value={form.fecha_entrega}
                onChange={e => set('fecha_entrega', e.target.value)} />
            </Field>
            <Field label="Canal de venta" required>
              <select style={sel} value={form.canal}
                onChange={e => set('canal', e.target.value)}>
                <option value="mostrador">Mostrador</option>
                <option value="call_center">Call Center</option>
              </select>
            </Field>
            {form.canal === 'call_center' && (
              <Field label="Call Center origen">
                <select style={sel} value={form.call_center_origen}
                  onChange={e => set('call_center_origen', e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {CALL_CENTERS.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Asesor" required>
              <input style={inp} value={form.asesor_nombre}
                onChange={e => set('asesor_nombre', e.target.value)} required />
            </Field>
            <Field label="# Factura">
              <input style={inp} value={form.no_factura}
                onChange={e => set('no_factura', e.target.value)} />
            </Field>
          </Section>

          {/* CLIENTE */}
          <Section title="👤 Datos del cliente">
            <Field label="Cédula" required>
              <input style={inp} value={form.cedula_cliente}
                onChange={e => set('cedula_cliente', e.target.value)} required />
            </Field>
            <Field label="Nombre completo" required span={2}>
              <input style={inp} value={form.nombre_cliente}
                onChange={e => set('nombre_cliente', e.target.value)} required />
            </Field>
            <Field label="Teléfono">
              <input style={inp} value={form.telefono_cliente}
                onChange={e => set('telefono_cliente', e.target.value)} />
            </Field>
            <Field label="Correo electrónico">
              <input type="email" style={inp} value={form.email_cliente}
                onChange={e => set('email_cliente', e.target.value)} />
            </Field>
            <Field label="Ciudad" required>
              <input style={inp} value={form.ciudad_cliente}
                onChange={e => set('ciudad_cliente', e.target.value)} required />
            </Field>
          </Section>

          {/* PRODUCTO */}
          <Section title="📱 Producto">
            <Field label="Producto" required span={2}>
              <select style={sel} value={form.producto}
                onChange={e => set('producto', e.target.value)} required>
                <option value="">Seleccionar producto...</option>
                {PRODUCTOS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Color">
              <input style={inp} value={form.color}
                onChange={e => set('color', e.target.value)} placeholder="ej: Negro titanio" />
            </Field>
            <Field label="IMEI" required>
              <input style={inp} value={form.imei}
                onChange={e => set('imei', e.target.value)} required
                placeholder="15 dígitos" />
            </Field>
            <Field label="Proveedor" required>
              <select style={sel} value={form.proveedor}
                onChange={e => set('proveedor', e.target.value)} required>
                <option value="">Seleccionar...</option>
                {PROVEEDORES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Costo del equipo $" required>
              <input style={inp} value={form.costo_equipo}
                onChange={e => set('costo_equipo', e.target.value)}
                placeholder="0" required />
            </Field>
          </Section>

          {/* VALORES */}
          <Section title="💰 Valores de venta">
            <Field label="Valor de venta $" required>
              <input style={inp} value={form.valor_venta}
                onChange={e => set('valor_venta', e.target.value)} required />
            </Field>
            <Field label="Cuota inicial $">
              <input style={inp} value={form.cuota_inicial}
                onChange={e => set('cuota_inicial', e.target.value)} />
            </Field>
            <Field label="Número de cuotas">
              <input type="number" min="1" style={inp} value={form.numero_cuotas}
                onChange={e => set('numero_cuotas', e.target.value)} />
            </Field>
            <Field label="Valor de cuota $">
              <input style={inp} value={form.valor_cuota}
                onChange={e => set('valor_cuota', e.target.value)} />
            </Field>
          </Section>

          {/* MÉTODO DE PAGO */}
          <Section title="💳 Método de pago">
            <Field label="Método" required>
              <select style={sel} value={form.metodo_pago}
                onChange={e => set('metodo_pago', e.target.value)}>
                {METODOS_PAGO.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </Field>
            {['contado','mixto'].includes(form.metodo_pago) && (
              <Field label="Efectivo $">
                <input style={inp} value={form.pago_efectivo}
                  onChange={e => set('pago_efectivo', e.target.value)} />
              </Field>
            )}
            {['transferencia','mixto'].includes(form.metodo_pago) && (
              <Field label="Transferencia $">
                <input style={inp} value={form.pago_transferencia}
                  onChange={e => set('pago_transferencia', e.target.value)} />
              </Field>
            )}
            {['tarjeta','mixto'].includes(form.metodo_pago) && (
              <Field label="Tarjeta $">
                <input style={inp} value={form.pago_tarjeta}
                  onChange={e => set('pago_tarjeta', e.target.value)} />
              </Field>
            )}
          </Section>

          {/* FLAGS */}
          <Section title="⚙️ Opciones adicionales">
            <Field label="¿Es domicilio?">
              <label style={{ display:'flex', alignItems:'center', gap:8,
                color:'#fff', fontSize:13, cursor:'pointer' }}>
                <input type="checkbox" checked={form.es_domicilio}
                  onChange={e => set('es_domicilio', e.target.checked)} />
                Sí, tiene despacho
              </label>
            </Field>
            {form.es_domicilio && (
              <Field label="Dirección de entrega" required span={2}>
                <input style={inp} value={form.direccion_cliente}
                  onChange={e => set('direccion_cliente', e.target.value)}
                  placeholder="Dirección completa" required />
              </Field>
            )}
            <Field label="¿Comisión compartida?">
              <label style={{ display:'flex', alignItems:'center', gap:8,
                color:'#fff', fontSize:13, cursor:'pointer' }}>
                <input type="checkbox" checked={form.comision_compartida}
                  onChange={e => set('comision_compartida', e.target.checked)} />
                Sí, compartida
              </label>
            </Field>
            {form.comision_compartida && (
              <Field label="Asesor compartido">
                <input style={inp} value={form.asesor_compartido}
                  onChange={e => set('asesor_compartido', e.target.value)}
                  placeholder="Nombre del asesor" />
              </Field>
            )}
            <Field label="Observaciones" span={2}>
              <textarea style={{ ...inp, resize:'vertical', minHeight:72 }}
                value={form.observaciones}
                onChange={e => set('observaciones', e.target.value)} />
            </Field>
          </Section>

          {/* RETOMA */}
          <Section title="🔄 Retoma">
            <Field label="¿Tiene retoma?">
              <label style={{ display:'flex', alignItems:'center', gap:8,
                color:'#fff', fontSize:13, cursor:'pointer' }}>
                <input type="checkbox" checked={form.tiene_retoma}
                  onChange={e => set('tiene_retoma', e.target.checked)} />
                Sí, incluye retoma
              </label>
            </Field>
            {form.tiene_retoma && <>
              <Field label="IMEI retoma" required>
                <input style={inp} value={form.imei_retoma}
                  onChange={e => set('imei_retoma', e.target.value)} />
              </Field>
              <Field label="Referencia retoma" required>
                <input style={inp} value={form.referencia_retoma}
                  onChange={e => set('referencia_retoma', e.target.value)}
                  placeholder="ej: iPhone 11" />
              </Field>
              <Field label="Valor retoma $" required>
                <input style={inp} value={form.valor_retoma}
                  onChange={e => set('valor_retoma', e.target.value)} />
              </Field>
            </>}
          </Section>
        </div>

        {error && (
          <div style={{
            margin:'16px 0', padding:'12px 16px',
            background:'rgba(244,63,94,0.1)', border:'1px solid rgba(244,63,94,0.3)',
            borderRadius:8, color:'#f87171', fontSize:13
          }}>{error}</div>
        )}

        <div style={{ display:'flex', gap:12, marginTop:20 }}>
          <button type="button" onClick={() => navigate('/ventas')} style={{
            padding:'12px 24px', background:'transparent',
            border:'1px solid #1a2f52', borderRadius:8,
            color:'#6b8ab0', fontSize:14, cursor:'pointer'
          }}>Cancelar</button>
          <button type="submit" disabled={saving} style={{
            padding:'12px 32px',
            background: saving ? '#1e3058' : 'linear-gradient(135deg,#0066ff,#0044bb)',
            border:'none', borderRadius:8,
            color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer'
          }}>
            {saving ? 'Guardando...' : 'Registrar venta ✓'}
          </button>
        </div>
      </form>
    </div>
  )
}
