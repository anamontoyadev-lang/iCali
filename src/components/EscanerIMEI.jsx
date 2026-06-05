import { useRef, useState } from 'react'

export default function EscanerIMEI({ campo = 'IMEI 1', onResult, onClose }) {
  const [manual, setManual] = useState('')
  const fileRef = useRef(null)

  function handleManual() {
    const clean = manual.replace(/[^0-9]/g, '')
    if (clean.length >= 10) onResult(clean)
  }

  // En iPhone, usar input file con capture=environment
  // El usuario escanea con la cámara nativa y el resultado llega como imagen
  // Pero más confiable: input type=text con el teclado de la cámara en iOS
  // La mejor opción en iOS es abrir la app de cámara y que copie el IMEI

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:2000,
      background:'#060d1f', display:'flex',
      flexDirection:'column', fontFamily:"'DM Sans', system-ui"
    }}>
      {/* Header */}
      <div style={{
        padding:'16px 20px', borderBottom:'1px solid #1a2f52',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        background:'#0a1628'
      }}>
        <div style={{ color:'#fff', fontSize:15, fontWeight:600 }}>
          📱 Ingresar {campo}
        </div>
        <button onClick={onClose} style={{
          background:'transparent', border:'1px solid #1a2f52',
          borderRadius:8, color:'#8aabcc', fontSize:13,
          padding:'6px 14px', cursor:'pointer'
        }}>✕ Cancelar</button>
      </div>

      <div style={{ flex:1, padding:'24px 20px', display:'flex', flexDirection:'column', gap:20 }}>

        {/* Opción 1: Cámara nativa iOS */}
        <div style={{
          background:'#0d1a35', border:'1px solid #1a2f52',
          borderRadius:12, padding:'20px 18px'
        }}>
          <div style={{ color:'#fff', fontSize:14, fontWeight:600, marginBottom:6 }}>
            📷 Opción 1 — Escanear con cámara
          </div>
          <div style={{ color:'#4a6a8a', fontSize:12, marginBottom:14, lineHeight:1.5 }}>
            Abre la cámara, apunta al código de barras del IMEI. 
            iOS lo reconoce automáticamente — copia el número y pégalo abajo.
          </div>
          {/* Input file con capture — en iOS abre la cámara */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display:'none' }}
            onChange={() => {}}
          />
          <button
            onClick={() => fileRef.current?.click()}
            style={{
              width:'100%', padding:'12px',
              background:'linear-gradient(135deg,#0066ff,#0044bb)',
              border:'none', borderRadius:8, color:'#fff',
              fontSize:14, fontWeight:600, cursor:'pointer'
            }}>
            Abrir cámara
          </button>
        </div>

        {/* Opción 2: Ingreso manual con teclado numérico */}
        <div style={{
          background:'#0d1a35', border:'1px solid #1a2f52',
          borderRadius:12, padding:'20px 18px'
        }}>
          <div style={{ color:'#fff', fontSize:14, fontWeight:600, marginBottom:6 }}>
            ⌨️ Opción 2 — Ingresar manualmente
          </div>
          <div style={{ color:'#4a6a8a', fontSize:12, marginBottom:14 }}>
            Escribe o pega el {campo} directamente:
          </div>
          <input
            style={{
              width:'100%', boxSizing:'border-box',
              background:'#060d1f', border:'1px solid #1a2f52',
              borderRadius:8, padding:'14px 12px', color:'#fff',
              fontSize:18, outline:'none', letterSpacing:2,
              marginBottom:10
            }}
            placeholder="000000000000000"
            value={manual}
            onChange={e => setManual(e.target.value)}
            inputMode="numeric"
            type="text"
            autoFocus
          />
          <button
            onClick={handleManual}
            disabled={manual.replace(/\D/g,'').length < 10}
            style={{
              width:'100%', padding:'13px',
              background: manual.replace(/\D/g,'').length >= 10
                ? 'linear-gradient(135deg,#0066ff,#0044bb)' : '#1e3058',
              border:'none', borderRadius:8, color:'#fff',
              fontSize:15, fontWeight:600, cursor:'pointer'
            }}>
            {manual.replace(/\D/g,'').length >= 10
              ? `✓ Usar ${manual.replace(/\D/g,'')}`
              : `Ingresa ${campo} (${manual.replace(/\D/g,'').length}/15)`
            }
          </button>
        </div>

        {/* Tip iOS */}
        <div style={{
          background:'rgba(0,102,255,0.08)', border:'1px solid rgba(0,102,255,0.2)',
          borderRadius:10, padding:'12px 16px'
        }}>
          <div style={{ color:'#60a5fa', fontSize:12, lineHeight:1.6 }}>
            💡 <strong>Tip iPhone:</strong> En la app de Cámara, apunta al código de barras del IMEI — iOS muestra el número en pantalla automáticamente. Cópialo y pégalo arriba con toque largo → Pegar.
          </div>
        </div>
      </div>
    </div>
  )
}