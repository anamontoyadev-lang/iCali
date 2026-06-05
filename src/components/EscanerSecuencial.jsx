import { useEffect, useRef, useState } from 'react'

function loadQuagga() {
  return new Promise((resolve, reject) => {
    if (window.Quagga) { resolve(); return }
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/quagga/0.12.1/quagga.min.js'
    s.onload = resolve; s.onerror = reject
    document.head.appendChild(s)
  })
}

const PASOS = [
  { key: 'imei',        label: 'IMEI 1',        isIMEI: true  },
  { key: 'imei2',       label: 'IMEI 2',         isIMEI: true  },
  { key: 'serial_caja', label: 'Serial de caja', isIMEI: false },
]

function luhnCheck(num) {
  let s = 0, alt = false
  for (let i = num.length - 1; i >= 0; i--) {
    let n = parseInt(num[i], 10)
    if (alt) { n *= 2; if (n > 9) n -= 9 }
    s += n; alt = !alt
  }
  return s % 10 === 0
}

export default function EscanerSecuencial({ onComplete, onClose }) {
  const containerRef = useRef(null)
  const started      = useRef(false)

  // Todo el estado crítico en refs para evitar closures viejos en Quagga
  const pasoActual   = useRef(0)
  const valoresAcum  = useRef({ imei: '', imei2: '', serial_caja: '' })
  const detBuf       = useRef([])
  const locked       = useRef(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  // Solo para UI
  const [pasoUI,   setPasoUI]   = useState(0)
  const [valUI,    setValUI]    = useState({ imei: '', imei2: '', serial_caja: '' })
  const [conf,     setConf]     = useState(0)
  const [reading,  setReading]  = useState('—')
  const [flash,    setFlash]    = useState(false)
  const [manual,   setManual]   = useState('')

  useEffect(() => {
    const t = setTimeout(() => {
      loadQuagga().then(iniciar).catch(() => {})
    }, 400)
    return () => { clearTimeout(t); detener() }
  }, [])

  function iniciar() {
    if (!containerRef.current) return
    window.Quagga.init({
      inputStream: {
        name: 'Live', type: 'LiveStream',
        target: containerRef.current,
        constraints: {
          facingMode: 'environment',
          width: { ideal: 1280 }, height: { ideal: 720 },
          focusMode: 'continuous'
        },
        area: { top: '32%', right: '4%', bottom: '32%', left: '4%' }
      },
      locator: { patchSize: 'large', halfSample: true },
      numOfWorkers: 2,
      frequency: 20,
      decoder: { readers: [{ format: 'code_128_reader', config: {} }], multiple: false },
      locate: true
    }, err => {
      if (err) return
      window.Quagga.start()
      started.current = true
    })

    window.Quagga.onProcessed(r => {
      if (!r?.codeResult?.code) return
      const codes = r.codeResult.decodedCodes.filter(x => x.error !== undefined)
      if (!codes.length) return
      const c = 1 - codes.reduce((a, x) => a + x.error, 0) / codes.length
      setConf(Math.round(c * 100))
      const code = r.codeResult.code
      setReading(code.length > 20 ? code.slice(0, 20) + '…' : code)
    })

    window.Quagga.onDetected(r => {
      if (locked.current) return
      const code  = r.codeResult.code.trim()
      const codes = r.codeResult.decodedCodes.filter(x => x.error !== undefined)
      if (!codes.length) return
      const c = 1 - codes.reduce((a, x) => a + x.error, 0) / codes.length
      if (c < 0.78) return

      const p = PASOS[pasoActual.current]
      if (!p) return

      // Validar formato
      if (p.isIMEI) {
        if (!/^\d{14,15}$/.test(code)) return
        if (code.length === 15 && !luhnCheck(code)) return
      } else {
        if (code.length < 6) return
      }

      // Acumular lecturas consistentes
      detBuf.current.push(code)
      if (detBuf.current.length > 12) detBuf.current.shift()
      const counts = {}
      detBuf.current.forEach(x => counts[x] = (counts[x] || 0) + 1)
      const [best, cnt] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]

      if (cnt >= 4) {
        locked.current = true
        confirmarCodigo(best)
      }
    })
  }

  function detener() {
    if (started.current) {
      try { window.Quagga.stop() } catch {}
      started.current = false
    }
  }

  function confirmarCodigo(code) {
    // Flash visual
    setFlash(true)
    setTimeout(() => setFlash(false), 500)

    // Guardar en ref (fuente de verdad)
    const p = PASOS[pasoActual.current]
    valoresAcum.current = { ...valoresAcum.current, [p.key]: code }

    // Actualizar UI
    setValUI({ ...valoresAcum.current })

    const siguiente = pasoActual.current + 1

    if (siguiente < PASOS.length) {
      // Avanzar al siguiente paso
      pasoActual.current = siguiente
      setPasoUI(siguiente)
      setManual('')
      setConf(0)
      setReading('—')
      // Resetear buffer DESPUÉS de actualizar paso
      setTimeout(() => {
        detBuf.current = []
        locked.current = false
      }, 800) // pausa para que el usuario vea el flash antes de seguir leyendo
    } else {
      // Completado
      detener()
      onCompleteRef.current({ ...valoresAcum.current })
    }
  }

  function saltar() {
    const siguiente = pasoActual.current + 1
    if (siguiente < PASOS.length) {
      pasoActual.current = siguiente
      setPasoUI(siguiente)
      setManual('')
      setConf(0)
      setReading('—')
      detBuf.current = []
      locked.current = false
    } else {
      detener()
      onCompleteRef.current({ ...valoresAcum.current })
    }
  }

  function usarManual() {
    const clean = manual.trim()
    if (clean.length >= 6) confirmarCodigo(clean)
  }

  function cerrar() {
    detener()
    onClose()
  }

  const p = PASOS[pasoUI]
  const confColor = conf > 85 ? '#10b981' : conf > 60 ? '#f59e0b' : '#ef4444'

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:2000,
      background:'#000', display:'flex', flexDirection:'column',
      fontFamily:"'DM Sans', system-ui"
    }}>
      <style>{`
        #esc-v3 video { width:100%!important; height:100%!important; object-fit:cover!important; }
        #esc-v3 canvas.drawingBuffer { display:none!important; }
        @keyframes escLine { 0%,100%{top:33%} 50%{top:65%} }
        @keyframes escFlash { 0%{opacity:0} 30%{opacity:0.6} 100%{opacity:0} }
      `}</style>

      {/* Header */}
      <div style={{ background:'#0a1628', borderBottom:'1px solid #1a2f52', padding:'10px 16px', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
          <span style={{ color:'#fff', fontSize:14, fontWeight:600 }}>📷 Escanear equipos</span>
          <button onClick={cerrar} style={{ background:'transparent', border:'1px solid #1a2f52', borderRadius:7, color:'#8aabcc', fontSize:12, padding:'5px 12px', cursor:'pointer' }}>✕ Cancelar</button>
        </div>

        {/* Pasos */}
        <div style={{ display:'flex', alignItems:'center' }}>
          {PASOS.map((p2, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', flex:1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, flex:1 }}>
                <div style={{
                  width:26, height:26, borderRadius:'50%',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:11, fontWeight:700, flexShrink:0,
                  background: i < pasoUI ? '#10b981' : i === pasoUI ? '#0066ff' : '#1a2f52',
                  color:'#fff',
                  boxShadow: i === pasoUI ? '0 0 8px rgba(0,102,255,0.5)' : 'none'
                }}>
                  {i < pasoUI ? '✓' : i + 1}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{
                    fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em',
                    color: i < pasoUI ? '#10b981' : i === pasoUI ? '#fff' : '#4a6a8a'
                  }}>{p2.label}</div>
                  {i < pasoUI && valUI[p2.key] && (
                    <div style={{ fontSize:10, color:'#10b981', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {valUI[p2.key].slice(0, 14)}{valUI[p2.key].length > 14 ? '…' : ''}
                    </div>
                  )}
                </div>
              </div>
              {i < PASOS.length - 1 && (
                <div style={{ width:10, height:2, background: i < pasoUI ? '#10b981' : '#1a2f52', flexShrink:0, margin:'0 4px' }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Video */}
      <div id="esc-v3" ref={containerRef} style={{ flex:1, position:'relative', overflow:'hidden' }}>
        {flash && (
          <div style={{ position:'absolute', inset:0, background:'rgba(16,185,129,0.4)', zIndex:20, pointerEvents:'none', animation:'escFlash 0.5s ease-out' }} />
        )}
        <div style={{ position:'absolute', top:0, left:0, right:0, height:'32%', background:'rgba(0,0,0,0.6)', zIndex:5, pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:0, left:0, right:0, height:'32%', background:'rgba(0,0,0,0.6)', zIndex:5, pointerEvents:'none' }} />
        <div style={{ position:'absolute', top:'32%', left:'4%', right:'4%', bottom:'32%', zIndex:6, pointerEvents:'none' }}>
          {[
            { top:0,left:0, borderTop:'3px solid #0066ff', borderLeft:'3px solid #0066ff', borderRadius:'3px 0 0 0' },
            { top:0,right:0, borderTop:'3px solid #0066ff', borderRight:'3px solid #0066ff', borderRadius:'0 3px 0 0' },
            { bottom:0,left:0, borderBottom:'3px solid #0066ff', borderLeft:'3px solid #0066ff', borderRadius:'0 0 0 3px' },
            { bottom:0,right:0, borderBottom:'3px solid #0066ff', borderRight:'3px solid #0066ff', borderRadius:'0 0 3px 0' },
          ].map((s, i) => <div key={i} style={{ position:'absolute', width:20, height:20, ...s }} />)}
        </div>
        <div style={{
          position:'absolute', left:'5%', right:'5%', height:2,
          background:'linear-gradient(90deg,transparent,#0066ff,transparent)',
          zIndex:7, pointerEvents:'none',
          animation:'escLine 1.8s ease-in-out infinite'
        }} />
        <div style={{
          position:'absolute', bottom:'31%', left:0, right:0, textAlign:'center',
          zIndex:7, pointerEvents:'none', color:'rgba(255,255,255,0.6)', fontSize:12, padding:'6px 0'
        }}>
          Paso {pasoUI + 1} de {PASOS.length} — {p?.label}
        </div>
      </div>

      {/* Confianza */}
      <div style={{ background:'#0a1628', padding:'8px 16px', flexShrink:0, borderTop:'1px solid #1a2f52' }}>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:3 }}>
          <span style={{ color:'#4a6a8a' }}>Leyendo: <span style={{ color:'#8aabcc', fontFamily:'monospace' }}>{reading}</span></span>
          <span style={{ color: confColor, fontWeight:600 }}>{conf}%</span>
        </div>
        <div style={{ height:3, background:'#1a2f52', borderRadius:2, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${conf}%`, background: confColor, borderRadius:2, transition:'all .15s' }} />
        </div>
      </div>

      {/* Manual + saltar */}
      <div style={{ background:'#060d1f', borderTop:'1px solid #1a2f52', padding:'12px 16px', flexShrink:0 }}>
        <div style={{ display:'flex', gap:8, marginBottom:8 }}>
          <input
            style={{
              flex:1, background:'#0a1628', border:'1px solid #1a2f52',
              borderRadius:8, padding:'10px 12px', color:'#fff',
              fontSize:16, outline:'none', letterSpacing:1
            }}
            placeholder={`${p?.label} manual...`}
            value={manual}
            onChange={e => setManual(e.target.value)}
            inputMode="numeric"
            type="text"
            key={`manual-${pasoUI}`}
          />
          <button onClick={usarManual}
            disabled={manual.trim().length < 6}
            style={{
              padding:'10px 16px',
              background: manual.trim().length >= 6 ? 'linear-gradient(135deg,#0066ff,#0044bb)' : '#1e3058',
              border:'none', borderRadius:8, color:'#fff',
              fontSize:13, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap'
            }}>Usar →</button>
        </div>
        <button onClick={saltar} style={{
          width:'100%', padding:'9px',
          background:'transparent', border:'1px solid #1a2f52',
          borderRadius:8, color:'#6b8ab0', fontSize:13, cursor:'pointer'
        }}>
          ↷ Saltar {p?.label} {pasoUI < PASOS.length - 1 ? '→ siguiente' : '→ abrir formulario'}
        </button>
      </div>
    </div>
  )
}
