import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const TIPOS_VENTA = new Set(['FACTURA', 'FACTURA ELECTRONICA', 'RECIBO CAJA'])
const MESES_N = {1:'Enero',2:'Febrero',3:'Marzo',4:'Abril',5:'Mayo',6:'Junio',7:'Julio',8:'Agosto',9:'Septiembre',10:'Octubre',11:'Noviembre',12:'Diciembre'}

function detectarMesNombre(nombre) {
  const m = {ENERO:1,FEBRERO:2,MARZO:3,ABRIL:4,MAYO:5,JUNIO:6,JULIO:7,AGOSTO:8,SEPTIEMBRE:9,OCTUBRE:10,NOVIEMBRE:11,DICIEMBRE:12}
  const u = nombre.toUpperCase()
  for(const [k,v] of Object.entries(m)) if(u.includes(k)) return v
  return null
}
function detectarAñoNombre(nombre) {
  const m = nombre.match(/20\d{2}/); return m ? parseInt(m[0]) : null
}

function parsearRecaudo(wb, nombreArchivo) {
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json(ws, { header:1, defval:null, cellDates:true })

  // Buscar fila de encabezados
  let hi = 6
  for(let i=0; i<Math.min(15,raw.length); i++) {
    const r = (raw[i]||[]).join('|').toUpperCase()
    if(r.includes('NUMERO') && r.includes('VALOR')) { hi=i; break }
  }
  const headers = raw[hi]
  if(!headers) throw new Error('No se encontraron encabezados')

  const rows = raw.slice(hi+1).map(row => {
    const o={}; headers.forEach((h,i)=>{ if(h) o[String(h).trim()]=row[i] }); return o
  })

  const ventas = rows.filter(r => {
    const num=parseFloat(r['NUMERO']), val=parseFloat(r['VALOR']), tipo=String(r['TIPO']||'').trim()
    return !isNaN(num) && !isNaN(val) && val>0 && TIPOS_VENTA.has(tipo)
  })
  if(ventas.length===0) throw new Error('No se encontraron ventas válidas (FACTURA/RECIBO CAJA)')

  // Agrupar por vendedor
  const pv={}
  for(const v of ventas) {
    const n=String(v['NOMBRE USUARIO']||'').trim()
    if(!n||n==='CONTACT  ICALI'||n==='ADMINISTRADOR  I CALI') continue
    if(!pv[n]) pv[n]={equipos:0,valor:0}
    pv[n].equipos++; pv[n].valor+=Number(v['VALOR'])||0
  }

  // Detectar mes/año: 1) nombre archivo 2) fechas en contenido
  let mes=detectarMesNombre(nombreArchivo), año=detectarAñoNombre(nombreArchivo)

  if(!mes||!año) {
    // Buscar en columna FECHA
    const fcol=Object.keys(ventas[0]||{}).find(k=>k.toUpperCase().includes('FECHA'))
    if(fcol) {
      const fechas=ventas.map(v=>{
        const raw=v[fcol]
        if(raw instanceof Date) return raw
        if(typeof raw==='number') return new Date((raw-25569)*86400*1000)
        return new Date(raw)
      }).filter(d=>d&&!isNaN(d.getTime())&&d.getFullYear()>2020)
      if(fechas.length>0){
        const freq={}
        fechas.forEach(d=>{const k=`${d.getFullYear()}-${d.getMonth()+1}`;freq[k]=(freq[k]||0)+1})
        const [top]=Object.entries(freq).sort((a,b)=>b[1]-a[1])[0]
        const [y,m]=top.split('-').map(Number)
        if(!año) año=y; if(!mes) mes=m
      }
    }
  }

  return { porVendedor:pv, mes, año, totalFilas:ventas.length }
}

async function guardarRecaudo(porVendedor, mes, año, userId) {
  const {data:asesores}=await supabase.from('asesores').select('id,nombre_recaudo')
  let guardados=0,errores=0,sinCruzar=[]

  for(const [nRec,datos] of Object.entries(porVendedor)) {
    const norm=s=>s.replace(/\s+/g,' ').trim().toLowerCase()
    const asesor=asesores?.find(a=>a.nombre_recaudo&&norm(a.nombre_recaudo)===norm(nRec))
    if(!asesor){errores++;sinCruzar.push(nRec);continue}
    const {error}=await supabase.from('ventas_mensuales').upsert({
      asesor_id:asesor.id, año, mes,
      equipos:datos.equipos, valor_total:datos.valor,
      ticket_prom:datos.equipos>0?Math.round(datos.valor/datos.equipos):0,
      uploaded_by:userId
    },{onConflict:'asesor_id,año,mes'})
    if(error){errores++;sinCruzar.push(nRec+' (BD)')}else guardados++
  }
  return {guardados,errores,sinCruzar}
}

function ArchivoCard({a,onRemove}) {
  const estadoColor={ok:'var(--success)',error:'var(--danger)',procesando:'var(--info)',pendiente:'var(--muted)'}
  const estadoIcon={ok:'✓',error:'✗',procesando:'⟳',pendiente:'○'}
  return (
    <div style={{display:'flex',gap:10,padding:'10px 12px',borderRadius:'var(--radius-sm)',marginBottom:6,
      background:'var(--surface)',border:`0.5px solid ${a.estado==='ok'?'#27500A':a.estado==='error'?'#791F1F':'var(--border)'}`}}>
      <div style={{width:24,height:24,borderRadius:'50%',flexShrink:0,display:'flex',alignItems:'center',
        justifyContent:'center',fontSize:12,fontWeight:600,
        background:a.estado==='ok'?'var(--success-bg)':a.estado==='error'?'var(--danger-bg)':'var(--bg)',
        color:estadoColor[a.estado]||'var(--muted)'}}>
        {estadoIcon[a.estado]||'○'}
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:12,fontWeight:500,color:'var(--text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{a.nombre}</div>
        {a.mes&&a.año&&<div style={{fontSize:11,color:'var(--muted)'}}>{MESES_N[a.mes]} {a.año}{a.detalle?` · ${a.detalle.guardados} asesores · ${a.detalle.totalFilas?.toLocaleString('es-CO')} trans.`:''}</div>}
        {a.error&&<div style={{fontSize:11,color:'var(--danger)',marginTop:2}}>{a.error}</div>}
        {a.detalle?.sinCruzar?.length>0&&<div style={{fontSize:10,color:'var(--warn)',marginTop:2}}>Sin cruzar: {a.detalle.sinCruzar.slice(0,3).join(', ')}{a.detalle.sinCruzar.length>3?` +${a.detalle.sinCruzar.length-3} más`:''}</div>}
      </div>
      <button onClick={()=>onRemove(a.nombre)} style={{background:'transparent',border:'none',cursor:'pointer',color:'var(--muted)',fontSize:18,lineHeight:1,padding:'0 2px'}}>×</button>
    </div>
  )
}

function Dropzone({onFiles}) {
  const onDrop=useCallback(f=>{if(f.length>0)onFiles(f)},[onFiles])
  const {getRootProps,getInputProps,isDragActive}=useDropzone({onDrop,multiple:true,
    accept:{'application/vnd.ms-excel':['.xls'],'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':['.xlsx']}})
  return (
    <div {...getRootProps()} style={{border:`2px dashed ${isDragActive?'var(--accent)':'var(--border)'}`,
      borderRadius:'var(--radius)',padding:'2rem',textAlign:'center',cursor:'pointer',
      background:isDragActive?'var(--info-bg)':'var(--bg)',transition:'all .2s'}}>
      <input {...getInputProps()}/>
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{marginBottom:10}}>
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
      </svg>
      <div style={{fontWeight:500,marginBottom:4,fontSize:13}}>{isDragActive?'Suelta los archivos':'Arrastra todos los archivos Excel aquí'}</div>
      <div style={{fontSize:11,color:'var(--muted)'}}>Puedes subir los 15 archivos de una sola vez · .xls .xlsx</div>
    </div>
  )
}

export default function SubirDatos() {
  const {perfil}=useAuth()
  const [archivos,setArchivos]=useState([])
  const [procesando,setProcesando]=useState(false)
  const [tipo,setTipo]=useState('recaudo')

  const remover=nombre=>setArchivos(p=>p.filter(a=>a.nombre!==nombre))

  async function procesar(files) {
    setProcesando(true)
    for(const file of files) {
      if(archivos.find(a=>a.nombre===file.name)) continue
      setArchivos(p=>[...p,{nombre:file.name,estado:'procesando',mes:null,año:null}])
      try {
        const buf=await file.arrayBuffer()
        const wb=XLSX.read(buf,{type:'array',cellDates:true})
        if(tipo==='recaudo') {
          const {porVendedor,mes,año,totalFilas}=parsearRecaudo(wb,file.name)
          if(!mes||!año) {
            setArchivos(p=>p.map(a=>a.nombre===file.name?{...a,estado:'error',
              error:'No se detectó el período. Renombra el archivo con el mes (ej: Enero_2026.xls)'}:a))
            continue
          }
          const {guardados,errores,sinCruzar}=await guardarRecaudo(porVendedor,mes,año,perfil.id)
          await supabase.from('uploads').insert({tipo:'recaudo',nombre_archivo:file.name,año,mes,filas_procesadas:totalFilas,errores,subido_por:perfil.id})
          setArchivos(p=>p.map(a=>a.nombre===file.name?{...a,estado:'ok',mes,año,detalle:{guardados,totalFilas,sinCruzar}}:a))
        } else {
          setArchivos(p=>p.map(a=>a.nombre===file.name?{...a,estado:'error',error:'Módulo de comisiones en desarrollo'}:a))
        }
      } catch(err) {
        setArchivos(p=>p.map(a=>a.nombre===file.name?{...a,estado:'error',error:err.message}:a))
      }
    }
    setProcesando(false)
  }

  const ok=archivos.filter(a=>a.estado==='ok')
  const errores=archivos.filter(a=>a.estado==='error')
  const totalTrans=ok.reduce((s,a)=>s+(a.detalle?.totalFilas||0),0)

  return (
    <div>
      <div className="topbar">
        <div>
          <div style={{fontWeight:600,fontSize:15}}>Subir datos Excel</div>
          <div style={{fontSize:12,color:'var(--muted)'}}>Sube todos los archivos de una vez — el portal detecta el mes automáticamente</div>
        </div>
        {ok.length>0&&(
          <div style={{display:'flex',gap:8}}>
            <span className="badge badge-success">✓ {ok.length} archivo{ok.length>1?'s':''}</span>
            <span className="badge badge-gray">{totalTrans.toLocaleString('es-CO')} transacciones</span>
          </div>
        )}
      </div>
      <div className="page-body">

        <div className="card" style={{marginBottom:'1.25rem'}}>
          <div className="section-title">Tipo de archivo</div>
          <div style={{display:'flex',gap:10}}>
            {[{k:'recaudo',l:'RptRecaudoDiario',d:'Ventas mensuales · todos los meses a la vez'},{k:'comisiones',l:'COMISIONES_icali',d:'Planillas de comisiones'}].map(t=>(
              <button key={t.k} onClick={()=>setTipo(t.k)} className="btn"
                style={{background:tipo===t.k?'var(--dk)':'var(--bg)',color:tipo===t.k?'white':'var(--muted)',
                  border:`0.5px solid ${tipo===t.k?'var(--dk)':'var(--border)'}`,
                  flexDirection:'column',alignItems:'flex-start',padding:'10px 16px',gap:2}}>
                <span style={{fontWeight:600,fontSize:13}}>{t.l}</span>
                <span style={{fontSize:11,opacity:.7}}>{t.d}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="card" style={{marginBottom:'1.25rem'}}>
          <Dropzone onFiles={procesar}/>
          <div style={{marginTop:8,fontSize:11,color:'var(--muted)',textAlign:'center'}}>
            💡 Selecciona los 15 archivos (2025 completo + 2026 Q1) de una sola vez
          </div>
        </div>

        {procesando&&(
          <div className="alert alert-warn" style={{display:'flex',gap:10,alignItems:'center',marginBottom:'1rem'}}>
            <div className="spinner"/>Procesando archivos...
          </div>
        )}

        {archivos.length>0&&(
          <div className="card" style={{marginBottom:'1.25rem'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <div className="section-title" style={{margin:0}}>
                {archivos.length} archivo{archivos.length>1?'s':''} · {ok.length} OK{errores.length>0?` · ${errores.length} con error`:''}
              </div>
              <button className="btn btn-outline" style={{fontSize:11}} onClick={()=>setArchivos([])}>Limpiar</button>
            </div>
            {archivos.sort((a,b)=>{
              const ord={ok:0,error:1,procesando:2,pendiente:3}
              return (ord[a.estado]||3)-(ord[b.estado]||3)||(a.año!==b.año?a.año-b.año:a.mes-b.mes)
            }).map(a=><ArchivoCard key={a.nombre} a={a} onRemove={remover}/>)}
          </div>
        )}

        {ok.length>0&&(
          <div className="card">
            <div className="section-title">Períodos cargados exitosamente</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {ok.sort((a,b)=>a.año!==b.año?a.año-b.año:a.mes-b.mes).map(a=>(
                <span key={a.nombre} className="badge badge-success" style={{fontSize:12}}>
                  {MESES_N[a.mes]} {a.año} · {a.detalle?.totalFilas?.toLocaleString('es-CO')} trans.
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}