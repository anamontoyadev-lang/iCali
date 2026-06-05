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

const REQ = 4        // lecturas iguales consecutivas para confirmar
const MIN_C = 0.78   // confianza mínima

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
  { key: 'imei',        label: 'IMEI 1',        hint: 'Apunta al código de barras del IMEI 1', isIMEI: true  },
  { key: 'imei2',       label: 'IMEI 2',         hint: 'Apunta al IMEI 2 (dual SIM)',           isIMEI: true  },
  { key: 'serial_caja', label: 'Serial de caja', hint: 'Escanea el código de la caja',          isIMEI: false },
]

export default function EscanerSecuencial({ onComplete, onClose }) {
  const [pasoUI, setPasoUI]       = useState(0)
  const [reading, setReading]     = useState('–')
  const [manual, setManual]       = useState('')
  const [conf, setConf]           = useState(0)
  const [flash, setFlash]         = useState(false)
  const [saltados, setSaltados]   = useState({})

  // Todos los valores acumulados y estado volátil en refs para evitar closures stale
  const pasoActual   = useRef(0)
  const valoresAcum  = useRef({ imei: '', imei2: '', serial_caja: '' })
  const detBuf       = useRef([])
  const locked       = useRef(false)
  const quaggaVivo   = useRef(false)

  const videoRef  = useRef()
  const manualRef = useRef('')
  const onCompleteRef = useRef(onComplete)
  const onCloseRef    = useRef(onClose)
  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadQuagga().then(initQuagga).catch(() => {})
    }, 350)
    return () => {
      clearTimeout(timer)
      pararQuagga()
    }
  }, [])

  function initQuagga() {
    if (!videoRef.current) return
    quaggaVivo.current = true
    window.Quagga.init({
      inputStream: {
        type: 'LiveStream',
        target: videoRef.current,
        constraints: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'environment',
        },
        area: { top: '25%', right: '5%', left: '5%', bottom: '25%' },
      },
      decoder: {
        readers: ['code_128_reader', 'ean_reader', 'ean_8_reader', 'upc_reader'],
        multiple: false,
      },
      locate: true,
      numOfWorkers: 2,
      frequency: 15,
      halfSample: true,
    }, err => {
      if (err) { quaggaVivo.current = false; return }
      window.Quagga.start()
      window.Quagga.onDetected(onDetected)
    })
  }

  function pararQuagga() {
    if (quaggaVivo.current) {
      try {
        window.Quagga.offDetected(onDetected)
        window.Quagga.stop()
      } catch (_) {}
      quaggaVivo.current = false
    }
  }

  function onDetected(result) {
    if (locked.current) return
    const code = result?.codeResult?.code?.trim() || ''
    const c    = result?.codeResult?.startInfo?.error ?? 0
    const conf = c === 0 ? 1 : Math.max(0, 1 - c)
    if (!code || code.length < 6) return
    if (conf < MIN_C) return

    setReading(code)
    setConf(Math.round(conf * 100))

    detBuf.current.push(code)
    if (detBuf.current.length > REQ * 2) detBuf.current.shift()

    const ultimos = detBuf.current.slice(-REQ)
    if (ultimos.length === REQ && ultimos.every(v => v === ultimos[0])) {
      confirmar(code)
    }
  }

  function confirmar(code) {
    if (locked.current) return
    locked.current = true

    const paso = PASOS[pasoActual.current]
    valoresAcum.current = { ...valoresAcum.current, [paso.key]: code }

    setFlash(true)
    setTimeout(() => setFlash(false), 600)

    const siguiente = pasoActual.current + 1
    detBuf.current = []
    locked.current = false

    if (siguiente < PASOS.length) {
      pasoActual.current = siguiente
      setPasoUI(siguiente)
      setManual('')
      manualRef.current = ''
      setConf(0)
      setReading('–')
    } else {
      pararQuagga()
      onCompleteRef.current({ ...valoresAcum.current })
    }
  }

  function saltar() {
    const siguiente = pasoActual.current + 1
    detBuf.current = []
    locked.current = false

    setSaltados(s => ({ ...s, [PASOS[pasoActual.current].key]: true }))

    if (siguiente < PASOS.length) {
      pasoActual.current = siguiente
      setPasoUI(siguiente)
      setManual('')
      manualRef.current = ''
      setConf(0)
      setReading('–')
    } else {
      pararQuagga()
      onCompleteRef.current({ ...valoresAcum.current })
    }
  }

  function usarManual() {
    const clean = manualRef.current.trim()
    if (clean.length >= 6) confirmar(clean)
  }

  function cerrar() {
    pararQuagga()
    onCloseRef.current()
  }

  const paso = PASOS[pasoUI]
  const progreso = ((pasoUI) / PASOS.length) * 100

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: flash ? 'rgba(16,185,129,0.18)' : 'rgba(0,0,0,0.95)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 0, padding: 0,
      transition: 'background .15s',
      fontFamily: "'DM Sans', system-ui",
    }}>

      {/* Header */}
      <div style={{
        width: '100%', maxWidth: 460, display: 'flex',
        alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px 8px',
      }}>
        <div>
          <div style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>
            Paso {pasoUI + 1} de {PASOS.length} — {paso.label}
          </div>
          <div style={{ color: '#8aabcc', fontSize: 12, marginTop: 2 }}>{paso.hint}</div>
        </div>
        <button onClick={cerrar} style={{
          background: 'transparent', border: 'none', color: '#4a6a8a',
          fontSize: 22, cursor: 'pointer', lineHeight: 1,
        }}>×</button>
      </div>

      {/* Barra de progreso */}
      <div style={{ width: '100%', maxWidth: 460, padding: '0 20px 10px' }}>
        <div style={{ height: 3, background: '#1a2f52', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 2,
            width: `${progreso}%`,
            background: 'linear-gradient(90deg,#0066ff,#00c6ff)',
            transition: 'width .4s ease',
          }} />
        </div>
        {/* Indicadores de pasos */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          {PASOS.map((p, i) => (
            <div key={p.key} style={{
              fontSize: 10, fontWeight: 600, letterSpacing: '.04em',
              color: i < pasoUI ? '#10b981' : i === pasoUI ? '#0066ff' : '#2a3f5a',
            }}>
              {i < pasoUI ? '✓ ' : ''}{p.label}
            </div>
          ))}
        </div>
      </div>

      {/* Visor cámara */}
      <div style={{
        position: 'relative', width: '100%', maxWidth: 460,
        borderRadius: 12, overflow: 'hidden',
        border: flash ? '2px solid #10b981' : '2px solid #1a2f52',
        transition: 'border-color .15s',
        background: '#000',
      }}>
        <div
          ref={videoRef}
          style={{ width: '100%', aspectRatio: '16/9', background: '#000', display: 'block' }}
        />
        {/* Guía de escaneo */}
        <div style={{
          position: 'absolute', top: '50%', left: '10%', right: '10%',
          transform: 'translateY(-50%)', height: 2,
          background: flash ? 'rgba(16,185,129,0.8)' : 'rgba(0,102,255,0.6)',
          boxShadow: flash ? '0 0 12px #10b981' : '0 0 8px rgba(0,102,255,0.8)',
          transition: 'all .15s',
        }} />
        {/* Esquinas */}
        {[
          { top: '20%', left: '5%',  borderTop: '3px solid #0066ff', borderLeft: '3px solid #0066ff' },
          { top: '20%', right: '5%', borderTop: '3px solid #0066ff', borderRight: '3px solid #0066ff' },
          { bottom: '20%', left: '5%',  borderBottom: '3px solid #0066ff', borderLeft: '3px solid #0066ff' },
          { bottom: '20%', right: '5%', borderBottom: '3px solid #0066ff', borderRight: '3px solid #0066ff' },
        ].map((style, i) => (
          <div key={i} style={{ position: 'absolute', width: 20, height: 20, ...style }} />
        ))}

        {/* Lectura actual */}
        {reading !== '–' && (
          <div style={{
            position: 'absolute', bottom: 8, left: 8, right: 8,
            background: 'rgba(0,0,0,0.75)', borderRadius: 6,
            padding: '4px 10px', textAlign: 'center',
            color: conf > 85 ? '#10b981' : '#f59e0b',
            fontSize: 12, fontFamily: 'monospace', letterSpacing: 1,
          }}>
            {reading} <span style={{ fontSize: 10, opacity: .7 }}>({conf}%)</span>
          </div>
        )}

        {/* Flash confirmado */}
        {flash && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(16,185,129,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ fontSize: 48 }}>✅</div>
          </div>
        )}
      </div>

      {/* Manual */}
      <div style={{ width: '100%', maxWidth: 460, padding: '12px 20px 0' }}>
        <div style={{ color: '#5a7aaa', fontSize: 11, textAlign: 'center', marginBottom: 6 }}>
          O ingresa manualmente:
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            style={{
              flex: 1, background: '#0a1628', border: '1px solid #1a2f52', borderRadius: 8,
              padding: '10px 12px', color: '#fff', fontSize: 14, letterSpacing: 1,
              outline: 'none', textAlign: 'center',
            }}
            placeholder={`Ingresa ${paso.label}...`}
            value={manual}
            onChange={e => { setManual(e.target.value); manualRef.current = e.target.value }}
            onKeyDown={e => e.key === 'Enter' && usarManual()}
          />
          <button onClick={usarManual}
            disabled={manual.trim().length < 6}
            style={{
              padding: '10px 16px', border: 'none', borderRadius: 8,
              color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: manual.trim().length >= 6
                ? 'linear-gradient(135deg,#0066ff,#0044bb)' : '#1e3058',
            }}>
            Usar →
          </button>
        </div>
      </div>

      {/* Acciones */}
      <div style={{
        width: '100%', maxWidth: 460, padding: '10px 20px 20px',
        display: 'flex', gap: 10,
      }}>
        <button onClick={cerrar} style={{
          flex: 1, padding: '10px 0', background: 'transparent',
          border: '1px solid #1a2f52', borderRadius: 8,
          color: '#5a7aaa', fontSize: 13, cursor: 'pointer',
        }}>Cancelar</button>
        <button onClick={saltar} style={{
          flex: 1, padding: '10px 0', background: '#0d1a35',
          border: '1px solid #1a2f52', borderRadius: 8,
          color: '#8aabcc', fontSize: 13, cursor: 'pointer',
        }}>
          Saltar {paso.label} →
        </button>
      </div>

      {/* Resumen de lo capturado */}
      {Object.values(valoresAcum.current).some(v => v) && (
        <div style={{
          width: '100%', maxWidth: 460, margin: '0 0 12px',
          padding: '8px 20px', display: 'flex', gap: 12, flexWrap: 'wrap',
        }}>
          {PASOS.map((p, i) => {
            const val = valoresAcum.current[p.key]
            const salt = saltados[p.key]
            if (i >= pasoUI) return null
            return (
              <div key={p.key} style={{ fontSize: 11, color: salt ? '#4a6a8a' : '#10b981' }}>
                <span style={{ opacity: .6 }}>{p.label}: </span>
                <span style={{ fontFamily: 'monospace' }}>{salt ? '(saltado)' : val}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
