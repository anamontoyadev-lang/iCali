import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const fmt = n => new Intl.NumberFormat('es-CO', {
  style:'currency', currency:'COP', maximumFractionDigits:0
}).format(n || 0)

const inp = {
  background:'#0a1628', border:'1px solid #1a2f52', borderRadius:8,
  padding:'8px 12px', color:'#fff', fontSize:13, width:'100%', boxSizing:'border-box', outline:'none'
}
const sel = { ...inp, cursor:'pointer' }

const PRODUCTOS_LISTA = [
  'iPhone 11 64GB','iPhone 11 128GB','iPhone 12 64GB','iPhone 12 128GB','iPhone 12 256GB',
  'iPhone 13 128GB','iPhone 13 256GB','iPhone 13 512GB',
  'iPhone 13 Pro 128GB','iPhone 13 Pro 256GB','iPhone 13 Pro Max 128GB','iPhone 13 Pro Max 256GB',
  'iPhone 14 128GB','iPhone 14 Plus 128GB','iPhone 14 Pro 128GB','iPhone 14 Pro 256GB',
  'iPhone 14 Pro Max 128GB','iPhone 14 Pro Max 256GB','iPhone 14 Pro Max 512GB',
  'iPhone 15 128GB','iPhone 15 256GB','iPhone 15 Plus 256GB',
  'iPhone 15 Pro 128GB','iPhone 15 Pro 256GB',
  'iPhone 15 Pro Max 256GB','iPhone 15 Pro Max 512GB','iPhone 15 Pro Max 1TB',
  'iPhone 16 128GB','iPhone 16 256GB','iPhone 16 Pro 128GB','iPhone 16 Pro 256GB',
  'iPhone 16 Pro Max 256GB','iPhone 16 Pro Max 512GB','iPhone 16E 128GB',
  'iPhone 17 256GB','iPhone 17 Air 256GB','iPhone 17 Air 512GB',
  'iPhone 17 Pro 256GB','iPhone 17 Pro 512GB',
  'iPhone 17 Pro Max 256GB','iPhone 17 Pro Max 512GB','iPhone 17 Pro Max 1TB',
  'ZTEA56 Pro 6RAM 128GB','Otro'
]

export default function Proveedores() {
  const { esAdmin, esLiderAdmin } = useAuth()
  const [proveedores, setProveedores] = useState([])
  const [provActivo, setProvActivo]   = useState(null)
  const [tab, setTab]                 = useState('resumen')
  const [compras, setCompras]         = useState([])
  const [abonos, setAbonos]           = useState([])
  const [ventas, setVentas]           = useState([])
  const [loading, setLoading]         = useState(true)

  // Modales
  const [showFormProv, setShowFormProv]     = useState(false)
  const [showFormCompra, setShowFormCompra] = useState(false)
  const [showFormAbono, setShowFormAbono]   = useState(false)
  const [editProv, setEditProv]             = useState(null)
  const [saving, setSaving]                 = useState(false)
  const [msgOk, setMsgOk]                   = useState('')
  const [msgErr, setMsgErr]                 = useState('')

  const [formProv, setFormProv]   = useState({ nombre:'', contacto:'', telefono:'', email:'', ciudad:'', notas:'' })
  const [formCompra, setFormCompra] = useState({
    proveedor_id:'', producto:'', imei:'', color:'', capacidad:'', costo:'',
    fecha_compra: new Date().toISOString().split('T')[0], observaciones:''
  })
  const [formAbono, setFormAbono] = useState({
    proveedor_id:'', valor:'', fecha: new Date().toISOString().split('T')[0],
    medio_pago:'efectivo', referencia:'', notas:''
  })

  useEffect(() => { loadProveedores() }, [])
  useEffect(() => {
    if (provActivo) {
      loadDetalle(provActivo)
    }
  }, [provActivo])

  async function loadProveedores() {
    const { data } = await supabase
      .from('proveedores').select('*').order('nombre')
    setProveedores(data || [])
    setLoading(false)
  }

  async function loadDetalle(provId) {
    const [{ data: comprasData }, { data: abonosData }] = await Promise.all([
      supabase.from('compras_proveedor')
        .select('*')
        .eq('proveedor_id', provId)
        .order('created_at', { ascending: false }),
      supabase.from('abonos_proveedor')
        .select('*')
        .eq('proveedor_id', provId)
        .order('fecha', { ascending: false })
        .catch(() => ({ data: [] }))
    ])
    setCompras(comprasData || [])
    setAbonos(abonosData || [])

    // Ventas de equipos de este proveedor
    const imeis = (comprasData || []).filter(c => c.imei).map(c => c.imei)
    if (imeis.length > 0) {
      const { data: ventasData } = await supabase
        .from('ventas')
        .select('id,fecha_venta,nombre_cliente,producto,imei,valor_venta,asesor_nombre')
        .in('imei', imeis)
        .order('fecha_venta', { ascending: false })
      setVentas(ventasData || [])
    } else {
      setVentas([])
    }
  }

  // Calcular cuenta por pagar
  function calcularCuenta(provId) {
    const equiposComprados = compras.filter(c => c.proveedor_id === provId || !provId)
    const totalComprado    = equiposComprados.reduce((a, c) => a + Number(c.costo || 0), 0)
    const totalAbonado     = abonos.reduce((a, ab) => a + Number(ab.valor || 0), 0)
    const saldo            = totalComprado - totalAbonado
    return { totalComprado, totalAbonado, saldo }
  }

  async function guardarProveedor(e) {
    e.preventDefault()
    setSaving(true)
    setMsgErr('')
    try {
      if (editProv) {
        await supabase.from('proveedores').update(formProv).eq('id', editProv.id)
        setMsgOk('Proveedor actualizado')
        setEditProv(null)
      } else {
        await supabase.from('proveedores').insert(formProv)
        setMsgOk('Proveedor creado')
        setShowFormProv(false)
      }
      setFormProv({ nombre:'', contacto:'', telefono:'', email:'', ciudad:'', notas:'' })
      loadProveedores()
    } catch (err) { setMsgErr(err.message) }
    setSaving(false)
    setTimeout(() => { setMsgOk(''); setMsgErr('') }, 4000)
  }

  async function guardarCompra(e) {
    e.preventDefault()
    setSaving(true)
    setMsgErr('')
    try {
      const user = (await supabase.auth.getUser()).data.user
      await supabase.from('compras_proveedor').insert({
        ...formCompra,
        registrado_por: user.id,
        costo: Number(String(formCompra.costo).replace(/\D/g,'')) || 0,
        estado: 'disponible'
      })
      setMsgOk('Equipo registrado en inventario')
      setShowFormCompra(false)
      setFormCompra({ proveedor_id: provActivo || '', producto:'', imei:'', color:'', capacidad:'', costo:'',
        fecha_compra: new Date().toISOString().split('T')[0], observaciones:'' })
      if (provActivo) loadDetalle(provActivo)
      loadProveedores()
    } catch (err) { setMsgErr(err.message) }
    setSaving(false)
    setTimeout(() => { setMsgOk(''); setMsgErr('') }, 4000)
  }

  async function guardarAbono(e) {
    e.preventDefault()
    setSaving(true)
    setMsgErr('')
    try {
      const user = (await supabase.auth.getUser()).data.user
      await supabase.from('abonos_proveedor').insert({
        ...formAbono,
        registrado_por: user.id,
        valor: Number(String(formAbono.valor).replace(/\D/g,'')) || 0
      })
      setMsgOk(`Abono de ${fmt(Number(String(formAbono.valor).replace(/\D/g,'')))} registrado`)
      setShowFormAbono(false)
      setFormAbono({ proveedor_id: provActivo || '', valor:'', fecha: new Date().toISOString().split('T')[0],
        medio_pago:'efectivo', referencia:'', notas:'' })
      if (provActivo) loadDetalle(provActivo)
    } catch (err) { setMsgErr(err.message) }
    setSaving(false)
    setTimeout(() => { setMsgOk(''); setMsgErr('') }, 4000)
  }

  const prov = proveedores.find(p => p.id === provActivo)
  const cuenta = provActivo ? calcularCuenta(provActivo) : null
  const puedeEditar = esAdmin || esLiderAdmin

  const th = {
    color:'#4a6a8a', fontSize:11, fontWeight:600, textTransform:'uppercase',
    letterSpacing:'0.06em', padding:'10px 14px', textAlign:'left',
    borderBottom:'1px solid #1a2f52', whiteSpace:'nowrap'
  }
  const td = { padding:'10px 14px', color:'#cbd5e1', fontSize:13, borderBottom:'1px solid #0f1e36' }

  return (
    <div style={{ padding:'32px 36px', fontFamily:"'DM Sans', system-ui" }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <h1 style={{ color:'#fff', fontSize:20, fontWeight:600, margin:0 }}>Proveedores</h1>
        {puedeEditar && (
          <div style={{ display:'flex', gap:8 }}>
            {provActivo && <>
              <button onClick={() => { setShowFormAbono(true); setFormAbono(f => ({...f, proveedor_id: provActivo})) }} style={{
                padding:'9px 16px', background:'#0d1a35', border:'1px solid #1a2f52',
                borderRadius:8, color:'#8aabcc', fontSize:13, cursor:'pointer'
              }}>+ Registrar abono</button>
              <button onClick={() => { setShowFormCompra(true); setFormCompra(f => ({...f, proveedor_id: provActivo})) }} style={{
                padding:'9px 16px', background:'#0d1a35', border:'1px solid #1a2f52',
                borderRadius:8, color:'#8aabcc', fontSize:13, cursor:'pointer'
              }}>+ Ingresar equipo</button>
            </>}
            <button onClick={() => { setShowFormProv(true); setEditProv(null); setFormProv({ nombre:'', contacto:'', telefono:'', email:'', ciudad:'', notas:'' }) }} style={{
              padding:'9px 18px', background:'linear-gradient(135deg,#0066ff,#0044bb)',
              border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer'
            }}>+ Nuevo proveedor</button>
          </div>
        )}
      </div>

      {/* Mensajes */}
      {msgOk && <div style={{ marginBottom:12, padding:'10px 16px', background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.3)', borderRadius:8, color:'#10b981', fontSize:13 }}>✓ {msgOk}</div>}
      {msgErr && <div style={{ marginBottom:12, padding:'10px 16px', background:'rgba(244,63,94,0.1)', border:'1px solid rgba(244,63,94,0.3)', borderRadius:8, color:'#f87171', fontSize:13 }}>⚠ {msgErr}</div>}

      <div style={{ display:'flex', gap:20 }}>

        {/* Lista de proveedores */}
        <div style={{ width:260, flexShrink:0 }}>
          <div style={{ color:'#4a6a8a', fontSize:11, fontWeight:600, textTransform:'uppercase',
            letterSpacing:'0.08em', marginBottom:10 }}>
            {proveedores.length} proveedores
          </div>
          {loading ? (
            <div style={{ color:'#4a6a8a', fontSize:13 }}>Cargando...</div>
          ) : (
            proveedores.map(p => {
              const activo = provActivo === p.id
              // Totales rápidos
              const totalComp = compras.filter(c => c.proveedor_id === p.id)
                .reduce((a,c) => a + Number(c.costo||0), 0)
              return (
                <div key={p.id}
                  onClick={() => setProvActivo(activo ? null : p.id)}
                  style={{
                    background: activo ? '#102040' : '#0d1a35',
                    border: `1px solid ${activo ? '#0066ff' : '#1a2f52'}`,
                    borderRadius:10, padding:'14px 16px', marginBottom:8,
                    cursor:'pointer', transition:'all .15s'
                  }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                    <span style={{ color:'#fff', fontWeight:600, fontSize:13 }}>{p.nombre}</span>
                    {puedeEditar && (
                      <button onClick={ev => { ev.stopPropagation(); setEditProv(p); setFormProv({ nombre:p.nombre, contacto:p.contacto||'', telefono:p.telefono||'', email:p.email||'', ciudad:p.ciudad||'', notas:p.notas||'' }); setShowFormProv(true) }}
                        style={{ background:'transparent', border:'none', color:'#4a6a8a', fontSize:12, cursor:'pointer' }}>
                        ✏️
                      </button>
                    )}
                  </div>
                  {p.telefono && <div style={{ color:'#4a6a8a', fontSize:11, marginBottom:2 }}>📞 {p.telefono}</div>}
                  {p.contacto && <div style={{ color:'#4a6a8a', fontSize:11, marginBottom:2 }}>👤 {p.contacto}</div>}
                  {p.ciudad   && <div style={{ color:'#4a6a8a', fontSize:11 }}>📍 {p.ciudad}</div>}
                  <div style={{ marginTop:8, paddingTop:8, borderTop:'1px solid #1a2f52',
                    display:'flex', gap:8, fontSize:11 }}>
                    <span style={{ color:'#8aabcc' }}>
                      {compras.filter(c => c.proveedor_id === p.id && c.estado === 'disponible').length} disp.
                    </span>
                    <span style={{ color:'#4a6a8a' }}>·</span>
                    <span style={{ color:'#f59e0b' }}>
                      {fmt(totalComp)} total
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Detalle proveedor */}
        <div style={{ flex:1 }}>
          {!provActivo ? (
            <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:12,
              padding:40, textAlign:'center', color:'#4a6a8a', fontSize:13 }}>
              Selecciona un proveedor para ver el detalle
            </div>
          ) : (
            <>
              {/* KPIs cuenta */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16 }}>
                <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:10, padding:'14px 18px' }}>
                  <div style={{ color:'#5a7aaa', fontSize:10, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>Total comprado</div>
                  <div style={{ color:'#fff', fontSize:20, fontWeight:600 }}>{fmt(cuenta?.totalComprado)}</div>
                  <div style={{ color:'#4a6a8a', fontSize:11, marginTop:2 }}>{compras.length} equipos</div>
                </div>
                <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:10, padding:'14px 18px' }}>
                  <div style={{ color:'#5a7aaa', fontSize:10, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>Total abonado</div>
                  <div style={{ color:'#10b981', fontSize:20, fontWeight:600 }}>{fmt(cuenta?.totalAbonado)}</div>
                  <div style={{ color:'#4a6a8a', fontSize:11, marginTop:2 }}>{abonos.length} abonos</div>
                </div>
                <div style={{ background: cuenta?.saldo > 0 ? '#1a0a0a' : '#0a1a0a',
                  border: `1px solid ${cuenta?.saldo > 0 ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
                  borderRadius:10, padding:'14px 18px' }}>
                  <div style={{ color:'#5a7aaa', fontSize:10, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>Saldo pendiente</div>
                  <div style={{ color: cuenta?.saldo > 0 ? '#ef4444' : '#10b981', fontSize:20, fontWeight:700 }}>
                    {fmt(cuenta?.saldo)}
                  </div>
                  <div style={{ color:'#4a6a8a', fontSize:11, marginTop:2 }}>
                    {cuenta?.saldo > 0 ? 'Por pagar' : 'Al día ✓'}
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div style={{ display:'flex', gap:4, marginBottom:14 }}>
                {[['resumen','Equipos ingresados'],['vendidos','Lo que vendió'],['abonos','Abonos / Pagos']].map(([k,l]) => (
                  <button key={k} onClick={() => setTab(k)} style={{
                    padding:'7px 14px', borderRadius:7,
                    background: tab === k ? '#1a2f52' : 'transparent',
                    border: tab === k ? '1px solid #2a4f82' : '1px solid #1a2f52',
                    color: tab === k ? '#fff' : '#4a6a8a', fontSize:12, cursor:'pointer'
                  }}>{l}</button>
                ))}
              </div>

              {/* TAB: EQUIPOS INGRESADOS */}
              {tab === 'resumen' && (
                <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:12, overflow:'auto' }}>
                  {compras.length === 0 ? (
                    <div style={{ padding:32, textAlign:'center', color:'#4a6a8a', fontSize:13 }}>
                      Sin equipos ingresados
                    </div>
                  ) : (
                    <table style={{ width:'100%', borderCollapse:'collapse' }}>
                      <thead>
                        <tr>
                          <th style={th}>Producto</th>
                          <th style={th}>IMEI</th>
                          <th style={th}>Color</th>
                          <th style={th}>Costo</th>
                          <th style={th}>Fecha</th>
                          <th style={th}>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {compras.map(c => (
                          <tr key={c.id}>
                            <td style={{ ...td, fontSize:12, color:'#e2e8f0' }}>{c.producto}</td>
                            <td style={{ ...td, fontSize:11, fontFamily:'monospace', color:'#8aabcc' }}>{c.imei || '—'}</td>
                            <td style={{ ...td, fontSize:12 }}>{c.color || '—'}</td>
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
              )}

              {/* TAB: LO QUE VENDIÓ */}
              {tab === 'vendidos' && (
                <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:12, overflow:'auto' }}>
                  {ventas.length === 0 ? (
                    <div style={{ padding:32, textAlign:'center', color:'#4a6a8a', fontSize:13 }}>
                      Sin ventas registradas de equipos de este proveedor
                    </div>
                  ) : (
                    <table style={{ width:'100%', borderCollapse:'collapse' }}>
                      <thead>
                        <tr>
                          <th style={th}>Fecha</th>
                          <th style={th}>Cliente</th>
                          <th style={th}>Producto</th>
                          <th style={th}>IMEI</th>
                          <th style={th}>Valor venta</th>
                          <th style={th}>Asesor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ventas.map(v => (
                          <tr key={v.id}>
                            <td style={{ ...td, fontSize:12, whiteSpace:'nowrap' }}>
                              {new Date(v.fecha_venta+'T12:00').toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'})}
                            </td>
                            <td style={{ ...td, fontWeight:500, color:'#e2e8f0' }}>{v.nombre_cliente}</td>
                            <td style={{ ...td, fontSize:12 }}>{v.producto}</td>
                            <td style={{ ...td, fontSize:11, fontFamily:'monospace', color:'#8aabcc' }}>{v.imei}</td>
                            <td style={{ ...td, fontWeight:600, color:'#10b981', whiteSpace:'nowrap' }}>{fmt(v.valor_venta)}</td>
                            <td style={{ ...td, fontSize:12 }}>{v.asesor_nombre}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* TAB: ABONOS */}
              {tab === 'abonos' && (
                <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:12, overflow:'auto' }}>
                  {abonos.length === 0 ? (
                    <div style={{ padding:32, textAlign:'center', color:'#4a6a8a', fontSize:13 }}>
                      Sin abonos registrados
                    </div>
                  ) : (
                    <table style={{ width:'100%', borderCollapse:'collapse' }}>
                      <thead>
                        <tr>
                          <th style={th}>Fecha</th>
                          <th style={th}>Valor</th>
                          <th style={th}>Medio de pago</th>
                          <th style={th}>Referencia</th>
                          <th style={th}>Notas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {abonos.map(a => (
                          <tr key={a.id}>
                            <td style={{ ...td, fontSize:12, whiteSpace:'nowrap' }}>
                              {new Date(a.fecha+'T12:00').toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'})}
                            </td>
                            <td style={{ ...td, fontWeight:700, color:'#10b981', whiteSpace:'nowrap' }}>{fmt(a.valor)}</td>
                            <td style={{ ...td, fontSize:12, textTransform:'capitalize' }}>{a.medio_pago}</td>
                            <td style={{ ...td, fontSize:12, color:'#8aabcc' }}>{a.referencia || '—'}</td>
                            <td style={{ ...td, fontSize:12 }}>{a.notas || '—'}</td>
                          </tr>
                        ))}
                        <tr>
                          <td colSpan={4} style={{ ...td, fontWeight:600, color:'#fff', textAlign:'right' }}>
                            Total abonado:
                          </td>
                          <td style={{ ...td, fontWeight:700, color:'#10b981', whiteSpace:'nowrap' }}>
                            {fmt(abonos.reduce((a,ab) => a + Number(ab.valor||0), 0))}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* MODAL PROVEEDOR */}
      {showFormProv && (
        <Modal titulo={editProv ? `Editar: ${editProv.nombre}` : 'Nuevo proveedor'} onClose={() => { setShowFormProv(false); setEditProv(null) }}>
          <form onSubmit={guardarProveedor}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px 14px' }}>
              {[['nombre','Nombre *',true,'span 2'],['contacto','Contacto',false,''],
                ['telefono','Teléfono',false,''],['email','Email',false,''],
                ['ciudad','Ciudad',false,''],['notas','Notas',false,'span 2']
              ].map(([k,l,req,span]) => (
                <div key={k} style={{ gridColumn: span || undefined }}>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>{l}</label>
                  {k === 'notas'
                    ? <textarea style={{ ...inp, resize:'vertical', minHeight:60 }} value={formProv[k]} onChange={e => setFormProv(f=>({...f,[k]:e.target.value}))} />
                    : <input required={req} style={inp} value={formProv[k]} onChange={e => setFormProv(f=>({...f,[k]:e.target.value}))} />
                  }
                </div>
              ))}
            </div>
            {msgErr && <ErrBox msg={msgErr} />}
            <BotonesModal onCancel={() => { setShowFormProv(false); setEditProv(null) }} saving={saving} label={editProv ? 'Guardar cambios' : 'Crear proveedor'} />
          </form>
        </Modal>
      )}

      {/* MODAL COMPRA */}
      {showFormCompra && (
        <Modal titulo="Ingresar equipo" onClose={() => setShowFormCompra(false)}>
          <form onSubmit={guardarCompra}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px 14px' }}>
              <div style={{ gridColumn:'span 2' }}>
                <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Proveedor *</label>
                <select required style={sel} value={formCompra.proveedor_id} onChange={e => setFormCompra(f=>({...f, proveedor_id:e.target.value}))}>
                  <option value="">Seleccionar...</option>
                  {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div style={{ gridColumn:'span 2' }}>
                <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Producto *</label>
                <select required style={sel} value={formCompra.producto} onChange={e => setFormCompra(f=>({...f, producto:e.target.value}))}>
                  <option value="">Seleccionar...</option>
                  {PRODUCTOS_LISTA.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              {[['imei','IMEI'],['color','Color'],['capacidad','Capacidad GB'],['costo','Costo $'],['fecha_compra','Fecha compra','date']].map(([k,l,type]) => (
                <div key={k}>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>{l}</label>
                  <input type={type||'text'} style={inp} value={formCompra[k]} onChange={e => setFormCompra(f=>({...f,[k]:e.target.value}))} />
                </div>
              ))}
            </div>
            {msgErr && <ErrBox msg={msgErr} />}
            <BotonesModal onCancel={() => setShowFormCompra(false)} saving={saving} label="Registrar equipo" />
          </form>
        </Modal>
      )}

      {/* MODAL ABONO */}
      {showFormAbono && (
        <Modal titulo="Registrar abono al proveedor" onClose={() => setShowFormAbono(false)}>
          <form onSubmit={guardarAbono}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px 14px' }}>
              <div style={{ gridColumn:'span 2' }}>
                <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Proveedor *</label>
                <select required style={sel} value={formAbono.proveedor_id} onChange={e => setFormAbono(f=>({...f, proveedor_id:e.target.value}))}>
                  <option value="">Seleccionar...</option>
                  {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div>
                <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Valor abono $*</label>
                <input required style={inp} value={formAbono.valor} onChange={e => setFormAbono(f=>({...f, valor:e.target.value}))} placeholder="0" />
              </div>
              <div>
                <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Fecha *</label>
                <input required type="date" style={inp} value={formAbono.fecha} onChange={e => setFormAbono(f=>({...f, fecha:e.target.value}))} />
              </div>
              <div>
                <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Medio de pago</label>
                <select style={sel} value={formAbono.medio_pago} onChange={e => setFormAbono(f=>({...f, medio_pago:e.target.value}))}>
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="cheque">Cheque</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div>
                <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Referencia / comprobante</label>
                <input style={inp} value={formAbono.referencia} onChange={e => setFormAbono(f=>({...f, referencia:e.target.value}))} />
              </div>
              <div style={{ gridColumn:'span 2' }}>
                <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Notas</label>
                <textarea style={{ ...inp, resize:'vertical', minHeight:60 }} value={formAbono.notas} onChange={e => setFormAbono(f=>({...f, notas:e.target.value}))} />
              </div>
            </div>
            {msgErr && <ErrBox msg={msgErr} />}
            <BotonesModal onCancel={() => setShowFormAbono(false)} saving={saving} label="Registrar abono" />
          </form>
        </Modal>
      )}
    </div>
  )
}

function Modal({ titulo, onClose, children }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
      <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:14, padding:28, width:'100%', maxWidth:500, fontFamily:"'DM Sans', system-ui", maxHeight:'90vh', overflow:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <h3 style={{ color:'#fff', margin:0, fontSize:16 }}>{titulo}</h3>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color:'#4a6a8a', fontSize:20, cursor:'pointer' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ErrBox({ msg }) {
  return <div style={{ marginTop:10, padding:'10px 14px', background:'rgba(244,63,94,0.1)', border:'1px solid rgba(244,63,94,0.3)', borderRadius:8, color:'#f87171', fontSize:13 }}>⚠ {msg}</div>
}

function BotonesModal({ onCancel, saving, label }) {
  return (
    <div style={{ display:'flex', gap:10, marginTop:20, justifyContent:'flex-end' }}>
      <button type="button" onClick={onCancel} style={{ padding:'9px 20px', background:'transparent', border:'1px solid #1a2f52', borderRadius:8, color:'#6b8ab0', fontSize:13, cursor:'pointer' }}>Cancelar</button>
      <button type="submit" disabled={saving} style={{ padding:'9px 24px', background: saving ? '#1e3058' : 'linear-gradient(135deg,#0066ff,#0044bb)', border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>{saving ? 'Guardando...' : label}</button>
    </div>
  )
}