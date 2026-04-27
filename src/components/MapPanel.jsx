import { useEffect, useRef, useState, useCallback } from 'react'
import { loadKakaoMaps } from '../lib/loadKakaoMaps'

export default function MapPanel({
  sections,
  selectedSectionId,
  onSelectSection,
  routesMap,
  selectedRoutePath,
  liveLocation,
  walkingPath,
  walkingInfo,
  walkingError,
  onRefreshLocation,
  isRefreshingLocation,
  distanceToGoal,
  isArrived,
}) {
  const mapRef = useRef(null)
  const kakaoRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const polylinesRef = useRef([])
  const markersRef = useRef([])
  const walkingPolylineRef = useRef(null)
  const liveMarkerRef = useRef(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [isSatellite, setIsSatellite] = useState(false)

  // Initialize map once
  useEffect(() => {
    const appKey = import.meta.env.VITE_KAKAO_MAP_APP_KEY
    if (!appKey) {
      setErrorMessage('카카오맵 키가 없어서 지도를 렌더링하지 못했습니다.')
      return
    }
    if (!mapRef.current) return

    loadKakaoMaps(appKey)
      .then((kakao) => {
        kakaoRef.current = kakao
        const map = new kakao.maps.Map(mapRef.current, {
          center: new kakao.maps.LatLng(36.54, 126.33),
          level: 9,
        })
        mapInstanceRef.current = map
      })
      .catch((error) => setErrorMessage(error.message))
  }, [])

  // Redraw all section polylines + markers when sections/routesMap/selectedSectionId changes
  useEffect(() => {
    const kakao = kakaoRef.current
    const map = mapInstanceRef.current
    if (!kakao || !map || !sections.length) return

    // Remove old polylines & markers
    polylinesRef.current.forEach((p) => p.setMap(null))
    markersRef.current.forEach((m) => m.setMap(null))
    polylinesRef.current = []
    markersRef.current = []

    const allBounds = new kakao.maps.LatLngBounds()
    const selectedBounds = new kakao.maps.LatLngBounds()

    sections.forEach((section) => {
      const routePath = routesMap[section.id]?.detailedPath ?? []
      if (routePath.length < 2) return

      const isSelected = section.id === selectedSectionId
      const polylinePath = routePath.map((point) => {
        const latLng = new kakao.maps.LatLng(point.lat, point.lng)
        allBounds.extend(latLng)
        if (isSelected) selectedBounds.extend(latLng)
        return latLng
      })

      const polyline = new kakao.maps.Polyline({
        map,
        path: polylinePath,
        strokeWeight: isSelected ? 7 : 3,
        strokeColor: isSelected ? '#0f766e' : '#94a3b8',
        strokeOpacity: isSelected ? 0.95 : 0.45,
        strokeStyle: 'solid',
      })
      polylinesRef.current.push(polyline)

      const goalMarker = new kakao.maps.Marker({
        map,
        position: new kakao.maps.LatLng(section.endPoint.lat, section.endPoint.lng),
        title: section.name,
      })
      kakao.maps.event.addListener(goalMarker, 'click', () => onSelectSection(section.id))
      markersRef.current.push(goalMarker)
    })

    // Zoom to selected section, otherwise show all
    if (selectedSectionId && !selectedBounds.isEmpty()) {
      map.setBounds(selectedBounds, 80)
    } else if (!allBounds.isEmpty()) {
      map.setBounds(allBounds)
    }
  }, [sections, routesMap, selectedSectionId, onSelectSection])

  // Update walking path overlay
  useEffect(() => {
    const kakao = kakaoRef.current
    const map = mapInstanceRef.current
    if (!kakao || !map) return

    if (walkingPolylineRef.current) {
      walkingPolylineRef.current.setMap(null)
      walkingPolylineRef.current = null
    }

    if (walkingPath?.length > 1) {
      walkingPolylineRef.current = new kakao.maps.Polyline({
        map,
        path: walkingPath.map((p) => new kakao.maps.LatLng(p.lat, p.lng)),
        strokeWeight: 5,
        strokeColor: '#f97316',
        strokeOpacity: 0.9,
        strokeStyle: 'dash',
      })
    }
  }, [walkingPath])

  // Update live location marker
  useEffect(() => {
    const kakao = kakaoRef.current
    const map = mapInstanceRef.current
    if (!kakao || !map) return

    if (liveMarkerRef.current) {
      liveMarkerRef.current.setMap(null)
      liveMarkerRef.current = null
    }

    if (liveLocation) {
      liveMarkerRef.current = new kakao.maps.Marker({
        map,
        position: new kakao.maps.LatLng(liveLocation.lat, liveLocation.lng),
        title: '현재 위치',
      })
    }
  }, [liveLocation])

  // Toggle satellite/hybrid map type
  const toggleSatellite = useCallback(() => {
    const kakao = kakaoRef.current
    const map = mapInstanceRef.current
    if (!kakao || !map) return

    setIsSatellite((prev) => {
      const next = !prev
      if (next) {
        map.addOverlayMapTypeId(kakao.maps.MapTypeId.HYBRID)
      } else {
        map.removeOverlayMapTypeId(kakao.maps.MapTypeId.HYBRID)
      }
      return next
    })
  }, [])

  return (
    <section className="panel map-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">라이브 지도</p>
          <h2>동서트레일 전체구간</h2>
        </div>
        <span className="status-chip">{isArrived ? '도착 반경 진입' : '이동 중'}</span>
      </div>

      <div className="map-shell">
        <div ref={mapRef} className="map-canvas" />
        {errorMessage ? (
          <div className="map-fallback">
            <strong>지도 대기 중</strong>
            <p>{errorMessage}</p>
          </div>
        ) : null}
      </div>

      <div className="map-meta">
        <div>
          <span className="meta-label">선택 구간</span>
          <strong>{sections.find((section) => section.id === selectedSectionId)?.name ?? '-'}</strong>
        </div>
        <div>
          <span className="meta-label">도착지 거리</span>
          <strong>{distanceToGoal === null ? '위치 대기' : `${Math.round(distanceToGoal)}m`}</strong>
        </div>
        <div>
          <span className="meta-label">도보 경로</span>
          <strong>
            {walkingInfo ? `${(walkingInfo.distanceMeter / 1000).toFixed(1)}km / ${Math.round(walkingInfo.durationSecond / 60)}분` : '대기 중'}
          </strong>
        </div>
        <div>
          <span className="meta-label">현재 위치</span>
          <strong>
            {liveLocation ? `${liveLocation.lat.toFixed(5)}, ${liveLocation.lng.toFixed(5)}` : '위치 수신 전'}
          </strong>
        </div>
      </div>

      <div className="map-actions">
        <button type="button" className="stamp-button" onClick={onRefreshLocation} disabled={isRefreshingLocation}>
          {isRefreshingLocation ? '위치 갱신 중...' : '현재 위치 갱신'}
        </button>
        <button type="button" className={`stamp-button${isSatellite ? ' active' : ''}`} onClick={toggleSatellite}>
          {isSatellite ? '일반 지도' : '위성 사진'}
        </button>
      </div>

      <div className="section-chip-list">
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            className={`section-chip ${section.id === selectedSectionId ? 'active' : ''}`}
            onClick={() => onSelectSection(section.id)}
          >
            {section.number}구간
          </button>
        ))}
      </div>

      {walkingError ? <p className="subtle-text">{walkingError}</p> : null}
    </section>
  )
}
