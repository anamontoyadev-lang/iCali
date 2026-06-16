import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { logActividad } from '../lib/drive'
import SolicitudEquiposPanel from '../components/SolicitudEquiposPanel'

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

const REFERENCIAS_RETOMA = [
  'iPhone 6','iPhone 6S','iPhone 7','iPhone 7 Plus',
  'iPhone 8','iPhone 8 Plus','iPhone X','iPhone XR','iPhone XS','iPhone XS Max',
  'iPhone 11','iPhone 11 Pro','iPhone 11 Pro Max',
  'iPhone 12','iPhone 12 Mini','iPhone 12 Pro','iPhone 12 Pro Max',
  'iPhone 13','iPhone 13 Mini','iPhone 13 Pro','iPhone 13 Pro Max',
  'iPhone 14','iPhone 14 Plus','iPhone 14 Pro','iPhone 14 Pro Max',
  'iPhone 15','iPhone 15 Plus','iPhone 15 Pro','iPhone 15 Pro Max',
  'iPhone 16','iPhone 16 Plus','iPhone 16 Pro','iPhone 16 Pro Max',
  'Otro'
]

const CIUDADES_COLOMBIA = [
  'Bogotá','Medellín','Cali','Barranquilla','Cartagena','Cúcuta','Bucaramanga',
  'Pereira','Santa Marta','Ibagué','Pasto','Manizales','Neiva','Villavicencio',
  'Armenia','Valledupar','Montería','Sincelejo','Popayán','Floridablanca',
  'Soledad','Itagüí','Bello','Buenaventura','Barrancabermeja','Palmira',
  'Tunja','Florencia','Quibdó','Riohacha','San Andrés','Yopal','Arauca',
  'Tumaco','Apartadó','Envigado','Sabaneta','La Ceja','Rionegro',
  'Girón','Piedecuesta','Zipaquirá','Fusagasugá','Soacha','Chía','Cajicá',
  'Mosquera','Facatativá','Espinal','Girardot','Melgar','Buga','Tuluá',
  'Cartago','Santander de Quilichao','Magangué','Lorica','Aguachica','Ocaña',
  'Duitama','Sogamoso','Dosquebradas','La Virginia','Pitalito','Garzón',
  'Ipiales','La Unión','Otra ciudad'
]

const inp = {
  background:'#ffffff', border:'1px solid #cbd5e1',
  borderRadius:8, padding:'9px 12px', color:'#0f172a',
  fontSize:13, width:'100%', boxSizing:'border-box', outline:'none'
}
const sel = { ...inp, cursor:'pointer' }
const num = v => Number(String(v).replace(/\./g,'').replace(/,/g,'.').replace(/[^\d.]/g,'')) || 0

function Field({ label, children, required, span }) {
  return (
    <div style={{ gridColumn: span ? `span ${span}` : undefined }}>
      <label style={{ display:'block', color:'#475569', fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:5 }}>
        {label}{required && <span style={{ color:'#dc2626' }}> *</span>}
      </label>
      {children}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom:28 }}>
      <div style={{ color:'#1e3a8a', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', borderBottom:'1px solid #cbd5e1', paddingBottom:8, marginBottom:16 }}>{title}</div>
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

  // Cotización de equipos
  const [equiposSolicitados, setEquiposSolicitados] = useState([])
  const [solicitudEnviada, setSolicitudEnviada]     = useState(false)
  const [enviandoNotif, setEnviandoNotif]           = useState(false)

  // Retoma — notificación inmediata a Diego
  const [retomaNotifEnviada, setRetomaNotifEnviada] = useState(false)
  const [retomaAceptada, setRetomaAceptada]           = useState(false)

  useEffect(() => {
    loadVenta()
    supabase.from('proveedores').select('id,nombre').eq('activo',true).order('nombre')
      .then(({ data }) => setProveedores(data || []))
  }, [id])

  async function loadVenta() {
    const { data, error } = await supabase.from('ventas').select('*').eq('id', id).single()
    if (error || !data) { navigate('/ventas'); return }

    // Cargar datos de retoma si existen
    const { data: retoma } = await supabase.from('retomas').select('*').eq('venta_id', id).maybeSingle()

    setForm({
      ...data,
      tiene_retoma: data.tiene_retoma || false,
      referencia_retoma: retoma?.referencia || '',
      referencia_retoma_otro: '',
      imei_retoma: retoma?.imei_retoma === 'pendiente' ? '' : (retoma?.imei_retoma || ''),
      retoma_gb: retoma?.capacidad_gb || '',
      retoma_color: retoma?.color || '',
      retoma_bateria: retoma?.porcentaje_bateria || '',
      valor_retoma: retoma?.valor_retoma || '',
      retoma_valorador: retoma?.estado === 'verificada' ? 'asesor' : 'diego',
    })
    setRetomaNotifEnviada(retoma?.estado !== 'recibida' ? false : false)
    setLoading(false)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Notificar a Diego inmediatamente cuando el asesor elige "Diego valora"
  async function notificarValoracionRetoma() {
    if (retomaNotifEnviada) return
    const user = (await supabase.auth.getUser()).data.user
    const refFinal = form.referencia_retoma === 'Otro'
      ? (form.referencia_retoma_otro || 'pendiente')
      : (form.referencia_retoma || 'pendiente')
    await supabase.from('notificaciones').insert({
      tipo:              'VALORACION_RETOMA',
      mensaje:           `📋 ${form.asesor_nombre} solicita valoración de retoma — ${refFinal}`,
      datos: {
        venta_id:     id,
        referencia:   refFinal,
        imei:         form.imei_retoma || '',
        gb:           form.retoma_gb || '',
        color:        form.retoma_color || '',
        bateria:      form.retoma_bateria || '',
        valor_est:    num(form.valor_retoma),
        asesor:       form.asesor_nombre,
        asesor_id:    user.id,
        cliente:      form.nombre_cliente,
        producto_venta: form.producto,
      },
      creado_por:        user.id,
      creado_por_nombre: form.asesor_nombre,
      destinatario_rol:  'retomas',
    })
    setRetomaNotifEnviada(true)
  }

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
      tiene_retoma:      form.tiene_retoma,
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

    // Guardar/actualizar retoma
    if (form.tiene_retoma) {
      const refFinal = form.referencia_retoma === 'Otro'
        ? (form.referencia_retoma_otro || 'pendiente')
        : (form.referencia_retoma || 'pendiente')
      const valoroAsesor = form.retoma_valorador === 'asesor'

      await supabase.from('retomas').upsert({
        venta_id:       id,
        imei_retoma:    form.imei_retoma || 'pendiente',
        referencia:     refFinal,
        capacidad_gb:   form.retoma_gb || null,
        color:          form.retoma_color || null,
        porcentaje_bateria: form.retoma_bateria ? Number(form.retoma_bateria) : null,
        valor_retoma:   num(form.valor_retoma),
        estado:         valoroAsesor ? 'verificada' : 'recibida',
        observaciones:  valoroAsesor ? `Valorado por asesor ${form.asesor_nombre}` : 'Pendiente valoración de Diego',
      }, { onConflict: 'venta_id', ignoreDuplicates: false })

      if (valoroAsesor) {
        await supabase.from('notificaciones').insert({
          tipo:              'RECOGIDA_RETOMA',
          mensaje:           `Recoger retoma valorada por asesor — ${refFinal}`,
          datos: {
            venta_id:     id,
            referencia:   refFinal,
            imei:         form.imei_retoma || '',
            valor_retoma: num(form.valor_retoma),
            asesor:       form.asesor_nombre,
            cliente:      form.nombre_cliente,
            producto_venta: form.producto,
          },
          creado_por:        user.id,
          creado_por_nombre: form.asesor_nombre,
          destinatario_rol:  'retomas',
        })
      } else if (!retomaNotifEnviada) {
        await supabase.from('notificaciones').insert({
          tipo:              'VALORACION_RETOMA',
          mensaje:           `Nueva retoma para valorar — ${refFinal}`,
          datos: {
            venta_id:     id,
            referencia:   refFinal,
            imei:         form.imei_retoma || '',
            valor_est:    num(form.valor_retoma),
            asesor:       form.asesor_nombre,
            cliente:      form.nombre_cliente,
            producto_venta: form.producto,
          },
          creado_por:        user.id,
          creado_por_nombre: form.asesor_nombre,
          destinatario_rol:  'retomas',
        })
      }
    }

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
      <h2 style={{ color:'#0f172a', margin:'0 0 8px' }}>Venta actualizada</h2>
      <p style={{ color:'#4a6a8a', fontSize:14 }}>Redirigiendo...</p>
    </div>
  )

  const asesoresFiltrados = form.canal === 'call_center' ? ASESORES.call_center : ASESORES.mostrador

  return (
    <div style={{ padding:'32px 36px', maxWidth:900, fontFamily:"'DM Sans', system-ui, sans-serif" }}>
      <div style={{ marginBottom:28 }}>
        <button onClick={() => navigate('/ventas')} style={{ background:'transparent', border:'none', color:'#4a6a8a', fontSize:13, cursor:'pointer', padding:0, marginBottom:12 }}>← Volver a ventas</button>
        <h1 style={{ color:'#0f172a', fontSize:20, fontWeight:600, margin:0 }}>Continuar venta</h1>
        <p style={{ color:'#4a6a8a', fontSize:13, margin:'4px 0 0' }}>Completa o corrige la información de esta venta</p>
      </div>

      <form onSubmit={handleSubmit}>

        {/* ═══ PREPARACIÓN: Retoma y cotización de equipos ═══ */}
        <div style={{ background:'#ffffff', border:'1px solid #e2e8f0', borderRadius:14, padding:'28px 32px', boxShadow:'0 1px 3px rgba(0,0,0,0.06)', marginBottom:20 }}>
          <Section title="🎯 Preparación de la venta">
            <Field label="¿El cliente quiere cotizar equipos de inventario?" span={2}>
              <div style={{ background:'rgba(59,130,246,0.06)', border:'1px solid rgba(59,130,246,0.2)', borderRadius:8, padding:'12px 14px' }}>
                <SolicitudEquiposPanel
                  equiposSolicitados={equiposSolicitados}
                  setEquiposSolicitados={setEquiposSolicitados}
                  solicitudEnviada={solicitudEnviada}
                  setSolicitudEnviada={setSolicitudEnviada}
                  enviandoNotif={enviandoNotif}
                  setEnviandoNotif={setEnviandoNotif}
                  asesorNombre={form.asesor_nombre}
                  clienteNombre={form.nombre_cliente}
                  onSeleccionarParaVenta={(eq) => {
                    setForm(f => ({
                      ...f,
                      producto:      eq.producto || f.producto,
                      imei:          eq.imei || '',
                      color:         eq.color || '',
                      almacenamiento: eq.almacenamiento || '',
                      costo_equipo:  String(eq.costo || ''),
                      proveedor:     eq.proveedores?.nombre || f.proveedor,
                    }))
                  }}
                />
              </div>
            </Field>

            <Field label="¿Tiene retoma?">
              <label style={{ display:'flex', alignItems:'center', gap:8, color:'#111827', fontSize:13, cursor:'pointer' }}>
                <input type="checkbox" checked={form.tiene_retoma || false} onChange={e => set('tiene_retoma', e.target.checked)} />
                Sí, incluye retoma
              </label>
            </Field>
            {form.tiene_retoma && <>
              <Field label="Referencia del equipo" required>
                <select style={sel} value={form.referencia_retoma || ''} onChange={e => set('referencia_retoma', e.target.value)}>
                  <option value="">Seleccionar referencia...</option>
                  {REFERENCIAS_RETOMA.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
              {form.referencia_retoma === 'Otro' && (
                <Field label="Especifica la referencia">
                  <input style={inp} value={form.referencia_retoma_otro || ''} onChange={e => set('referencia_retoma_otro', e.target.value)} placeholder="ej: Motorola G82..." />
                </Field>
              )}
              <Field label="IMEI retoma">
                <input style={inp} value={form.imei_retoma || ''} onChange={e => set('imei_retoma', e.target.value)} />
              </Field>
              <Field label="Almacenamiento">
                <select style={sel} value={form.retoma_gb || ''} onChange={e => set('retoma_gb', e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {['32GB','64GB','128GB','256GB','512GB','1TB'].map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </Field>
              <Field label="Color">
                <select style={sel}
                  value={['Negro','Blanco','Rojo','Azul','Verde','Morado','Rosa','Amarillo','Medianoche','Luz de estrella','Grafito','Oro','Plata','Negro medianoche','Blanco estrella','Sierra Azul','Negro titanio','Titanio blanco','Titanio azul','Titanio natural','Titanio arena del desierto','Verde azulado','Ultramarino','Azul cielo'].includes(form.retoma_color||'') ? (form.retoma_color||'') : (form.retoma_color ? 'Otro' : '')}
                  onChange={e => set('retoma_color', e.target.value === 'Otro' ? '' : e.target.value)}>
                  <option value="">Seleccionar color...</option>
                  {['Negro','Blanco','Rojo','Azul','Verde','Morado','Rosa','Amarillo','Medianoche','Luz de estrella','Grafito','Oro','Plata','Negro medianoche','Blanco estrella','Sierra Azul','Negro titanio','Titanio blanco','Titanio azul','Titanio natural','Titanio arena del desierto','Verde azulado','Ultramarino','Azul cielo'].map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="Otro">✏️ Otro color...</option>
                </select>
                {(form.retoma_color && !['Negro','Blanco','Rojo','Azul','Verde','Morado','Rosa','Amarillo','Medianoche','Luz de estrella','Grafito','Oro','Plata','Negro medianoche','Blanco estrella','Sierra Azul','Negro titanio','Titanio blanco','Titanio azul','Titanio natural','Titanio arena del desierto','Verde azulado','Ultramarino','Azul cielo'].includes(form.retoma_color)) && (
                  <input style={{ ...inp, marginTop:6 }} value={form.retoma_color} onChange={e => set('retoma_color', e.target.value)} placeholder="Escribe el color..." autoFocus />
                )}
              </Field>
              <Field label="Batería %">
                <input style={inp} type="number" min="0" max="100" value={form.retoma_bateria || ''} onChange={e => set('retoma_bateria', e.target.value)} placeholder="ej: 87" />
              </Field>

              <Field label="¿Quién valora el equipo?" span={2}>
                <div style={{ display:'flex', gap:10 }}>
                  <button type="button" onClick={() => set('retoma_valorador','asesor')}
                    style={{ flex:1, padding:'12px', border:`2px solid ${form.retoma_valorador==='asesor'?'#0066ff':'#cbd5e1'}`, borderRadius:8, cursor:'pointer',
                      background: form.retoma_valorador==='asesor' ? 'rgba(0,102,255,0.08)' : '#ffffff', textAlign:'left' }}>
                    <div style={{ color: form.retoma_valorador==='asesor'?'#0066ff':'#475569', fontWeight:700, fontSize:13 }}>👤 Yo valoro el equipo</div>
                    <div style={{ color:'#6b7280', fontSize:11, marginTop:2 }}>Ingreso el valor directamente — será parte del pago. Al cerrar la venta, Diego recogerá el equipo.</div>
                  </button>
                  <button type="button" onClick={() => { set('retoma_valorador','diego'); notificarValoracionRetoma() }}
                    style={{ flex:1, padding:'12px', border:`2px solid ${form.retoma_valorador==='diego'?'#0066ff':'#cbd5e1'}`, borderRadius:8, cursor:'pointer',
                      background: form.retoma_valorador==='diego' ? 'rgba(0,102,255,0.08)' : '#ffffff', textAlign:'left' }}>
                    <div style={{ color: form.retoma_valorador==='diego'?'#0066ff':'#475569', fontWeight:700, fontSize:13 }}>🔬 Diego valora</div>
                    <div style={{ color:'#6b7280', fontSize:11, marginTop:2 }}>Se notifica a Diego para que venga a valorar antes de cerrar la venta.</div>
                  </button>
                </div>
              </Field>

              <Field label={form.retoma_valorador === 'asesor' ? 'Valor retoma $ (tu valoración — usado como pago)' : 'Valor estimado $ (referencia para Diego)'}>
                <input style={inp} value={form.valor_retoma || ''} onChange={e => set('valor_retoma', e.target.value)} placeholder="0" />
              </Field>

              {form.retoma_valorador === 'diego' && (
                <Field span={2}>
                  <div style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:8, padding:'10px 14px', color:'#92400e', fontSize:12 }}>
                    {retomaNotifEnviada
                      ? '✅ Notificación enviada a Diego — está en camino para valorar el equipo.'
                      : '🔬 Notificando a Diego...'}
                  </div>
                </Field>
              )}
              {form.retoma_valorador === 'asesor' && (
                <Field span={2}>
                  {!retomaAceptada ? (
                    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                      <div style={{ background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.3)', borderRadius:8, padding:'10px 14px', color:'#065f46', fontSize:12 }}>
                        ✓ Este valor se descontará del total de la venta como abono.
                      </div>
                      <button type="button"
                        disabled={!num(form.valor_retoma||0)}
                        onClick={() => { setRetomaAceptada(true) }}
                        style={{ padding:'10px 20px', background: num(form.valor_retoma||0) ? 'linear-gradient(135deg,#10b981,#059669)' : '#e2e8f0', border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:700, cursor: num(form.valor_retoma||0) ? 'pointer':'default', alignSelf:'flex-start' }}>
                        ✓ Aceptar retoma — descontar {form.valor_retoma ? `$${Number(form.valor_retoma).toLocaleString('es-CO')}` : '$0'} del total
                      </button>
                    </div>
                  ) : (
                    <div style={{ background:'rgba(16,185,129,0.12)', border:'2px solid #10b981', borderRadius:8, padding:'12px 16px' }}>
                      <div style={{ color:'#059669', fontWeight:700, fontSize:13, marginBottom:4 }}>✅ Retoma aceptada — ${Number(form.valor_retoma).toLocaleString('es-CO')}</div>
                      {num(form.valor_venta) > 0 && (
                        <div style={{ color:'#065f46', fontSize:12, fontWeight:600 }}>
                          Cliente paga: ${(num(form.valor_venta||0) - num(form.valor_retoma||0)).toLocaleString('es-CO')}
                        </div>
                      )}
                      <button type="button" onClick={() => setRetomaAceptada(false)}
                        style={{ marginTop:8, padding:'4px 10px', background:'transparent', border:'1px solid #10b981', borderRadius:6, color:'#10b981', fontSize:11, cursor:'pointer' }}>
                        Modificar valor
                      </button>
                    </div>
                  )}
                </Field>
              )}
            </>}
          </Section>
        </div>

        {/* ═══ FORMULARIO DE VENTA ═══ */}
        <div style={{ background:'#ffffff', border:'1px solid #e2e8f0', borderRadius:14, padding:'28px 32px', boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>

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
              <select style={sel} value={CIUDADES_COLOMBIA.includes(form.ciudad_cliente)?form.ciudad_cliente:form.ciudad_cliente?'Otra ciudad':''}
                onChange={e => set('ciudad_cliente', e.target.value === 'Otra ciudad' ? '' : e.target.value)} required>
                <option value="">Seleccionar ciudad...</option>
                {CIUDADES_COLOMBIA.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {(form.ciudad_cliente && !CIUDADES_COLOMBIA.slice(0,-1).includes(form.ciudad_cliente)) && (
                <input style={{ ...inp, marginTop:6 }} value={form.ciudad_cliente} onChange={e => set('ciudad_cliente', e.target.value)} placeholder="Escribe la ciudad..." />
              )}
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
            {retomaAceptada && num(form.valor_retoma||0) > 0 && (
              <Field span={2}>
                <div style={{ background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.3)', borderRadius:10, padding:'14px 16px' }}>
                  <div style={{ color:'#059669', fontSize:12, fontWeight:700, marginBottom:8 }}>💱 Resumen de pago con retoma</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    <div><div style={{ color:'#6b7280', fontSize:11 }}>Valor total</div><div style={{ color:'#0f172a', fontSize:14, fontWeight:600 }}>${num(form.valor_venta||0).toLocaleString('es-CO')}</div></div>
                    <div><div style={{ color:'#6b7280', fontSize:11 }}>Abono por retoma</div><div style={{ color:'#10b981', fontSize:14, fontWeight:700 }}>- ${num(form.valor_retoma||0).toLocaleString('es-CO')}</div></div>
                    <div style={{ gridColumn:'span 2', borderTop:'1px solid #cbd5e1', paddingTop:8 }}>
                      <div style={{ color:'#6b7280', fontSize:11 }}>Cliente paga</div>
                      <div style={{ color:'#0f172a', fontSize:18, fontWeight:700 }}>${Math.max(0, num(form.valor_venta||0) - num(form.valor_retoma||0)).toLocaleString('es-CO')}</div>
                    </div>
                  </div>
                </div>
              </Field>
            )}
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
              <label style={{ display:'flex', alignItems:'center', gap:8, color:'#111827', fontSize:13, cursor:'pointer' }}>
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
              <label style={{ display:'flex', alignItems:'center', gap:8, color:'#111827', fontSize:13, cursor:'pointer' }}>
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
