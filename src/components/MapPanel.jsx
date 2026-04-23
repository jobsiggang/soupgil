import { useEffect, useRef, useState } from 'react'
import { loadKakaoMaps } from '../lib/loadKakaoMaps'
import BeaconDetector from './BeaconDetector'

function getMapCenter(checkpoint) {
  return {
    lat: checkpoint?.lat ?? 35.10531,
    lng: checkpoint?.lng ?? 129.03202,
  }
}

export default function MapPanel({
  checkpoints,
  selectedCheckpoint,
  apiPreview,
  nextCheckpoint,
  navigationPath,
  navigationInfo,
  onBeaconDetected,
  isBeaconEnabled,
}) {
  const mapRef = useRef(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [routeError, setRouteError] = useState('')
  const [showBeaconPanel, setShowBeaconPanel] = useState(false)

  useEffect(() => {
    const appKey = import.meta.env.VITE_KAKAO_MAP_APP_KEY

    if (!appKey) {
      setErrorMessage('카카오맵 키가 없어서 지도를 렌더링하지 못했습니다.')
      return
    }

    if (!mapRef.current) {
      return
    }

    let isDisposed = false

    loadKakaoMaps(appKey)
      .then((kakao) => {
        if (isDisposed) {
          return
        }

        const center = getMapCenter(selectedCheckpoint)
        const map = new kakao.maps.Map(mapRef.current, {
          center: new kakao.maps.LatLng(center.lat, center.lng),
          level: 9,
        })

        const linePath = checkpoints.map(
          (checkpoint) => new kakao.maps.LatLng(checkpoint.lat, checkpoint.lng),
        )

        const fallbackPolyline = new kakao.maps.Polyline({
          map,
          path: linePath,
          strokeWeight: 5,
          strokeColor: '#94a3b8',
          strokeOpacity: 0.5,
          strokeStyle: 'shortdash',
        })

        if (navigationPath?.length > 1) {
          const routePath = navigationPath.map(
            (point) => new kakao.maps.LatLng(point.lat, point.lng),
          )

          // 경로 소스에 따라 색상과 스타일 결정
          let strokeColor = '#0f766e' // 기본: Kakao (검정-초록)
          let strokeWeight = 6
          let strokeOpacity = 0.95

          if (navigationInfo?.source === 'gpx') {
            strokeColor = '#2563eb' // 파란색: 등산로(고정)
          } else if (navigationInfo?.source === 'cardinal') {
            strokeColor = '#64748b' // 회색: 직선
            strokeOpacity = 0.6
          }

          new kakao.maps.Polyline({
            map,
            path: routePath,
            strokeWeight,
            strokeColor,
            strokeOpacity,
            strokeStyle: 'solid',
          })
          fallbackPolyline.setMap(null)
          setRouteError('')
        } else {
          setRouteError('내비 경로를 불러오지 못해 직선 경로로 표시합니다.')
        }

        checkpoints.forEach((checkpoint) => {
          const marker = new kakao.maps.Marker({
            position: new kakao.maps.LatLng(checkpoint.lat, checkpoint.lng),
            map,
          })

          if (checkpoint.id === selectedCheckpoint?.id) {
            const overlay = new kakao.maps.CustomOverlay({
              position: marker.getPosition(),
              content: `<div style="padding:8px 10px;background:#111827;color:#f8fafc;border-radius:10px;font-size:12px;font-weight:700;box-shadow:0 10px 30px rgba(15,23,42,0.25);">${checkpoint.title}</div>`,
              yAnchor: 2,
            })
            overlay.setMap(map)
          }
        })
      })
      .catch((error) => {
        if (!isDisposed) {
          setErrorMessage(error.message)
        }
      })

    return () => {
      isDisposed = true
    }
  }, [checkpoints, navigationPath, selectedCheckpoint])

  function openKakaoDirection() {
    if (!selectedCheckpoint || !nextCheckpoint) {
      return
    }

    const fromName = encodeURIComponent(selectedCheckpoint.title)
    const toName = encodeURIComponent(nextCheckpoint.title)
    const url = `https://map.kakao.com/link/from/${fromName},${selectedCheckpoint.lat},${selectedCheckpoint.lng}/to/${toName},${nextCheckpoint.lat},${nextCheckpoint.lng}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const previewItem = apiPreview?.items?.[0]

  return (
    <section className="panel map-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">라이브 지도</p>
          <h2>카카오맵 구간 뷰</h2>
        </div>
        <span className="status-chip">
          {selectedCheckpoint ? `${selectedCheckpoint.section}` : '선택 없음'}
        </span>
      </div>

      <div className="map-shell">
        <div ref={mapRef} className="map-canvas" />
        {errorMessage ? (
          <div className="map-fallback">
            <strong>지도 대기 중</strong>
            <p>{errorMessage}</p>
            <p>`.env`에 `VITE_KAKAO_MAP_APP_KEY`를 추가하면 실제 지도가 표시됩니다.</p>
          </div>
        ) : null}
      </div>

      <div className="map-meta">
        <div>
          <span className="meta-label">선택 좌표</span>
          <strong>
            {selectedCheckpoint
              ? `${selectedCheckpoint.lat.toFixed(6)}, ${selectedCheckpoint.lng.toFixed(6)}`
              : '-'}
          </strong>
        </div>
        <div>
          <span className="meta-label">경로 정보</span>
          {navigationInfo?.description ? (
            <strong>{navigationInfo.description}</strong>
          ) : (
            <strong>경로 없음</strong>
          )}
        </div>
        <div>
          <span className="meta-label">API 미리보기</span>
          <strong>{previewItem?.placeName ?? '아직 조회 안 함'}</strong>
        </div>
      </div>

      <div className="map-actions">
        <button
          type="button"
          className="stamp-button"
          onClick={() => setShowBeaconPanel((prev) => !prev)}
        >
          {showBeaconPanel ? '비콘 스캔 닫기' : '비콘 스캔 열기'}
        </button>
        <button type="button" className="stamp-button" onClick={openKakaoDirection}>
          카카오맵 길찾기 열기
        </button>
      </div>

      {navigationInfo ? (
        <p className="subtle-text">
          경로 길이 {(navigationInfo.distanceMeter / 1000).toFixed(1)}km, 예상 시간{' '}
          {Math.round(navigationInfo.durationSecond / 60)}분
        </p>
      ) : null}
      {routeError ? <p className="subtle-text">{routeError}</p> : null}

      {showBeaconPanel ? (
        <section className="beacon-inline">
          <BeaconDetector
            onCheckpointDetected={onBeaconDetected}
            isEnabled={isBeaconEnabled}
            compact
          />
        </section>
      ) : null}
    </section>
  )
}
