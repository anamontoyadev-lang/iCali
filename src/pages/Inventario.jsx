import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import * as XLSX from 'xlsx'
import EscanerSecuencial from '../components/EscanerSecuencial'
import { logInventario } from '../lib/drive'

const PRODUCTOS = [
  'iPhone 11 64GB','iPhone 11 128GB',
  'iPhone 12 64GB','iPhone 12 128GB','iPhone 12 256GB',
  'iPhone 13 128GB','iPhone 13 256GB','iPhone 13 512GB',
  'iPhone 13 Mini 128GB','iPhone 13 Pro 128GB','iPhone 13 Pro 256GB',
  'iPhone 13 Pro Max 128GB','iPhone 13 Pro Max 256GB',
  'iPhone 14 128GB','iPhone 14 Plus 128GB',
  'iPhone 14 Pro 128GB','iPhone 14 Pro 256GB',
  'iPhone 14 Pro Max 128GB','iPhone 14 Pro Max 256GB','iPhone 14 Pro Max 512GB',
  'iPhone 15 128GB','iPhone 15 256GB','iPhone 15 Plus 256GB',
  'iPhone 15 Pro 128GB','iPhone 15 Pro 256GB',
  'iPhone 15 Pro Max 256GB','iPhone 15 Pro Max 512GB','iPhone 15 Pro Max 1TB',
  'iPhone 16 128GB','iPhone 16 256GB',
  'iPhone 16 Pro 128GB','iPhone 16 Pro 256GB',
  'iPhone 16 Pro Max 256GB','iPhone 16 Pro Max 512GB','iPhone 16E 128GB',
  'iPhone 17 256GB','iPhone 17 Air 256GB','iPhone 17 Air 512GB',
  'iPhone 17 Pro 256GB','iPhone 17 Pro 512GB',
  'iPhone 17 Pro Max 256GB','iPhone 17 Pro Max 512GB','iPhone 17 Pro Max 1TB',
  'ZTEA56 Pro 6RAM 128GB','Otro'
]

const ALMACENAMIENTOS = ['64GB','128GB','256GB','512GB','1TB']

const ESTADOS_EQUIPO = [
  { value:'nuevo',          label:'Nuevo',           color:'#10b981' },
  { value:'exhibicion',     label:'Exhibición',      color:'#3b82f6' },
  { value:'usado',          label:'Usado',           color:'#f59e0b' },
  { value:'en_laboratorio', label:'En laboratorio',  color:'#8b5cf6' },
  { value:'para_reparar',   label:'Para reparar',    color:'#ef4444' },
]

const COLORES_IPHONE = [
  'Negro','Blanco','Rojo','Azul','Verde','Morado','Rosa','Amarillo',
  'Medianoche','Luz de estrella','Grafito','Oro','Plata',
  'Negro medianoche','Blanco estrella','Sierra Azul','Alpino Verde',
  'Negro espacial','Morado intenso',
  'Negro titanio','Titanio blanco','Titanio azul','Titanio natural',
  'Titanio arena del desierto',
  'Verde azulado','Ultramarino','Azul cielo',
]

const STICKERS = [
  { value:'Very Good', label:'Very Good', color:'#10b981', desc:'Excelente estado, sin rayones' },
  { value:'Good',      label:'Good',      color:'#3b82f6', desc:'Buen estado, uso normal' },
  { value:'Mid',       label:'Mid',       color:'#f59e0b', desc:'Estado regular, detalles visibles' },
]

const inp = {
  background:'#0a1628', border:'1px solid #1a2f52', borderRadius:8,
  padding:'9px 12px', color:'#fff', fontSize:13,
  width:'100%', boxSizing:'border-box', outline:'none'
}
const sel = { ...inp, cursor:'pointer' }

const fmt = n => new Intl.NumberFormat('es-CO',{
  style:'currency', currency:'COP', maximumFractionDigits:0
}).format(n || 0)

const INIT_FORM = {
  proveedor_id:'', producto:'', color:'',
  imei:'', imei2:'', serial_caja:'',
  almacenamiento:'128GB',
  costo:'', precio_venta_est:'',
  estado_equipo:'nuevo',
  fecha_compra: new Date().toISOString().split('T')[0],
  observaciones:'',
  sticker:'',
  bateria: '',
  no_factura: ''
}

export default function Inventario() {
  const { esAdmin, esLiderAdmin, puedeEditarInventario } = useAuth()
  const [proveedores, setProveedores]       = useState([])
  const [compras, setCompras]               = useState([])
  const [loading, setLoading]               = useState(true)
  const [filtroEstado, setFiltroEstado]     = useState('')
  const [filtroEstadoEq, setFiltroEstadoEq] = useState('')
  const [filtroProv, setFiltroProv]         = useState('')
  const [buscar, setBuscar]                 = useState('')

  const [showForm, setShowForm]   = useState(false)
  // Modo lote: proveedor + factura compartidos entre varios equipos
  const [lote, setLote] = useState({ proveedor_id:'', no_factura:'' })
  const [modoLote, setModoLote] = useState(false)
  const [form, setForm]           = useState(INIT_FORM)
  const [fotos, setFotos]         = useState([])
  const [fotoPreviews, setFotoPreviews] = useState([])
  const [saving, setSaving]       = useState(false)
  const [msgOk, setMsgOk]         = useState('')
  const [msgErr, setMsgErr]       = useState('')

  // Escáner secuencial
  const [escaner, setEscaner] = useState(false)

  // Carga masiva Excel
  const [showExcel, setShowExcel]       = useState(false)
  const [excelRows, setExcelRows]       = useState([])
  const [excelCols, setExcelCols]       = useState({})
  const [excelFileName, setExcelFileName] = useState('')
  const [importando, setImportando]     = useState(false)
  const [importResult, setImportResult] = useState(null)

  const fileExcelRef = useRef()
  const fotosRef     = useRef()

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [{ data: provs }, { data: items }] = await Promise.all([
      supabase.from('proveedores').select('id,nombre').eq('activo',true).order('nombre'),
      supabase.from('compras_proveedor')
        .select('*, proveedores(nombre)')
        .order('created_at', { ascending:false })
        .limit(500)
    ])
    setProveedores(provs || [])
    setCompras(items || [])
    setLoading(false)
  }

  function abrirEscaner() {
    setShowForm(false)
    setEscaner(true)
  }

  function handleFotos(e) {
    const files = Array.from(e.target.files)
    setFotos(prev => [...prev, ...files])
    const urls = files.map(f => URL.createObjectURL(f))
    setFotoPreviews(prev => [...prev, ...urls])
  }

  function quitarFoto(i) {
    setFotos(prev => prev.filter((_,idx) => idx !== i))
    setFotoPreviews(prev => prev.filter((_,idx) => idx !== i))
  }

  async function subirFotos(imei) {
    if (!fotos.length) return []
    const urls = []
    for (const foto of fotos) {
      try {
        const ext  = foto.name.split('.').pop()
        const path = `equipos/${String(imei).replace(/[^a-zA-Z0-9]/g,'_')}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error } = await supabase.storage.from('ICALI DOCS').upload(path, foto, { upsert:true })
        if (!error) {
          const { data:{ publicUrl } } = supabase.storage.from('ICALI DOCS').getPublicUrl(path)
          urls.push(publicUrl)
        }
      } catch(e) {}
    }
    return urls
  }

  async function guardarEquipo(e) {
    e.preventDefault()
    const guardarYOtro = e.nativeEvent?.submitter?.name === 'otro'
    setSaving(true)
    setMsgErr('')
    try {
      const user    = (await supabase.auth.getUser()).data.user
      const fotUrls = await subirFotos(form.imei || form.serial_caja || Date.now())
      const prov    = proveedores.find(p => p.id === form.proveedor_id)

      const { error } = await supabase.from('compras_proveedor').insert({
        proveedor_id:    form.proveedor_id,
        producto:        form.producto,
        imei:            form.imei.trim(),
        imei2:           form.imei2.trim(),
        serial_caja:     form.serial_caja.trim(),
        almacenamiento:  form.almacenamiento,
        color:           form.color,
        costo:           Number(String(form.costo).replace(/\D/g,'')) || 0,
        precio_venta_est:Number(String(form.precio_venta_est).replace(/\D/g,'')) || 0,
        estado_equipo:   form.estado_equipo,
        sticker:         form.sticker || null,
        bateria:         form.bateria ? Number(form.bateria) : null,
        fecha_compra:    form.fecha_compra,
        observaciones:   form.observaciones,
        fotos:           fotUrls.length ? fotUrls : null,
        registrado_por:  user.id,
        no_factura:      form.no_factura || null,
        estado:          'disponible'
      })
      if (error) throw new Error(error.message)

      // Log Drive
      await logInventario({
        usuario:   user.email,
        producto:  form.producto,
        imei:      form.imei,
        proveedor: prov?.nombre || '',
        costo:     Number(String(form.costo).replace(/\D/g,'')) || 0,
        accion:    'INGRESO_INVENTARIO'
      })

      setMsgOk(`✓ Equipo registrado correctamente`)
      if (guardarYOtro && modoLote) {
        // Mantener proveedor y factura, limpiar solo datos del equipo
        setForm(f => ({ ...INIT_FORM, proveedor_id: f.proveedor_id, no_factura: f.no_factura }))
      } else {
        setForm(INIT_FORM)
        setShowForm(false)
      }
      setFotos([])
      setFotoPreviews([])
      loadAll()
    } catch (err) { setMsgErr(err.message) }
    setSaving(false)
    setTimeout(() => { setMsgOk(''); setMsgErr('') }, 4000)
  }

  async function leerExcel(e) {
    const file = e.target.files[0]
    if (!file) return
    setExcelFileName(file.name)
    setImportResult(null)
    const buffer = await file.arrayBuffer()
    const wb     = XLSX.read(buffer)
    const ws     = wb.Sheets[wb.SheetNames[0]]
    const rows   = XLSX.utils.sheet_to_json(ws, { defval:'' })
    if (!rows.length) return
    const keys = Object.keys(rows[0])
    const find = (...terms) => keys.find(k => terms.some(t => k.toLowerCase().includes(t.toLowerCase()))) || ''
    const cols = {
      imei:       find('imei','serial','serie','codigo'),
      imei2:      find('imei2','imei 2','segundo imei'),
      producto:   find('producto','equipo','modelo','referencia','descripcion'),
      color:      find('color'),
      almacenamiento: find('almacenamiento','gb','capacidad','storage'),
      costo:      find('costo','precio','valor','price','cost'),
      precio_venta_est: find('precio venta','precio estimado','pvp','venta'),
      estado_equipo: find('estado','condicion','condition'),
      proveedor:  find('proveedor','supplier','vendor'),
      no_factura: find('factura','invoice','no factura','numero factura','nro'),
      bateria:    find('bateria','battery','bat'),
    }
    setExcelCols(cols)
    const parsed = rows.map((r,i) => ({
      _idx: i,
      imei:       String(r[cols.imei]     || '').trim(),
      imei2:      String(r[cols.imei2]    || '').trim(),
      producto:   String(r[cols.producto] || '').trim(),
      color:      String(r[cols.color]    || '').trim(),
      almacenamiento: String(r[cols.almacenamiento] || '').trim(),
      costo:      Number(String(r[cols.costo]||0).replace(/[^0-9.]/g,'')),
      precio_venta_est: Number(String(r[cols.precio_venta_est]||0).replace(/[^0-9.]/g,'')),
      estado_equipo: String(r[cols.estado_equipo] || 'nuevo').trim().toLowerCase(),
      proveedor:  String(r[cols.proveedor]|| '').trim(),
      no_factura: String(r[cols.no_factura] || '').trim(),
      bateria:    r[cols.bateria] ? Number(r[cols.bateria]) : null,
      _ok: true, _msg: ''
    })).filter(r => r.imei || r.producto)
    const existentes = new Set(compras.map(c => c.imei).filter(Boolean))
    parsed.forEach(r => {
      if (r.imei && existentes.has(r.imei)) { r._ok = false; r._msg = 'IMEI duplicado' }
    })
    setExcelRows(parsed)
    setShowExcel(true)
    e.target.value = ''
  }

  async function importarExcel() {
    setImportando(true)
    const user = (await supabase.auth.getUser()).data.user
    const validos = excelRows.filter(r => r._ok)
    let ok = 0, err = 0
    for (const r of validos) {
      const prov = lote.proveedor_id ? { id: lote.proveedor_id } : (proveedores.find(p => p.nombre.toLowerCase().includes((r.proveedor||'').toLowerCase())) || proveedores[0])
      const estadoNorm = ['nuevo','exhibicion','usado','en_laboratorio','para_reparar'].includes(r.estado_equipo)
        ? r.estado_equipo : 'nuevo'
      const { error } = await supabase.from('compras_proveedor').insert({
        proveedor_id:     prov?.id,
        producto:         r.producto || 'Sin especificar',
        imei:             r.imei,
        imei2:            r.imei2,
        color:            r.color,
        almacenamiento:   r.almacenamiento,
        costo:            r.costo,
        precio_venta_est: r.precio_venta_est,
        estado_equipo:    estadoNorm,
        bateria:          r.bateria || null,
        registrado_por:   user.id,
        estado:           'disponible',
        fecha_compra:     new Date().toISOString().split('T')[0],
        no_factura:       lote.no_factura || r.no_factura || null
      })
      if (error) err++; else ok++
    }
    setImportResult({ ok, err, omitidos: excelRows.filter(r => !r._ok).length })
    setImportando(false)
    loadAll()
  }

  const filtrados = compras.filter(c => {
    if (filtroEstado   && c.estado        !== filtroEstado)   return false
    if (filtroEstadoEq && c.estado_equipo !== filtroEstadoEq) return false
    if (filtroProv     && c.proveedor_id  !== filtroProv)     return false
    if (buscar) {
      const s = buscar.toLowerCase()
      if (!`${c.imei} ${c.imei2} ${c.serial_caja} ${c.producto} ${c.color}`.toLowerCase().includes(s)) return false
    }
    return true
  })

  const totalDisp  = compras.filter(c => c.estado === 'disponible').length
  const totalVend  = compras.filter(c => c.estado === 'vendido').length
  const valorStock = compras.filter(c => c.estado === 'disponible').reduce((a,c) => a + Number(c.costo||0), 0)
  const puedeEditar = puedeEditarInventario || esAdmin || esLiderAdmin

  const th = { color:'#4a6a8a', fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', padding:'10px 14px', textAlign:'left', borderBottom:'1px solid #1a2f52', whiteSpace:'nowrap' }
  const td = { padding:'10px 14px', color:'#cbd5e1', fontSize:13, borderBottom:'1px solid #0f1e36' }

  return (
    <div style={{ padding:'32px 36px', fontFamily:"'DM Sans', system-ui" }}>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ color:'#fff', fontSize:20, fontWeight:600, margin:'0 0 4px' }}>Inventario</h1>
          <p style={{ color:'#4a6a8a', fontSize:13, margin:0 }}>
            {totalDisp} disponibles · {totalVend} vendidos · {fmt(valorStock)} en stock
          </p>
        </div>
        {puedeEditar && (
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={abrirEscaner} style={{ padding:'9px 16px', background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:8, color:'#8aabcc', fontSize:13, cursor:'pointer' }}>📷 Escanear</button>
            <button onClick={() => fileExcelRef.current?.click()} style={{ padding:'9px 16px', background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:8, color:'#8aabcc', fontSize:13, cursor:'pointer' }}>📊 Carga masiva</button>
            <button onClick={() => { setModoLote(true) }} style={{ padding:'9px 16px', background:'#0d1a35', border:'1px solid #10b981', borderRadius:8, color:'#10b981', fontSize:13, fontWeight:600, cursor:'pointer' }}>📦 Ingreso por lote</button>
            <button onClick={() => { setShowForm(true); setModoLote(false); setForm(INIT_FORM); setFotos([]); setFotoPreviews([]) }} style={{ padding:'9px 18px', background:'linear-gradient(135deg,#0066ff,#0044bb)', border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>+ Ingresar equipo</button>
            <input ref={fileExcelRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:'none' }} onChange={leerExcel} />
          </div>
        )}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:12, marginBottom:20 }}>
        {[
          { label:'Disponibles', val:totalDisp, color:'#10b981' },
          { label:'Vendidos', val:totalVend, color:'#4a6a8a' },
          { label:'Total', val:compras.length, color:'#3b82f6' },
          { label:'Valor stock', val:fmt(valorStock), color:'#f59e0b', small:true },
        ].map(k => (
          <div key={k.label} style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:10, padding:'12px 16px' }}>
            <div style={{ color:'#5a7aaa', fontSize:10, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:4 }}>{k.label}</div>
            <div style={{ color:k.color, fontSize:k.small ? 16 : 24, fontWeight:600 }}>{k.val}</div>
          </div>
        ))}
      </div>

      {msgOk  && <div style={{ marginBottom:12, padding:'10px 16px', background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.3)', borderRadius:8, color:'#10b981', fontSize:13 }}>{msgOk}</div>}
      {msgErr && <div style={{ marginBottom:12, padding:'10px 16px', background:'rgba(244,63,94,0.1)', border:'1px solid rgba(244,63,94,0.3)', borderRadius:8, color:'#f87171', fontSize:13 }}>⚠ {msgErr}</div>}

      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
        <input placeholder="Buscar IMEI, serial, producto, color..." value={buscar} onChange={e => setBuscar(e.target.value)}
          style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:8, padding:'8px 12px', color:'#fff', fontSize:13, outline:'none', flex:1, minWidth:200 }} />
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:8, padding:'8px 12px', color: filtroEstado ? '#fff' : '#4a6a8a', fontSize:13, cursor:'pointer' }}>
          <option value="">Todos los estados</option>
          <option value="disponible">Disponible</option>
          <option value="vendido">Vendido</option>
          <option value="devuelto">Devuelto</option>
        </select>
        <select value={filtroEstadoEq} onChange={e => setFiltroEstadoEq(e.target.value)} style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:8, padding:'8px 12px', color: filtroEstadoEq ? '#fff' : '#4a6a8a', fontSize:13, cursor:'pointer' }}>
          <option value="">Condición del equipo</option>
          {ESTADOS_EQUIPO.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
        </select>
        <select value={filtroProv} onChange={e => setFiltroProv(e.target.value)} style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:8, padding:'8px 12px', color: filtroProv ? '#fff' : '#4a6a8a', fontSize:13, cursor:'pointer' }}>
          <option value="">Todos los proveedores</option>
          {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </div>

      <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:12, overflow:'auto' }}>
        {loading ? (
          <div style={{ padding:40, textAlign:'center', color:'#4a6a8a', fontSize:13 }}>Cargando...</div>
        ) : filtrados.length === 0 ? (
          <div style={{ padding:40, textAlign:'center', color:'#4a6a8a', fontSize:13 }}>Sin equipos con estos filtros</div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:900 }}>
            <thead>
              <tr>
                <th style={th}>Foto</th>
                <th style={th}>Producto</th>
                <th style={th}>IMEI 1</th>
                <th style={th}>IMEI 2</th>
                <th style={th}>Serial caja</th>
                <th style={th}>GB</th>
                <th style={th}>Color</th>
                <th style={th}>Batería</th>
                <th style={th}>Costo</th>
                <th style={th}>P. Venta est.</th>
                <th style={th}>Sticker</th>
                <th style={th}>Condición</th>
                <th style={th}>Factura</th>
                <th style={th}>Proveedor</th>
                <th style={th}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(c => {
                const condicion = ESTADOS_EQUIPO.find(e => e.value === c.estado_equipo)
                const primeraFoto = Array.isArray(c.fotos) ? c.fotos[0] : c.foto_url
                return (
                  <tr key={c.id}>
                    <td style={td}>
                      {primeraFoto
                        ? <img src={primeraFoto} alt="equipo" style={{ width:40, height:40, objectFit:'cover', borderRadius:6 }} />
                        : <div style={{ width:40, height:40, borderRadius:6, background:'#1a2f52', display:'flex', alignItems:'center', justifyContent:'center', color:'#4a6a8a', fontSize:16 }}>📱</div>
                      }
                    </td>
                    <td style={{ ...td, fontSize:12, color:'#e2e8f0', maxWidth:140 }}>{c.producto}</td>
                    <td style={{ ...td, fontSize:11, fontFamily:'monospace', color:'#8aabcc' }}>{c.imei || '—'}</td>
                    <td style={{ ...td, fontSize:11, fontFamily:'monospace', color:'#6a8aaa' }}>{c.imei2 || '—'}</td>
                    <td style={{ ...td, fontSize:11, fontFamily:'monospace', color:'#6a8aaa' }}>{c.serial_caja || '—'}</td>
                    <td style={{ ...td, fontSize:12, color:'#8aabcc' }}>{c.almacenamiento || c.capacidad || '—'}</td>
                    <td style={{ ...td, fontSize:12 }}>{c.color || '—'}</td>
                    <td style={td}>
                      {c.bateria != null ? (
                        <span style={{
                          color: c.bateria >= 80 ? '#10b981' : c.bateria >= 60 ? '#f59e0b' : '#ef4444',
                          fontWeight:600, fontSize:12
                        }}>{c.bateria}%</span>
                      ) : '—'}
                    </td>
                    <td style={{ ...td, fontWeight:600, color:'#fff', whiteSpace:'nowrap' }}>{fmt(c.costo)}</td>
                    <td style={{ ...td, color:'#10b981', whiteSpace:'nowrap' }}>{c.precio_venta_est ? fmt(c.precio_venta_est) : '—'}</td>
                    <td style={td}>
                      {c.sticker ? (
                        <span style={{
                          background: c.sticker==='Very Good' ? 'rgba(16,185,129,0.15)' : c.sticker==='Good' ? 'rgba(59,130,246,0.15)' : 'rgba(245,158,11,0.15)',
                          color: c.sticker==='Very Good' ? '#10b981' : c.sticker==='Good' ? '#3b82f6' : '#f59e0b',
                          fontSize:11, padding:'2px 8px', borderRadius:4, fontWeight:600
                        }}>{c.sticker}</span>
                      ) : '—'}
                    </td>
                    <td style={td}>
                      {condicion
                        ? <span style={{ background: condicion.color+'22', color: condicion.color, fontSize:11, padding:'2px 8px', borderRadius:4, fontWeight:500 }}>{condicion.label}</span>
                        : '—'}
                    </td>
                    <td style={{ ...td, fontSize:12, color:'#8aabcc' }}>{c.no_factura || '—'}</td>
                    <td style={{ ...td, fontSize:12 }}>{c.proveedores?.nombre || '—'}</td>
                    <td style={td}>
                      <span style={{
                        background: c.estado==='disponible' ? '#0f3d2a' : c.estado==='vendido' ? '#1a1a2e' : '#2a1a0a',
                        color: c.estado==='disponible' ? '#10b981' : c.estado==='vendido' ? '#4a6a8a' : '#f59e0b',
                        fontSize:11, padding:'2px 8px', borderRadius:4, fontWeight:500
                      }}>
                        {c.estado === 'disponible' ? 'Disponible' : c.estado === 'vendido' ? 'Vendido' : c.estado}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ESCÁNER SECUENCIAL */}
      {escaner && (
        <EscanerSecuencial
          onComplete={(valores) => {
            setForm(f => ({
              ...f,
              imei:        valores.imei        || '',
              imei2:       valores.imei2       || '',
              serial_caja: valores.serial_caja || '',
            }))
            setEscaner(false)
            setShowForm(true)
          }}
          onClose={() => setEscaner(false)}
        />
      )}

      {/* MODAL CONFIGURAR LOTE */}
      {modoLote && !showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.78)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background:'#0d1a35', border:'1px solid #10b981', borderRadius:14, padding:28, width:'100%', maxWidth:420, fontFamily:"'DM Sans', system-ui" }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <h3 style={{ color:'#fff', margin:0, fontSize:16 }}>📦 Configurar lote de ingreso</h3>
              <button onClick={() => setModoLote(false)} style={{ background:'transparent', border:'none', color:'#4a6a8a', fontSize:20, cursor:'pointer' }}>×</button>
            </div>
            <p style={{ color:'#8aabcc', fontSize:13, margin:'0 0 16px' }}>
              Define el proveedor y número de factura una sola vez. Luego agrega cada equipo del mismo pedido.
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Proveedor *</label>
                <select style={sel} value={lote.proveedor_id} onChange={e => setLote(l=>({...l, proveedor_id:e.target.value}))}>
                  <option value="">Seleccionar...</option>
                  {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div>
                <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>N° Factura</label>
                <input style={inp} value={lote.no_factura} onChange={e => setLote(l=>({...l, no_factura:e.target.value}))} placeholder="ej: FAC-2024-001 o 12345" />
              </div>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:20, justifyContent:'flex-end' }}>
              <button onClick={() => setModoLote(false)} style={{ padding:'9px 20px', background:'transparent', border:'1px solid #1a2f52', borderRadius:8, color:'#6b8ab0', fontSize:13, cursor:'pointer' }}>Cancelar</button>
              <button
                disabled={!lote.proveedor_id}
                onClick={() => {
                  setForm({ ...INIT_FORM, proveedor_id: lote.proveedor_id, no_factura: lote.no_factura })
                  setFotos([]); setFotoPreviews([])
                  setShowForm(true)
                }}
                style={{ padding:'9px 24px', background: lote.proveedor_id ? 'linear-gradient(135deg,#10b981,#059669)' : '#1e3058', border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:600, cursor: lote.proveedor_id ? 'pointer' : 'default' }}>
                Iniciar lote → Agregar equipos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL INGRESAR EQUIPO */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.78)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:14, padding:28, width:'100%', maxWidth:580, fontFamily:"'DM Sans', system-ui", maxHeight:'92vh', overflow:'auto' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <div>
                <h3 style={{ color:'#fff', margin:'0 0 4px', fontSize:16 }}>Ingresar equipo al inventario</h3>
                {modoLote && (
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <span style={{ background:'rgba(16,185,129,0.15)', color:'#10b981', fontSize:11, padding:'2px 8px', borderRadius:4 }}>
                      📦 Lote: {proveedores.find(p=>p.id===lote.proveedor_id)?.nombre}
                    </span>
                    {lote.no_factura && <span style={{ background:'rgba(59,130,246,0.15)', color:'#60a5fa', fontSize:11, padding:'2px 8px', borderRadius:4 }}>FAC: {lote.no_factura}</span>}
                  </div>
                )}
              </div>
              <button onClick={() => { setShowForm(false); setFotos([]); setFotoPreviews([]) }} style={{ background:'transparent', border:'none', color:'#4a6a8a', fontSize:20, cursor:'pointer' }}>×</button>
            </div>

            <form onSubmit={guardarEquipo}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px 14px' }}>

                <div>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Proveedor *</label>
                  <select required style={sel} value={form.proveedor_id} onChange={e => setForm(f=>({...f, proveedor_id:e.target.value}))}>
                    <option value="">Seleccionar...</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>N° Factura</label>
                  <input style={inp} value={form.no_factura} onChange={e => setForm(f=>({...f, no_factura:e.target.value}))} placeholder="ej: FAC-2024-001" />
                </div>

                <div style={{ gridColumn:'span 2' }}>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Producto *</label>
                  <select required style={sel} value={form.producto} onChange={e => setForm(f=>({...f, producto:e.target.value}))}>
                    <option value="">Seleccionar...</option>
                    {PRODUCTOS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>IMEI 1</label>
                  <input style={inp} value={form.imei} onChange={e => setForm(f=>({...f, imei:e.target.value}))} placeholder="15 dígitos" />
                </div>

                <div>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>IMEI 2</label>
                  <input style={inp} value={form.imei2} onChange={e => setForm(f=>({...f, imei2:e.target.value}))} placeholder="Opcional" />
                </div>

                <div>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Serial de caja</label>
                  <input style={inp} value={form.serial_caja} onChange={e => setForm(f=>({...f, serial_caja:e.target.value}))} placeholder="Opcional" />
                </div>

                <div>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Almacenamiento</label>
                  <select style={sel} value={form.almacenamiento} onChange={e => setForm(f=>({...f, almacenamiento:e.target.value}))}>
                    {ALMACENAMIENTOS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Color</label>
                  <select style={sel} value={form.color === '' || COLORES_IPHONE.includes(form.color) ? form.color : '__otro__'}
                    onChange={e => {
                      if (e.target.value === '__otro__') setForm(f=>({...f, color:'__custom__'}))
                      else setForm(f=>({...f, color: e.target.value}))
                    }}>
                    <option value="">Seleccionar color...</option>
                    {COLORES_IPHONE.map(c => <option key={c} value={c}>{c}</option>)}
                    <option value="__otro__">✏️ Otro color...</option>
                  </select>
                  {(form.color === '__custom__' || (!COLORES_IPHONE.includes(form.color) && form.color !== '')) && (
                    <input style={{ ...inp, marginTop:6 }}
                      value={form.color === '__custom__' ? '' : form.color}
                      onChange={e => setForm(f=>({...f, color:e.target.value}))}
                      placeholder="Escribe el color..." autoFocus />
                  )}
                </div>

                {/* BATERÍA */}
                <div>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Batería %</label>
                  <input
                    style={inp}
                    type="number" min="0" max="100"
                    value={form.bateria}
                    onChange={e => setForm(f=>({...f, bateria: e.target.value}))}
                    placeholder="ej: 89"
                  />
                </div>

                <div>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Precio de compra $</label>
                  <input style={inp} value={form.costo} onChange={e => setForm(f=>({...f, costo:e.target.value}))} placeholder="0" />
                </div>

                <div>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Precio estimado de venta $</label>
                  <input style={inp} value={form.precio_venta_est} onChange={e => setForm(f=>({...f, precio_venta_est:e.target.value}))} placeholder="0" />
                </div>

                <div>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Condición del equipo</label>
                  <select style={sel} value={form.estado_equipo} onChange={e => setForm(f=>({...f, estado_equipo:e.target.value}))}>
                    {ESTADOS_EQUIPO.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                  </select>
                </div>

                <div style={{ gridColumn:'span 2' }}>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:8 }}>Sticker de calidad</label>
                  <div style={{ display:'flex', gap:8 }}>
                    {STICKERS.map(s => (
                      <button key={s.value} type="button"
                        onClick={() => setForm(f=>({...f, sticker: f.sticker === s.value ? '' : s.value}))}
                        style={{
                          flex:1, padding:'10px 8px', border:`2px solid ${form.sticker === s.value ? s.color : '#1a2f52'}`,
                          borderRadius:8, cursor:'pointer', transition:'all .15s',
                          background: form.sticker === s.value ? s.color + '22' : 'transparent',
                          color: form.sticker === s.value ? s.color : '#4a6a8a', textAlign:'center'
                        }}>
                        <div style={{ fontSize:13, fontWeight:700 }}>{s.label}</div>
                        <div style={{ fontSize:10, marginTop:2, opacity:.8 }}>{s.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Fecha de compra</label>
                  <input type="date" style={inp} value={form.fecha_compra} onChange={e => setForm(f=>({...f, fecha_compra:e.target.value}))} />
                </div>

                <div style={{ gridColumn:'span 2' }}>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Notas</label>
                  <textarea style={{ ...inp, resize:'vertical', minHeight:60 }} value={form.observaciones} onChange={e => setForm(f=>({...f, observaciones:e.target.value}))} />
                </div>

                <div style={{ gridColumn:'span 2' }}>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:8 }}>
                    Fotos del equipo ({fotoPreviews.length} seleccionadas)
                  </label>
                  <input ref={fotosRef} type="file" accept="image/*" capture="environment" multiple style={{ display:'none' }} onChange={handleFotos} />
                  <button type="button" onClick={() => fotosRef.current?.click()} style={{ padding:'8px 16px', background:'#1a2f52', border:'none', borderRadius:8, color:'#8aabcc', fontSize:13, cursor:'pointer', marginBottom:10 }}>📷 Agregar fotos</button>
                  {fotoPreviews.length > 0 && (
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      {fotoPreviews.map((url, i) => (
                        <div key={i} style={{ position:'relative' }}>
                          <img src={url} alt={`foto ${i+1}`} style={{ width:64, height:64, objectFit:'cover', borderRadius:8, border:'1px solid #1a2f52' }} />
                          <button type="button" onClick={() => quitarFoto(i)} style={{ position:'absolute', top:-6, right:-6, width:18, height:18, background:'#ef4444', border:'none', borderRadius:'50%', color:'#fff', fontSize:10, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {msgErr && <div style={{ marginTop:10, padding:'10px 14px', background:'rgba(244,63,94,0.1)', border:'1px solid rgba(244,63,94,0.3)', borderRadius:8, color:'#f87171', fontSize:13 }}>⚠ {msgErr}</div>}

              <div style={{ display:'flex', gap:10, marginTop:20, justifyContent:'flex-end' }}>
                <button type="button" onClick={() => { setShowForm(false); setFotos([]); setFotoPreviews([]) }} style={{ padding:'9px 20px', background:'transparent', border:'1px solid #1a2f52', borderRadius:8, color:'#6b8ab0', fontSize:13, cursor:'pointer' }}>Cancelar</button>
                {modoLote && (
                  <button type="submit" name="otro" disabled={saving} style={{ padding:'9px 20px', background: saving?'#1e3058':'#0d2a1a', border:'1px solid #10b981', borderRadius:8, color:'#10b981', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                    {saving ? '...' : '✓ Guardar y agregar otro'}
                  </button>
                )}
                <button type="submit" disabled={saving} style={{ padding:'9px 24px', background: saving ? '#1e3058' : 'linear-gradient(135deg,#0066ff,#0044bb)', border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                  {saving ? 'Guardando...' : modoLote ? 'Guardar y cerrar lote' : 'Registrar equipo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EXCEL */}
      {showExcel && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.82)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:14, padding:28, width:'100%', maxWidth:860, fontFamily:"'DM Sans', system-ui", maxHeight:'90vh', overflow:'auto' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <div>
                <h3 style={{ color:'#fff', margin:'0 0 4px', fontSize:16 }}>Carga masiva — {excelFileName}</h3>
                <p style={{ color:'#4a6a8a', fontSize:13, margin:0 }}>{excelRows.filter(r=>r._ok).length} listos · {excelRows.filter(r=>!r._ok).length} con problemas</p>
              </div>
              <button onClick={() => { setShowExcel(false); setExcelRows([]); setImportResult(null) }} style={{ background:'transparent', border:'none', color:'#4a6a8a', fontSize:20, cursor:'pointer' }}>×</button>
            </div>

            {/* Campos globales para el lote Excel */}
            {!importResult && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 14px', marginBottom:14, padding:'12px 14px', background:'rgba(59,130,246,0.06)', border:'1px solid rgba(59,130,246,0.2)', borderRadius:10 }}>
                <div>
                  <label style={{ color:'#8aabcc', fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:4 }}>Proveedor (aplica a todos)</label>
                  <select style={{ ...sel, fontSize:12 }} value={lote.proveedor_id} onChange={e => setLote(l=>({...l, proveedor_id:e.target.value}))}>
                    <option value="">Del archivo Excel</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ color:'#8aabcc', fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:4 }}>N° Factura (aplica a todos)</label>
                  <input style={{ ...inp, fontSize:12 }} value={lote.no_factura} onChange={e => setLote(l=>({...l, no_factura:e.target.value}))} placeholder="ej: FAC-2024-001" />
                </div>
              </div>
            )}

            {importResult && (
              <div style={{ marginBottom:12, padding:'10px 16px', background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.3)', borderRadius:8, color:'#10b981', fontSize:13 }}>
                ✓ Importados: {importResult.ok} · Errores: {importResult.err} · Omitidos: {importResult.omitidos}
              </div>
            )}

            <div style={{ overflow:'auto', maxHeight:380, borderRadius:8, border:'1px solid #1a2f52', marginBottom:14 }}>
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:700 }}>
                <thead>
                  <tr>
                    {['','Factura','IMEI 1','IMEI 2','Producto','GB','Color','Bat%','Costo','P.Venta','Condición'].map(h => (
                      <th key={h} style={{ color:'#4a6a8a', fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em', padding:'7px 10px', textAlign:'left', borderBottom:'1px solid #1a2f52', background:'#0d1a35', position:'sticky', top:0, whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {excelRows.map((r,i) => (
                    <tr key={i} style={{ background: r._ok ? 'transparent' : 'rgba(239,68,68,0.05)' }}>
                      <td style={{ padding:'7px 10px', borderBottom:'1px solid #0f1e36' }}>
                        {r._ok ? <span style={{ color:'#10b981' }}>✓</span> : <span style={{ color:'#ef4444', fontSize:11 }}>⚠ {r._msg}</span>}
                      </td>
                      <td style={{ padding:'7px 10px', borderBottom:'1px solid #0f1e36', fontSize:11, color:'#60a5fa' }}>{r.no_factura || '—'}</td>
                      <td style={{ padding:'7px 10px', borderBottom:'1px solid #0f1e36', fontSize:11, fontFamily:'monospace', color:'#8aabcc' }}>{r.imei || '—'}</td>
                      <td style={{ padding:'7px 10px', borderBottom:'1px solid #0f1e36', fontSize:11, fontFamily:'monospace', color:'#6a8aaa' }}>{r.imei2 || '—'}</td>
                      <td style={{ padding:'7px 10px', borderBottom:'1px solid #0f1e36', fontSize:12, color:'#e2e8f0' }}>{r.producto || '—'}</td>
                      <td style={{ padding:'7px 10px', borderBottom:'1px solid #0f1e36', fontSize:12 }}>{r.almacenamiento || '—'}</td>
                      <td style={{ padding:'7px 10px', borderBottom:'1px solid #0f1e36', fontSize:12 }}>{r.color || '—'}</td>
                      <td style={{ padding:'7px 10px', borderBottom:'1px solid #0f1e36', fontSize:12, color:'#10b981' }}>{r.bateria ? `${r.bateria}%` : '—'}</td>
                      <td style={{ padding:'7px 10px', borderBottom:'1px solid #0f1e36', fontSize:12, color:'#fff', whiteSpace:'nowrap' }}>{r.costo ? fmt(r.costo) : '—'}</td>
                      <td style={{ padding:'7px 10px', borderBottom:'1px solid #0f1e36', fontSize:12, color:'#10b981', whiteSpace:'nowrap' }}>{r.precio_venta_est ? fmt(r.precio_venta_est) : '—'}</td>
                      <td style={{ padding:'7px 10px', borderBottom:'1px solid #0f1e36', fontSize:12 }}>{r.estado_equipo || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => { setShowExcel(false); setExcelRows([]); setImportResult(null) }} style={{ padding:'9px 20px', background:'transparent', border:'1px solid #1a2f52', borderRadius:8, color:'#6b8ab0', fontSize:13, cursor:'pointer' }}>Cerrar</button>
              {!importResult && (
                <button onClick={importarExcel} disabled={importando || !excelRows.filter(r=>r._ok).length} style={{ padding:'9px 24px', border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', background: importando ? '#1e3058' : 'linear-gradient(135deg,#0066ff,#0044bb)' }}>
                  {importando ? '⏳ Importando...' : `✓ Importar ${excelRows.filter(r=>r._ok).length} equipos`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
