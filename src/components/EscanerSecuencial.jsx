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

const REQ = 4
const MIN_C = 0.78

function luhnCheck(num) {
  let s = 0, alt = false
  for (let i = num.length - 1; i >= 0; i--) {
    let n = parseInt(num[i], 10)
    if (alt) { n *= 2; if (n > 9) n -= 9 }
    s += n; alt = !alt
  }
  return s % 10 === 0
}

const PASOS = [
  { key: 'imei',       label: 'IMEI 1',       hint: 'Escanea el IMEI 1 del equipo',       isIMEI: true  },
  { key: 'imei2',      label: 'IMEI 2',        hint: 'Escanea el IMEI 2 (dual SIM)',       isIMEI: true  },
  { key: 'serial_caja',label: 'Serial de caja',hint: 'Escanea el código de barras de la caja', isIMEI: false },
]

export default function EscanerSecuencial({ onComplete, onClose }) {
  const containerRef = useRef(null)
  const detBuf       = useRef([])
  const locked       = useRef(false)
  const started      = useRef(false)
  const pasoRef      = useRef(0)

  const [paso,    setPaso]    = useState(0)
  const [valores, setValores] = useState({ imei: '', imei2: '', serial_caja: '' })
  const [conf,    setConf]    = useState(0)
  const [reading, setReading] = useState('—')
  const [manual,  setManual]  = useState('')
  const [flash,   setFlash]   = useState(false)

  useEffect(() => {
    loadQuagga().then(initQuagga).catch(() => {})
    return () => stopQuagga()
  }, [])

  // Reiniciar buffer cuando cambia el paso
  useEffect(() => {
    pasoRef.current = paso
    detBuf.current  = []
    locked.current  = false
    setConf(0)
    setReading('—')
    setManual('')
  }, [paso])

  function initQuagga() {
    if (!containerRef.current) return
    window.Quagga.init({
      inputStream: {
        name: 'Live', type: 'LiveStream',
        target: containerRef.current,
        constraints: {
          facingMode: 'environment',
          width: { ideal: 1280 }, height: { ideal: 720 },
          focusMode: 'continuous',
          advanced: [{ focusMode: 'continuous' }]
        },
        area: { top: '32%', right: '4%', bottom: '32%', left: '4%' }
      },
      locator:  { patchSize: 'large', halfSample: true },
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
      if (c < MIN_C) return

      const p = PASOS[pasoRef.current]
      if (p.isIMEI) {
        if (!/^\d{14,15}$/.test(code)) return
        if (code.length === 15 && !luhnCheck(code)) return
      } else {
        if (code.length < 6) return
      }

      detBuf.current.push(code)
      if (detBuf.current.length > REQ * 3) detBuf.current.shift()
      const counts = {}
      detBuf.current.forEach(x => counts[x] = (counts[x] || 0) + 1)
      const [best, cnt] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]

      if (cnt >= REQ) {
        locked.current = true
        confirmar(best)
      }
    })
  }

  function stopQuagga() {
    if (started.current) {
      try { window.Quagga.stop() } catch {}
      started.current = false
    }
  }

  function confirmar(code) {
    setFlash(true)
    setTimeout(() => setFlash(false), 600)

    const p = PASOS[pasoRef.current]
    const nuevos = { ...valores, [p.key]: code }
    setValores(nuevos)

    const siguiente = pasoRef.current + 1
    if (siguiente < PASOS.length) {
      setPaso(siguiente)
    } else {
      // Todos los campos escaneados — cerrar escáner y abrir formulario
      stopQuagga()
      onComplete(nuevos)
    }
  }

  function saltar() {
    const siguiente = paso + 1
    if (siguiente < PASOS.length) {
      setPaso(siguiente)
    } else {
      stopQuagga()
      onComplete(valores)
    }
  }

  function usarManual() {
    const clean = manual.trim()
    if (clean.length >= 6) confirmar(clean)
  }

  function handleClose() {
    stopQuagga()
    onClose()
  }

  const p = PASOS[paso]
  const confColor = conf > 85 ? '#10b981' : conf > 60 ? '#f59e0b' : '#ef4444'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: '#000', display: 'flex', flexDirection: 'column',
      fontFamily: "'DM Sans', system-ui"
    }}>
      <style>{`
        #esc-container video { width:100%!important; height:100%!important; object-fit:cover!important; }
        #esc-container canvas.drawingBuffer { display:none!important; }
        @keyframes escScan { 0%,100%{top:33%} 50%{top:65%} }
        @keyframes flashGreen { 0%{opacity:0} 30%{opacity:0.5} 100%{opacity:0} }
      `}</style>

      {/* Header con pasos */}
      <div style={{
        background: '#0a1628', borderBottom: '1px solid #1a2f52',
        padding: '10px 16px', flexShrink: 0
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
          <span style={{ color:'#fff', fontSize:14, fontWeight:600 }}>
            📷 Escanear equipos
          </span>
          <button onClick={handleClose} style={{
            background:'transparent', border:'1px solid #1a2f52',
            borderRadius:7, color:'#8aabcc', fontSize:12,
            padding:'5px 12px', cursor:'pointer'
          }}>✕ Cancelar</button>
        </div>

        {/* Indicador de pasos */}
        <div style={{ display:'flex', alignItems:'center', gap:0 }}>
          {PASOS.map((p2, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', flex:1 }}>
              <div style={{
                display:'flex', alignItems:'center', gap:6, flex:1
              }}>
                <div style={{
                  width:26, height:26, borderRadius:'50%',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:11, fontWeight:700, flexShrink:0,
                  background: i < paso ? '#10b981' : i === paso ? '#0066ff' : '#1a2f52',
                  color: '#fff',
                  boxShadow: i === paso ? '0 0 8px rgba(0,102,255,0.5)' : 'none'
                }}>
                  {i < paso ? '✓' : i + 1}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{
                    fontSize:10, fontWeight:600,
                    color: i < paso ? '#10b981' : i === paso ? '#fff' : '#4a6a8a',
                    textTransform:'uppercase', letterSpacing:'0.05em'
                  }}>{p2.label}</div>
                  {i < paso && valores[p2.key] && (
                    <div style={{ fontSize:10, color:'#10b981', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {valores[p2.key].slice(0, 12)}{valores[p2.key].length > 12 ? '…' : ''}
                    </div>
                  )}
                </div>
              </div>
              {i < PASOS.length - 1 && (
                <div style={{ width:12, height:2, background: i < paso ? '#10b981' : '#1a2f52', flexShrink:0, margin:'0 4px' }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Video */}
      <div id="esc-container" ref={containerRef} style={{ flex:1, position:'relative', overflow:'hidden' }}>
        {/* Flash verde al confirmar */}
        {flash && (
          <div style={{
            position:'absolute', inset:0, background:'rgba(16,185,129,0.3)',
            zIndex:20, pointerEvents:'none',
            animation:'flashGreen 0.6s ease-out'
          }} />
        )}
        {/* Overlay oscuro */}
        <div style={{ position:'absolute', top:0, left:0, right:0, height:'32%', background:'rgba(0,0,0,0.6)', zIndex:5, pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:0, left:0, right:0, height:'32%', background:'rgba(0,0,0,0.6)', zIndex:5, pointerEvents:'none' }} />
        {/* Marco */}
        <div style={{ position:'absolute', top:'32%', left:'4%', right:'4%', bottom:'32%', zIndex:6, pointerEvents:'none' }}>
          {[
            { top:0,left:0, borderTop:'3px solid #0066ff', borderLeft:'3px solid #0066ff', borderRadius:'3px 0 0 0' },
            { top:0,right:0, borderTop:'3px solid #0066ff', borderRight:'3px solid #0066ff', borderRadius:'0 3px 0 0' },
            { bottom:0,left:0, borderBottom:'3px solid #0066ff', borderLeft:'3px solid #0066ff', borderRadius:'0 0 0 3px' },
            { bottom:0,right:0, borderBottom:'3px solid #0066ff', borderRight:'3px solid #0066ff', borderRadius:'0 0 3px 0' },
          ].map((s,i) => <div key={i} style={{ position:'absolute', width:20, height:20, ...s }} />)}
        </div>
        {/* Línea barrido */}
        <div style={{
          position:'absolute', left:'5%', right:'5%', height:2,
          background:'linear-gradient(90deg,transparent,#0066ff,transparent)',
          zIndex:7, pointerEvents:'none',
          animation:'escScan 1.8s ease-in-out infinite'
        }} />
        {/* Hint */}
        <div style={{
          position:'absolute', bottom:'30%', left:0, right:0,
          textAlign:'center', zIndex:7, pointerEvents:'none',
          color:'rgba(255,255,255,0.6)', fontSize:12, marginBottom:8
        }}>{p.hint}</div>
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
            placeholder={`${p.label} manual...`}
            value={manual}
            onChange={e => setManual(e.target.value)}
            inputMode="numeric"
            type="text"
            key={paso}
            autoFocus={false}
          />
          <button onClick={usarManual}
            disabled={manual.trim().length < 6}
            style={{
              padding:'10px 16px',
              background: manual.trim().length >= 6
                ? 'linear-gradient(135deg,#0066ff,#0044bb)' : '#1e3058',
              border:'none', borderRadius:8, color:'#fff',
              fontSize:13, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap'
            }}>Usar →</button>
        </div>
        <button onClick={saltar} style={{
          width:'100%', padding:'9px',
          background:'transparent', border:'1px solid #1a2f52',
          borderRadius:8, color:'#6b8ab0', fontSize:13, cursor:'pointer'
        }}>
          ↷ Saltar {p.label} {paso < PASOS.length - 1 ? '→ siguiente' : '→ ir al formulario'}
        </button>
      </div>
    </div>
  )
}
