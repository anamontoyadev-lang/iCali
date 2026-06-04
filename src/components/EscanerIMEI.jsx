// src/components/EscanerIMEI.jsx
import { useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

export default function EscanerIMEI({ onResult, onClose }) {
  const scannerRef = useRef(null)
  const containerId = 'escaner-imei-container'

  useEffect(() => {
    const scanner = new Html5Qrcode(containerId)
    scannerRef.current = scanner

    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 280, height: 120 } },
      (text) => {
        // Código leído — limpiar y devolver solo números
        const clean = text.replace(/[^0-9]/g, '')
        if (clean.length >= 10) {
          scanner.stop().catch(() => {})
          onResult(clean)
        }
      },
      () => {} // error silencioso por frame
    ).catch(() => {
      // Sin cámara — cerrar
      onClose()
    })

    return () => {
      scanner.stop().catch(() => {})
    }
  }, [])

  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.92)',
      display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', zIndex:1000, gap:16, padding:20,
      fontFamily:"'DM Sans', system-ui"
    }}>
      <div style={{ color:'#fff', fontSize:15, fontWeight:500, textAlign:'center' }}>
        📷 Apunta al código de barras del IMEI
      </div>

      {/* Contenedor del escáner */}
      <div style={{ width:'100%', maxWidth:360, borderRadius:12, overflow:'hidden', background:'#000' }}>
        <div id={containerId} style={{ width:'100%' }} />
      </div>

      <div style={{ color:'#8aabcc', fontSize:12, textAlign:'center', maxWidth:300 }}>
        Mantén el código de barras dentro del recuadro. Se leerá automáticamente.
      </div>

      <button onClick={onClose} style={{
        padding:'10px 28px', background:'transparent',
        border:'1px solid #4a6a8a', borderRadius:8,
        color:'#8aabcc', fontSize:13, cursor:'pointer'
      }}>Cancelar</button>
    </div>
  )
}
