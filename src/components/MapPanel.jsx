import { useEffect, useRef, useState } from 'react'
import { loadKakaoMaps } from '../lib/loadKakaoMaps'

function getCenter(selectedRoutePath, liveLocation) {
  if (liveLocation) {
    return liveLocation
  }

  if (selectedRoutePath?.length) {
    return selectedRoutePath[Math.floor(selectedRoutePath.length / 2)]
  }

  return { lat: 36.54, lng: 126.33 }
}

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
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const appKey = import.meta.env.VITE_KAKAO_MAP_APP_KEY

    if (!appKey) {
      setErrorMessage('카카오맵 키가 없어서 지도를 렌더링하지 못했습니다.')
      return
    }

    if (!mapRef.current || !sections.length) {
      return
    }

    let isDisposed = false

    loadKakaoMaps(appKey)
      .then((kakao) => {
        if (isDisposed) {
          return
        }

        const center = getCenter(selectedRoutePath, liveLocation)
        const map = new kakao.maps.Map(mapRef.current, {
          center: new kakao.maps.LatLng(center.lat, center.lng),
          level: 8,
        })

        const bounds = new kakao.maps.LatLngBounds()

        sections.forEach((section) => {
          const routePath = routesMap[section.id]?.detailedPath ?? []
          if (routePath.length < 2) {
            return
          }

          const polylinePath = routePath.map((point) => {
            const latLng = new kakao.maps.LatLng(point.lat, point.lng)
            bounds.extend(latLng)
            return latLng
          })

          new kakao.maps.Polyline({
            map,
            path: polylinePath,
            strokeWeight: section.id === selectedSectionId ? 7 : 3,
            strokeColor: section.id === selectedSectionId ? '#0f766e' : '#94a3b8',
            strokeOpacity: section.id === selectedSectionId ? 0.95 : 0.45,
            strokeStyle: 'solid',
          })

          const goalMarker = new kakao.maps.Marker({
            map,
            position: new kakao.maps.LatLng(section.endPoint.lat, section.endPoint.lng),
            title: section.name,
          })

          kakao.maps.event.addListener(goalMarker, 'click', () => {
            onSelectSection(section.id)
          })
        })

        if (walkingPath?.length > 1) {
          const walkingPolylinePath = walkingPath.map((point) => {
            const latLng = new kakao.maps.LatLng(point.lat, point.lng)
            bounds.extend(latLng)
            return latLng
          })

          new kakao.maps.Polyline({
            map,
            path: walkingPolylinePath,
            strokeWeight: 5,
            strokeColor: '#f97316',
            strokeOpacity: 0.9,
            strokeStyle: 'dash',
          })
        }

        if (liveLocation) {
          const liveMarkerPosition = new kakao.maps.LatLng(liveLocation.lat, liveLocation.lng)
          bounds.extend(liveMarkerPosition)
          new kakao.maps.Marker({
            map,
            position: liveMarkerPosition,
            title: '현재 위치',
          })
        }

        if (!bounds.isEmpty()) {
          map.setBounds(bounds)
        }
      })
      .catch((error) => {
        if (!isDisposed) {
          setErrorMessage(error.message)
        }
      })

    return () => {
      isDisposed = true
    }
  }, [liveLocation, onSelectSection, routesMap, sections, selectedRoutePath, selectedSectionId, walkingPath])

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
