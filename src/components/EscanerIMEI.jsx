import { useEffect, useRef, useState } from 'react'

export default function EscanerIMEI({ campo = 'IMEI 1', onResult, onClose }) {
  const videoRef  = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const animRef   = useRef(null)
  const [status, setStatus]       = useState('Iniciando cámara...')
  const [manual, setManual]       = useState('')
  const [scanning, setScanning]   = useState(false)

  useEffect(() => {
    startCamera()
    return () => stopAll()
  }, [])

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width:  { ideal: 1920 },
          height: { ideal: 1080 }
        }
      })
      streamRef.current = stream
      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      video.onloadedmetadata = () => {
        video.play().catch(() => {})
        setScanning(true)
        setStatus(`Apunta al código de barras del ${campo}`)
        requestAnimationFrame(scanLoop)
      }
    } catch {
      setStatus('Sin acceso a cámara — ingresa manualmente')
    }
  }

  function stopAll() {
    if (animRef.current) cancelAnimationFrame(animRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }

  async function scanLoop() {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) {
      animRef.current = requestAnimationFrame(scanLoop)
      return
    }

    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0)

    if ('BarcodeDetector' in window) {
      try {
        const detector  = new window.BarcodeDetector({
          formats: ['code_128','code_39','ean_13','ean_8','upc_a','upc_e','codabar','itf']
        })
        const barcodes = await detector.detect(canvas)
        if (barcodes.length > 0) {
          const raw   = barcodes[0].rawValue
          const clean = raw.replace(/[^0-9]/g, '')
          if (clean.length >= 10) {
            stopAll()
            onResult(clean)
            return
          }
        }
      } catch {}
    }

    animRef.current = requestAnimationFrame(scanLoop)
  }

  function handleManual() {
    const clean = manual.replace(/[^0-9]/g, '')
    if (clean.length >= 10) {
      stopAll()
      onResult(clean)
    }
  }

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:2000,
      background:'#000',
      display:'flex', flexDirection:'column',
      fontFamily:"'DM Sans', system-ui"
    }}>

      {/* Header */}
      <div style={{
        padding:'14px 16px',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        background:'rgba(0,0,0,0.8)', flexShrink:0
      }}>
        <div style={{ color:'#fff', fontSize:15, fontWeight:600 }}>
          📷 Escaneando {campo}
        </div>
        <button onClick={() => { stopAll(); onClose() }} style={{
          background:'transparent', border:'1px solid #4a6a8a',
          borderRadius:8, color:'#8aabcc', fontSize:13,
          padding:'6px 14px', cursor:'pointer'
        }}>✕ Cancelar</button>
      </div>

      {/* Video — ocupa todo el espacio disponible */}
      <div style={{ flex:1, position:'relative', overflow:'hidden' }}>
        <video ref={videoRef} playsInline muted
          style={{
            width:'100%', height:'100%',
            objectFit:'cover', display:'block'
          }} />
        <canvas ref={canvasRef} style={{ display:'none' }} />

        {/* Overlay con ventana de escaneo */}
        <div style={{
          position:'absolute', inset:0,
          display:'flex', alignItems:'center', justifyContent:'center'
        }}>
          {/* Sombra alrededor */}
          <div style={{
            position:'absolute', inset:0,
            background:'rgba(0,0,0,0.5)',
            WebkitMaskImage:'radial-gradient(ellipse 85% 25% at 50% 50%, transparent 100%, black 100%)',
            maskImage:'radial-gradient(ellipse 85% 25% at 50% 50%, transparent 100%, black 100%)'
          }} />
          {/* Marco */}
          <div style={{
            position:'relative',
            width:'85%', maxWidth:340,
            height:90, border:'none',
            zIndex:1
          }}>
            {/* Esquinas */}
            {[
              { top:0, left:0, borderTop:'3px solid #0066ff', borderLeft:'3px solid #0066ff', borderRadius:'6px 0 0 0' },
              { top:0, right:0, borderTop:'3px solid #0066ff', borderRight:'3px solid #0066ff', borderRadius:'0 6px 0 0' },
              { bottom:0, left:0, borderBottom:'3px solid #0066ff', borderLeft:'3px solid #0066ff', borderRadius:'0 0 0 6px' },
              { bottom:0, right:0, borderBottom:'3px solid #0066ff', borderRight:'3px solid #0066ff', borderRadius:'0 0 6px 0' },
            ].map((s, i) => (
              <div key={i} style={{ position:'absolute', width:22, height:22, ...s }} />
            ))}
            {/* Línea de escaneo */}
            <div style={{
              position:'absolute', left:4, right:4, height:2,
              background:'linear-gradient(90deg, transparent, #0066ff, transparent)',
              animation:'scanline 1.8s ease-in-out infinite'
            }} />
          </div>
        </div>
      </div>

      {/* Status */}
      <div style={{
        background:'rgba(0,0,0,0.85)', padding:'10px 20px',
        color: scanning ? '#8aabcc' : '#f87171',
        fontSize:13, textAlign:'center', flexShrink:0
      }}>{status}</div>

      {/* Ingreso manual */}
      <div style={{
        background:'#0a1628', borderTop:'1px solid #1a2f52',
        padding:'14px 16px', flexShrink:0
      }}>
        <div style={{ color:'#4a6a8a', fontSize:11, textTransform:'uppercase',
          letterSpacing:'0.06em', marginBottom:8 }}>
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

      <style>{`
        @keyframes scanline {
          0%   { top: 4px;  opacity: 1; }
          50%  { top: 80px; opacity: 1; }
          100% { top: 4px;  opacity: 1; }
        }
      `}</style>
    </div>
  )
}