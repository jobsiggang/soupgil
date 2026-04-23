import { useEffect, useState } from 'react'
import { getBeaconScanner } from '../services/beaconScanner'

export default function BeaconDetector({ onCheckpointDetected, isEnabled, compact = false }) {
  const [scanStatus, setScanStatus] = useState('idle') // idle | scanning | error
  const [errorMessage, setErrorMessage] = useState('')
  const [detectedList, setDetectedList] = useState([])
  const [isSupported, setIsSupported] = useState(true)

  useEffect(() => {
    // Web Bluetooth 지원 여부 확인
    setIsSupported(!!navigator.bluetooth)
  }, [])

  async function startBeaconScan() {
    const scanner = getBeaconScanner()
    setErrorMessage('')

    try {
      setScanStatus('scanning')
      
      const removeListener = scanner.addListener((beacon) => {
        setDetectedList((prev) => {
          const existing = prev.find((b) => b.id === beacon.id)
          if (existing) {
            return prev.map((b) =>
              b.id === beacon.id ? { ...b, detectedAt: beacon.detectedAt } : b,
            )
          }
          return [...prev, beacon]
        })

        // 체크포인트와 매칭되면 콜백 호출
        if (beacon.checkpointId) {
          onCheckpointDetected(beacon.checkpointId, beacon)
        }
      })

      await scanner.startScanning()

      return () => {
        removeListener()
      }
    } catch (error) {
      setScanStatus('error')
      setErrorMessage(error.message)
    }
  }

  function stopBeaconScan() {
    const scanner = getBeaconScanner()
    scanner.stopScanning()
    setScanStatus('idle')
    setDetectedList([])
  }

  return (
    <section className={`beacon-detector ${compact ? 'compact' : ''}`}>
      <div className="beacon-header">
        <h3>🔵 비콘 감지</h3>
        <span className={`beacon-status ${scanStatus}`}>
          {scanStatus === 'idle' && '대기'}
          {scanStatus === 'scanning' && '스캔 중...'}
          {scanStatus === 'error' && '오류'}
        </span>
      </div>

      {!isSupported ? (
        <div className="beacon-warning">
          <p>⚠️ 이 브라우저는 Web Bluetooth API를 지원하지 않습니다.</p>
          <p>지원하는 브라우저: Chrome, Edge, Opera (최신 버전)</p>
        </div>
      ) : (
        <>
          <div className="beacon-controls">
            {scanStatus === 'idle' ? (
              <button
                type="button"
                className="beacon-button"
                onClick={startBeaconScan}
                disabled={!isEnabled}
              >
                스캔 시작
              </button>
            ) : (
              <button
                type="button"
                className="beacon-button stop"
                onClick={stopBeaconScan}
              >
                스캔 중지
              </button>
            )}
          </div>

          {errorMessage && (
            <div className="beacon-error">
              <p>{errorMessage}</p>
            </div>
          )}

          {detectedList.length > 0 && (
            <div className="beacon-list">
              <p className="beacon-hint">감지된 비콘:</p>
              <ul>
                {(compact ? detectedList.slice(-3) : detectedList).map((beacon) => (
                  <li key={beacon.id}>
                    <strong>{beacon.id}</strong>
                    <span className="beacon-rssi">
                      신호: {beacon.rssi ?? 'N/A'} dBm
                    </span>
                    {beacon.checkpointId ? (
                      <span className="beacon-matched">✓ 매칭됨</span>
                    ) : (
                      <span className="beacon-unmatched">미등록</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  )
}
