import { useEffect, useRef, useState } from 'react'
import { loadKakaoMaps } from '../lib/loadKakaoMaps'

function getMapCenter(checkpoint) {
  return {
    lat: checkpoint?.lat ?? 35.10531,
    lng: checkpoint?.lng ?? 129.03202,
  }
}

export default function MapPanel({ checkpoints, selectedCheckpoint, apiPreview }) {
  const mapRef = useRef(null)
  const [errorMessage, setErrorMessage] = useState('')

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

        new kakao.maps.Polyline({
          map,
          path: linePath,
          strokeWeight: 5,
          strokeColor: '#0f766e',
          strokeOpacity: 0.8,
          strokeStyle: 'solid',
        })

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
  }, [checkpoints, selectedCheckpoint])

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
          <span className="meta-label">API 미리보기</span>
          <strong>{previewItem?.placeName ?? '아직 조회 안 함'}</strong>
        </div>
      </div>
    </section>
  )
}
