import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } from '@zxing/browser'

function esIMEIValido(code) {
  return /^\d{15}$/.test(code)
}

function esSerialValido(code) {
  return /^[A-Za-z0-9]{6,25}$/.test(code)
}

const PASOS = [
  { key: 'imei',        label: 'IMEI 1',        hint: 'Apunta al código de barras del IMEI 1',  validar: esIMEIValido  },
  { key: 'imei2',       label: 'IMEI 2',         hint: 'Apunta al código de barras del IMEI 2',  validar: esIMEIValido  },
  { key: 'serial_caja', label: 'Serial de caja', hint: 'Escanea el código de la caja (opcional)', validar: esSerialValido },
]

export default function EscanerSecuencial({ onComplete, onClose }) {
  const [pasoUI, setPasoUI]         = useState(0)
  const [reading, setReading]       = useState('–')
  const [manual, setManual]         = useState('')
  const [flash, setFlash]           = useState(false)
  const [capturados, setCapturados] = useState({})
  const [pendiente, setPendiente]   = useState(null)
  const [cuenta, setCuenta]         = useState(0)
  const [errCam, setErrCam]         = useState('')

  const pasoActual    = useRef(0)
  const valoresAcum   = useRef({ imei: '', imei2: '', serial_caja: '' })
  const locked        = useRef(false)
  const videoRef      = useRef()
  const readerRef     = useRef(null)
  const cuentaRef     = useRef(null)
  const manualRef     = useRef('')
  const onCompleteRef = useRef(onComplete)
  const onCloseRef    = useRef(onClose)

  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useEffect(() => {
    iniciarZxing()
    return () => { pararZxing(); clearInterval(cuentaRef.current) }
  }, [])

  async function iniciarZxing() {
    try {
      const hints = new Map()
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.CODE_128,
        BarcodeFormat.EAN_13,
        BarcodeFormat.UPC_A,
      ])
      hints.set(DecodeHintType.TRY_HARDER, true)

      const reader = new BrowserMultiFormatReader(hints)
      readerRef.current = reader

      // Obtener cámara trasera
      const devices = await BrowserMultiFormatReader.listVideoInputDevices()
      const trasera = devices.find(d =>
        d.label.toLowerCase().includes('back') ||
        d.label.toLowerCase().includes('rear') ||
        d.label.toLowerCase().includes('environment') ||
        d.label.toLowerCase().includes('trasera')
      ) || devices[devices.length - 1]

      if (!trasera) { setErrCam('No se encontró cámara'); return }

      await reader.decodeFromVideoDevice(trasera.deviceId, videoRef.current, (result, err) => {
        if (!result) return
        if (locked.current) return

        const code = result.getText().trim()
        const paso = PASOS[pasoActual.current]

        setReading(code)

        if (!paso.validar(code)) return

        // Válido — mostrar confirmación
        locked.current = true
        setPendiente({ code, label: paso.label })
        iniciarCuenta(code)
      })
    } catch (e) {
      setErrCam('Error al iniciar cámara: ' + e.message)
    }
  }

  function pararZxing() {
    try { readerRef.current?.reset() } catch (_) {}
  }

  function iniciarCuenta(code) {
    let n = 4
    setCuenta(n)
    clearInterval(cuentaRef.current)
    cuentaRef.current = setInterval(() => {
      n -= 1
      setCuenta(n)
      if (n <= 0) {
        clearInterval(cuentaRef.current)
        confirmarPendiente(code)
      }
    }, 1000)
  }

  function confirmarPendiente(code) {
    clearInterval(cuentaRef.current)
    setPendiente(null)
    const paso = PASOS[pasoActual.current]
    valoresAcum.current[paso.key] = code
    setCapturados(prev => ({ ...prev, [paso.key]: code }))
    setFlash(true)
    setTimeout(() => setFlash(false), 600)
    locked.current = false
    avanzar()
  }

  function rechazarPendiente() {
    clearInterval(cuentaRef.current)
    setPendiente(null)
    locked.current = false
    setReading('–')
  }

  function avanzar() {
    const siguiente = pasoActual.current + 1
    if (siguiente < PASOS.length) {
      pasoActual.current = siguiente
      setPasoUI(siguiente)
      setManual('')
      manualRef.current = ''
      setReading('–')
    } else {
      pararZxing()
      onCompleteRef.current({
        imei:        valoresAcum.current.imei        || '',
        imei2:       valoresAcum.current.imei2       || '',
        serial_caja: valoresAcum.current.serial_caja || '',
      })
    }
  }

  function saltar() {
    clearInterval(cuentaRef.current)
    setPendiente(null)
    locked.current = false
    valoresAcum.current[PASOS[pasoActual.current].key] = ''
    setReading('–')
    setManual('')
    manualRef.current = ''
    avanzar()
  }

  function usarManual() {
    const clean = manualRef.current.trim()
    const paso  = PASOS[pasoActual.current]
    if (!paso.validar(clean)) return
    clearInterval(cuentaRef.current)
    setPendiente(null)
    locked.current = false
    valoresAcum.current[paso.key] = clean
    setCapturados(prev => ({ ...prev, [paso.key]: clean }))
    setFlash(true)
    setTimeout(() => setFlash(false), 500)
    avanzar()
  }

  function cerrar() {
    clearInterval(cuentaRef.current)
    pararZxing()
    onCloseRef.current()
  }

  const paso     = PASOS[pasoUI]
  const progreso = (pasoUI / PASOS.length) * 100
  const esMEID   = reading !== '–' && /^\d{14}$/.test(reading)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: flash ? 'rgba(16,185,129,0.12)' : 'rgba(0,0,0,0.97)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center',
      transition: 'background .15s',
      fontFamily: "'DM Sans', system-ui",
    }}>

      {/* PANTALLA CONFIRMACIÓN */}
      {pendiente && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          background: 'rgba(0,0,0,0.96)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 20, padding: 32,
        }}>
          <div style={{ fontSize: 48 }}>🔍</div>
          <div style={{ color: '#fff', fontSize: 16, fontWeight: 700, textAlign: 'center' }}>
            ¿Este es el {pendiente.label} correcto?
          </div>
          <div style={{ background: '#0d1a35', border: '2px solid #0066ff', borderRadius: 12, padding: '16px 24px', textAlign: 'center' }}>
            <div style={{ color: '#8aabcc', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{pendiente.label} leído</div>
            <div style={{ color: '#10b981', fontSize: 20, fontFamily: 'monospace', letterSpacing: 2, fontWeight: 700 }}>
              {pendiente.code}
            </div>
          </div>
          <div style={{ color: '#4a6a8a', fontSize: 13 }}>
            Confirmando en <span style={{ color: '#0066ff', fontWeight: 700, fontSize: 18 }}>{cuenta}</span>s...
          </div>
          <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 340 }}>
            <button onClick={rechazarPendiente} style={{
              flex: 1, padding: '12px 0', background: 'transparent',
              border: '1px solid #ef4444', borderRadius: 8,
              color: '#ef4444', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>✗ No es este</button>
            <button onClick={() => confirmarPendiente(pendiente.code)} style={{
              flex: 1, padding: '12px 0', background: 'linear-gradient(135deg,#10b981,#059669)',
              border: 'none', borderRadius: 8,
              color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>✓ Confirmar</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ width:'100%', maxWidth:460, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px 8px' }}>
        <div>
          <div style={{ color:'#fff', fontSize:15, fontWeight:600 }}>Paso {pasoUI + 1} de {PASOS.length} — {paso.label}</div>
          <div style={{ color:'#8aabcc', fontSize:12, marginTop:2 }}>{paso.hint}</div>
        </div>
        <button onClick={cerrar} style={{ background:'transparent', border:'none', color:'#4a6a8a', fontSize:22, cursor:'pointer' }}>×</button>
      </div>

      {/* Progreso */}
      <div style={{ width:'100%', maxWidth:460, padding:'0 20px 10px' }}>
        <div style={{ height:3, background:'#1a2f52', borderRadius:2, overflow:'hidden' }}>
          <div style={{ height:'100%', borderRadius:2, width:`${progreso}%`, background:'linear-gradient(90deg,#0066ff,#00c6ff)', transition:'width .4s ease' }} />
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:6 }}>
          {PASOS.map((p, i) => (
            <div key={p.key} style={{ fontSize:10, fontWeight:600, color: i < pasoUI ? '#10b981' : i === pasoUI ? '#0066ff' : '#2a3f5a' }}>
              {i < pasoUI ? '✓ ' : ''}{p.label}
            </div>
          ))}
        </div>
      </div>

      {/* Visor */}
      <div style={{ position:'relative', width:'100%', maxWidth:460, borderRadius:12, overflow:'hidden', border: flash ? '2px solid #10b981' : '2px solid #1a2f52', background:'#000' }}>
        <video ref={videoRef} style={{ width:'100%', aspectRatio:'4/3', background:'#000', display:'block' }} autoPlay muted playsInline />

        {/* Línea guía centrada */}
        <div style={{ position:'absolute', top:'50%', left:'8%', right:'8%', transform:'translateY(-50%)', height:2, background:'rgba(0,102,255,0.8)', boxShadow:'0 0 10px rgba(0,102,255,0.9)' }} />

        {/* Esquinas */}
        {[
          { top:'25%', left:'5%', borderTop:'3px solid #0066ff', borderLeft:'3px solid #0066ff' },
          { top:'25%', right:'5%', borderTop:'3px solid #0066ff', borderRight:'3px solid #0066ff' },
          { bottom:'25%', left:'5%', borderBottom:'3px solid #0066ff', borderLeft:'3px solid #0066ff' },
          { bottom:'25%', right:'5%', borderBottom:'3px solid #0066ff', borderRight:'3px solid #0066ff' },
        ].map((s, i) => <div key={i} style={{ position:'absolute', width:24, height:24, ...s }} />)}

        {/* Lectura */}
        {reading !== '–' && (
          <div style={{ position:'absolute', bottom:8, left:8, right:8, background:'rgba(0,0,0,0.85)', borderRadius:6, padding:'5px 10px', textAlign:'center' }}>
            <div style={{ color: esMEID ? '#f59e0b' : '#10b981', fontSize:13, fontFamily:'monospace', letterSpacing:1 }}>{reading}</div>
            {esMEID && <div style={{ color:'#f59e0b', fontSize:10, marginTop:2 }}>MEID (14 dígitos) — necesito el IMEI de 15 dígitos</div>}
          </div>
        )}

        {errCam && (
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.8)', color:'#ef4444', fontSize:13, padding:20, textAlign:'center' }}>
            {errCam}
          </div>
        )}

        {flash && (
          <div style={{ position:'absolute', inset:0, background:'rgba(16,185,129,0.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ fontSize:48 }}>✅</div>
          </div>
        )}
      </div>

      {/* Manual */}
      <div style={{ width:'100%', maxWidth:460, padding:'12px 20px 0' }}>
        <div style={{ color:'#5a7aaa', fontSize:11, textAlign:'center', marginBottom:6 }}>O ingresa manualmente:</div>
        <div style={{ display:'flex', gap:8 }}>
          <input
            style={{ flex:1, background:'#0a1628', border:'1px solid #1a2f52', borderRadius:8, padding:'10px 12px', color:'#fff', fontSize:14, letterSpacing:1, outline:'none', textAlign:'center' }}
            placeholder={paso.key === 'serial_caja' ? 'Serial alfanumérico...' : 'IMEI (15 dígitos)...'}
            value={manual}
            onChange={e => { setManual(e.target.value); manualRef.current = e.target.value }}
            onKeyDown={e => e.key === 'Enter' && usarManual()}
          />
          <button onClick={usarManual} disabled={manual.trim().length < 6}
            style={{ padding:'10px 16px', border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', background: manual.trim().length >= 6 ? 'linear-gradient(135deg,#0066ff,#0044bb)' : '#1e3058' }}>
            Usar →
          </button>
        </div>
      </div>

      {/* Acciones */}
      <div style={{ width:'100%', maxWidth:460, padding:'10px 20px 16px', display:'flex', gap:10 }}>
        <button onClick={cerrar} style={{ flex:1, padding:'10px 0', background:'transparent', border:'1px solid #1a2f52', borderRadius:8, color:'#5a7aaa', fontSize:13, cursor:'pointer' }}>Cancelar</button>
        <button onClick={saltar} style={{ flex:1, padding:'10px 0', background:'#0d1a35', border:'1px solid #1a2f52', borderRadius:8, color:'#8aabcc', fontSize:13, cursor:'pointer' }}>
          {paso.key === 'serial_caja' ? 'Sin caja →' : `Saltar ${paso.label} →`}
        </button>
      </div>

      {/* Resumen capturado */}
      {Object.keys(capturados).length > 0 && (
        <div style={{ width:'100%', maxWidth:460, padding:'0 20px 12px', display:'flex', gap:16, flexWrap:'wrap' }}>
          {PASOS.map((p, i) => {
            const val = capturados[p.key]
            if (!val || i >= pasoUI) return null
            return (
              <div key={p.key} style={{ fontSize:11, color:'#10b981' }}>
                <span style={{ opacity:.6 }}>{p.label}: </span>
                <span style={{ fontFamily:'monospace' }}>{val}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
