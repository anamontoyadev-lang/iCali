import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { logActividad, logVenta } from '../lib/drive'

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

const COLORES_POR_REF = {
  'iPhone 11':         ['Negro','Blanco','Rojo','Amarillo','Morado','Verde'],
  'iPhone 12':         ['Negro','Blanco','Rojo','Azul','Verde','Morado'],
  'iPhone 13':         ['Negro medianoche','Blanco estrella','Rojo','Azul','Rosa','Verde'],
  'iPhone 13 Pro':     ['Grafito','Oro','Plata','Sierra Azul','Alpino Verde'],
  'iPhone 13 Pro Max': ['Grafito','Oro','Plata','Sierra Azul','Alpino Verde'],
  'iPhone 14':         ['Medianoche','Luz de estrella','Rojo','Azul','Morado','Amarillo'],
  'iPhone 14 Plus':    ['Medianoche','Luz de estrella','Rojo','Azul','Morado','Amarillo'],
  'iPhone 14 Pro':     ['Negro espacial','Plata','Oro','Morado intenso'],
  'iPhone 14 Pro Max': ['Negro espacial','Plata','Oro','Morado intenso'],
  'iPhone 15':         ['Negro','Rosa','Amarillo','Verde','Azul'],
  'iPhone 15 Plus':    ['Negro','Rosa','Amarillo','Verde','Azul'],
  'iPhone 15 Pro':     ['Titanio negro','Titanio blanco','Titanio azul','Titanio natural'],
  'iPhone 15 Pro Max': ['Titanio negro','Titanio blanco','Titanio azul','Titanio natural'],
  'iPhone 16':         ['Negro','Blanco','Rosa','Verde azulado','Ultramarino'],
  'iPhone 16 Plus':    ['Negro','Blanco','Rosa','Verde azulado','Ultramarino'],
  'iPhone 16 Pro':     ['Titanio negro','Titanio blanco','Titanio arena del desierto','Titanio natural'],
  'iPhone 16 Pro Max': ['Titanio negro','Titanio blanco','Titanio arena del desierto','Titanio natural'],
  'iPhone 16E':        ['Negro','Blanco'],
  'iPhone 17':         ['Negro','Blanco','Rosa','Azul cielo'],
  'iPhone 17 Air':     ['Negro','Blanco','Azul cielo'],
  'iPhone 17 Pro':     ['Titanio negro','Titanio blanco','Titanio arena del desierto','Titanio natural'],
  'iPhone 17 Pro Max': ['Titanio negro','Titanio blanco','Titanio arena del desierto','Titanio natural'],
}

const PRODUCTOS = [
  'iPhone 11 64GB - EXHIBICIÓN','iPhone 11 128GB - EXHIBICIÓN',
  'iPhone 12 64GB - EXHIBICIÓN','iPhone 12 128GB - EXHIBICIÓN','iPhone 12 256GB - EXHIBICIÓN',
  'iPhone 13 128GB - EXHIBICIÓN','iPhone 13 256GB - EXHIBICIÓN','iPhone 13 512GB - EXHIBICIÓN',
  'iPhone 13 Mini 128GB - EXHIBICIÓN',
  'iPhone 13 Pro 128GB - EXHIBICIÓN','iPhone 13 Pro 256GB - EXHIBICIÓN',
  'iPhone 13 Pro Max 128GB - EXHIBICIÓN','iPhone 13 Pro Max 256GB - EXHIBICIÓN',
  'iPhone 14 128GB - EXHIBICIÓN','iPhone 14 Plus 128GB - EXHIBICIÓN',
  'iPhone 14 Pro 128GB - EXHIBICIÓN','iPhone 14 Pro 256GB - EXHIBICIÓN',
  'iPhone 14 Pro Max 128GB - EXHIBICIÓN','iPhone 14 Pro Max 256GB - EXHIBICIÓN','iPhone 14 Pro Max 512GB - EXHIBICIÓN',
  'iPhone 15 128GB - EXHIBICIÓN','iPhone 15 256GB - EXHIBICIÓN','iPhone 15 Plus 256GB - EXHIBICIÓN',
  'iPhone 15 Pro 128GB - EXHIBICIÓN','iPhone 15 Pro 256GB - EXHIBICIÓN',
  'iPhone 15 Pro Max 256GB - EXHIBICIÓN','iPhone 15 Pro Max 512GB - EXHIBICIÓN','iPhone 15 Pro Max 1TB - EXHIBICIÓN',
  'iPhone 16 128GB - EXHIBICIÓN','iPhone 16 256GB - EXHIBICIÓN',
  'iPhone 16 Pro 128GB - EXHIBICIÓN','iPhone 16 Pro 256GB - EXHIBICIÓN',
  'iPhone 16 Pro Max 256GB - EXHIBICIÓN','iPhone 16 Pro Max 512GB - EXHIBICIÓN',
  'iPhone 16E 128GB - EXHIBICIÓN',
  'iPhone 13 128GB - NUEVO','iPhone 14 128GB - NUEVO','iPhone 15 128GB - NUEVO',
  'iPhone 16 128GB - NUEVO','iPhone 16 256GB - NUEVO',
  'iPhone 16 Pro Max 256GB - NUEVO','iPhone 16 Pro Max 512GB - NUEVO','iPhone 16E 128GB - NUEVO',
  'iPhone 17 256GB - NUEVO','iPhone 17 Air 256GB - NUEVO','iPhone 17 Air 512GB - NUEVO',
  'iPhone 17 Pro 256GB - NUEVO','iPhone 17 Pro 512GB - NUEVO',
  'iPhone 17 Pro Max 256GB - NUEVO','iPhone 17 Pro Max 512GB - NUEVO','iPhone 17 Pro Max 1TB - NUEVO',
  'ZTEA56 Pro 6RAM 128GB - NUEVO'
]

const REFERENCIAS_RETOMA = [
  'iPhone 6','iPhone 6S','iPhone 7','iPhone 7 Plus',
  'iPhone 8','iPhone 8 Plus','iPhone X','iPhone XR','iPhone XS','iPhone XS Max',
  'iPhone 11','iPhone 11 Pro','iPhone 11 Pro Max',
  'iPhone 12','iPhone 12 Mini','iPhone 12 Pro','iPhone 12 Pro Max',
  'iPhone 13','iPhone 13 Mini','iPhone 13 Pro','iPhone 13 Pro Max',
  'iPhone 14','iPhone 14 Plus','iPhone 14 Pro','iPhone 14 Pro Max',
  'iPhone 15','iPhone 15 Plus','iPhone 15 Pro','iPhone 15 Pro Max',
  'iPhone 16','iPhone 16 Plus','iPhone 16 Pro','iPhone 16 Pro Max','iPhone 16E',
  'iPhone 17','iPhone 17 Air','iPhone 17 Pro','iPhone 17 Pro Max',
  'Samsung S21','Samsung S22','Samsung S23','Samsung S24','Samsung S25','Otro'
]

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

const ESTADOS_EQUIPO = [
  { value:'nuevo',          label:'Nuevo',          color:'#10b981' },
  { value:'exhibicion',     label:'Exhibición',     color:'#3b82f6' },
  { value:'usado',          label:'Usado',          color:'#f59e0b' },
  { value:'en_laboratorio', label:'En laboratorio', color:'#8b5cf6' },
  { value:'para_reparar',   label:'Para reparar',   color:'#ef4444' },
]

function getRefBase(producto) {
  const nombre = producto.split(' - ')[0]
  return Object.keys(COLORES_POR_REF).find(k =>
    nombre.toLowerCase().includes(k.toLowerCase())
  ) || null
}

const INIT = {
  fecha_venta: new Date().toISOString().split('T')[0],
  fecha_entrega: '', canal: 'mostrador', asesor_nombre: '',
  metodo_pago: 'contado',
  pago_efectivo: '', pago_transferencia: '', pago_tarjeta: '',
  cedula_cliente: '', nombre_cliente: '', telefono_cliente: '',
  email_cliente: '', ciudad_cliente: '', direccion_cliente: '',
  producto: '', color: '', color_custom: '',
  imei: '', proveedor: '', costo_equipo: '',
  no_factura: '', valor_venta: '', cuota_inicial: '0',
  numero_cuotas: '1', valor_cuota: '0',
  comision_compartida: false, asesor_compartido: '',
  es_domicilio: false, tiene_retoma: false, observaciones: '',
  imei_retoma: '', referencia_retoma: '', referencia_retoma_otro: '', valor_retoma: '',
}

const inp = {
  background:'#0a1628', border:'1px solid #1a2f52',
  borderRadius:8, padding:'9px 12px', color:'#fff',
  fontSize:13, width:'100%', boxSizing:'border-box', outline:'none'
}
const sel = { ...inp, cursor:'pointer' }
const fmt = n => new Intl.NumberFormat('es-CO',{ style:'currency', currency:'COP', maximumFractionDigits:0 }).format(n || 0)

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
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px,1fr))', gap:'12px 14px' }}>
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
    asesor_nombre: perfil?.nombre ? `${perfil.nombre} ${perfil.apellido || ''}`.trim() : ''
  })
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState(false)
  const [coloresDisponibles, setColoresDisponibles] = useState([])
  const [colorPersonalizado, setColorPersonalizado] = useState(false)
  const [proveedores, setProveedores] = useState([])
  const [costoAutoInfo, setCostoAutoInfo] = useState(null)

  // Stock por referencia
  const [stockDisponible, setStockDisponible]   = useState([])
  const [showStock, setShowStock]               = useState(false)
  const [loadingStock, setLoadingStock]         = useState(false)
  const [equipoSeleccionado, setEquipoSeleccionado] = useState(null)

  // Notificación
  const [enviandoNotif, setEnviandoNotif]   = useState(false)
  const [notifEnviada, setNotifEnviada]     = useState(false)
  const [notifRespuesta, setNotifRespuesta] = useState(null)
  const [notifId, setNotifId]               = useState(null)

  useEffect(() => {
    supabase.from('proveedores').select('id,nombre').eq('activo', true).order('nombre')
      .then(({ data }) => setProveedores(data || []))
  }, [])

  useEffect(() => {
    if (form.producto) {
      const ref = getRefBase(form.producto)
      setColoresDisponibles(ref ? COLORES_POR_REF[ref] || [] : [])
      setForm(f => ({ ...f, color: '', color_custom: '' }))
      setColorPersonalizado(false)
      buscarStock(form.producto)
    }
  }, [form.producto])

  useEffect(() => {
    const imei = form.imei.trim()
    if (imei.length >= 10) buscarCostoPorIMEI(imei)
    else setCostoAutoInfo(null)
  }, [form.imei])

  useEffect(() => {
    if (form.producto && form.imei.trim().length < 10) buscarCostoPorProducto(form.producto)
  }, [form.producto])

  // Polling notificación
  useEffect(() => {
    if (!notifId) return
    const interval = setInterval(async () => {
      const { data } = await supabase.from('notificaciones').select('respondida,respuesta,respondido_por').eq('id', notifId).single()
      if (data?.respondida) {
        setNotifRespuesta(data)
        clearInterval(interval)
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [notifId])

  async function buscarStock(producto) {
    const nombre = producto.split(' - ')[0]
    setLoadingStock(true)
    const { data } = await supabase
      .from('compras_proveedor')
      .select('id, imei, imei2, color, almacenamiento, costo, precio_venta_est, estado_equipo, bateria, sticker, fotos, proveedores(nombre)')
      .ilike('producto', `%${nombre}%`)
      .eq('estado', 'disponible')
      .order('created_at', { ascending: false })
    setStockDisponible(data || [])
    setLoadingStock(false)
  }

  async function buscarCostoPorIMEI(imei) {
    const { data } = await supabase
      .from('compras_proveedor')
      .select('costo, producto, proveedores(nombre)')
      .eq('imei', imei)
      .eq('estado', 'disponible')
      .single()
    if (data) {
      setCostoAutoInfo({ costo: data.costo, fuente: `IMEI · ${data.proveedores?.nombre || ''}` })
      setForm(f => ({ ...f, costo_equipo: String(data.costo) }))
    } else setCostoAutoInfo(null)
  }

  async function buscarCostoPorProducto(producto) {
    const nombre = producto.split(' - ')[0]
    const { data } = await supabase
      .from('compras_proveedor')
      .select('costo, proveedores(nombre)')
      .ilike('producto', `%${nombre}%`)
      .eq('estado', 'disponible')
      .order('created_at', { ascending: false })
      .limit(1)
    if (data && data.length > 0) {
      setCostoAutoInfo({ costo: data[0].costo, fuente: `Referencia · ${data[0].proveedores?.nombre || ''}` })
      setForm(f => ({ ...f, costo_equipo: String(data[0].costo) }))
    }
  }

  function seleccionarEquipo(equipo) {
    setEquipoSeleccionado(equipo)
    setForm(f => ({
      ...f,
      imei:         equipo.imei || '',
      color:        equipo.color || '',
      costo_equipo: String(equipo.costo || ''),
      proveedor:    equipo.proveedores?.nombre || f.proveedor,
      _de_inventario: true,
    }))
    setCostoAutoInfo({ costo: equipo.costo, fuente: `Stock · IMEI ${equipo.imei}` })
    setShowStock(false)
  }

  async function enviarNotificacionInventario() {
    if (enviandoNotif) return
    setEnviandoNotif(true)
    const user = (await supabase.auth.getUser()).data.user
    const { data, error } = await supabase.from('notificaciones').insert({
      tipo: 'SOLICITUD_EQUIPO',
      mensaje: `Solicitud de equipo para mostrar al cliente`,
      datos: {
        producto:  form.producto,
        imei:      equipoSeleccionado?.imei || form.imei,
        asesor:    form.asesor_nombre,
        cliente:   form.nombre_cliente || 'Cliente en mostrador',
      },
      creado_por:       user.id,
      creado_por_nombre: form.asesor_nombre,
      destinatario_rol: 'inventario',
    }).select().single()
    if (!error && data) {
      setNotifId(data.id)
      setNotifEnviada(true)
    }
    setEnviandoNotif(false)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const num = v => Number(String(v).replace(/\./g,'').replace(/,/g,'.').replace(/[^\d.]/g,'')) || 0
  const asesoresFiltrados = form.canal === 'call_center' ? ASESORES.call_center : ASESORES.mostrador
  const colorFinal = colorPersonalizado ? form.color_custom : form.color

  async function guardarBorrador() {
    setSaving(true)
    setError('')
    try {
      const user = (await supabase.auth.getUser()).data.user
      if (!user) { setError('Sesión expirada'); setSaving(false); return }
      const payload = {
        registrado_por:    user.id,
        fecha_venta:       form.fecha_venta,
        canal:             form.canal,
        asesor_id:         user.id,
        asesor_nombre:     form.asesor_nombre || '',
        cedula_cliente:    form.cedula_cliente || '',
        nombre_cliente:    form.nombre_cliente || 'Borrador',
        telefono_cliente:  form.telefono_cliente || '',
        ciudad_cliente:    form.ciudad_cliente || '',
        producto:          form.producto || '',
        color:             colorFinal || '',
        imei:              form.imei || '',
        proveedor:         form.proveedor || '',
        costo_equipo:      num(form.costo_equipo),
        valor_venta:       num(form.valor_venta),
        metodo_pago:       form.metodo_pago,
        estado:            'registrada',
        observaciones:     '[BORRADOR] ' + (form.observaciones || ''),
        es_domicilio:      false,
        tiene_retoma:      false,
      }
      const { error: errB } = await supabase.from('ventas').insert(payload)
      if (errB) throw new Error(errB.message)
      setSuccess(true)
      setTimeout(() => navigate('/ventas'), 1500)
    } catch(err) { setError(err.message) }
    setSaving(false)
  }

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
      call_center_origen:null,
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
      color:             colorFinal,
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

    if (errVenta) { setError('Error al guardar: ' + errVenta.message); setSaving(false); return }

    // Marcar salida en inventario
    if (form.imei.trim().length >= 10 && venta?.id) {
      await supabase.from('compras_proveedor')
        .update({ estado: 'vendido', venta_id: venta.id })
        .eq('imei', form.imei.trim())
        .eq('estado', 'disponible')
    }

    if (form.tiene_retoma && venta?.id) {
      const refFinal = form.referencia_retoma === 'Otro'
        ? (form.referencia_retoma_otro || 'pendiente')
        : (form.referencia_retoma || 'pendiente')
      await supabase.from('retomas').update({
        imei_retoma:  form.imei_retoma || 'pendiente',
        referencia:   refFinal,
        valor_retoma: num(form.valor_retoma)
      }).eq('venta_id', venta.id)
    }

    await supabase.from('logs_actividad').insert({
      usuario_id:     user.id,
      usuario_nombre: form.asesor_nombre,
      accion:         'NUEVA_VENTA',
      detalle:        `${form.producto} | ${form.nombre_cliente} | $${num(form.valor_venta).toLocaleString('es-CO')}`,
      tabla:          'ventas',
      registro_id:    venta.id
    })

    // Drive — venta + actividad
    await logVenta({ ...venta, asesor_nombre: form.asesor_nombre })
    await logActividad({
      usuario: form.asesor_nombre,
      accion: 'NUEVA_VENTA',
      detalle: `${form.producto} | IMEI: ${form.imei} | ${form.nombre_cliente} | $${num(form.valor_venta).toLocaleString('es-CO')}`,
      tabla: 'ventas'
    })

    setSuccess(true)
    setSaving(false)
    setTimeout(() => navigate('/ventas'), 1800)
  }

  if (success) return (
    <div style={{ padding:'80px 36px', textAlign:'center', fontFamily:"'DM Sans', system-ui" }}>
      <div style={{ fontSize:48, marginBottom:16 }}>✅</div>
      <h2 style={{ color:'#fff', margin:'0 0 8px' }}>Venta registrada</h2>
      <p style={{ color:'#4a6a8a', fontSize:14 }}>Redirigiendo...</p>
    </div>
  )

  const condSeleccionada = equipoSeleccionado ? ESTADOS_EQUIPO.find(e => e.value === equipoSeleccionado.estado_equipo) : null

  return (
    <div style={{ padding:'clamp(16px, 4vw, 32px)', maxWidth:900, fontFamily:"'DM Sans', system-ui, sans-serif" }}>
      <div style={{ marginBottom:28 }}>
        <button onClick={() => navigate('/ventas')} style={{ background:'transparent', border:'none', color:'#4a6a8a', fontSize:13, cursor:'pointer', padding:0, marginBottom:12 }}>← Volver a ventas</button>
        <h1 style={{ color:'#fff', fontSize:20, fontWeight:600, margin:0 }}>Registrar venta</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:14, padding:'clamp(16px, 4vw, 28px) clamp(14px, 4vw, 32px)' }}>

          <Section title="📅 Información general">
            <Field label="Fecha de venta" required>
              <input type="date" style={inp} value={form.fecha_venta} onChange={e => set('fecha_venta', e.target.value)} required />
            </Field>
            <Field label="Fecha de entrega">
              <input type="date" style={inp} value={form.fecha_entrega} onChange={e => set('fecha_entrega', e.target.value)} />
            </Field>
            <Field label="Canal de venta" required>
              <select style={sel} value={form.canal} onChange={e => { set('canal', e.target.value); set('asesor_nombre', '') }}>
                <option value="mostrador">Mostrador</option>
                <option value="call_center">Call Center</option>
              </select>
            </Field>
            <Field label="Asesor" required>
              <select style={sel} value={form.asesor_nombre} onChange={e => set('asesor_nombre', e.target.value)} required>
                <option value="">Seleccionar asesor...</option>
                {asesoresFiltrados.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </Field>
            <Field label="# Factura">
              <input style={inp} value={form.no_factura} onChange={e => set('no_factura', e.target.value)} />
            </Field>
          </Section>

          <Section title="👤 Datos del cliente">
            <Field label="Cédula" required>
              <input style={inp} value={form.cedula_cliente} onChange={e => set('cedula_cliente', e.target.value)} required />
            </Field>
            <Field label="Nombre completo" required span={2}>
              <input style={inp} value={form.nombre_cliente} onChange={e => set('nombre_cliente', e.target.value)} required />
            </Field>
            <Field label="Teléfono">
              <input style={inp} value={form.telefono_cliente} onChange={e => set('telefono_cliente', e.target.value)} />
            </Field>
            <Field label="Correo">
              <input type="email" style={inp} value={form.email_cliente} onChange={e => set('email_cliente', e.target.value)} />
            </Field>
            <Field label="Ciudad" required>
              <input style={inp} value={form.ciudad_cliente} onChange={e => set('ciudad_cliente', e.target.value)} required />
            </Field>
          </Section>

          <Section title="📱 Producto">
            <Field label="Producto" required span={2}>
              <select style={sel} value={form.producto} onChange={e => set('producto', e.target.value)} required>
                <option value="">Seleccionar producto...</option>
                {PRODUCTOS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>

            {/* STOCK DISPONIBLE */}
            {form.producto && (
              <div style={{ gridColumn:'span 2' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                  <span style={{ color:'#8aabcc', fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em' }}>
                    Stock disponible
                  </span>
                  {loadingStock
                    ? <span style={{ color:'#4a6a8a', fontSize:11 }}>Buscando...</span>
                    : <span style={{ color: stockDisponible.length > 0 ? '#10b981' : '#ef4444', fontSize:11, fontWeight:600 }}>
                        {stockDisponible.length} equipo{stockDisponible.length !== 1 ? 's' : ''} en inventario
                      </span>
                  }
                  {stockDisponible.length > 0 && (
                    <button type="button" onClick={() => setShowStock(true)} style={{ padding:'4px 12px', background:'#0066ff22', border:'1px solid #0066ff55', borderRadius:6, color:'#60a5fa', fontSize:11, cursor:'pointer', fontWeight:600 }}>
                      Ver equipos →
                    </button>
                  )}
                </div>

                {/* Equipo seleccionado */}
                {equipoSeleccionado && (
                  <div style={{ background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.3)', borderRadius:10, padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div>
                      <div style={{ color:'#10b981', fontSize:12, fontWeight:600, marginBottom:4 }}>✓ Equipo seleccionado del inventario</div>
                      <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
                        <span style={{ color:'#8aabcc', fontSize:12 }}>IMEI: <span style={{ color:'#fff', fontFamily:'monospace' }}>{equipoSeleccionado.imei}</span></span>
                        {equipoSeleccionado.color && <span style={{ color:'#8aabcc', fontSize:12 }}>Color: <span style={{ color:'#fff' }}>{equipoSeleccionado.color}</span></span>}
                        {equipoSeleccionado.bateria != null && <span style={{ color:'#8aabcc', fontSize:12 }}>Batería: <span style={{ color: equipoSeleccionado.bateria >= 80 ? '#10b981' : '#f59e0b' }}>{equipoSeleccionado.bateria}%</span></span>}
                        {condSeleccionada && <span style={{ background: condSeleccionada.color+'22', color: condSeleccionada.color, fontSize:11, padding:'2px 8px', borderRadius:4 }}>{condSeleccionada.label}</span>}
                        {equipoSeleccionado.sticker && <span style={{ color:'#f59e0b', fontSize:11 }}>{equipoSeleccionado.sticker}</span>}
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                      {/* Notificación a inventario */}
                      {!notifEnviada ? (
                        <button type="button" onClick={enviarNotificacionInventario} disabled={enviandoNotif}
                          style={{ padding:'6px 12px', background:'#1a2f52', border:'1px solid #3b82f6', borderRadius:6, color:'#60a5fa', fontSize:11, cursor:'pointer', whiteSpace:'nowrap' }}>
                          {enviandoNotif ? '...' : '🔔 Pedir a inventario'}
                        </button>
                      ) : notifRespuesta ? (
                        <span style={{ fontSize:20 }}>{notifRespuesta.respuesta === 'si' ? '✅' : '❌'}</span>
                      ) : (
                        <span style={{ color:'#f59e0b', fontSize:11 }}>⏳ Esperando respuesta...</span>
                      )}
                      <button type="button" onClick={() => { setEquipoSeleccionado(null); setNotifEnviada(false); setNotifId(null); setNotifRespuesta(null) }}
                        style={{ background:'transparent', border:'none', color:'#4a6a8a', fontSize:16, cursor:'pointer' }}>×</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <Field label="Color">
              {coloresDisponibles.length > 0 ? (
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  <select style={sel} value={colorPersonalizado ? '__otro__' : form.color}
                    onChange={e => {
                      if (e.target.value === '__otro__') { setColorPersonalizado(true); set('color','') }
                      else { setColorPersonalizado(false); set('color', e.target.value); set('color_custom','') }
                    }}>
                    <option value="">Seleccionar color...</option>
                    {coloresDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
                    <option value="__otro__">Otro color...</option>
                  </select>
                  {colorPersonalizado && (
                    <input style={inp} placeholder="Escribe el color" value={form.color_custom} onChange={e => set('color_custom', e.target.value)} />
                  )}
                </div>
              ) : (
                <input style={inp} value={form.color} onChange={e => set('color', e.target.value)} placeholder="ej: Negro titanio" />
              )}
            </Field>

            <Field label="IMEI" required>
              <input style={inp} value={form.imei} onChange={e => set('imei', e.target.value)} placeholder="15 dígitos" required />
            </Field>

            <Field label="Proveedor">
              <select style={sel} value={form._prov_nuevo ? '__nuevo__' : form.proveedor}
                onChange={e => {
                  if (e.target.value === '__nuevo__') { set('_prov_nuevo', true); set('proveedor','') }
                  else { set('_prov_nuevo', false); set('proveedor', e.target.value) }
                }}>
                <option value="">Seleccionar...</option>
                {proveedores.map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
                <option value="__nuevo__">✏️ Agregar proveedor nuevo...</option>
              </select>
              {form._prov_nuevo && (
                <input style={{ ...inp, marginTop:6 }}
                  placeholder="Nombre del proveedor"
                  value={form.proveedor}
                  onChange={e => set('proveedor', e.target.value)}
                  autoFocus />
              )}
            </Field>

            {/* Costo solo si el equipo NO viene del inventario */}
            {!form._de_inventario && (
              <Field label="Costo equipo $" required>
                <div style={{ position:'relative' }}>
                  <input style={inp} value={form.costo_equipo}
                    onChange={e => { set('costo_equipo', e.target.value); setCostoAutoInfo(null) }}
                    placeholder="0" required />
                  {costoAutoInfo && (
                    <div style={{ marginTop:4, padding:'4px 8px', background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.3)', borderRadius:5, fontSize:11, color:'#10b981' }}>
                      ✓ Costo cargado desde {costoAutoInfo.fuente}
                    </div>
                  )}
                </div>
              </Field>
            )}
          </Section>

          <Section title="💰 Valores">
            <Field label="Valor de venta $" required>
              <input style={inp} value={form.valor_venta} onChange={e => set('valor_venta', e.target.value)} required />
            </Field>
            <Field label="Cuota inicial $">
              <input style={inp} value={form.cuota_inicial} onChange={e => set('cuota_inicial', e.target.value)} />
            </Field>
            <Field label="# Cuotas">
              <input type="number" min="1" style={inp} value={form.numero_cuotas} onChange={e => set('numero_cuotas', e.target.value)} />
            </Field>
            <Field label="Valor cuota $">
              <input style={inp} value={form.valor_cuota} onChange={e => set('valor_cuota', e.target.value)} />
            </Field>
          </Section>

          <Section title="💳 Método de pago">
            <Field label="Método" required>
              <select style={sel} value={form.metodo_pago} onChange={e => set('metodo_pago', e.target.value)}>
                {METODOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </Field>
            {['contado','mixto'].includes(form.metodo_pago) && (
              <Field label="Efectivo $"><input style={inp} value={form.pago_efectivo} onChange={e => set('pago_efectivo', e.target.value)} /></Field>
            )}
            {['transferencia','mixto'].includes(form.metodo_pago) && (
              <Field label="Transferencia $"><input style={inp} value={form.pago_transferencia} onChange={e => set('pago_transferencia', e.target.value)} /></Field>
            )}
            {['tarjeta','mixto'].includes(form.metodo_pago) && (
              <Field label="Tarjeta $"><input style={inp} value={form.pago_tarjeta} onChange={e => set('pago_tarjeta', e.target.value)} /></Field>
            )}
          </Section>

          <Section title="⚙️ Opciones adicionales">
            <Field label="¿Es domicilio?">
              <label style={{ display:'flex', alignItems:'center', gap:8, color:'#fff', fontSize:13, cursor:'pointer' }}>
                <input type="checkbox" checked={form.es_domicilio} onChange={e => set('es_domicilio', e.target.checked)} />
                Sí, tiene despacho
              </label>
            </Field>
            {form.es_domicilio && (
              <Field label="Dirección de entrega" required span={2}>
                <input style={inp} value={form.direccion_cliente} onChange={e => set('direccion_cliente', e.target.value)} placeholder="Dirección completa" required />
              </Field>
            )}
            <Field label="¿Comisión compartida?">
              <label style={{ display:'flex', alignItems:'center', gap:8, color:'#fff', fontSize:13, cursor:'pointer' }}>
                <input type="checkbox" checked={form.comision_compartida} onChange={e => set('comision_compartida', e.target.checked)} />
                Sí, compartida
              </label>
            </Field>
            {form.comision_compartida && (
              <Field label="Asesor compartido">
                <select style={sel} value={form.asesor_compartido} onChange={e => set('asesor_compartido', e.target.value)}>
                  <option value="">Seleccionar asesor...</option>
                  {TODOS_ASESORES.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </Field>
            )}
            <Field label="Observaciones" span={2}>
              <textarea style={{ ...inp, resize:'vertical', minHeight:72 }} value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
            </Field>
          </Section>

          <Section title="🔄 Retoma">
            <Field label="¿Tiene retoma?">
              <label style={{ display:'flex', alignItems:'center', gap:8, color:'#fff', fontSize:13, cursor:'pointer' }}>
                <input type="checkbox" checked={form.tiene_retoma} onChange={e => set('tiene_retoma', e.target.checked)} />
                Sí, incluye retoma
              </label>
            </Field>
            {form.tiene_retoma && <>
              <Field label="Referencia del equipo" required>
                <select style={sel} value={form.referencia_retoma} onChange={e => set('referencia_retoma', e.target.value)}>
                  <option value="">Seleccionar referencia...</option>
                  {REFERENCIAS_RETOMA.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
              {form.referencia_retoma === 'Otro' && (
                <Field label="Especifica la referencia">
                  <input style={inp} value={form.referencia_retoma_otro} onChange={e => set('referencia_retoma_otro', e.target.value)} placeholder="ej: Motorola G82..." />
                </Field>
              )}
              <Field label="IMEI retoma">
                <input style={inp} value={form.imei_retoma} onChange={e => set('imei_retoma', e.target.value)} />
              </Field>
              <Field label="Valor retoma $">
                <input style={inp} value={form.valor_retoma} onChange={e => set('valor_retoma', e.target.value)} />
              </Field>
            </>}
          </Section>
        </div>

        {error && (
          <div style={{ margin:'16px 0', padding:'12px 16px', background:'rgba(244,63,94,0.1)', border:'1px solid rgba(244,63,94,0.3)', borderRadius:8, color:'#f87171', fontSize:13 }}>{error}</div>
        )}

        <div style={{ display:'flex', gap:12, marginTop:20, flexWrap:'wrap' }}>
          <button type="button" onClick={() => navigate('/ventas')} style={{ padding:'12px 24px', background:'transparent', border:'1px solid #1a2f52', borderRadius:8, color:'#6b8ab0', fontSize:14, cursor:'pointer' }}>Cancelar</button>
          <button type="button" disabled={saving} onClick={() => guardarBorrador()} style={{ padding:'12px 24px', background:'transparent', border:'1px solid #f59e0b', borderRadius:8, color:'#f59e0b', fontSize:14, cursor:'pointer' }}>
            ⏸ Pausar venta
          </button>
          <button type="submit" disabled={saving} style={{ padding:'12px 32px', background: saving ? '#1e3058' : 'linear-gradient(135deg,#0066ff,#0044bb)', border:'none', borderRadius:8, color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer' }}>
            {saving ? 'Guardando...' : 'Registrar venta ✓'}
          </button>
        </div>
      </form>

      {/* MODAL STOCK */}
      {showStock && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.82)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:14, padding:24, width:'100%', maxWidth:700, maxHeight:'85vh', overflow:'auto', fontFamily:"'DM Sans', system-ui" }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <div>
                <h3 style={{ color:'#fff', margin:'0 0 4px', fontSize:15 }}>Stock disponible — {form.producto?.split(' - ')[0]}</h3>
                <p style={{ color:'#4a6a8a', fontSize:12, margin:0 }}>{stockDisponible.length} equipos disponibles en inventario</p>
              </div>
              <button onClick={() => setShowStock(false)} style={{ background:'transparent', border:'none', color:'#4a6a8a', fontSize:20, cursor:'pointer' }}>×</button>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {stockDisponible.map(eq => {
                const cond = ESTADOS_EQUIPO.find(e => e.value === eq.estado_equipo)
                return (
                  <div key={eq.id} style={{ background:'#0a1628', border:'1px solid #1a2f52', borderRadius:10, padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
                    <div style={{ flex:1, display:'flex', gap:16, flexWrap:'wrap', alignItems:'center' }}>
                      <div>
                        <div style={{ color:'#5a7aaa', fontSize:10, marginBottom:2 }}>IMEI</div>
                        <div style={{ color:'#fff', fontFamily:'monospace', fontSize:13 }}>{eq.imei || '—'}</div>
                      </div>
                      {eq.color && (
                        <div>
                          <div style={{ color:'#5a7aaa', fontSize:10, marginBottom:2 }}>Color</div>
                          <div style={{ color:'#cbd5e1', fontSize:12 }}>{eq.color}</div>
                        </div>
                      )}
                      {eq.bateria != null && (
                        <div>
                          <div style={{ color:'#5a7aaa', fontSize:10, marginBottom:2 }}>Batería</div>
                          <div style={{ color: eq.bateria >= 80 ? '#10b981' : eq.bateria >= 60 ? '#f59e0b' : '#ef4444', fontSize:13, fontWeight:600 }}>{eq.bateria}%</div>
                        </div>
                      )}
                      {eq.sticker && (
                        <span style={{ background: eq.sticker==='Very Good' ? 'rgba(16,185,129,0.15)' : eq.sticker==='Good' ? 'rgba(59,130,246,0.15)' : 'rgba(245,158,11,0.15)', color: eq.sticker==='Very Good' ? '#10b981' : eq.sticker==='Good' ? '#3b82f6' : '#f59e0b', fontSize:10, padding:'2px 8px', borderRadius:4, fontWeight:600 }}>{eq.sticker}</span>
                      )}
                      {cond && (
                        <span style={{ background: cond.color+'22', color: cond.color, fontSize:10, padding:'2px 8px', borderRadius:4 }}>{cond.label}</span>
                      )}
                      {eq.precio_venta_est ? (
                        <div>
                          <div style={{ color:'#5a7aaa', fontSize:10, marginBottom:2 }}>Precio venta</div>
                          <div style={{ color:'#10b981', fontSize:12, fontWeight:600 }}>{fmt(eq.precio_venta_est)}</div>
                        </div>
                      ) : null}
                      {/* Foto del equipo */}
                      {Array.isArray(eq.fotos) && eq.fotos[0] && (
                        <img src={eq.fotos[0]} alt="equipo" style={{ width:48, height:48, objectFit:'cover', borderRadius:8, border:'1px solid #1a2f52' }} />
                      )}
                      {eq.proveedores?.nombre && (
                        <div style={{ color:'#4a6a8a', fontSize:11 }}>{eq.proveedores.nombre}</div>
                      )}
                    </div>
                    <button type="button" onClick={() => seleccionarEquipo(eq)}
                      style={{ padding:'8px 16px', background:'linear-gradient(135deg,#0066ff,#0044bb)', border:'none', borderRadius:8, color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
                      Seleccionar →
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
