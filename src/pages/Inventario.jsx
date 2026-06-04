import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import * as XLSX from 'xlsx'

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
  'iPhone 16 Pro Max 256GB','iPhone 16 Pro Max 512GB',
  'iPhone 16E 128GB',
  'iPhone 17 256GB','iPhone 17 Air 256GB','iPhone 17 Air 512GB',
  'iPhone 17 Pro 256GB','iPhone 17 Pro 512GB',
  'iPhone 17 Pro Max 256GB','iPhone 17 Pro Max 512GB','iPhone 17 Pro Max 1TB',
  'ZTEA56 Pro 6RAM 128GB','Otro'
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

export default function Inventario() {
  const { esAdmin, esLiderAdmin } = useAuth()
  const [tab, setTab]             = useState('stock')
  const [proveedores, setProveedores] = useState([])
  const [compras, setCompras]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('disponible')
  const [filtroProv, setFiltroProv]     = useState('')
  const [buscar, setBuscar]             = useState('')

  // Form ingreso individual
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState({
    proveedor_id:'', producto:'', imei:'', color:'',
    capacidad:'', costo:'',
    fecha_compra: new Date().toISOString().split('T')[0],
    observaciones:''
  })
  const [fotoFile, setFotoFile]   = useState(null)
  const [fotoPreview, setFotoPreview] = useState(null)
  const [saving, setSaving]       = useState(false)
  const [msgOk, setMsgOk]         = useState('')
  const [msgErr, setMsgErr]       = useState('')

  // Escáner IMEI
  const [escaner, setEscaner]     = useState(false)
  const [imeiEscaneado, setImeiEscaneado] = useState('')
  const videoRef  = useRef()
  const streamRef = useRef()
  const inputImeiRef = useRef()

  // Carga masiva Excel
  const [showExcel, setShowExcel] = useState(false)
  const [excelRows, setExcelRows] = useState([])
  const [excelCols, setExcelCols] = useState({})
  const [excelFile, setExcelFile] = useState(null)
  const [importando, setImportando] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const fileExcelRef = useRef()
  const fotoRef      = useRef()

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

  // ── ESCÁNER IMEI con cámara ──
  async function iniciarEscaner() {
    setEscaner(true)
    setImeiEscaneado('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch {
      // Si no hay cámara, mostrar campo manual
    }
  }

  function cerrarEscaner() {
    setEscaner(false)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }

  function usarIMEI() {
    if (imeiEscaneado.trim().length >= 10) {
      setForm(f => ({ ...f, imei: imeiEscaneado.trim() }))
      cerrarEscaner()
      setShowForm(true)
    }
  }

  // ── FOTO DEL EQUIPO ──
  function handleFoto(e) {
    const file = e.target.files[0]
    if (!file) return
    setFotoFile(file)
    const url = URL.createObjectURL(file)
    setFotoPreview(url)
  }

  async function subirFoto(imei) {
    if (!fotoFile) return null
    const ext  = fotoFile.name.split('.').pop()
    const path = `equipos/${imei}-${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from('ICALI DOCS')
      .upload(path, fotoFile, { upsert: true })
    if (error) return null
    const { data: { publicUrl } } = supabase.storage
      .from('ICALI DOCS')
      .getPublicUrl(path)
    return publicUrl
  }

  // ── GUARDAR EQUIPO INDIVIDUAL ──
  async function guardarEquipo(e) {
    e.preventDefault()
    setSaving(true)
    setMsgErr('')
    try {
      const user    = (await supabase.auth.getUser()).data.user
      const fotoUrl = await subirFoto(form.imei)
      const { error } = await supabase.from('compras_proveedor').insert({
        proveedor_id:   form.proveedor_id,
        producto:       form.producto,
        imei:           form.imei.trim(),
        color:          form.color,
        capacidad:      form.capacidad,
        costo:          Number(form.costo.replace(/\D/g,'')) || 0,
        fecha_compra:   form.fecha_compra,
        observaciones:  form.observaciones,
        foto_url:       fotoUrl,
        registrado_por: user.id,
        estado:         'disponible'
      })
      if (error) throw new Error(error.message)
      setMsgOk(`✓ Equipo ${form.imei} registrado`)
      setForm(f => ({ ...f, imei:'', color:'', observaciones:'', costo:'' }))
      setFotoFile(null)
      setFotoPreview(null)
      loadAll()
    } catch (err) { setMsgErr(err.message) }
    setSaving(false)
    setTimeout(() => { setMsgOk(''); setMsgErr('') }, 4000)
  }

  // ── LEER EXCEL ──
  async function leerExcel(e) {
    const file = e.target.files[0]
    if (!file) return
    setExcelFile(file.name)
    setImportResult(null)

    const buffer = await file.arrayBuffer()
    const wb     = XLSX.read(buffer)
    const ws     = wb.Sheets[wb.SheetNames[0]]
    const rows   = XLSX.utils.sheet_to_json(ws, { defval:'' })
    if (!rows.length) return

    const keys    = Object.keys(rows[0])
    const find    = (...terms) => keys.find(k =>
      terms.some(t => k.toLowerCase().includes(t.toLowerCase()))
    ) || ''

    const cols = {
      imei:      find('imei','serial','serie','codigo'),
      producto:  find('producto','equipo','modelo','referencia','descripcion'),
      color:     find('color'),
      capacidad: find('capacidad','gb','almacenamiento','storage'),
      costo:     find('costo','precio','valor','price','cost'),
      proveedor: find('proveedor','supplier','vendor'),
    }
    setExcelCols(cols)

    const parsed = rows.map((r,i) => ({
      _idx: i,
      imei:      String(r[cols.imei]     || '').trim(),
      producto:  String(r[cols.producto] || '').trim(),
      color:     String(r[cols.color]    || '').trim(),
      capacidad: String(r[cols.capacidad]|| '').trim(),
      costo:     Number(String(r[cols.costo]||0).replace(/[^0-9.]/g,'')),
      proveedor: String(r[cols.proveedor]|| '').trim(),
      _ok: true,
      _msg: ''
    })).filter(r => r.imei || r.producto)

    // Marcar duplicados
    const isCopy = new Set(compras.map(c => c.imei))
    parsed.forEach(r => {
      if (r.imei && isCopy.has(r.imei)) {
        r._ok  = false
        r._msg = 'IMEI ya existe'
      }
    })
    setExcelRows(parsed)
    setShowExcel(true)
    e.target.value = ''
  }

  // ── IMPORTAR EXCEL ──
  async function importarExcel() {
    setImportando(true)
    const user = (await supabase.auth.getUser()).data.user
    const validos = excelRows.filter(r => r._ok)

    let ok = 0, err = 0
    for (const r of validos) {
      const prov = proveedores.find(p =>
        p.nombre.toLowerCase().includes(r.proveedor.toLowerCase())
      ) || proveedores[0]

      const { error } = await supabase.from('compras_proveedor').insert({
        proveedor_id:   prov?.id,
        producto:       r.producto || 'Sin especificar',
        imei:           r.imei,
        color:          r.color,
        capacidad:      r.capacidad,
        costo:          r.costo,
        registrado_por: user.id,
        estado:         'disponible',
        fecha_compra:   new Date().toISOString().split('T')[0]
      })
      if (error) err++
      else ok++
    }

    setImportResult({ ok, err, omitidos: excelRows.filter(r => !r._ok).length })
    setImportando(false)
    loadAll()
  }

  // ── FILTROS ──
  const filtrados = compras.filter(c => {
    if (filtroEstado && c.estado !== filtroEstado) return false
    if (filtroProv   && c.proveedor_id !== filtroProv) return false
    if (buscar) {
      const s = buscar.toLowerCase()
      if (!`${c.imei} ${c.producto} ${c.color}`.toLowerCase().includes(s)) return false
    }
    return true
  })

  const totalDisp  = compras.filter(c => c.estado === 'disponible').length
  const totalVend  = compras.filter(c => c.estado === 'vendido').length
  const valorStock = compras.filter(c => c.estado === 'disponible')
    .reduce((a,c) => a + Number(c.costo||0), 0)

  const th = {
    color:'#4a6a8a', fontSize:11, fontWeight:600, textTransform:'uppercase',
    letterSpacing:'0.06em', padding:'10px 14px', textAlign:'left',
    borderBottom:'1px solid #1a2f52', whiteSpace:'nowrap'
  }
  const td = { padding:'10px 14px', color:'#cbd5e1', fontSize:13, borderBottom:'1px solid #0f1e36' }

  const puedeEditar = esAdmin || esLiderAdmin

  return (
    <div style={{ padding:'32px 36px', fontFamily:"'DM Sans', system-ui" }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ color:'#fff', fontSize:20, fontWeight:600, margin:'0 0 4px' }}>Inventario</h1>
          <p style={{ color:'#4a6a8a', fontSize:13, margin:0 }}>
            {totalDisp} disponibles · {totalVend} vendidos · {fmt(valorStock)} en stock
          </p>
        </div>
        {puedeEditar && (
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => iniciarEscaner()} style={{
              padding:'9px 16px', background:'#0d1a35',
              border:'1px solid #1a2f52', borderRadius:8,
              color:'#8aabcc', fontSize:13, cursor:'pointer'
            }}>📷 Escanear IMEI</button>
            <button onClick={() => fileExcelRef.current?.click()} style={{
              padding:'9px 16px', background:'#0d1a35',
              border:'1px solid #1a2f52', borderRadius:8,
              color:'#8aabcc', fontSize:13, cursor:'pointer'
            }}>📊 Carga masiva Excel</button>
            <button onClick={() => { setShowForm(true); setMsgErr('') }} style={{
              padding:'9px 18px',
              background:'linear-gradient(135deg,#0066ff,#0044bb)',
              border:'none', borderRadius:8,
              color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer'
            }}>+ Ingresar equipo</button>
            <input ref={fileExcelRef} type="file" accept=".xlsx,.xls,.csv"
              style={{ display:'none' }} onChange={leerExcel} />
          </div>
        )}
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12, marginBottom:20 }}>
        {[
          { label:'Disponibles', val:totalDisp,      color:'#10b981' },
          { label:'Vendidos',    val:totalVend,       color:'#4a6a8a' },
          { label:'Total equipos',val:compras.length, color:'#3b82f6' },
          { label:'Valor stock',  val:fmt(valorStock), color:'#f59e0b', small:true },
        ].map(k => (
          <div key={k.label} style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:10, padding:'14px 18px' }}>
            <div style={{ color:'#5a7aaa', fontSize:11, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>{k.label}</div>
            <div style={{ color: k.color, fontSize: k.small ? 18 : 26, fontWeight:600 }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Mensajes */}
      {msgOk  && <div style={{ marginBottom:12, padding:'10px 16px', background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.3)', borderRadius:8, color:'#10b981', fontSize:13 }}>{msgOk}</div>}
      {msgErr && <div style={{ marginBottom:12, padding:'10px 16px', background:'rgba(244,63,94,0.1)', border:'1px solid rgba(244,63,94,0.3)', borderRadius:8, color:'#f87171', fontSize:13 }}>⚠ {msgErr}</div>}

      {/* Filtros */}
      <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
        <input placeholder="Buscar IMEI, producto, color..."
          value={buscar} onChange={e => setBuscar(e.target.value)}
          style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:8,
            padding:'8px 12px', color:'#fff', fontSize:13, outline:'none', flex:1, minWidth:200 }} />
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} style={{
          background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:8,
          padding:'8px 12px', color: filtroEstado ? '#fff' : '#4a6a8a', fontSize:13, cursor:'pointer' }}>
          <option value="">Todos los estados</option>
          <option value="disponible">Disponible</option>
          <option value="vendido">Vendido</option>
          <option value="devuelto">Devuelto</option>
          <option value="en_revision">En revisión</option>
        </select>
        <select value={filtroProv} onChange={e => setFiltroProv(e.target.value)} style={{
          background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:8,
          padding:'8px 12px', color: filtroProv ? '#fff' : '#4a6a8a', fontSize:13, cursor:'pointer' }}>
          <option value="">Todos los proveedores</option>
          {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </div>

      {/* Tabla inventario */}
      <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:12, overflow:'auto' }}>
        {loading ? (
          <div style={{ padding:40, textAlign:'center', color:'#4a6a8a', fontSize:13 }}>Cargando...</div>
        ) : filtrados.length === 0 ? (
          <div style={{ padding:40, textAlign:'center', color:'#4a6a8a', fontSize:13 }}>
            Sin equipos registrados con estos filtros
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:700 }}>
            <thead>
              <tr>
                <th style={th}>Foto</th>
                <th style={th}>IMEI</th>
                <th style={th}>Producto</th>
                <th style={th}>Color</th>
                <th style={th}>Proveedor</th>
                <th style={th}>Costo</th>
                <th style={th}>Fecha</th>
                <th style={th}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(c => (
                <tr key={c.id}>
                  <td style={td}>
                    {c.foto_url ? (
                      <img src={c.foto_url} alt="equipo"
                        style={{ width:40, height:40, objectFit:'cover', borderRadius:6 }} />
                    ) : (
                      <div style={{ width:40, height:40, borderRadius:6,
                        background:'#1a2f52', display:'flex', alignItems:'center',
                        justifyContent:'center', color:'#4a6a8a', fontSize:16 }}>📱</div>
                    )}
                  </td>
                  <td style={{ ...td, fontSize:11, fontFamily:'monospace', color:'#8aabcc' }}>{c.imei}</td>
                  <td style={{ ...td, fontSize:12, color:'#e2e8f0' }}>{c.producto}</td>
                  <td style={{ ...td, fontSize:12 }}>{c.color || '—'}</td>
                  <td style={{ ...td, fontSize:12 }}>{c.proveedores?.nombre || '—'}</td>
                  <td style={{ ...td, fontWeight:600, color:'#fff', whiteSpace:'nowrap' }}>{fmt(c.costo)}</td>
                  <td style={{ ...td, fontSize:12, whiteSpace:'nowrap' }}>
                    {c.fecha_compra ? new Date(c.fecha_compra+'T12:00').toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'}) : '—'}
                  </td>
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
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ══ MODAL ESCÁNER IMEI ══ */}
      {escaner && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.9)',
          display:'flex', flexDirection:'column', alignItems:'center',
          justifyContent:'center', zIndex:1000, gap:16 }}>
          <div style={{ color:'#fff', fontSize:16, fontWeight:500 }}>📷 Apunta la cámara al código de barras del IMEI</div>
          <video ref={videoRef} autoPlay playsInline
            style={{ width:'100%', maxWidth:400, borderRadius:12, background:'#000' }} />
          <div style={{ display:'flex', flexDirection:'column', gap:8, width:'100%', maxWidth:400 }}>
            <div style={{ color:'#8aabcc', fontSize:12, textAlign:'center' }}>
              O ingresa el IMEI manualmente:
            </div>
            <input
              ref={inputImeiRef}
              style={{ ...inp, textAlign:'center', fontSize:16, letterSpacing:2 }}
              placeholder="000000000000000"
              value={imeiEscaneado}
              onChange={e => setImeiEscaneado(e.target.value)}
              maxLength={20}
              autoFocus
            />
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={cerrarEscaner} style={{
              padding:'10px 24px', background:'transparent',
              border:'1px solid #4a6a8a', borderRadius:8,
              color:'#8aabcc', fontSize:13, cursor:'pointer'
            }}>Cancelar</button>
            <button onClick={usarIMEI} disabled={imeiEscaneado.trim().length < 10} style={{
              padding:'10px 24px',
              background: imeiEscaneado.trim().length >= 10
                ? 'linear-gradient(135deg,#0066ff,#0044bb)' : '#1e3058',
              border:'none', borderRadius:8,
              color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer'
            }}>Usar este IMEI →</button>
          </div>
        </div>
      )}

      {/* ══ MODAL INGRESAR EQUIPO ══ */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background:'#0d1a35', border:'1px solid #1a2f52',
            borderRadius:14, padding:28, width:'100%', maxWidth:520,
            fontFamily:"'DM Sans', system-ui", maxHeight:'90vh', overflow:'auto' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <h3 style={{ color:'#fff', margin:0, fontSize:16 }}>Ingresar equipo</h3>
              <button onClick={() => { setShowForm(false); setFotoPreview(null); setFotoFile(null) }}
                style={{ background:'transparent', border:'none', color:'#4a6a8a', fontSize:20, cursor:'pointer' }}>×</button>
            </div>

            <form onSubmit={guardarEquipo}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px 14px' }}>

                {/* Proveedor */}
                <div style={{ gridColumn:'span 2' }}>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Proveedor *</label>
                  <select required style={sel} value={form.proveedor_id}
                    onChange={e => setForm(f=>({...f, proveedor_id:e.target.value}))}>
                    <option value="">Seleccionar...</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>

                {/* Producto */}
                <div style={{ gridColumn:'span 2' }}>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Producto *</label>
                  <select required style={sel} value={form.producto}
                    onChange={e => setForm(f=>({...f, producto:e.target.value}))}>
                    <option value="">Seleccionar...</option>
                    {PRODUCTOS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                {/* IMEI */}
                <div style={{ gridColumn:'span 2' }}>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>IMEI *</label>
                  <div style={{ display:'flex', gap:8 }}>
                    <input required style={{ ...inp, flex:1 }} value={form.imei}
                      onChange={e => setForm(f=>({...f, imei:e.target.value}))}
                      placeholder="15 dígitos" />
                    <button type="button" onClick={() => iniciarEscaner()} style={{
                      padding:'9px 14px', background:'#1a2f52',
                      border:'none', borderRadius:8,
                      color:'#8aabcc', fontSize:13, cursor:'pointer', whiteSpace:'nowrap'
                    }}>📷 Escanear</button>
                  </div>
                </div>

                {[['color','Color'],['capacidad','Capacidad GB'],['costo','Costo $']].map(([k,l]) => (
                  <div key={k}>
                    <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>{l}</label>
                    <input style={inp} value={form[k]}
                      onChange={e => setForm(f=>({...f, [k]:e.target.value}))} />
                  </div>
                ))}

                <div>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Fecha compra</label>
                  <input type="date" style={inp} value={form.fecha_compra}
                    onChange={e => setForm(f=>({...f, fecha_compra:e.target.value}))} />
                </div>

                {/* Foto */}
                <div style={{ gridColumn:'span 2' }}>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Foto del equipo</label>
                  <input ref={fotoRef} type="file" accept="image/*" capture="environment"
                    style={{ display:'none' }} onChange={handleFoto} />
                  <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                    <button type="button" onClick={() => fotoRef.current?.click()} style={{
                      padding:'9px 16px', background:'#1a2f52', border:'none',
                      borderRadius:8, color:'#8aabcc', fontSize:13, cursor:'pointer'
                    }}>
                      {fotoPreview ? '📷 Cambiar foto' : '📷 Tomar / subir foto'}
                    </button>
                    {fotoPreview && (
                      <img src={fotoPreview} alt="preview"
                        style={{ width:60, height:60, objectFit:'cover', borderRadius:8,
                          border:'1px solid #1a2f52' }} />
                    )}
                  </div>
                </div>

                {/* Observaciones */}
                <div style={{ gridColumn:'span 2' }}>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Observaciones</label>
                  <textarea style={{ ...inp, resize:'vertical', minHeight:60 }}
                    value={form.observaciones}
                    onChange={e => setForm(f=>({...f, observaciones:e.target.value}))} />
                </div>
              </div>

              {msgErr && <div style={{ marginTop:10, padding:'10px 14px', background:'rgba(244,63,94,0.1)', border:'1px solid rgba(244,63,94,0.3)', borderRadius:8, color:'#f87171', fontSize:13 }}>⚠ {msgErr}</div>}

              <div style={{ display:'flex', gap:10, marginTop:20, justifyContent:'flex-end' }}>
                <button type="button" onClick={() => { setShowForm(false); setFotoPreview(null); setFotoFile(null) }} style={{
                  padding:'9px 20px', background:'transparent', border:'1px solid #1a2f52',
                  borderRadius:8, color:'#6b8ab0', fontSize:13, cursor:'pointer'
                }}>Cancelar</button>
                <button type="submit" disabled={saving} style={{
                  padding:'9px 24px',
                  background: saving ? '#1e3058' : 'linear-gradient(135deg,#0066ff,#0044bb)',
                  border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer'
                }}>{saving ? 'Guardando...' : 'Registrar equipo'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ MODAL CARGA MASIVA EXCEL ══ */}
      {showExcel && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background:'#0d1a35', border:'1px solid #1a2f52',
            borderRadius:14, padding:28, width:'100%', maxWidth:800,
            fontFamily:"'DM Sans', system-ui", maxHeight:'90vh', overflow:'auto' }}>

            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <div>
                <h3 style={{ color:'#fff', margin:'0 0 4px', fontSize:16 }}>
                  Carga masiva — {excelFile}
                </h3>
                <p style={{ color:'#4a6a8a', fontSize:13, margin:0 }}>
                  {excelRows.filter(r=>r._ok).length} equipos listos · {excelRows.filter(r=>!r._ok).length} con problemas
                </p>
              </div>
              <button onClick={() => { setShowExcel(false); setExcelRows([]); setImportResult(null) }}
                style={{ background:'transparent', border:'none', color:'#4a6a8a', fontSize:20, cursor:'pointer' }}>×</button>
            </div>

            {/* Mapeo de columnas detectadas */}
            <div style={{ background:'#0a1628', border:'1px solid #1a2f52', borderRadius:8,
              padding:'10px 14px', marginBottom:14, fontSize:12, color:'#8aabcc' }}>
              <strong style={{ color:'#fff' }}>Columnas detectadas: </strong>
              {Object.entries(excelCols).map(([k,v]) => v ? `${k}="${v}"` : null).filter(Boolean).join(' · ')}
            </div>

            {/* Resultado importación */}
            {importResult && (
              <div style={{ marginBottom:14, padding:'12px 16px',
                background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.3)',
                borderRadius:8, color:'#10b981', fontSize:13 }}>
                ✓ Importados: {importResult.ok} · Errores: {importResult.err} · Omitidos: {importResult.omitidos}
              </div>
            )}

            {/* Tabla previsualización */}
            <div style={{ overflow:'auto', maxHeight:400, borderRadius:8,
              border:'1px solid #1a2f52', marginBottom:16 }}>
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:600 }}>
                <thead>
                  <tr>
                    {['','IMEI','Producto','Color','Capacidad','Costo','Proveedor'].map(h => (
                      <th key={h} style={{ color:'#4a6a8a', fontSize:11, fontWeight:600,
                        textTransform:'uppercase', letterSpacing:'.06em',
                        padding:'8px 12px', textAlign:'left',
                        borderBottom:'1px solid #1a2f52', background:'#0d1a35',
                        position:'sticky', top:0, whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {excelRows.map((r,i) => (
                    <tr key={i} style={{ background: r._ok ? 'transparent' : 'rgba(239,68,68,0.05)' }}>
                      <td style={{ padding:'8px 12px', borderBottom:'1px solid #0f1e36' }}>
                        {r._ok
                          ? <span style={{ color:'#10b981', fontSize:14 }}>✓</span>
                          : <span title={r._msg} style={{ color:'#ef4444', fontSize:12 }}>⚠ {r._msg}</span>
                        }
                      </td>
                      <td style={{ padding:'8px 12px', borderBottom:'1px solid #0f1e36',
                        fontSize:11, fontFamily:'monospace', color:'#8aabcc' }}>{r.imei || '—'}</td>
                      <td style={{ padding:'8px 12px', borderBottom:'1px solid #0f1e36',
                        fontSize:12, color:'#e2e8f0' }}>{r.producto || '—'}</td>
                      <td style={{ padding:'8px 12px', borderBottom:'1px solid #0f1e36', fontSize:12 }}>{r.color || '—'}</td>
                      <td style={{ padding:'8px 12px', borderBottom:'1px solid #0f1e36', fontSize:12 }}>{r.capacidad || '—'}</td>
                      <td style={{ padding:'8px 12px', borderBottom:'1px solid #0f1e36',
                        fontSize:12, color: r.costo ? '#fff' : '#4a6a8a' }}>{r.costo ? fmt(r.costo) : '—'}</td>
                      <td style={{ padding:'8px 12px', borderBottom:'1px solid #0f1e36', fontSize:12 }}>{r.proveedor || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => { setShowExcel(false); setExcelRows([]); setImportResult(null) }} style={{
                padding:'9px 20px', background:'transparent', border:'1px solid #1a2f52',
                borderRadius:8, color:'#6b8ab0', fontSize:13, cursor:'pointer'
              }}>Cerrar</button>
              {!importResult && (
                <button onClick={importarExcel} disabled={importando || excelRows.filter(r=>r._ok).length === 0} style={{
                  padding:'9px 24px',
                  background: importando ? '#1e3058' : 'linear-gradient(135deg,#0066ff,#0044bb)',
                  border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer'
                }}>
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