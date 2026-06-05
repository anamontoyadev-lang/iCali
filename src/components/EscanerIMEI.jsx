import { useEffect, useRef, useState } from 'react'

export default function EscanerIMEI({ onResult, onClose }) {
  const videoRef    = useRef(null)
  const canvasRef   = useRef(null)
  const streamRef   = useRef(null)
  const animRef     = useRef(null)
  const [status, setStatus] = useState('Iniciando cámara...')
  const [manualIMEI, setManualIMEI] = useState('')

  useEffect(() => {
    startCamera()
    return () => stopCamera()
  }, [])

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play().catch(() => {})
        videoRef.current.onloadedmetadata = () => {
          setStatus('Apunta al código de barras del IMEI')
          scanLoop()
        }
      }
    } catch {
      setStatus('Sin acceso a la cámara — ingresa manualmente')
    }
  }

  function stopCamera() {
    if (animRef.current) cancelAnimationFrame(animRef.current)
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
  }

  async function scanLoop() {
    if (!videoRef.current || !canvasRef.current) return
    const video  = videoRef.current
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')

    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)

    // Usar BarcodeDetector nativo del navegador (más rápido)
    if ('BarcodeDetector' in window) {
      try {
        const detector = new window.BarcodeDetector({
          formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'codabar', 'itf']
        })
        const barcodes = await detector.detect(canvas)
        if (barcodes.length > 0) {
          const raw   = barcodes[0].rawValue
          const clean = raw.replace(/[^0-9]/g, '')
          if (clean.length >= 10) {
            stopCamera()
            onResult(clean)
            return
          }
        }
      } catch {}
    }

    animRef.current = requestAnimationFrame(scanLoop)
  }

  function handleManual() {
    const clean = manualIMEI.replace(/[^0-9]/g, '')
    if (clean.length >= 10) {
      stopCamera()
      onResult(clean)
    }
  }

  return (
    <div style={{
      position:'fixed', inset:0, background:'#000',
      display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', zIndex:1000,
      fontFamily:"'DM Sans', system-ui"
    }}>
      {/* Video */}
      <div style={{ position:'relative', width:'100%', maxWidth:420 }}>
        <video ref={videoRef} playsInline muted
          style={{ width:'100%', display:'block', maxHeight:'60vh', objectFit:'cover' }} />
        <canvas ref={canvasRef} style={{ display:'none' }} />

        {/* Guía visual */}
        <div style={{
          position:'absolute', inset:0,
          display:'flex', alignItems:'center', justifyContent:'center',
          pointerEvents:'none'
        }}>
          <div style={{
            width:'85%', height:80,
            border:'2px solid #0066ff',
            borderRadius:8,
            boxShadow:'0 0 0 9999px rgba(0,0,0,0.5)'
          }}>
            {/* Línea animada */}
            <div style={{
              width:'100%', height:2,
              background:'#0066ff',
              animation:'scan 1.5s linear infinite',
              marginTop:38
            }} />
          </div>
        </div>
      </div>

      {/* Status */}
      <div style={{ color:'#8aabcc', fontSize:13, padding:'12px 20px', textAlign:'center' }}>
        {status}
      </div>

      {/* Ingreso manual */}
      <div style={{ width:'100%', maxWidth:380, padding:'0 20px' }}>
        <div style={{ color:'#4a6a8a', fontSize:12, textAlign:'center', marginBottom:8 }}>
          O ingresa el IMEI manualmente:
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <input
            style={{
              flex:1, background:'#0a1628', border:'1px solid #1a2f52',
              borderRadius:8, padding:'10px 12px', color:'#fff',
              fontSize:16, outline:'none', letterSpacing:1
            }}
            placeholder="000000000000000"
            value={manualIMEI}
            onChange={e => setManualIMEI(e.target.value)}
            type="number"
            inputMode="numeric"
          />
          <button onClick={handleManual}
            disabled={manualIMEI.replace(/\D/g,'').length < 10}
            style={{
              padding:'10px 16px',
              background: manualIMEI.replace(/\D/g,'').length >= 10
                ? 'linear-gradient(135deg,#0066ff,#0044bb)' : '#1e3058',
              border:'none', borderRadius:8,
              color:'#fff', fontSize:13, cursor:'pointer', fontWeight:600
            }}>Usar</button>
        </div>
      </div>

      <button onClick={() => { stopCamera(); onClose() }} style={{
        marginTop:16, padding:'10px 28px',
        background:'transparent', border:'1px solid #4a6a8a',
        borderRadius:8, color:'#8aabcc', fontSize:13, cursor:'pointer'
      }}>Cancelar</button>

      <style>{`
        @keyframes scan {
          0%   { margin-top: 0px; }
          50%  { margin-top: 72px; }
          100% { margin-top: 0px; }
        }
      `}</style>
    </div>
  )
}
