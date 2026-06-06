import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import * as XLSX from 'xlsx'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line
} from 'recharts'

const fmt = n => new Intl.NumberFormat('es-CO', { style:'currency', currency:'COP', maximumFractionDigits:0 }).format(n || 0)
const fmtK = n => {
  if (!n) return '$0'
  if (n >= 1_000_000_000) return '$' + (n/1_000_000_000).toFixed(1) + 'B'
  if (n >= 1_000_000)     return '$' + (n/1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)         return '$' + (n/1_000).toFixed(0) + 'K'
  return '$' + String(n)
}
const COLORS = ['#0066ff','#10b981','#f59e0b','#8b5cf6','#ec4899','#14b8a6','#f97316','#ef4444']
const MESES  = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const TABS = [
  { key:'dashboard',    label:'📊 Dashboard' },
  { key:'ventas',       label:'🛍 Ventas' },
  { key:'inventario',   label:'📦 Inventario' },
  { key:'despachos',    label:'🚚 Despachos' },
  { key:'retomas',      label:'🔄 Retomas' },
  { key:'proveedores',  label:'🏭 Proveedores' },
  { key:'todo',         label:'📋 Todo junto' },
]

function downloadXLSX(data, filename, sheetName = 'Datos') {
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, filename)
}

function BtnExcel({ onClick, label = '📥 Descargar Excel' }) {
  return (
    <button onClick={onClick} style={{
      padding:'8px 16px', background:'#0d1a35',
      border:'1px solid #10b981', borderRadius:8,
      color:'#10b981', fontSize:12, fontWeight:600, cursor:'pointer'
    }}>{label}</button>
  )
}

const th = { color:'#4a6a8a', fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', padding:'10px 14px', textAlign:'left', borderBottom:'1px solid #1a2f52', whiteSpace:'nowrap' }
const td = { padding:'10px 14px', color:'#cbd5e1', fontSize:13, borderBottom:'1px solid #0f1e36' }

export default function Reportes() {
  const { esAsesor, perfil } = useAuth()
  const [tab, setTab]         = useState('dashboard')
  const [periodo, setPeriodo] = useState(new Date().toISOString().slice(0,7))
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  // Dashboard data
  const [totales, setTotales]               = useState({ ventas:0, valor:0, utilidad:0, domicilios:0, retomas:0 })
  const [resumenAsesores, setResumenAsesores] = useState([])
  const [porCanal, setPorCanal]             = useState([])
  const [porMetodo, setPorMetodo]           = useState([])
  const [topProductos, setTopProductos]     = useState([])
  const [tendencia, setTendencia]           = useState([])
  const [porCiudad, setPorCiudad]           = useState([])

  // Raw data para reportes
  const [rawVentas, setRawVentas]         = useState([])
  const [rawInventario, setRawInventario] = useState([])
  const [rawDespachos, setRawDespachos]   = useState([])
  const [rawRetomas, setRawRetomas]       = useState([])
  const [rawProveedores, setRawProveedores] = useState([])
  const [rawAbonos, setRawAbonos]         = useState([])

  useEffect(() => { loadAll() }, [periodo])

  async function loadAll() {
    setLoading(true)
    setError('')
    try {
      const desde = periodo + '-01'
      const hasta = new Date(Number(periodo.split('-')[0]), Number(periodo.split('-')[1]), 0).toISOString().split('T')[0]

      let qVentas = supabase.from('ventas')
        .select('id,fecha_venta,no_factura,asesor_nombre,canal,cedula_cliente,nombre_cliente,telefono_cliente,producto,imei,color,proveedor,costo_equipo,valor_venta,metodo_pago,estado,es_domicilio,tiene_retoma,ciudad_cliente,cuota_inicial,numero_cuotas,observaciones')
        .gte('fecha_venta', desde).lte('fecha_venta', hasta).neq('estado', 'anulada')
      if (esAsesor && perfil) qVentas = qVentas.eq('asesor_nombre', `${perfil.nombre} ${perfil.apellido || ''}`.trim())

      const [
        { data: vData },
        { data: iData },
        { data: dData },
        { data: rData },
        { data: pData },
        { data: aData },
      ] = await Promise.all([
        qVentas,
        supabase.from('compras_proveedor').select('*, proveedores(nombre)').order('created_at', { ascending:false }).limit(1000),
        supabase.from('despachos').select('*, ventas(nombre_cliente,producto,imei,asesor_nombre,no_factura)').order('created_at', { ascending:false }).limit(500),
        supabase.from('retomas').select('*, ventas(nombre_cliente,asesor_nombre,fecha_venta)').order('created_at', { ascending:false }).limit(500),
        supabase.from('proveedores').select('*, abonos_proveedor(*)').eq('activo', true).order('nombre'),
        supabase.from('abonos_proveedor').select('*, proveedores(nombre)').order('created_at', { ascending:false }).limit(500),
      ])

      const ventas = vData || []
      setRawVentas(ventas)
      setRawInventario(iData || [])
      setRawDespachos(dData || [])
      setRawRetomas(rData || [])
      setRawProveedores(pData || [])
      setRawAbonos(aData || [])

      // Dashboard calcs
      const totalValor = ventas.reduce((a,v) => a + Number(v.valor_venta||0), 0)
      const totalCosto = ventas.reduce((a,v) => a + Number(v.costo_equipo||0), 0)
      setTotales({ ventas: ventas.length, valor: totalValor, utilidad: totalValor - totalCosto, domicilios: ventas.filter(v=>v.es_domicilio).length, retomas: ventas.filter(v=>v.tiene_retoma).length })

      const byAsesor = {}
      ventas.forEach(v => {
        const k = v.asesor_nombre || 'Sin asignar'
        if (!byAsesor[k]) byAsesor[k] = { asesor:k, ventas:0, valor:0, costo:0 }
        byAsesor[k].ventas++; byAsesor[k].valor += Number(v.valor_venta||0); byAsesor[k].costo += Number(v.costo_equipo||0)
      })
      setResumenAsesores(Object.values(byAsesor).map(r => ({ ...r, utilidad: r.valor-r.costo, ticket: r.ventas ? Math.round(r.valor/r.ventas) : 0 })).sort((a,b) => b.ventas-a.ventas))

      const byCanal = {}
      ventas.forEach(v => { const k = v.canal==='call_center'?'Call Center':'Mostrador'; if (!byCanal[k]) byCanal[k]={name:k,value:0,valor:0}; byCanal[k].value++; byCanal[k].valor+=Number(v.valor_venta||0) })
      setPorCanal(Object.values(byCanal))

      const METODO_LABELS = { contado:'Contado', transferencia:'Transferencia', tarjeta:'Tarjeta', addi:'ADDI', credi_ya:'Credi Ya', brilla:'Brilla', banco_bogota:'Bco Bogotá', contraentrega:'Contraentrega', mixto:'Mixto' }
      const byMetodo = {}
      ventas.forEach(v => { const k = METODO_LABELS[v.metodo_pago]||v.metodo_pago||'Otro'; if (!byMetodo[k]) byMetodo[k]={name:k,value:0}; byMetodo[k].value++ })
      setPorMetodo(Object.values(byMetodo).sort((a,b)=>b.value-a.value))

      const byProd = {}
      ventas.forEach(v => { const n=(v.producto||'Otro').split(' - ')[0]; if(!byProd[n]) byProd[n]={name:n,ventas:0,valor:0}; byProd[n].ventas++; byProd[n].valor+=Number(v.valor_venta||0) })
      setTopProductos(Object.values(byProd).sort((a,b)=>b.ventas-a.ventas).slice(0,8))

      const byDia = {}
      ventas.forEach(v => { const d=v.fecha_venta?.slice(8,10)||'01'; if(!byDia[d]) byDia[d]={dia:Number(d),ventas:0,valor:0}; byDia[d].ventas++; byDia[d].valor+=Number(v.valor_venta||0) })
      setTendencia(Object.values(byDia).sort((a,b)=>a.dia-b.dia))

      const byCiudad = {}
      ventas.forEach(v => { const k=v.ciudad_cliente||'Sin ciudad'; if(!byCiudad[k]) byCiudad[k]={name:k,value:0}; byCiudad[k].value++ })
      setPorCiudad(Object.values(byCiudad).sort((a,b)=>b.value-a.value).slice(0,6))

    } catch(err) { setError(err.message) }
    setLoading(false)
  }

  // ── DESCARGAS ──
  function dlVentas() {
    downloadXLSX(rawVentas.map(v => ({
      'Fecha':          v.fecha_venta,
      '# Factura':      v.no_factura || '',
      'Cédula':         v.cedula_cliente,
      'Cliente':        v.nombre_cliente,
      'Teléfono':       v.telefono_cliente || '',
      'Producto':       v.producto,
      'IMEI':           v.imei,
      'Color':          v.color || '',
      'Proveedor':      v.proveedor || '',
      'Costo':          v.costo_equipo || 0,
      'Valor venta':    v.valor_venta || 0,
      'Método pago':    v.metodo_pago,
      'Canal':          v.canal,
      'Asesor':         v.asesor_nombre,
      'Estado':         v.estado,
      'Ciudad':         v.ciudad_cliente || '',
      'Domicilio':      v.es_domicilio ? 'Sí' : 'No',
      'Retoma':         v.tiene_retoma ? 'Sí' : 'No',
      'Cuota inicial':  v.cuota_inicial || 0,
      '# Cuotas':       v.numero_cuotas || 1,
      'Observaciones':  v.observaciones || '',
    })), `Ventas_iCali_${periodo}.xlsx`, 'Ventas')
  }

  function dlInventario() {
    downloadXLSX(rawInventario.map(i => ({
      'Producto':        i.producto,
      'IMEI 1':          i.imei || '',
      'IMEI 2':          i.imei2 || '',
      'Serial caja':     i.serial_caja || '',
      'Color':           i.color || '',
      'Almacenamiento':  i.almacenamiento || '',
      'Batería %':       i.bateria ?? '',
      'Costo':           i.costo || 0,
      'Precio venta est': i.precio_venta_est || 0,
      'Sticker':         i.sticker || '',
      'Condición':       i.estado_equipo || '',
      'Estado':          i.estado || '',
      'Proveedor':       i.proveedores?.nombre || '',
      'Fecha compra':    i.fecha_compra || '',
      'Observaciones':   i.observaciones || '',
    })), `Inventario_iCali_${periodo}.xlsx`, 'Inventario')
  }

  function dlDespachos() {
    downloadXLSX(rawDespachos.map(d => ({
      'Cliente':          d.ventas?.nombre_cliente || '',
      'Producto':         d.ventas?.producto || '',
      'IMEI':             d.ventas?.imei || '',
      'Asesor':           d.ventas?.asesor_nombre || '',
      '# Factura':        d.ventas?.no_factura || '',
      'Tipo envío':       d.tipo_envio || '',
      'Ciudad destino':   d.ciudad_destino || '',
      'Dirección':        d.direccion_destino || '',
      'Estado':           d.estado || '',
      'Transportadora':   d.transportadora || '',
      'Mensajero':        d.mensajero || '',
      '# Guía':           d.numero_guia || '',
      'Flete':            d.valor_flete || 0,
      'Quién paga flete': d.quien_paga_flete || '',
      'Fecha despacho':   d.fecha_despacho || '',
      'Fecha entrega':    d.fecha_entrega_real || '',
      'Novedad':          d.novedad_descripcion || '',
      'Observaciones':    d.observaciones || '',
    })), `Despachos_iCali_${periodo}.xlsx`, 'Despachos')
  }

  function dlRetomas() {
    downloadXLSX(rawRetomas.map(r => ({
      'Referencia':       r.referencia || '',
      'IMEI retoma':      r.imei_retoma || '',
      'GB':               r.capacidad_gb || '',
      'Color':            r.color || '',
      'Batería %':        r.porcentaje_bateria ?? '',
      'Valor retoma':     r.valor_retoma || 0,
      'Costo estimado':   r.costo_estimado || 0,
      'Estado':           r.estado || '',
      'Quién tiene':      r.quien_tiene || '',
      'Punto tienda':     r.punto_tienda || '',
      'Cliente origen':   r.ventas?.nombre_cliente || '',
      'Asesor':           r.ventas?.asesor_nombre || '',
      'Fecha venta orig': r.ventas?.fecha_venta || '',
      'Observaciones':    r.observaciones || '',
    })), `Retomas_iCali_${periodo}.xlsx`, 'Retomas')
  }

  function dlProveedores() {
    downloadXLSX(rawProveedores.map(p => ({
      'Proveedor':        p.nombre,
      'Contacto':         p.contacto || '',
      'Teléfono':         p.telefono || '',
      'Total deuda':      p.total_deuda || 0,
      'Total abonado':    p.total_abonado || 0,
      'Saldo pendiente':  (p.total_deuda||0) - (p.total_abonado||0),
      'Activo':           p.activo ? 'Sí' : 'No',
    })), `Proveedores_iCali_${periodo}.xlsx`, 'Proveedores')
  }

  function dlAbonos() {
    downloadXLSX(rawAbonos.map(a => ({
      'Proveedor':    a.proveedores?.nombre || '',
      'Fecha':        a.fecha || a.created_at?.slice(0,10) || '',
      'Valor abono':  a.valor || 0,
      'Medio pago':   a.medio_pago || '',
      'Concepto':     a.concepto || '',
      'Registrado por': a.registrado_por_nombre || '',
      'Observaciones': a.observaciones || '',
    })), `Abonos_Proveedores_iCali_${periodo}.xlsx`, 'Abonos')
  }

  function dlTodo() {
    const wb = XLSX.utils.book_new()
    const sheets = [
      { name:'Ventas',      rows: rawVentas.map(v => ({ 'Fecha':v.fecha_venta,'Cliente':v.nombre_cliente,'Producto':v.producto,'IMEI':v.imei,'Asesor':v.asesor_nombre,'Canal':v.canal,'Valor venta':v.valor_venta||0,'Costo':v.costo_equipo||0,'Método':v.metodo_pago,'Estado':v.estado,'Ciudad':v.ciudad_cliente||'' })) },
      { name:'Inventario',  rows: rawInventario.map(i => ({ 'Producto':i.producto,'IMEI':i.imei||'','Color':i.color||'','Batería':i.bateria??'','Costo':i.costo||0,'Precio venta est':i.precio_venta_est||0,'Estado':i.estado,'Proveedor':i.proveedores?.nombre||'' })) },
      { name:'Despachos',   rows: rawDespachos.map(d => ({ 'Cliente':d.ventas?.nombre_cliente||'','Producto':d.ventas?.producto||'','Estado':d.estado,'Ciudad':d.ciudad_destino||'','Transportadora':d.transportadora||'','Guía':d.numero_guia||'','Flete':d.valor_flete||0 })) },
      { name:'Retomas',     rows: rawRetomas.map(r => ({ 'Referencia':r.referencia||'','IMEI':r.imei_retoma||'','Batería':r.porcentaje_bateria??'','Valor':r.valor_retoma||0,'Estado':r.estado,'Cliente':r.ventas?.nombre_cliente||'' })) },
      { name:'Proveedores', rows: rawProveedores.map(p => ({ 'Proveedor':p.nombre,'Total deuda':p.total_deuda||0,'Total abonado':p.total_abonado||0,'Saldo':(p.total_deuda||0)-(p.total_abonado||0) })) },
      { name:'Abonos',      rows: rawAbonos.map(a => ({ 'Proveedor':a.proveedores?.nombre||'','Fecha':a.fecha||'','Valor':a.valor||0,'Medio':a.medio_pago||'' })) },
    ]
    sheets.forEach(s => {
      if (s.rows.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s.rows), s.name)
    })
    XLSX.writeFile(wb, `Reporte_Completo_iCali_${periodo}.xlsx`)
  }

  const mesLabel = () => { const [y,m] = periodo.split('-'); return `${MESES[Number(m)-1]} ${y}` }
  const tooltipStyle = { contentStyle:{ background:'#0a1628', border:'1px solid #1a2f52', borderRadius:8 }, labelStyle:{ color:'#fff', fontSize:12 }, itemStyle:{ color:'#8aabcc', fontSize:12 } }
  const chartCard = (titulo, children) => (
    <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:12, padding:'18px 20px' }}>
      <div style={{ color:'#8aabcc', fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:14 }}>{titulo}</div>
      {children}
    </div>
  )

  const TableWrap = ({ children }) => (
    <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:12, overflow:'auto' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', minWidth:800 }}>{children}</table>
    </div>
  )

  return (
    <div style={{ padding:'32px 36px', fontFamily:"'DM Sans', system-ui", maxWidth:1200 }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ color:'#fff', fontSize:20, fontWeight:600, margin:'0 0 4px' }}>Reportes</h1>
          <p style={{ color:'#4a6a8a', fontSize:13, margin:0 }}>{mesLabel()}</p>
        </div>
        <input type="month" value={periodo} onChange={e => setPeriodo(e.target.value)}
          style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:8, padding:'8px 12px', color:'#fff', fontSize:13, cursor:'pointer' }} />
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:20, flexWrap:'wrap', borderBottom:'1px solid #1a2f52', paddingBottom:12 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding:'7px 14px', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:600,
            background: tab === t.key ? 'linear-gradient(135deg,#0066ff,#0044bb)' : '#0d1a35',
            color: tab === t.key ? '#fff' : '#8aabcc',
          }}>{t.label}</button>
        ))}
      </div>

      {error && <div style={{ marginBottom:20, padding:'12px 16px', background:'rgba(244,63,94,0.1)', border:'1px solid rgba(244,63,94,0.3)', borderRadius:8, color:'#f87171', fontSize:13 }}>⚠ {error}</div>}

      {loading ? (
        <div style={{ color:'#4a6a8a', fontSize:13, padding:40, textAlign:'center' }}>Cargando datos...</div>
      ) : (
        <>
          {/* ── DASHBOARD ── */}
          {tab === 'dashboard' && (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12, marginBottom:24 }}>
                {[
                  { label:'Total ventas',   val: totales.ventas,         sub:'del período',          color:'#0066ff' },
                  { label:'Valor total',    val: fmtK(totales.valor),    sub: fmt(totales.valor),     color:'#00aaff' },
                  { label:'Utilidad bruta', val: fmtK(totales.utilidad), sub: fmt(totales.utilidad),  color:'#10b981' },
                  { label:'Con domicilio',  val: totales.domicilios,     sub:'despachos',             color:'#8b5cf6' },
                  { label:'Con retoma',     val: totales.retomas,        sub:'equipos',               color:'#f59e0b' },
                ].map(k => (
                  <div key={k.label} style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:12, padding:'16px 20px' }}>
                    <div style={{ color:'#5a7aaa', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>{k.label}</div>
                    <div style={{ color:'#fff', fontSize:24, fontWeight:700 }}>{k.val}</div>
                    <div style={{ color:'#4a6a8a', fontSize:11, marginTop:3 }}>{k.sub}</div>
                    <div style={{ height:3, background:k.color, borderRadius:2, marginTop:12, opacity:0.5 }} />
                  </div>
                ))}
              </div>
              {totales.ventas === 0 ? (
                <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:12, padding:40, textAlign:'center' }}>
                  <div style={{ fontSize:32, marginBottom:12 }}>📊</div>
                  <div style={{ color:'#fff', fontSize:15, fontWeight:500, marginBottom:6 }}>Sin ventas en {mesLabel()}</div>
                  <div style={{ color:'#4a6a8a', fontSize:13 }}>Registra ventas para ver los reportes aquí</div>
                </div>
              ) : (
                <>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
                    {chartCard('Ventas por día', (
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={tendencia} margin={{ left:0, right:10, top:5, bottom:0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1a2f52" />
                          <XAxis dataKey="dia" tick={{ fill:'#4a6a8a', fontSize:11 }} />
                          <YAxis tick={{ fill:'#4a6a8a', fontSize:11 }} allowDecimals={false} />
                          <Tooltip {...tooltipStyle} formatter={v => [v + ' ventas']} />
                          <Line type="monotone" dataKey="ventas" stroke="#0066ff" strokeWidth={2} dot={{ fill:'#0066ff', r:3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ))}
                    {chartCard('Ventas por canal', (
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={porCanal} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                            {porCanal.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip {...tooltipStyle} formatter={v => [v + ' ventas']} />
                        </PieChart>
                      </ResponsiveContainer>
                    ))}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
                    {chartCard('Método de pago', (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={porMetodo} layout="vertical" margin={{ left:70, right:20, top:0, bottom:0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1a2f52" />
                          <XAxis type="number" tick={{ fill:'#4a6a8a', fontSize:11 }} allowDecimals={false} />
                          <YAxis type="category" dataKey="name" tick={{ fill:'#8aabcc', fontSize:11 }} width={70} />
                          <Tooltip {...tooltipStyle} formatter={v => [v + ' ventas']} />
                          <Bar dataKey="value" fill="#0066ff" radius={[0,4,4,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ))}
                    {chartCard('Ventas por ciudad', (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={porCiudad} layout="vertical" margin={{ left:70, right:20, top:0, bottom:0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1a2f52" />
                          <XAxis type="number" tick={{ fill:'#4a6a8a', fontSize:11 }} allowDecimals={false} />
                          <YAxis type="category" dataKey="name" tick={{ fill:'#8aabcc', fontSize:11 }} width={70} />
                          <Tooltip {...tooltipStyle} formatter={v => [v + ' ventas']} />
                          <Bar dataKey="value" fill="#10b981" radius={[0,4,4,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ))}
                  </div>
                  {chartCard('Top productos', (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={topProductos} margin={{ left:0, right:20, top:0, bottom:60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1a2f52" />
                        <XAxis dataKey="name" tick={{ fill:'#8aabcc', fontSize:10 }} angle={-35} textAnchor="end" interval={0} />
                        <YAxis tick={{ fill:'#4a6a8a', fontSize:11 }} allowDecimals={false} />
                        <Tooltip {...tooltipStyle} formatter={v => [v + ' unidades']} />
                        <Bar dataKey="ventas" fill="#8b5cf6" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ))}
                  <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:12, overflow:'auto', marginTop:14 }}>
                    <div style={{ padding:'14px 20px', borderBottom:'1px solid #1a2f52', color:'#8aabcc', fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em' }}>
                      Ranking asesores — {mesLabel()}
                    </div>
                    <table style={{ width:'100%', borderCollapse:'collapse' }}>
                      <thead><tr>{['#','Asesor','Ventas','Valor total','Utilidad','Ticket prom.'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                      <tbody>
                        {resumenAsesores.map((r, i) => (
                          <tr key={r.asesor}>
                            <td style={td}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</td>
                            <td style={{ ...td, color:'#e2e8f0', fontWeight:500 }}>{r.asesor}</td>
                            <td style={{ ...td, color:'#fff', fontSize:16, fontWeight:700 }}>{r.ventas}</td>
                            <td style={{ ...td, color:'#fff', fontWeight:600, whiteSpace:'nowrap' }}>{fmt(r.valor)}</td>
                            <td style={{ ...td, color:'#10b981', fontWeight:600, whiteSpace:'nowrap' }}>{fmt(r.utilidad)}</td>
                            <td style={{ ...td, color:'#8aabcc', whiteSpace:'nowrap' }}>{fmt(r.ticket)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}

          {/* ── VENTAS ── */}
          {tab === 'ventas' && (
            <>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                <span style={{ color:'#8aabcc', fontSize:13 }}>{rawVentas.length} registros</span>
                <BtnExcel onClick={dlVentas} label={`📥 Descargar Excel (${rawVentas.length})`} />
              </div>
              <TableWrap>
                <thead><tr>
                  {['Fecha','Factura','Cliente','Cédula','Producto','IMEI','Asesor','Canal','Valor','Costo','Método','Estado'].map(h => <th key={h} style={th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {rawVentas.map(v => (
                    <tr key={v.id}>
                      <td style={td}>{v.fecha_venta}</td>
                      <td style={{ ...td, fontSize:11 }}>{v.no_factura||'—'}</td>
                      <td style={td}><div style={{ fontWeight:500, color:'#e2e8f0' }}>{v.nombre_cliente}</div><div style={{ color:'#4a6a8a', fontSize:11 }}>{v.cedula_cliente}</div></td>
                      <td style={{ ...td, fontSize:11 }}>{v.cedula_cliente}</td>
                      <td style={{ ...td, fontSize:12, maxWidth:160 }}>{v.producto}</td>
                      <td style={{ ...td, fontSize:11, fontFamily:'monospace', color:'#8aabcc' }}>{v.imei||'—'}</td>
                      <td style={{ ...td, fontSize:12 }}>{v.asesor_nombre}</td>
                      <td style={td}><span style={{ background: v.canal==='mostrador'?'#1e3a5f':'#1e3a2f', color: v.canal==='mostrador'?'#60a5fa':'#34d399', fontSize:11, padding:'2px 8px', borderRadius:4 }}>{v.canal==='mostrador'?'Mostrador':'Call'}</span></td>
                      <td style={{ ...td, fontWeight:600, color:'#fff', whiteSpace:'nowrap' }}>{fmt(v.valor_venta)}</td>
                      <td style={{ ...td, color:'#f59e0b', whiteSpace:'nowrap' }}>{fmt(v.costo_equipo)}</td>
                      <td style={{ ...td, fontSize:11, color:'#8aabcc' }}>{v.metodo_pago?.replace('_',' ')}</td>
                      <td style={td}><span style={{ background:'#1a2f52', color:'#8aabcc', fontSize:11, padding:'2px 8px', borderRadius:4 }}>{v.estado}</span></td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            </>
          )}

          {/* ── INVENTARIO ── */}
          {tab === 'inventario' && (
            <>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                <span style={{ color:'#8aabcc', fontSize:13 }}>{rawInventario.length} equipos</span>
                <BtnExcel onClick={dlInventario} label={`📥 Descargar Excel (${rawInventario.length})`} />
              </div>
              <TableWrap>
                <thead><tr>{['Producto','IMEI','Color','Bat%','Costo','P.Venta est','Sticker','Condición','Estado','Proveedor'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {rawInventario.map(i => (
                    <tr key={i.id}>
                      <td style={{ ...td, fontSize:12, color:'#e2e8f0', maxWidth:160 }}>{i.producto}</td>
                      <td style={{ ...td, fontSize:11, fontFamily:'monospace', color:'#8aabcc' }}>{i.imei||'—'}</td>
                      <td style={{ ...td, fontSize:12 }}>{i.color||'—'}</td>
                      <td style={td}>{i.bateria!=null ? <span style={{ color: i.bateria>=80?'#10b981':i.bateria>=60?'#f59e0b':'#ef4444', fontWeight:600 }}>{i.bateria}%</span> : '—'}</td>
                      <td style={{ ...td, fontWeight:600, color:'#fff', whiteSpace:'nowrap' }}>{fmt(i.costo)}</td>
                      <td style={{ ...td, color:'#10b981', whiteSpace:'nowrap' }}>{i.precio_venta_est ? fmt(i.precio_venta_est) : '—'}</td>
                      <td style={td}>{i.sticker ? <span style={{ color:'#f59e0b', fontSize:11 }}>{i.sticker}</span> : '—'}</td>
                      <td style={td}><span style={{ background:'#1a2f5255', color:'#8aabcc', fontSize:11, padding:'2px 8px', borderRadius:4 }}>{i.estado_equipo||'—'}</span></td>
                      <td style={td}><span style={{ background: i.estado==='disponible'?'#0f3d2a':'#1a1a2e', color: i.estado==='disponible'?'#10b981':'#4a6a8a', fontSize:11, padding:'2px 8px', borderRadius:4 }}>{i.estado}</span></td>
                      <td style={{ ...td, fontSize:12 }}>{i.proveedores?.nombre||'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            </>
          )}

          {/* ── DESPACHOS ── */}
          {tab === 'despachos' && (
            <>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                <span style={{ color:'#8aabcc', fontSize:13 }}>{rawDespachos.length} despachos</span>
                <BtnExcel onClick={dlDespachos} label={`📥 Descargar Excel (${rawDespachos.length})`} />
              </div>
              <TableWrap>
                <thead><tr>{['Cliente','Producto','IMEI','Tipo','Ciudad','Estado','Transportadora','Guía','Flete','Asesor'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {rawDespachos.map(d => (
                    <tr key={d.id}>
                      <td style={td}>{d.ventas?.nombre_cliente||'—'}</td>
                      <td style={{ ...td, fontSize:12, maxWidth:140 }}>{d.ventas?.producto||'—'}</td>
                      <td style={{ ...td, fontSize:11, fontFamily:'monospace', color:'#8aabcc' }}>{d.ventas?.imei||'—'}</td>
                      <td style={td}><span style={{ background:'#1e3a5f', color:'#60a5fa', fontSize:11, padding:'2px 8px', borderRadius:4 }}>{d.tipo_envio==='domicilio_cali'?'Cali':'Nacional'}</span></td>
                      <td style={{ ...td, fontSize:12 }}>{d.ciudad_destino||'—'}</td>
                      <td style={td}><span style={{ background:'#1a2f52', color:'#8aabcc', fontSize:11, padding:'2px 8px', borderRadius:4 }}>{d.estado||'—'}</span></td>
                      <td style={{ ...td, fontSize:12 }}>{d.transportadora||d.mensajero||'—'}</td>
                      <td style={{ ...td, fontSize:11, fontFamily:'monospace' }}>{d.numero_guia||'—'}</td>
                      <td style={{ ...td, whiteSpace:'nowrap' }}>{d.valor_flete ? fmt(d.valor_flete) : '—'}</td>
                      <td style={{ ...td, fontSize:12 }}>{d.ventas?.asesor_nombre||'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            </>
          )}

          {/* ── RETOMAS ── */}
          {tab === 'retomas' && (
            <>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                <span style={{ color:'#8aabcc', fontSize:13 }}>{rawRetomas.length} retomas</span>
                <BtnExcel onClick={dlRetomas} label={`📥 Descargar Excel (${rawRetomas.length})`} />
              </div>
              <TableWrap>
                <thead><tr>{['Referencia','IMEI','Batería','Valor retoma','Costo est.','Estado','Quién tiene','Cliente','Asesor'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {rawRetomas.map(r => (
                    <tr key={r.id}>
                      <td style={td}><div style={{ fontWeight:500, color:'#e2e8f0' }}>{r.referencia||'—'}</div><div style={{ color:'#4a6a8a', fontSize:11 }}>{r.capacidad_gb} {r.color}</div></td>
                      <td style={{ ...td, fontSize:11, fontFamily:'monospace', color:'#8aabcc' }}>{r.imei_retoma||'—'}</td>
                      <td style={td}>{r.porcentaje_bateria!=null ? <span style={{ color: r.porcentaje_bateria>=80?'#10b981':r.porcentaje_bateria>=60?'#f59e0b':'#ef4444', fontWeight:600 }}>{r.porcentaje_bateria}%</span> : '—'}</td>
                      <td style={{ ...td, fontWeight:600, color:'#fff', whiteSpace:'nowrap' }}>{fmt(r.valor_retoma)}</td>
                      <td style={{ ...td, color:'#10b981', whiteSpace:'nowrap' }}>{r.costo_estimado ? fmt(r.costo_estimado) : '—'}</td>
                      <td style={td}><span style={{ background:'#1a2f52', color:'#8aabcc', fontSize:11, padding:'2px 8px', borderRadius:4 }}>{r.estado||'—'}</span></td>
                      <td style={{ ...td, fontSize:12 }}>{r.quien_tiene||'—'}</td>
                      <td style={{ ...td, fontSize:12 }}>{r.ventas?.nombre_cliente||'—'}</td>
                      <td style={{ ...td, fontSize:12 }}>{r.ventas?.asesor_nombre||'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            </>
          )}

          {/* ── PROVEEDORES ── */}
          {tab === 'proveedores' && (
            <>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                <span style={{ color:'#8aabcc', fontSize:13 }}>{rawProveedores.length} proveedores</span>
                <div style={{ display:'flex', gap:8 }}>
                  <BtnExcel onClick={dlAbonos} label="📥 Abonos Excel" />
                  <BtnExcel onClick={dlProveedores} label="📥 Proveedores Excel" />
                </div>
              </div>
              <TableWrap>
                <thead><tr>{['Proveedor','Total deuda','Total abonado','Saldo pendiente','Estado'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {rawProveedores.map(p => {
                    const saldo = (p.total_deuda||0) - (p.total_abonado||0)
                    return (
                      <tr key={p.id}>
                        <td style={{ ...td, fontWeight:500, color:'#e2e8f0' }}>{p.nombre}</td>
                        <td style={{ ...td, color:'#fff', fontWeight:600, whiteSpace:'nowrap' }}>{fmt(p.total_deuda)}</td>
                        <td style={{ ...td, color:'#10b981', whiteSpace:'nowrap' }}>{fmt(p.total_abonado)}</td>
                        <td style={{ ...td, color: saldo>0?'#ef4444':'#10b981', fontWeight:700, whiteSpace:'nowrap' }}>{fmt(saldo)}</td>
                        <td style={td}><span style={{ background: p.activo?'#0f3d2a':'#2a1a1a', color: p.activo?'#10b981':'#ef4444', fontSize:11, padding:'2px 8px', borderRadius:4 }}>{p.activo?'Activo':'Inactivo'}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </TableWrap>

              {rawAbonos.length > 0 && (
                <div style={{ marginTop:20 }}>
                  <div style={{ color:'#8aabcc', fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>Historial de abonos</div>
                  <TableWrap>
                    <thead><tr>{['Proveedor','Fecha','Valor','Medio pago','Concepto'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {rawAbonos.slice(0,50).map(a => (
                        <tr key={a.id}>
                          <td style={{ ...td, fontWeight:500, color:'#e2e8f0' }}>{a.proveedores?.nombre||'—'}</td>
                          <td style={{ ...td, fontSize:12 }}>{a.fecha||a.created_at?.slice(0,10)||'—'}</td>
                          <td style={{ ...td, color:'#10b981', fontWeight:600, whiteSpace:'nowrap' }}>{fmt(a.valor)}</td>
                          <td style={{ ...td, fontSize:12 }}>{a.medio_pago||'—'}</td>
                          <td style={{ ...td, fontSize:12 }}>{a.concepto||'—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </TableWrap>
                </div>
              )}
            </>
          )}

          {/* ── TODO JUNTO ── */}
          {tab === 'todo' && (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:20, padding:'40px 0' }}>
              <div style={{ fontSize:48 }}>📋</div>
              <div style={{ color:'#fff', fontSize:16, fontWeight:600 }}>Reporte completo iCali</div>
              <div style={{ color:'#4a6a8a', fontSize:13, textAlign:'center', maxWidth:400 }}>
                Descarga un único archivo Excel con todas las pestañas: Ventas, Inventario, Despachos, Retomas, Proveedores y Abonos.
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, width:'100%', maxWidth:500 }}>
                {[
                  { label:'Ventas',      n: rawVentas.length,      fn: dlVentas },
                  { label:'Inventario',  n: rawInventario.length,  fn: dlInventario },
                  { label:'Despachos',   n: rawDespachos.length,   fn: dlDespachos },
                  { label:'Retomas',     n: rawRetomas.length,     fn: dlRetomas },
                  { label:'Proveedores', n: rawProveedores.length, fn: dlProveedores },
                  { label:'Abonos',      n: rawAbonos.length,      fn: dlAbonos },
                ].map(item => (
                  <div key={item.label} style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:10, padding:'12px', textAlign:'center' }}>
                    <div style={{ color:'#fff', fontSize:18, fontWeight:700 }}>{item.n}</div>
                    <div style={{ color:'#4a6a8a', fontSize:11, marginBottom:8 }}>{item.label}</div>
                    <button onClick={item.fn} style={{ padding:'4px 10px', background:'transparent', border:'1px solid #1a2f52', borderRadius:6, color:'#8aabcc', fontSize:11, cursor:'pointer' }}>↓</button>
                  </div>
                ))}
              </div>
              <button onClick={dlTodo} style={{
                padding:'14px 40px', background:'linear-gradient(135deg,#0066ff,#0044bb)',
                border:'none', borderRadius:10, color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer',
                marginTop:10
              }}>
                📥 Descargar TODO en un Excel
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
