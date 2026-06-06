import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'

const ENTIDADES = [
  { value:'addi',          label:'ADDI' },
  { value:'credi_ya',      label:'Credi Ya' },
  { value:'brilla',        label:'Brilla' },
  { value:'banco_bogota',  label:'Banco de Bogotá' },
  { value:'alo_credit',    label:'Alo Credit' },
  { value:'superCreditos', label:'SuperCréditos' },
  { value:'crediaguas',    label:'Crediaguas' },
  { value:'renting',       label:'Renting' },
  { value:'otro',          label:'Otro' }
]

const fmt = n => new Intl.NumberFormat('es-CO', {
  style:'currency', currency:'COP', maximumFractionDigits:0
}).format(n || 0)

export default function Extractos() {
  const [extractos, setExtractos] = useState([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [uploading, setUploading] = useState(false)
  const [msgErr, setMsgErr]       = useState('')
  const [form, setForm] = useState({
    entidad:'addi', periodo:'', fecha_extracto:'',
    total_equipos_liquidados:'', valor_total_liquidado:'',
    valor_total_retenido:'', valor_neto_recibido:'', observaciones:''
  })
  const [archivo, setArchivo] = useState(null)
  const fileRef = useRef()

  useEffect(() => { loadExtractos() }, [])

  async function loadExtractos() {
    const { data, error } = await supabase
      .from('extractos')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) console.error('Error extractos:', error)
    setExtractos(data || [])
    setLoading(false)
  }

  async function subirExtracto(e) {
    e.preventDefault()
    if (!archivo) { setMsgErr('Selecciona un archivo'); return }
    setUploading(true)
    setMsgErr('')

    const user = (await supabase.auth.getUser()).data.user
    const ext  = archivo.name.split('.').pop()
    const path = `extractos/${form.entidad}/${form.periodo.replace(/\s/g,'-')}-${Date.now()}.${ext}`

    const { error: fileError } = await supabase.storage
      .from('ICALI DOCS')
      .upload(path, archivo, { upsert: false })

    if (fileError) {
      setMsgErr('Error al subir archivo: ' + fileError.message)
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('ICALI DOCS')
      .getPublicUrl(path)

    const { error } = await supabase.from('extractos').insert({
      subido_por:                 user.id,
      entidad:                    form.entidad,
      periodo:                    form.periodo,
      fecha_extracto:             form.fecha_extracto,
      archivo_url:                publicUrl,
      archivo_nombre:             archivo.name,
      archivo_tipo:               ext,
      total_equipos_liquidados:   Number(form.total_equipos_liquidados) || 0,
      valor_total_liquidado:      Number(String(form.valor_total_liquidado).replace(/\D/g,'')) || 0,
      valor_total_retenido:       Number(String(form.valor_total_retenido).replace(/\D/g,'')) || 0,
      valor_neto_recibido:        Number(String(form.valor_neto_recibido).replace(/\D/g,'')) || 0,
      observaciones:              form.observaciones
    })

    setUploading(false)
    if (!error) {
      setShowForm(false)
      setArchivo(null)
      setForm({ entidad:'addi', periodo:'', fecha_extracto:'', total_equipos_liquidados:'', valor_total_liquidado:'', valor_total_retenido:'', valor_neto_recibido:'', observaciones:'' })
      loadExtractos()
    } else {
      setMsgErr('Error al guardar: ' + error.message)
    }
  }

  async function marcarConciliado(id) {
    await supabase.from('extractos').update({
      conciliado: true,
      fecha_conciliacion: new Date().toISOString().split('T')[0]
    }).eq('id', id)
    loadExtractos()
  }

  function descargarExcel() {
    const rows = extractos.map(ex => ({
      'Entidad':           ENTIDADES.find(e => e.value === ex.entidad)?.label || ex.entidad,
      'Período':           ex.periodo,
      'Fecha extracto':    ex.fecha_extracto || '',
      'Equipos liquidados': ex.total_equipos_liquidados,
      'Valor total':       ex.valor_total_liquidado,
      'Total retenido':    ex.valor_total_retenido,
      'Neto recibido':     ex.valor_neto_recibido,
      'Conciliado':        ex.conciliado ? 'Sí' : 'No',
      'Fecha conciliación': ex.fecha_conciliacion || '',
      'Observaciones':     ex.observaciones || '',
      'Archivo':           ex.archivo_nombre || '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Extractos')
    XLSX.writeFile(wb, `Extractos_iCali_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const th = { color:'#4a6a8a', fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', padding:'10px 14px', textAlign:'left', borderBottom:'1px solid #1a2f52', whiteSpace:'nowrap' }
  const td = { padding:'10px 14px', color:'#cbd5e1', fontSize:13, borderBottom:'1px solid #0f1e36' }
  const inp = { background:'#0a1628', border:'1px solid #1a2f52', borderRadius:6, padding:'7px 10px', color:'#fff', fontSize:13, width:'100%', boxSizing:'border-box', outline:'none' }

  // KPIs
  const totalNeto     = extractos.reduce((a,e) => a + Number(e.valor_neto_recibido||0), 0)
  const totalRetenido = extractos.reduce((a,e) => a + Number(e.valor_total_retenido||0), 0)
  const totalEquipos  = extractos.reduce((a,e) => a + Number(e.total_equipos_liquidados||0), 0)
  const pendientes    = extractos.filter(e => !e.conciliado).length

  return (
    <div style={{ padding:'32px 36px', fontFamily:"'DM Sans', system-ui" }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ color:'#fff', fontSize:20, fontWeight:600, margin:'0 0 4px' }}>Extractos y liquidaciones</h1>
          <p style={{ color:'#4a6a8a', fontSize:13, margin:0 }}>Archivos de liquidación por financiera</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={descargarExcel} style={{ padding:'9px 16px', background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:8, color:'#8aabcc', fontSize:13, cursor:'pointer' }}>
            📊 Descargar Excel
          </button>
          <button onClick={() => setShowForm(true)} style={{ padding:'10px 20px', background:'linear-gradient(135deg,#0066ff,#0044bb)', border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
            + Subir extracto
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, marginBottom:20 }}>
        {[
          { label:'Total neto recibido',  val:fmt(totalNeto),     color:'#10b981', small:true },
          { label:'Total retenido',        val:fmt(totalRetenido), color:'#f59e0b', small:true },
          { label:'Equipos liquidados',    val:totalEquipos,       color:'#3b82f6' },
          { label:'Sin conciliar',         val:pendientes,         color: pendientes > 0 ? '#ef4444' : '#4a6a8a' },
        ].map(k => (
          <div key={k.label} style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:10, padding:'12px 16px' }}>
            <div style={{ color:'#5a7aaa', fontSize:10, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:4 }}>{k.label}</div>
            <div style={{ color:k.color, fontSize:k.small ? 15 : 24, fontWeight:600 }}>{k.val}</div>
          </div>
        ))}
      </div>

      <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:12, overflow:'auto' }}>
        {loading ? (
          <div style={{ padding:40, color:'#4a6a8a', textAlign:'center', fontSize:13 }}>Cargando...</div>
        ) : extractos.length === 0 ? (
          <div style={{ padding:40, color:'#4a6a8a', textAlign:'center', fontSize:13 }}>
            No hay extractos subidos todavía
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:900 }}>
            <thead>
              <tr>
                <th style={th}>Entidad</th>
                <th style={th}>Período</th>
                <th style={th}>Fecha</th>
                <th style={th}>Equipos</th>
                <th style={th}>Valor total</th>
                <th style={th}>Retenido</th>
                <th style={th}>Neto recibido</th>
                <th style={th}>Archivo</th>
                <th style={th}>Conciliado</th>
              </tr>
            </thead>
            <tbody>
              {extractos.map(ex => (
                <tr key={ex.id}>
                  <td style={td}>
                    <span style={{ color:'#fff', fontWeight:500 }}>
                      {ENTIDADES.find(e => e.value === ex.entidad)?.label || ex.entidad}
                    </span>
                  </td>
                  <td style={{ ...td, fontWeight:500, color:'#e2e8f0' }}>{ex.periodo}</td>
                  <td style={{ ...td, fontSize:12 }}>
                    {ex.fecha_extracto
                      ? new Date(ex.fecha_extracto + 'T12:00').toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' })
                      : '—'}
                  </td>
                  <td style={{ ...td, textAlign:'center', fontWeight:600, color:'#fff' }}>{ex.total_equipos_liquidados}</td>
                  <td style={{ ...td, whiteSpace:'nowrap', fontWeight:600, color:'#fff' }}>{fmt(ex.valor_total_liquidado)}</td>
                  <td style={{ ...td, whiteSpace:'nowrap', color:'#f59e0b' }}>{fmt(ex.valor_total_retenido)}</td>
                  <td style={{ ...td, whiteSpace:'nowrap', fontWeight:700, color:'#10b981' }}>{fmt(ex.valor_neto_recibido)}</td>
                  <td style={td}>
                    {ex.archivo_url ? (
                      <a href={ex.archivo_url} target="_blank" rel="noreferrer" style={{ color:'#60a5fa', fontSize:12, textDecoration:'none', display:'flex', alignItems:'center', gap:4 }}>
                        📄 {ex.archivo_nombre?.slice(0,20)}{ex.archivo_nombre?.length > 20 ? '...' : ''}
                      </a>
                    ) : '—'}
                  </td>
                  <td style={td}>
                    {ex.conciliado ? (
                      <span style={{ background:'#0f3d2a', color:'#10b981', fontSize:11, padding:'3px 8px', borderRadius:4, fontWeight:500 }}>
                        ✓ {ex.fecha_conciliacion}
                      </span>
                    ) : (
                      <button onClick={() => marcarConciliado(ex.id)} style={{ background:'#1a2f52', border:'none', borderRadius:6, color:'#8aabcc', fontSize:11, padding:'4px 10px', cursor:'pointer' }}>
                        Marcar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal subir extracto */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:14, padding:28, width:'100%', maxWidth:520, fontFamily:"'DM Sans', system-ui", maxHeight:'90vh', overflow:'auto' }}>
            <h3 style={{ color:'#fff', margin:'0 0 20px', fontSize:16 }}>Subir extracto de liquidación</h3>
            <form onSubmit={subirExtracto}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px 14px' }}>
                <div>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Entidad *</label>
                  <select required style={{ ...inp, cursor:'pointer' }} value={form.entidad} onChange={e => setForm(f => ({ ...f, entidad: e.target.value }))}>
                    {ENTIDADES.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Período * (ej: Mayo 2026)</label>
                  <input required style={inp} value={form.periodo} onChange={e => setForm(f => ({ ...f, periodo: e.target.value }))} placeholder="Mayo 2026" />
                </div>
                <div>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Fecha extracto *</label>
                  <input required type="date" style={inp} value={form.fecha_extracto} onChange={e => setForm(f => ({ ...f, fecha_extracto: e.target.value }))} />
                </div>
                <div>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}># Equipos liquidados</label>
                  <input type="number" style={inp} value={form.total_equipos_liquidados} onChange={e => setForm(f => ({ ...f, total_equipos_liquidados: e.target.value }))} />
                </div>
                <div>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Valor total $</label>
                  <input style={inp} value={form.valor_total_liquidado} onChange={e => setForm(f => ({ ...f, valor_total_liquidado: e.target.value }))} />
                </div>
                <div>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Total retenido $</label>
                  <input style={inp} value={form.valor_total_retenido} onChange={e => setForm(f => ({ ...f, valor_total_retenido: e.target.value }))} />
                </div>
                <div>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Neto recibido $</label>
                  <input style={inp} value={form.valor_neto_recibido} onChange={e => setForm(f => ({ ...f, valor_neto_recibido: e.target.value }))} />
                </div>
                <div style={{ gridColumn:'span 2' }}>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Archivo (PDF, Excel) *</label>
                  <div onClick={() => fileRef.current?.click()} style={{ border:'1px dashed #1a2f52', borderRadius:8, padding:'20px', textAlign:'center', cursor:'pointer', background: archivo ? '#0f2a1a' : '#0a1628' }}>
                    <input ref={fileRef} type="file" accept=".pdf,.xlsx,.xls,.csv" style={{ display:'none' }} onChange={e => setArchivo(e.target.files[0])} />
                    {archivo
                      ? <span style={{ color:'#10b981', fontSize:13 }}>✓ {archivo.name}</span>
                      : <span style={{ color:'#4a6a8a', fontSize:13 }}>Clic para seleccionar archivo</span>
                    }
                  </div>
                </div>
                <div style={{ gridColumn:'span 2' }}>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Notas</label>
                  <textarea style={{ ...inp, resize:'vertical', minHeight:60 }} value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} />
                </div>
              </div>
              {msgErr && <div style={{ marginTop:10, padding:'8px 12px', background:'rgba(244,63,94,0.1)', border:'1px solid rgba(244,63,94,0.3)', borderRadius:6, color:'#f87171', fontSize:12 }}>{msgErr}</div>}
              <div style={{ display:'flex', gap:10, marginTop:20, justifyContent:'flex-end' }}>
                <button type="button" onClick={() => { setShowForm(false); setArchivo(null); setMsgErr('') }} style={{ padding:'9px 20px', background:'transparent', border:'1px solid #1a2f52', borderRadius:8, color:'#6b8ab0', fontSize:13, cursor:'pointer' }}>Cancelar</button>
                <button type="submit" disabled={uploading} style={{ padding:'9px 24px', background: uploading ? '#1e3058' : 'linear-gradient(135deg,#0066ff,#0044bb)', border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                  {uploading ? 'Subiendo...' : 'Subir extracto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}