import { useEffect, useRef, useState } from 'react'

// Carga Quagga desde CDN igual que en AniCode Pro
function loadQuagga() {
  return new Promise((resolve, reject) => {
    if (window.Quagga) { resolve(); return }
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/quagga/0.12.1/quagga.min.js'
    s.onload  = resolve
    s.onerror = reject
    document.head.appendChild(s)
  })
}

const REQ   = 5      // lecturas consistentes para confirmar
const MIN_C = 0.82   // umbral mínimo de confianza

function luhnCheck(num) {
  let s = 0, alt = false
  for (let i = num.length - 1; i >= 0; i--) {
    let n = parseInt(num[i], 10)
    if (alt) { n *= 2; if (n > 9) n -= 9 }
    s += n; alt = !alt
  }
  return s % 10 === 0
}

export default function EscanerIMEI({ campo = 'IMEI 1', onResult, onClose }) {
  const containerRef = useRef(null)
  const detBuf       = useRef([])
  const locked       = useRef(false)
  const [status,  setStatus]  = useState('Iniciando cámara...')
  const [conf,    setConf]    = useState(0)
  const [reading, setReading] = useState('—')
  const [manual,  setManual]  = useState('')
  const [running, setRunning] = useState(false)

  useEffect(() => {
    let started = false
    loadQuagga().then(() => {
      if (!containerRef.current) return
      window.Quagga.init({
        inputStream: {
          name: 'Live',
          type: 'LiveStream',
          target: containerRef.current,
          constraints: {
            facingMode: 'environment',
            width:  { min: 1280, ideal: 1920, max: 1920 },
            height: { min: 720,  ideal: 1080, max: 1080 },
            focusMode: 'continuous'
          },
          area: { top: '25%', right: '8%', bottom: '25%', left: '8%' }
        },
        locator: { patchSize: 'medium', halfSample: false },
        numOfWorkers: navigator.hardwareConcurrency > 2 ? 2 : 1,
        frequency: 15,
        decoder: {
          readers: [{ format: 'code_128_reader', config: {} }],
          multiple: false
        },
        locate: true
      }, err => {
        if (err) {
          setStatus('Sin acceso a cámara — ingresa manualmente')
          return
        }
        window.Quagga.start()
        started = true
        setRunning(true)
        setStatus(`Apunta al código de barras del ${campo}`)
      })

      window.Quagga.onProcessed(r => {
        if (!r?.codeResult?.code) return
        const codes = r.codeResult.decodedCodes.filter(x => x.error !== undefined)
        if (!codes.length) return
        const c = 1 - codes.reduce((a, x) => a + x.error, 0) / codes.length
        setConf(Math.round(c * 100))
        setReading(r.codeResult.code)
      })

      window.Quagga.onDetected(r => {
        if (locked.current) return
        const code  = r.codeResult.code.trim()
        const codes = r.codeResult.decodedCodes.filter(x => x.error !== undefined)
        if (!codes.length) return
        const c = 1 - codes.reduce((a, x) => a + x.error, 0) / codes.length
        if (c < MIN_C) return

        // Validar que sea IMEI (14-15 dígitos)
        if (!/^\d{14,15}$/.test(code)) return
        // Validar Luhn para IMEI de 15 dígitos
        if (code.length === 15 && !luhnCheck(code)) return

        detBuf.current.push(code)
        if (detBuf.current.length > REQ * 4) detBuf.current.shift()

        const counts = {}
        detBuf.current.forEach(x => counts[x] = (counts[x] || 0) + 1)
        const [best, cnt] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
        setConf(Math.min(Math.round(cnt / REQ * 100), 99))

        if (cnt >= REQ) {
          locked.current = true
          detBuf.current = []
          stopAndReturn(best)
        }
      })
    }).catch(() => setStatus('Error cargando escáner'))

    return () => {
      if (started || window.Quagga) {
        try { window.Quagga.stop() } catch {}
      }
    }
  }, [])

  function stopAndReturn(code) {
    try { window.Quagga.stop() } catch {}
    onResult(code)
  }

  function handleManual() {
    const clean = manual.replace(/[^0-9]/g, '')
    if (clean.length >= 10) {
      try { window.Quagga.stop() } catch {}
      onResult(clean)
    }
  }

  function handleClose() {
    try { window.Quagga.stop() } catch {}
    onClose()
  }

  const confColor = conf > 88 ? '#10b981' : conf > 70 ? '#f59e0b' : '#ef4444'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: '#000', display: 'flex', flexDirection: 'column',
      fontFamily: "'DM Sans', system-ui"
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px', background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0, borderBottom: '1px solid #1a2f52'
      }}>
        <div style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>
          <span style={{ marginRight: 8 }}>
            {running
              ? <span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%', background:'#10b981', boxShadow:'0 0 6px #10b981', marginRight:6 }} />
              : '📷 '
            }
          </span>
          Escaneando {campo}
        </div>
        <button onClick={handleClose} style={{
          background: 'transparent', border: '1px solid #1a2f52',
          borderRadius: 8, color: '#8aabcc', fontSize: 13,
          padding: '6px 14px', cursor: 'pointer'
        }}>✕ Cancelar</button>
      </div>

      {/* Video — pantalla completa */}
      <div ref={containerRef} style={{
        flex: 1, position: 'relative', overflow: 'hidden',
        background: '#000'
      }}>
        {/* Overlay con ventana de escaneo */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}>
          {/* Sombras */}
          <div style={{ position:'absolute', top:0, left:0, right:0, height:'25%', background:'rgba(0,0,0,0.55)' }} />
          <div style={{ position:'absolute', bottom:0, left:0, right:0, height:'25%', background:'rgba(0,0,0,0.55)' }} />
          <div style={{ position:'absolute', top:'25%', bottom:'25%', left:0, width:'8%', background:'rgba(0,0,0,0.55)' }} />
          <div style={{ position:'absolute', top:'25%', bottom:'25%', right:0, width:'8%', background:'rgba(0,0,0,0.55)' }} />
          {/* Marco con esquinas */}
          <div style={{ position:'absolute', top:'25%', left:'8%', right:'8%', bottom:'25%' }}>
            {[
              { top:0, left:0, borderTop:'3px solid #0066ff', borderLeft:'3px solid #0066ff', borderRadius:'4px 0 0 0' },
              { top:0, right:0, borderTop:'3px solid #0066ff', borderRight:'3px solid #0066ff', borderRadius:'0 4px 0 0' },
              { bottom:0, left:0, borderBottom:'3px solid #0066ff', borderLeft:'3px solid #0066ff', borderRadius:'0 0 0 4px' },
              { bottom:0, right:0, borderBottom:'3px solid #0066ff', borderRight:'3px solid #0066ff', borderRadius:'0 0 4px 0' },
            ].map((s, i) => (
              <div key={i} style={{ position:'absolute', width:22, height:22, ...s }} />
            ))}
            {/* Línea de barrido */}
            <div style={{
              position: 'absolute', left: 4, right: 4, height: 2,
              background: 'linear-gradient(90deg, transparent, #0066ff, transparent)',
              animation: 'quaggaScan 1.6s ease-in-out infinite'
            }} />
          </div>
        </div>
        {/* CSS inyectado para el video y canvas de Quagga */}
        <style>{`
          #scanner-qrcode-container video,
          div[ref] video { width:100%!important; height:100%!important; object-fit:cover!important; }
          canvas.drawingBuffer { display:none!important; }
          @keyframes quaggaScan {
            0%   { top: 4px; }
            50%  { top: calc(100% - 6px); }
            100% { top: 4px; }
          }
        `}</style>
      </div>

      {/* Confianza + lectura actual */}
      <div style={{
        background: 'rgba(0,0,0,0.85)', padding: '8px 16px',
        flexShrink: 0, borderTop: '1px solid #1a2f52'
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#4a6a8a', marginBottom:4 }}>
          <span>Confianza</span>
          <span style={{ color: confColor, fontWeight:600 }}>{conf}%</span>
        </div>
        <div style={{ height:3, background:'#1a2f52', borderRadius:2, overflow:'hidden', marginBottom:6 }}>
          <div style={{ height:'100%', width:`${conf}%`, background: confColor, borderRadius:2, transition:'width .15s,background .2s' }} />
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
          <span style={{ color:'#4a6a8a' }}>Leyendo:</span>
          <span style={{ color:'#8aabcc', fontFamily:'monospace', fontWeight:600 }}>{reading}</span>
        </div>
        <div style={{ color:'#4a6a8a', fontSize:11, marginTop:4, textAlign:'center' }}>{status}</div>
      </div>

      {/* Ingreso manual */}
      <div style={{
        background: '#0a1628', borderTop: '1px solid #1a2f52',
        padding: '12px 16px', flexShrink: 0
      }}>
        <div style={{ color:'#4a6a8a', fontSize:11, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>
          O ingresa el {campo} manualmente:
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <input
            style={{
              flex:1, background:'#060d1f', border:'1px solid #1a2f52',
              borderRadius:8, padding:'11px 12px', color:'#fff',
              fontSize:17, outline:'none', letterSpacing:1
            }}
            placeholder="000000000000000"
            value={manual}
            onChange={e => setManual(e.target.value)}
            inputMode="numeric"
            type="text"
            autoComplete="off"
          />
          <button onClick={handleManual}
            disabled={manual.replace(/\D/g,'').length < 10}
            style={{
              padding:'11px 18px',
              background: manual.replace(/\D/g,'').length >= 10
                ? 'linear-gradient(135deg,#0066ff,#0044bb)' : '#1e3058',
              border:'none', borderRadius:8, color:'#fff',
              fontSize:14, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap'
            }}>Usar →</button>
        </div>
      </div>
    </div>
  )
}
