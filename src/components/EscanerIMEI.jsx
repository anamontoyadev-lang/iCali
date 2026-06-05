import { useEffect, useRef, useState } from 'react'

function loadQuagga() {
  return new Promise((resolve, reject) => {
    if (window.Quagga) { resolve(); return }
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/quagga/0.12.1/quagga.min.js'
    s.onload = resolve
    s.onerror = reject
    document.head.appendChild(s)
  })
}

const REQ = 4
const MIN_C = 0.80

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
  const detBuf = useRef([])
  const locked = useRef(false)
  const quaggaStarted = useRef(false)
  const [status, setStatus] = useState('Cargando cámara...')
  const [conf, setConf] = useState(0)
  const [reading, setReading] = useState('—')
  const [manual, setManual] = useState('')

  useEffect(() => {
    loadQuagga().then(startQuagga).catch(() => setStatus('Error cargando escáner'))
    return () => {
      if (quaggaStarted.current) {
        try { window.Quagga.stop() } catch {}
        quaggaStarted.current = false
      }
    }
  }, [])

  function startQuagga() {
    if (!containerRef.current) return
    window.Quagga.init({
      inputStream: {
        name: 'Live',
        type: 'LiveStream',
        target: containerRef.current,
        constraints: {
          facingMode: 'environment',
          // Resolución más baja = enfoque más rápido en móvil
          width:  { ideal: 1280 },
          height: { ideal: 720 },
          focusMode: 'continuous',
          advanced: [{ focusMode: 'continuous' }]
        },
        // Área de análisis pequeña y centrada — solo la franja del código de barras
        area: { top: '35%', right: '5%', bottom: '35%', left: '5%' }
      },
      locator: {
        patchSize: 'large',  // large = mejor para códigos estrechos como IMEI
        halfSample: true     // true = más rápido
      },
      numOfWorkers: 2,
      frequency: 20,
      decoder: {
        readers: [
          { format: 'code_128_reader', config: {} }
        ],
        multiple: false
      },
      locate: true
    }, err => {
      if (err) {
        setStatus('Sin acceso a cámara — ingresa manualmente')
        return
      }
      window.Quagga.start()
      quaggaStarted.current = true
      setStatus(`Centra el código de barras en la línea azul`)
    })

    window.Quagga.onProcessed(r => {
      if (!r?.codeResult?.code) return
      const codes = r.codeResult.decodedCodes.filter(x => x.error !== undefined)
      if (!codes.length) return
      const c = 1 - codes.reduce((a, x) => a + x.error, 0) / codes.length
      setConf(Math.round(c * 100))
      const code = r.codeResult.code
      setReading(code.length > 18 ? code.slice(0, 18) + '…' : code)
    })

    window.Quagga.onDetected(r => {
      if (locked.current) return
      const code = r.codeResult.code.trim()
      const codes = r.codeResult.decodedCodes.filter(x => x.error !== undefined)
      if (!codes.length) return
      const c = 1 - codes.reduce((a, x) => a + x.error, 0) / codes.length
      if (c < MIN_C) return
      if (!/^\d{14,15}$/.test(code)) return
      if (code.length === 15 && !luhnCheck(code)) return

      detBuf.current.push(code)
      if (detBuf.current.length > REQ * 3) detBuf.current.shift()
      const counts = {}
      detBuf.current.forEach(x => counts[x] = (counts[x] || 0) + 1)
      const [best, cnt] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]

      if (cnt >= REQ) {
        locked.current = true
        try { window.Quagga.stop() } catch {}
        quaggaStarted.current = false
        onResult(best)
      }
    })
  }

  function handleManual() {
    const clean = manual.replace(/[^0-9]/g, '')
    if (clean.length >= 10) {
      if (quaggaStarted.current) { try { window.Quagga.stop() } catch {} }
      onResult(clean)
    }
  }

  function handleClose() {
    if (quaggaStarted.current) { try { window.Quagga.stop() } catch {} }
    onClose()
  }

  const confColor = conf > 85 ? '#10b981' : conf > 60 ? '#f59e0b' : '#ef4444'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: '#000', display: 'flex', flexDirection: 'column',
      fontFamily: "'DM Sans', system-ui"
    }}>
      <style>{`
        #quagga-container video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
        }
        #quagga-container canvas.drawingBuffer { display: none !important; }
        @keyframes scanBar {
          0%   { top: 35%; }
          50%  { top: 63%; }
          100% { top: 35%; }
        }
      `}</style>

      {/* Header */}
      <div style={{
        padding: '12px 16px', background: '#0a1628',
        borderBottom: '1px solid #1a2f52',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: quaggaStarted.current ? '#10b981' : '#4a6a8a',
            boxShadow: quaggaStarted.current ? '0 0 6px #10b981' : 'none'
          }} />
          <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>
            Escanear {campo}
          </span>
        </div>
        <button onClick={handleClose} style={{
          background: 'transparent', border: '1px solid #1a2f52',
          borderRadius: 8, color: '#8aabcc', fontSize: 13,
          padding: '6px 14px', cursor: 'pointer'
        }}>✕ Cancelar</button>
      </div>

      {/* Video fullscreen */}
      <div id="quagga-container" ref={containerRef} style={{
        flex: 1, position: 'relative', overflow: 'hidden'
      }}>
        {/* Overlay oscuro arriba y abajo */}
        <div style={{ position:'absolute', top:0, left:0, right:0, height:'35%', background:'rgba(0,0,0,0.6)', zIndex:5, pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:0, left:0, right:0, height:'35%', background:'rgba(0,0,0,0.6)', zIndex:5, pointerEvents:'none' }} />

        {/* Marco de la ventana de escaneo */}
        <div style={{
          position: 'absolute', top: '35%', left: '5%', right: '5%', bottom: '35%',
          zIndex: 6, pointerEvents: 'none'
        }}>
          {/* Esquinas */}
          {[
            { top:0, left:0, borderTop:'3px solid #0066ff', borderLeft:'3px solid #0066ff', borderRadius:'3px 0 0 0' },
            { top:0, right:0, borderTop:'3px solid #0066ff', borderRight:'3px solid #0066ff', borderRadius:'0 3px 0 0' },
            { bottom:0, left:0, borderBottom:'3px solid #0066ff', borderLeft:'3px solid #0066ff', borderRadius:'0 0 0 3px' },
            { bottom:0, right:0, borderBottom:'3px solid #0066ff', borderRight:'3px solid #0066ff', borderRadius:'0 0 3px 0' },
          ].map((s, i) => (
            <div key={i} style={{ position:'absolute', width:20, height:20, ...s }} />
          ))}
        </div>

        {/* Línea de barrido */}
        <div style={{
          position: 'absolute', left: '6%', right: '6%', height: 2,
          background: 'linear-gradient(90deg,transparent,#0066ff,transparent)',
          zIndex: 7, pointerEvents: 'none',
          animation: 'scanBar 1.8s ease-in-out infinite'
        }} />

        {/* Texto guía dentro de la ventana */}
        <div style={{
          position: 'absolute', top: '65%', left: 0, right: 0,
          textAlign: 'center', zIndex: 7, pointerEvents: 'none',
          color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 8
        }}>
          Mantén el código de barras dentro del marco
        </div>
      </div>

      {/* Barra de estado */}
      <div style={{
        background: '#0a1628', borderTop: '1px solid #1a2f52',
        padding: '8px 16px', flexShrink: 0
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:3 }}>
          <span style={{ color:'#4a6a8a' }}>Confianza</span>
          <span style={{ color: confColor, fontWeight:600 }}>{conf}%</span>
        </div>
        <div style={{ height:3, background:'#1a2f52', borderRadius:2, marginBottom:6, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${conf}%`, background: confColor, borderRadius:2, transition:'all .15s' }} />
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:2 }}>
          <span style={{ color:'#4a6a8a' }}>Leyendo:</span>
          <span style={{ color:'#8aabcc', fontFamily:'monospace' }}>{reading}</span>
        </div>
        <div style={{ color:'#4a6a8a', fontSize:11, textAlign:'center' }}>{status}</div>
      </div>

      {/* Ingreso manual */}
      <div style={{
        background: '#060d1f', borderTop: '1px solid #1a2f52',
        padding: '12px 16px', flexShrink: 0
      }}>
        <div style={{ color:'#4a6a8a', fontSize:11, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>
          Ingreso manual de {campo}:
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <input
            style={{
              flex:1, background:'#0a1628', border:'1px solid #1a2f52',
              borderRadius:8, padding:'11px 12px', color:'#fff',
              fontSize:17, outline:'none', letterSpacing:1
            }}
            placeholder="000000000000000"
            value={manual}
            onChange={e => setManual(e.target.value)}
            inputMode="numeric"
            type="text"
          />
          <button onClick={handleManual}
            disabled={manual.replace(/\D/g,'').length < 10}
            style={{
              padding:'11px 18px',
              background: manual.replace(/\D/g,'').length >= 10
                ? 'linear-gradient(135deg,#0066ff,#0044bb)' : '#1e3058',
              border:'none', borderRadius:8, color:'#fff',
              fontSize:14, fontWeight:600, cursor:'pointer'
            }}>Usar →</button>
        </div>
      </div>
    </div>
  )
}
