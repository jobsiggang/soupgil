// Web Bluetooth API를 사용해 ESP32 비콘 감지
// 실제 환경에서는 비콘 UUID/MAC 필터와 신호 강도(RSSI) 판별 추가 필요

export class BeaconScanner {
  constructor() {
    this.isScanning = false
    this.detectedBeacons = new Map()
    this.listeners = new Set()
  }

  addListener(callback) {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  notifyListeners(beacon) {
    this.listeners.forEach((cb) => cb(beacon))
  }

  // 비콘 ID를 체크포인트 ID와 매핑
  // 형식: "ESP32-GD-031" → checkpoint ID
  beaconToCheckpoint(beaconId) {
    // 실제 구현에서는 데이터베이스 조회 또는 설정 객체 사용
    const beaconMap = {
      'ESP32-START-001': 'poi-start',
      'ESP32-GD-031': 'poi-0000032799',
      'ESP32-FINISH-001': 'poi-finish',
    }
    return beaconMap[beaconId] || null
  }

  async startScanning() {
    // 지원하지 않는 브라우저 체크
    if (!navigator.bluetooth) {
      throw new Error('이 브라우저는 Web Bluetooth API를 지원하지 않습니다.')
    }

    if (this.isScanning) {
      return
    }

    this.isScanning = true
    this.detectedBeacons.clear()

    try {
      // 사용자가 기기를 선택하도록 요청
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['battery_service'],
      })

      device.addEventListener('advertisementreceived', (event) => {
        const beaconId = this.extractBeaconId(event)
        
        if (beaconId) {
          const beacon = {
            id: beaconId,
            checkpointId: this.beaconToCheckpoint(beaconId),
            rssi: event.rssi,
            txPower: event.txPower,
            detectedAt: new Date(),
            uuids: event.uuids,
            name: event.device.name,
          }

          this.detectedBeacons.set(beaconId, beacon)
          this.notifyListeners(beacon)
        }
      })

      // 광고 수신 시작
      await device.watchAdvertisements()
    } catch (error) {
      this.isScanning = false
      throw error
    }
  }

  extractBeaconId(event) {
    // 광고 이름에서 비콘 ID 추출
    // 예: 디바이스 이름이 "ESP32-GD-031"이면 그 이름 자체를 ID로 사용
    if (event.device.name && event.device.name.startsWith('ESP32-')) {
      return event.device.name
    }

    // 또는 UUID/매뉴팩처 데이터에서 파싱 가능
    // 실제 구현에서는 애플리케이션별 포맷 정의 필요
    return null
  }

  stopScanning() {
    this.isScanning = false
    this.detectedBeacons.clear()
  }

  getDetectedBeacons() {
    return Array.from(this.detectedBeacons.values())
  }
}

// 싱글톤 인스턴스
let scannerInstance = null

export function getBeaconScanner() {
  if (!scannerInstance) {
    scannerInstance = new BeaconScanner()
  }
  return scannerInstance
}
