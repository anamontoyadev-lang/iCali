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

const REQ   = 4     // lecturas iguales consecutivas para confirmar
const MIN_C = 0.70  // confianza mínima

// IMEI: exactamente 15 dígitos numéricos (MEID tiene 14 → rechazado)
function esIMEIValido(code) {
  return /^\d{15}$/.test(code)
}

// Serial: alfanumérico 6-25 caracteres
function esSerialValido(code) {
  return /^[A-Za-z0-9]{6,25}$/.test(code)
}

const PASOS = [
  { key: 'imei',        label: 'IMEI 1',        hint: 'Apunta al código de barras IMEI (15 dígitos)',  validar: esIMEIValido  },
  { key: 'imei2',       label: 'IMEI 2',         hint: 'Apunta al código de barras IMEI2 (15 dígitos)', validar: esIMEIValido  },
  { key: 'serial_caja', label: 'Serial de caja', hint: 'Escanea el código de la caja (opcional)',       validar: esSerialValido },
]

export default function EscanerSecuencial({ onComplete, onClose }) {
  const [pasoUI, setPasoUI]         = useState(0)
  const [reading, setReading]       = useState('–')
  const [manual, setManual]         = useState('')
  const [conf, setConf]             = useState(0)
  const [flash, setFlash]           = useState(false)
  const [msgEstado, setMsgEstado]   = useState('')
  const [capturados, setCapturados] = useState({})

  const pasoActual    = useRef(0)
  const valoresAcum   = useRef({ imei: '', imei2: '', serial_caja: '' })
  const detBuf        = useRef([])
  const locked        = useRef(false)
  const quaggaVivo    = useRef(false)
  const videoRef      = useRef()
  const manualRef     = useRef('')
  const onCompleteRef = useRef(onComplete)
  const onCloseRef    = useRef(onClose)

  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadQuagga().then(initQuagga).catch(() => {})
    }, 400)
    return () => { clearTimeout(timer); pararQuagga() }
  }, [])

  function initQuagga() {
    if (!videoRef.current) return
    quaggaVivo.current = true
    window.Quagga.init({
      inputStream: {
        type: 'LiveStream',
        target: videoRef.current,
        constraints: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' },
        area: { top: '30%', right: '5%', left: '5%', bottom: '30%' },
      },
      decoder: {
        readers: ['code_128_reader'],
        multiple: false,
      },
      locate: true,
      numOfWorkers: 2,
      frequency: 10,
      halfSample: false,
    }, err => {
      if (err) { quaggaVivo.current = false; return }
      window.Quagga.start()
      window.Quagga.onDetected(onDetected)
    })
  }

  function pararQuagga() {
    if (quaggaVivo.current) {
      try { window.Quagga.offDetected(onDetected); window.Quagga.stop() } catch (_) {}
      quaggaVivo.current = false
    }
  }

  function onDetected(result) {
    if (locked.current) return
    const code = result?.codeResult?.code?.trim() || ''
    const c    = result?.codeResult?.startInfo?.error ?? 0
    const confianza = c === 0 ? 1 : Math.max(0, 1 - c)
    if (!code || confianza < MIN_C) return

    const paso = PASOS[pasoActual.current]
    setReading(code)
    setConf(Math.round(confianza * 100))

    if (!paso.validar(code)) {
      // Mostrar mensaje descriptivo según el caso
      if (paso.key !== 'serial_caja' && /^\d{14}$/.test(code)) {
        setMsgEstado('MEID detectado — apunta al código IMEI de 15 dígitos')
      } else {
        setMsgEstado(`Esperando ${paso.label}...`)
      }
      detBuf.current = []
      return
    }

    setMsgEstado('')
    detBuf.current.push(code)
    if (detBuf.current.length > REQ * 2) detBuf.current.shift()

    const ultimos = detBuf.current.slice(-REQ)
    if (ultimos.length === REQ && ultimos.every(v => v === ultimos[0])) {
      confirmar(code)
    }
  }

  function confirmar(code) {
    if (locked.current) return
    const paso = PASOS[pasoActual.current]
    if (!paso.validar(code)) {
      setMsgEstado(`Código no válido para ${paso.label}`)
      return
    }

    locked.current = true
    setMsgEstado('')

    // Guardar SOLO en el campo del paso actual — nunca tocar otros campos
    valoresAcum.current[paso.key] = code
    setCapturados(prev => ({ ...prev, [paso.key]: code }))

    setFlash(true)
    setTimeout(() => setFlash(false), 700)

    // Resetear buffer completamente antes del siguiente paso
    detBuf.current = []
    locked.current = false

    const siguiente = pasoActual.current + 1
    if (siguiente < PASOS.length) {
      pasoActual.current = siguiente
      setPasoUI(siguiente)
      setManual('')
      manualRef.current = ''
      setConf(0)
      setReading('–')
    } else {
      pararQuagga()
      onCompleteRef.current({
        imei:        valoresAcum.current.imei        || '',
        imei2:       valoresAcum.current.imei2       || '',
        serial_caja: valoresAcum.current.serial_caja || '',
      })
    }
  }

  function saltar() {
    if (locked.current) return
    // Campo actual queda vacío
    valoresAcum.current[PASOS[pasoActual.current].key] = ''
    detBuf.current = []
    setMsgEstado('')
    setReading('–')
    setConf(0)
    setManual('')
    manualRef.current = ''

    const siguiente = pasoActual.current + 1
    if (siguiente < PASOS.length) {
      pasoActual.current = siguiente
      setPasoUI(siguiente)
    } else {
      pararQuagga()
      onCompleteRef.current({
        imei:        valoresAcum.current.imei        || '',
        imei2:       valoresAcum.current.imei2       || '',
        serial_caja: valoresAcum.current.serial_caja || '',
      })
    }
  }

  function usarManual() {
    const clean = manualRef.current.trim()
    const paso  = PASOS[pasoActual.current]
    if (!paso.validar(clean)) {
      setMsgEstado(paso.key === 'serial_caja'
        ? 'Ingresa entre 6 y 25 caracteres alfanuméricos'
        : 'El IMEI debe tener exactamente 15 dígitos')
      return
    }
    confirmar(clean)
  }

  function cerrar() {
    pararQuagga()
    onCloseRef.current()
  }

  const paso     = PASOS[pasoUI]
  const progreso = (pasoUI / PASOS.length) * 100
  const esMEID   = reading !== '–' && /^\d{14}$/.test(reading)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: flash ? 'rgba(16,185,129,0.12)' : 'rgba(0,0,0,0.96)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: 0,
      transition: 'background .15s',
      fontFamily: "'DM Sans', system-ui",
    }}>

      {/* Header */}
      <div style={{ width:'100%', maxWidth:460, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px 8px' }}>
        <div>
          <div style={{ color:'#fff', fontSize:15, fontWeight:600 }}>
            Paso {pasoUI + 1} de {PASOS.length} — {paso.label}
          </div>
          <div style={{ color:'#8aabcc', fontSize:12, marginTop:2 }}>{paso.hint}</div>
        </div>
        <button onClick={cerrar} style={{ background:'transparent', border:'none', color:'#4a6a8a', fontSize:22, cursor:'pointer' }}>×</button>
      </div>

      {/* Barra progreso */}
      <div style={{ width:'100%', maxWidth:460, padding:'0 20px 10px' }}>
        <div style={{ height:3, background:'#1a2f52', borderRadius:2, overflow:'hidden' }}>
          <div style={{ height:'100%', borderRadius:2, width:`${progreso}%`, background:'linear-gradient(90deg,#0066ff,#00c6ff)', transition:'width .4s ease' }} />
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:6 }}>
          {PASOS.map((p, i) => (
            <div key={p.key} style={{ fontSize:10, fontWeight:600, letterSpacing:'.04em', color: i < pasoUI ? '#10b981' : i === pasoUI ? '#0066ff' : '#2a3f5a' }}>
              {i < pasoUI ? '✓ ' : ''}{p.label}
            </div>
          ))}
        </div>
      </div>

      {/* Visor cámara */}
      <div style={{ position:'relative', width:'100%', maxWidth:460, borderRadius:12, overflow:'hidden', border: flash ? '2px solid #10b981' : esMEID ? '2px solid #f59e0b' : '2px solid #1a2f52', transition:'border-color .15s', background:'#000' }}>
        <div ref={videoRef} style={{ width:'100%', aspectRatio:'16/9', background:'#000', display:'block' }} />

        {/* Línea guía */}
        <div style={{ position:'absolute', top:'50%', left:'10%', right:'10%', transform:'translateY(-50%)', height:2, background: flash ? 'rgba(16,185,129,0.8)' : 'rgba(0,102,255,0.6)', boxShadow: flash ? '0 0 12px #10b981' : '0 0 8px rgba(0,102,255,0.8)', transition:'all .15s' }} />

        {/* Esquinas */}
        {[
          { top:'20%', left:'5%', borderTop:'3px solid #0066ff', borderLeft:'3px solid #0066ff' },
          { top:'20%', right:'5%', borderTop:'3px solid #0066ff', borderRight:'3px solid #0066ff' },
          { bottom:'20%', left:'5%', borderBottom:'3px solid #0066ff', borderLeft:'3px solid #0066ff' },
          { bottom:'20%', right:'5%', borderBottom:'3px solid #0066ff', borderRight:'3px solid #0066ff' },
        ].map((s, i) => <div key={i} style={{ position:'absolute', width:20, height:20, ...s }} />)}

        {/* Lectura actual */}
        {reading !== '–' && (
          <div style={{ position:'absolute', bottom:8, left:8, right:8, background:'rgba(0,0,0,0.85)', borderRadius:6, padding:'5px 10px', textAlign:'center' }}>
            <div style={{ color: esMEID ? '#f59e0b' : msgEstado ? '#f59e0b' : '#10b981', fontSize:13, fontFamily:'monospace', letterSpacing:1 }}>
              {reading} <span style={{ fontSize:10, opacity:.7 }}>({conf}%)</span>
            </div>
            {esMEID && <div style={{ color:'#f59e0b', fontSize:10, marginTop:2 }}>⚠ MEID (14 dígitos) — apunta al IMEI de 15 dígitos</div>}
          </div>
        )}

        {/* Flash OK */}
        {flash && (
          <div style={{ position:'absolute', inset:0, background:'rgba(16,185,129,0.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ fontSize:48 }}>✅</div>
          </div>
        )}
      </div>

      {/* Mensaje estado */}
      {msgEstado && !esMEID && (
        <div style={{ width:'100%', maxWidth:460, padding:'6px 20px 0', color:'#f59e0b', fontSize:12, textAlign:'center' }}>
          ⏳ {msgEstado}
        </div>
      )}

      {/* Manual */}
      <div style={{ width:'100%', maxWidth:460, padding:'12px 20px 0' }}>
        <div style={{ color:'#5a7aaa', fontSize:11, textAlign:'center', marginBottom:6 }}>O ingresa manualmente:</div>
        <div style={{ display:'flex', gap:8 }}>
          <input
            style={{ flex:1, background:'#0a1628', border:'1px solid #1a2f52', borderRadius:8, padding:'10px 12px', color:'#fff', fontSize:14, letterSpacing:1, outline:'none', textAlign:'center' }}
            placeholder={paso.key === 'serial_caja' ? 'Serial alfanumérico...' : 'IMEI exacto (15 dígitos)...'}
            value={manual}
            onChange={e => { setManual(e.target.value); manualRef.current = e.target.value; setMsgEstado('') }}
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
