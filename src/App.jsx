import { useEffect, useMemo, useState, useTransition } from 'react'
import './App.css'
import MapPanel from './components/MapPanel'
import StampBoard from './components/StampBoard'
import BeaconDetector from './components/BeaconDetector'
import { initialStampedIds, trailCourse } from './data/trails'
import { fetchPoiPreview } from './services/poiService'
import { fetchAllSectionPois, TRAIL_SECTIONS } from './services/poiCache'
import {
  completeSection,
  fetchNavigationRoute,
  getUserProgress,
  recordStamp,
  registerUser,
} from './services/apiClient'
import { selectRouteByThreshold, getRouteDescription } from './data/sectionRoutes'

function mapPoiToCheckpoint(section, item) {
  return {
    id: `poi-${item.poiId}`,
    poiId: item.poiId,
    title: item.name,
    lat: item.lat,
    lng: item.lng,
    section: section.name,
    note: item.description || '설명 정보 없음',
    beaconId: `ESP32-${item.poiId}`,
    directionHints: item.destinations ?? [],
  }
}

function App() {
  const [stampedIds, setStampedIds] = useState(initialStampedIds)
  const [selectedCheckpoint, setSelectedCheckpoint] = useState(
    trailCourse.checkpoints[0],
  )
  const [apiPreview, setApiPreview] = useState(null)
  const [apiError, setApiError] = useState('')
  const [isFetchingPreview, setIsFetchingPreview] = useState(false)
  const [isPending, startTransition] = useTransition()

  const [currentUser, setCurrentUser] = useState(null)
  const [userProgress, setUserProgress] = useState(null)
  const [backendError, setBackendError] = useState('')

  const [poiBySection, setPoiBySection] = useState({})
  const [isLoadingPois, setIsLoadingPois] = useState(false)
  const [navigationPath, setNavigationPath] = useState([])
  const [navigationInfo, setNavigationInfo] = useState(null)
  const [selectedSectionId, setSelectedSectionId] = useState(null)

  const dynamicCheckpoints = useMemo(() => {
    const flattened = TRAIL_SECTIONS.flatMap((section) => {
      const items = poiBySection[section.id]?.items ?? []
      return items.map((item) => mapPoiToCheckpoint(section, item))
    }).filter((checkpoint) => checkpoint.lat && checkpoint.lng)

    return flattened
  }, [poiBySection])

  const checkpoints =
    dynamicCheckpoints.length > 0 ? dynamicCheckpoints : trailCourse.checkpoints

  useEffect(() => {
    if (!selectedCheckpoint || !checkpoints.some((it) => it.id === selectedCheckpoint.id)) {
      setSelectedCheckpoint(checkpoints[0] ?? null)
    }
  }, [checkpoints, selectedCheckpoint])

  useEffect(() => {
    async function initialize() {
      let userId = localStorage.getItem('trailUserId')

      if (!userId) {
        userId = `user-${Date.now()}`
        localStorage.setItem('trailUserId', userId)
      }

      try {
        const userRes = await registerUser(userId)
        setCurrentUser(userRes.user)

        const progressRes = await getUserProgress(userId)
        setUserProgress(progressRes)
      } catch (error) {
        setBackendError(error.message)
      }

      await loadAllPois()
    }

    initialize()
  }, [])

  async function loadAllPois() {
    setIsLoadingPois(true)

    try {
      const serviceKey = import.meta.env.VITE_PUBLIC_DATA_SERVICE_KEY
      const allPois = await fetchAllSectionPois({
        serviceKey,
        trailName: trailCourse.name,
        sections: TRAIL_SECTIONS,
      })
      setPoiBySection(allPois)
    } catch (error) {
      console.warn('POI 로드 실패:', error)
    } finally {
      setIsLoadingPois(false)
    }
  }

  const completedCount = stampedIds.length
  const progressRate = Math.round((completedCount / checkpoints.length) * 100)
  const remainingCount = checkpoints.length - completedCount

  const nextCheckpoint = useMemo(
    () => checkpoints.find((checkpoint) => !stampedIds.includes(checkpoint.id)) ?? null,
    [checkpoints, stampedIds],
  )

  useEffect(() => {
    async function loadNavigationPath() {
      if (!selectedCheckpoint || !nextCheckpoint || selectedCheckpoint.id === nextCheckpoint.id) {
        setNavigationPath([])
        setNavigationInfo(null)
        setSelectedSectionId(null)
        return
      }

      try {
        // 다음 체크포인트의 section을 기반으로 구간 ID 결정
        // 또는 selectedCheckpoint의 section 사용
        let sectionId = null
        if (nextCheckpoint.section) {
          const matchingSection = TRAIL_SECTIONS.find((s) => s.name === nextCheckpoint.section)
          sectionId = matchingSection?.id ?? null
        }

        const kakaoRoute = await fetchNavigationRoute({
          originLat: selectedCheckpoint.lat,
          originLng: selectedCheckpoint.lng,
          destLat: nextCheckpoint.lat,
          destLng: nextCheckpoint.lng,
        })

        // 거리 임계값과 구간별 고정 경로 규칙을 적용하여 최적 경로 선택
        const selectedRoute = selectRouteByThreshold({
          originLat: selectedCheckpoint.lat,
          originLng: selectedCheckpoint.lng,
          destLat: nextCheckpoint.lat,
          destLng: nextCheckpoint.lng,
          sectionId,
          kakaoPath: kakaoRoute.path ?? [],
          kakaoDistance: kakaoRoute.summary?.distanceMeter ?? null,
        })

        setNavigationPath(selectedRoute.path)
        setNavigationInfo({
          ...kakaoRoute.summary,
          source: selectedRoute.source,
          detourRatio: selectedRoute.detourRatio,
          distanceMeters: selectedRoute.distanceMeters,
          description: getRouteDescription(selectedRoute),
        })
        setSelectedSectionId(sectionId)
      } catch (error) {
        setNavigationPath([])
        setNavigationInfo(null)
        setSelectedSectionId(null)
      }
    }

    loadNavigationPath()
  }, [selectedCheckpoint, nextCheckpoint])

  async function handlePreviewLoad() {
    const serviceKey = import.meta.env.VITE_PUBLIC_DATA_SERVICE_KEY

    setApiError('')
    setIsFetchingPreview(true)

    try {
      const preview = await fetchPoiPreview({
        serviceKey,
        trailName: trailCourse.name,
      })

      startTransition(() => {
        setApiPreview(preview)
      })
    } catch (error) {
      setApiError(error.message)
    } finally {
      setIsFetchingPreview(false)
    }
  }

  function updateSectionCompletion(checkpointId) {
    if (!currentUser?.userId) {
      return
    }

    const checkpoint = checkpoints.find((item) => item.id === checkpointId)
    if (!checkpoint?.section) {
      return
    }

    const sectionPoints = checkpoints.filter((item) => item.section === checkpoint.section)
    const sectionComplete = sectionPoints.every((item) =>
      item.id === checkpointId ? true : stampedIds.includes(item.id),
    )

    if (sectionComplete) {
      completeSection(currentUser.userId, checkpoint.section).catch((error) => {
        console.warn('구간 완주 기록 실패:', error)
      })
    }
  }

  function handleStamp(checkpointId, beaconData = null) {
    setStampedIds((current) => {
      if (current.includes(checkpointId)) {
        return current
      }
      return [...current, checkpointId]
    })

    if (currentUser?.userId) {
      recordStamp(currentUser.userId, checkpointId, beaconData ?? {}).catch((error) => {
        console.warn('스탬프 기록 실패:', error)
      })

      getUserProgress(currentUser.userId)
        .then((progressRes) => setUserProgress(progressRes))
        .catch(() => {})
    }

    updateSectionCompletion(checkpointId)
  }

  function handleBeaconDetected(checkpointId, beaconData) {
    handleStamp(checkpointId, {
      beaconId: beaconData.id,
      lat: selectedCheckpoint?.lat,
      lng: selectedCheckpoint?.lng,
    })
  }

  return (
    <main className="app-shell">
      <section className="hero-panel panel">
        <div className="hero-copy">
          <p className="eyebrow">EASYGO TRAIL PASS</p>
          <h1>{trailCourse.theme}</h1>
          <p className="hero-description">{trailCourse.description}</p>

          <div className="hero-actions">
            <button
              type="button"
              className="primary-button"
              onClick={handlePreviewLoad}
              disabled={isFetchingPreview}
            >
              {isFetchingPreview ? 'POI 조회 중...' : '공공데이터 POI 불러오기'}
            </button>
            <span className="subtle-text">
              키가 없으면 API 호출은 건너뛰고 샘플 체크포인트가 표시됩니다.
            </span>
          </div>
        </div>

        <div className="hero-stats">
          <article>
            <span>완료율</span>
            <strong>{progressRate}%</strong>
          </article>
          <article>
            <span>남은 인증</span>
            <strong>{remainingCount}개</strong>
          </article>
          <article>
            <span>로드된 POI</span>
            <strong>{checkpoints.length.toLocaleString()}개</strong>
          </article>
          <article>
            <span>구간 진행</span>
            <strong>
              {userProgress?.completedSections?.length ?? 0}/{TRAIL_SECTIONS.length}
            </strong>
          </article>
        </div>
      </section>

      <section className="overview-grid">
        <MapPanel
          checkpoints={checkpoints}
          selectedCheckpoint={selectedCheckpoint}
          apiPreview={apiPreview}
          nextCheckpoint={nextCheckpoint}
          navigationPath={navigationPath}
          navigationInfo={navigationInfo}
        />

        <section className="panel progress-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">진행 현황</p>
              <h2>{trailCourse.name}</h2>
            </div>
            <span className="status-chip">도장깨기 모드</span>
          </div>

          <div className="progress-bar" aria-hidden="true">
            <div style={{ width: `${progressRate}%` }} />
          </div>

          <div className="progress-summary">
            <article>
              <span>다음 체크포인트</span>
              <strong>{nextCheckpoint?.title ?? '모든 인증 완료'}</strong>
            </article>
            <article>
              <span>선택 지점</span>
              <strong>{selectedCheckpoint?.title ?? '-'}</strong>
            </article>
          </div>

          <div className="preview-card">
            <h3>공공데이터 응답 스냅샷</h3>
            <p>
              {apiPreview?.items?.[0]?.description ??
                '아직 API를 호출하지 않았습니다. 환경 변수 설정 후 버튼을 눌러 실제 표지판 데이터를 확인하세요.'}
            </p>
            {apiPreview?.items?.[0] ? (
              <dl className="preview-meta">
                <div>
                  <dt>POI ID</dt>
                  <dd>{apiPreview.items[0].poiId}</dd>
                </div>
                <div>
                  <dt>목적지</dt>
                  <dd>
                    {[
                      apiPreview.items[0].destination1,
                      apiPreview.items[0].destination2,
                      apiPreview.items[0].destination3,
                    ]
                      .filter(Boolean)
                      .join(' / ') || '정보 없음'}
                  </dd>
                </div>
              </dl>
            ) : null}
            {apiError ? <p className="error-text">{apiError}</p> : null}
            {isPending ? (
              <p className="subtle-text">응답 UI를 반영하는 중입니다.</p>
            ) : null}
          </div>
        </section>
      </section>

      <StampBoard
        checkpoints={checkpoints}
        stampedIds={stampedIds}
        selectedCheckpointId={selectedCheckpoint?.id}
        onSelect={setSelectedCheckpoint}
        onStamp={handleStamp}
      />

      <section className="panel beacon-detector">
        <BeaconDetector onCheckpointDetected={handleBeaconDetected} isEnabled={!!currentUser} />
      </section>

      <section className="panel user-section">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">사용자 정보</p>
            <h2>계정</h2>
          </div>
          <span className="status-chip">{currentUser ? '연결됨' : '대기 중'}</span>
        </div>

        {currentUser ? (
          <div className="user-info">
            <article>
              <span>사용자명</span>
              <strong>{currentUser.nickname}</strong>
            </article>
            <article>
              <span>등록일</span>
              <strong>{new Date(currentUser.createdAt).toLocaleDateString('ko-KR')}</strong>
            </article>
            <article>
              <span>완주 구간</span>
              <strong>
                {userProgress?.completedSections?.length ?? 0}/{TRAIL_SECTIONS.length}
              </strong>
            </article>
            <article>
              <span>누적 스탬프</span>
              <strong>{userProgress?.totalStamps ?? stampedIds.length}</strong>
            </article>
          </div>
        ) : (
          <p>사용자 등록 중...</p>
        )}

        {backendError ? <p className="error-text">백엔드 동기화 오류: {backendError}</p> : null}
        {isLoadingPois ? <p className="subtle-text">POI 데이터 로드 중...</p> : null}
        {Object.keys(poiBySection).length > 0 ? (
          <p className="subtle-text">
            {Object.keys(poiBySection).length}개 구간, 총{' '}
            {Object.values(poiBySection).reduce(
              (sum, sec) => sum + (sec.items?.length ?? 0),
              0,
            )}
            개 POI 로드됨
          </p>
        ) : null}
      </section>
    </main>
  )
}

export default App
