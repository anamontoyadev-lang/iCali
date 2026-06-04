import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const PRODUCTOS_LISTA = [
  'iPhone 11 64GB','iPhone 11 128GB',
  'iPhone 12 64GB','iPhone 12 128GB','iPhone 12 256GB',
  'iPhone 13 128GB','iPhone 13 256GB','iPhone 13 512GB',
  'iPhone 13 Pro 128GB','iPhone 13 Pro 256GB',
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

const fmt = n => new Intl.NumberFormat('es-CO', {
  style:'currency', currency:'COP', maximumFractionDigits:0
}).format(n || 0)

const inp = {
  background:'#0a1628', border:'1px solid #1a2f52', borderRadius:8,
  padding:'8px 12px', color:'#fff', fontSize:13, width:'100%', boxSizing:'border-box', outline:'none'
}
const sel = { ...inp, cursor:'pointer' }

export default function Proveedores() {
  const { esAdmin, esLiderAdmin } = useAuth()
  const [proveedores, setProveedores] = useState([])
  const [compras, setCompras]         = useState([])
  const [stock, setStock]             = useState([])
  const [tab, setTab]                 = useState('stock')
  const [provActivo, setProvActivo]   = useState(null)
  const [loading, setLoading]         = useState(true)

  const [showFormProv, setShowFormProv] = useState(false)
  const [showFormCompra, setShowFormCompra] = useState(false)
  const [formProv, setFormProv] = useState({ nombre:'', contacto:'', telefono:'', email:'', ciudad:'', notas:'' })
  const [formCompra, setFormCompra] = useState({
    proveedor_id:'', producto:'', imei:'', color:'', capacidad:'', costo:'',
    fecha_compra: new Date().toISOString().split('T')[0], observaciones:''
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [{ data: provs }, { data: comprasData }, { data: stockData }] = await Promise.all([
      supabase.from('proveedores').select('*').order('nombre'),
      supabase.from('compras_proveedor')
        .select('*, proveedores(nombre)').order('created_at', { ascending: false }).limit(200),
      supabase.from('v_stock_proveedores').select('*')
    ])
    setProveedores(provs || [])
    setCompras(comprasData || [])
    setStock(stockData || [])
    setLoading(false)
  }

  async function guardarProveedor(e) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('proveedores').insert(formProv)
    setSaving(false)
    setShowFormProv(false)
    setFormProv({ nombre:'', contacto:'', telefono:'', email:'', ciudad:'', notas:'' })
    loadAll()
  }

  async function guardarCompra(e) {
    e.preventDefault()
    setSaving(true)
    const user = (await supabase.auth.getUser()).data.user
    await supabase.from('compras_proveedor').insert({
      ...formCompra,
      registrado_por: user.id,
      costo: Number(formCompra.costo.replace(/\./g,'').replace(/,/g,'.')) || 0
    })
    setSaving(false)
    setShowFormCompra(false)
    setFormCompra({
      proveedor_id:'', producto:'', imei:'', color:'', capacidad:'', costo:'',
      fecha_compra: new Date().toISOString().split('T')[0], observaciones:''
    })
    loadAll()
  }

  async function cambiarEstadoCompra(id, estado) {
    await supabase.from('compras_proveedor').update({ estado }).eq('id', id)
    loadAll()
  }

  const th = {
    color:'#4a6a8a', fontSize:11, fontWeight:600, textTransform:'uppercase',
    letterSpacing:'0.06em', padding:'10px 14px', textAlign:'left',
    borderBottom:'1px solid #1a2f52', whiteSpace:'nowrap'
  }
  const td = { padding:'10px 14px', color:'#cbd5e1', fontSize:13, borderBottom:'1px solid #0f1e36' }

  const comprasFiltradas = provActivo
    ? compras.filter(c => c.proveedor_id === provActivo)
    : compras

  const totalStock = stock.reduce((a, s) => a + Number(s.valor_stock || 0), 0)
  const totalDisponibles = stock.reduce((a, s) => a + Number(s.disponibles || 0), 0)

  return (
    <div style={{ padding:'32px 36px', fontFamily:"'DM Sans', system-ui" }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ color:'#fff', fontSize:20, fontWeight:600, margin:'0 0 4px' }}>Proveedores</h1>
          <p style={{ color:'#4a6a8a', fontSize:13, margin:0 }}>
            {proveedores.length} proveedores · {totalDisponibles} equipos en stock
          </p>
        </div>
        {(esAdmin || esLiderAdmin) && (
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={() => setShowFormCompra(true)} style={{
              padding:'9px 18px', background:'#0d1a35',
              border:'1px solid #1a2f52', borderRadius:8,
              color:'#8aabcc', fontSize:13, cursor:'pointer'
            }}>+ Registrar compra</button>
            <button onClick={() => setShowFormProv(true)} style={{
              padding:'9px 18px',
              background:'linear-gradient(135deg,#0066ff,#0044bb)',
              border:'none', borderRadius:8,
              color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer'
            }}>+ Nuevo proveedor</button>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12, marginBottom:24 }}>
        <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:10, padding:'14px 18px' }}>
          <div style={{ color:'#5a7aaa', fontSize:11, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>Equipos disponibles</div>
          <div style={{ color:'#fff', fontSize:26, fontWeight:600 }}>{totalDisponibles}</div>
        </div>
        <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:10, padding:'14px 18px' }}>
          <div style={{ color:'#5a7aaa', fontSize:11, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>Valor en stock</div>
          <div style={{ color:'#10b981', fontSize:22, fontWeight:600 }}>{fmt(totalStock)}</div>
        </div>
        <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:10, padding:'14px 18px' }}>
          <div style={{ color:'#5a7aaa', fontSize:11, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>Total compras</div>
          <div style={{ color:'#fff', fontSize:26, fontWeight:600 }}>{compras.length}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:16 }}>
        {[['stock','Stock por producto'],['compras','Historial compras'],['proveedores','Proveedores']].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding:'7px 16px', borderRadius:7,
            background: tab === k ? '#1a2f52' : 'transparent',
            border: tab === k ? '1px solid #2a4f82' : '1px solid #1a2f52',
            color: tab === k ? '#fff' : '#4a6a8a',
            fontSize:12, cursor:'pointer'
          }}>{l}</button>
        ))}
      </div>

      {/* Filtro por proveedor */}
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
        <button onClick={() => setProvActivo(null)} style={{
          padding:'5px 12px', borderRadius:6, fontSize:11,
          background: !provActivo ? '#1a2f52' : 'transparent',
          border:'1px solid #1a2f52', color: !provActivo ? '#fff' : '#4a6a8a', cursor:'pointer'
        }}>Todos</button>
        {proveedores.map(p => (
          <button key={p.id} onClick={() => setProvActivo(p.id)} style={{
            padding:'5px 12px', borderRadius:6, fontSize:11,
            background: provActivo === p.id ? '#1a2f52' : 'transparent',
            border:'1px solid #1a2f52',
            color: provActivo === p.id ? '#fff' : '#4a6a8a', cursor:'pointer'
          }}>{p.nombre}</button>
        ))}
      </div>

      {/* CONTENIDO TABS */}
      <div style={{ background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:12, overflow:'auto' }}>
        {loading ? (
          <div style={{ padding:40, color:'#4a6a8a', textAlign:'center', fontSize:13 }}>Cargando...</div>
        ) : tab === 'stock' ? (
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:600 }}>
            <thead>
              <tr>
                <th style={th}>Proveedor</th>
                <th style={th}>Producto</th>
                <th style={th}>Color</th>
                <th style={th}>Disponibles</th>
                <th style={th}>Vendidos</th>
                <th style={th}>Valor stock</th>
              </tr>
            </thead>
            <tbody>
              {stock.filter(s => !provActivo || s.proveedor === proveedores.find(p=>p.id===provActivo)?.nombre).map((s,i) => (
                <tr key={i}>
                  <td style={{ ...td, fontWeight:500, color:'#e2e8f0' }}>{s.proveedor}</td>
                  <td style={{ ...td, fontSize:12 }}>{s.producto}</td>
                  <td style={{ ...td, color:'#8aabcc', fontSize:12 }}>{s.color || '—'}</td>
                  <td style={td}>
                    <span style={{
                      background: Number(s.disponibles) > 0 ? '#0f3d2a' : '#1a1a2e',
                      color: Number(s.disponibles) > 0 ? '#10b981' : '#4a6a8a',
                      padding:'2px 10px', borderRadius:5, fontSize:12, fontWeight:600
                    }}>{s.disponibles}</span>
                  </td>
                  <td style={{ ...td, color:'#4a6a8a' }}>{s.vendidos}</td>
                  <td style={{ ...td, color:'#10b981', fontWeight:600, whiteSpace:'nowrap' }}>
                    {fmt(s.valor_stock)}
                  </td>
                </tr>
              ))}
              {stock.length === 0 && (
                <tr><td colSpan={6} style={{ padding:32, textAlign:'center', color:'#4a6a8a', fontSize:13 }}>
                  Sin equipos registrados todavía
                </td></tr>
              )}
            </tbody>
          </table>

        ) : tab === 'compras' ? (
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:700 }}>
            <thead>
              <tr>
                <th style={th}>Fecha</th>
                <th style={th}>Proveedor</th>
                <th style={th}>Producto</th>
                <th style={th}>IMEI</th>
                <th style={th}>Costo</th>
                <th style={th}>Estado</th>
                {(esAdmin || esLiderAdmin) && <th style={th}>Acción</th>}
              </tr>
            </thead>
            <tbody>
              {comprasFiltradas.map(c => (
                <tr key={c.id}>
                  <td style={{ ...td, fontSize:12, whiteSpace:'nowrap' }}>
                    {new Date(c.fecha_compra+'T12:00').toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'})}
                  </td>
                  <td style={{ ...td, fontWeight:500, color:'#e2e8f0' }}>{c.proveedores?.nombre}</td>
                  <td style={{ ...td, fontSize:12 }}>{c.producto}</td>
                  <td style={{ ...td, fontSize:11, color:'#8aabcc', fontFamily:'monospace' }}>{c.imei || '—'}</td>
                  <td style={{ ...td, fontWeight:600, color:'#fff', whiteSpace:'nowrap' }}>{fmt(c.costo)}</td>
                  <td style={td}>
                    <span style={{
                      background: c.estado==='disponible' ? '#0f3d2a' : c.estado==='vendido' ? '#1a1a2e' : '#2a1a0a',
                      color: c.estado==='disponible' ? '#10b981' : c.estado==='vendido' ? '#4a6a8a' : '#f59e0b',
                      fontSize:11, padding:'2px 8px', borderRadius:4, fontWeight:500
                    }}>
                      {c.estado === 'disponible' ? 'Disponible' : c.estado === 'vendido' ? 'Vendido' : c.estado}
                    </span>
                  </td>
                  {(esAdmin || esLiderAdmin) && (
                    <td style={td}>
                      <select value={c.estado}
                        onChange={e => cambiarEstadoCompra(c.id, e.target.value)}
                        style={{
                          background:'#0a1628', border:'1px solid #1a2f52', borderRadius:6,
                          color:'#fff', fontSize:11, padding:'3px 8px', cursor:'pointer'
                        }}>
                        <option value="disponible">Disponible</option>
                        <option value="vendido">Vendido</option>
                        <option value="devuelto">Devuelto</option>
                        <option value="en_revision">En revisión</option>
                      </select>
                    </td>
                  )}
                </tr>
              ))}
              {comprasFiltradas.length === 0 && (
                <tr><td colSpan={7} style={{ padding:32, textAlign:'center', color:'#4a6a8a', fontSize:13 }}>
                  Sin compras registradas
                </td></tr>
              )}
            </tbody>
          </table>

        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Nombre</th>
                <th style={th}>Contacto</th>
                <th style={th}>Teléfono</th>
                <th style={th}>Ciudad</th>
                <th style={th}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {proveedores.map(p => (
                <tr key={p.id}>
                  <td style={{ ...td, fontWeight:500, color:'#e2e8f0' }}>{p.nombre}</td>
                  <td style={{ ...td, fontSize:12 }}>{p.contacto || '—'}</td>
                  <td style={{ ...td, fontSize:12 }}>{p.telefono || '—'}</td>
                  <td style={{ ...td, fontSize:12 }}>{p.ciudad || '—'}</td>
                  <td style={td}>
                    <span style={{
                      background: p.activo ? '#0f3d2a' : '#2a1a1a',
                      color: p.activo ? '#10b981' : '#ef4444',
                      fontSize:11, padding:'2px 8px', borderRadius:4
                    }}>{p.activo ? 'Activo' : 'Inactivo'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL NUEVO PROVEEDOR */}
      {showFormProv && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.75)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000
        }}>
          <div style={{
            background:'#0d1a35', border:'1px solid #1a2f52',
            borderRadius:14, padding:28, width:'100%', maxWidth:480,
            fontFamily:"'DM Sans', system-ui"
          }}>
            <h3 style={{ color:'#fff', margin:'0 0 20px', fontSize:16 }}>Nuevo proveedor</h3>
            <form onSubmit={guardarProveedor}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px 14px' }}>
                {[['nombre','Nombre *',true,'span 2'],['contacto','Persona de contacto',false,''],
                  ['telefono','Teléfono',false,''],['email','Email',false,''],
                  ['ciudad','Ciudad',false,''],['notas','Notas',false,'span 2']].map(([k,l,req,span]) => (
                  <div key={k} style={{ gridColumn: span || undefined }}>
                    <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500,
                      textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>{l}</label>
                    {k === 'notas'
                      ? <textarea style={{ ...inp, resize:'vertical', minHeight:60 }}
                          value={formProv[k]} onChange={e => setFormProv(f=>({...f,[k]:e.target.value}))} />
                      : <input required={req} style={inp}
                          value={formProv[k]} onChange={e => setFormProv(f=>({...f,[k]:e.target.value}))} />
                    }
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', gap:10, marginTop:20, justifyContent:'flex-end' }}>
                <button type="button" onClick={() => setShowFormProv(false)} style={{
                  padding:'9px 20px', background:'transparent', border:'1px solid #1a2f52',
                  borderRadius:8, color:'#6b8ab0', fontSize:13, cursor:'pointer'
                }}>Cancelar</button>
                <button type="submit" disabled={saving} style={{
                  padding:'9px 24px', background:'linear-gradient(135deg,#0066ff,#0044bb)',
                  border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer'
                }}>{saving ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR COMPRA */}
      {showFormCompra && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.75)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000
        }}>
          <div style={{
            background:'#0d1a35', border:'1px solid #1a2f52',
            borderRadius:14, padding:28, width:'100%', maxWidth:520,
            fontFamily:"'DM Sans', system-ui", maxHeight:'90vh', overflow:'auto'
          }}>
            <h3 style={{ color:'#fff', margin:'0 0 20px', fontSize:16 }}>Registrar compra</h3>
            <form onSubmit={guardarCompra}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px 14px' }}>
                <div style={{ gridColumn:'span 2' }}>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500,
                    textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>
                    Proveedor *
                  </label>
                  <select required style={{ ...sel }} value={formCompra.proveedor_id}
                    onChange={e => setFormCompra(f=>({...f, proveedor_id:e.target.value}))}>
                    <option value="">Seleccionar...</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn:'span 2' }}>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500,
                    textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>
                    Producto *
                  </label>
                  <select required style={sel} value={formCompra.producto}
                    onChange={e => setFormCompra(f=>({...f, producto:e.target.value}))}>
                    <option value="">Seleccionar producto...</option>
                    {PRODUCTOS_LISTA.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                {[['imei','IMEI',''],['color','Color',''],['capacidad','Capacidad',''],
                  ['costo','Costo $',''],['fecha_compra','Fecha compra','date']].map(([k,l,type]) => (
                  <div key={k}>
                    <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500,
                      textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>{l}</label>
                    <input type={type||'text'} style={inp} value={formCompra[k]}
                      onChange={e => setFormCompra(f=>({...f,[k]:e.target.value}))} />
                  </div>
                ))}
                <div style={{ gridColumn:'span 2' }}>
                  <label style={{ color:'#8aabcc', fontSize:11, fontWeight:500,
                    textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>
                    Observaciones
                  </label>
                  <textarea style={{ ...inp, resize:'vertical', minHeight:60 }}
                    value={formCompra.observaciones}
                    onChange={e => setFormCompra(f=>({...f, observaciones:e.target.value}))} />
                </div>
              </div>
              <div style={{ display:'flex', gap:10, marginTop:20, justifyContent:'flex-end' }}>
                <button type="button" onClick={() => setShowFormCompra(false)} style={{
                  padding:'9px 20px', background:'transparent', border:'1px solid #1a2f52',
                  borderRadius:8, color:'#6b8ab0', fontSize:13, cursor:'pointer'
                }}>Cancelar</button>
                <button type="submit" disabled={saving} style={{
                  padding:'9px 24px', background:'linear-gradient(135deg,#0066ff,#0044bb)',
                  border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer'
                }}>{saving ? 'Guardando...' : 'Registrar compra'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}