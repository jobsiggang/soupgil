import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import './App.css'
import MapPanel from './components/MapPanel'
import StampBoard from './components/StampBoard'
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

function parseFiniteNumber(value, fallback) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function parsePositiveInt(value, fallback) {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : fallback
}

const CHECKIN_RADIUS_METER = parsePositiveInt(import.meta.env.VITE_CHECKIN_RADIUS_METER, 80)
const BASE_CHECKPOINT_SCORE = parsePositiveInt(import.meta.env.VITE_BASE_CHECKPOINT_SCORE, 100)
const AUTO_CHECKIN_INTERVAL_MS = parsePositiveInt(import.meta.env.VITE_AUTO_CHECKIN_INTERVAL_MS, 6000)
const AUTO_CHECKIN_DEFAULT_ENABLED = import.meta.env.VITE_AUTO_CHECKIN_DEFAULT === 'true'
const UNYANG_TEST_CENTER = {
  lat: parseFiniteNumber(import.meta.env.VITE_UNYANG_TEST_LAT, 35.56746),
  lng: parseFiniteNumber(import.meta.env.VITE_UNYANG_TEST_LNG, 129.12597),
}

function toRadians(value) {
  return (value * Math.PI) / 180
}

function getDistanceMeter(from, to) {
  const earthRadiusMeter = 6371000
  const latDiff = toRadians(to.lat - from.lat)
  const lngDiff = toRadians(to.lng - from.lng)
  const fromLat = toRadians(from.lat)
  const toLat = toRadians(to.lat)

  const halfChord =
    Math.sin(latDiff / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lngDiff / 2) ** 2

  return 2 * earthRadiusMeter * Math.atan2(Math.sqrt(halfChord), Math.sqrt(1 - halfChord))
}

function resolveDifficulty(checkpoint) {
  if (checkpoint.difficulty) {
    return checkpoint.difficulty
  }

  const altitude = Number.isFinite(checkpoint.altitude) ? checkpoint.altitude : 0
  const directionCount = checkpoint.directionHints?.length ?? 0

  if (altitude >= 120 || directionCount >= 3) {
    return 'hard'
  }
  if (altitude >= 60 || directionCount >= 2) {
    return 'medium'
  }
  return 'easy'
}

function getCheckpointScore(checkpoint, baseScore) {
  const difficulty = resolveDifficulty(checkpoint)
  const altitude = Number.isFinite(checkpoint.altitude) ? checkpoint.altitude : 0

  const multiplier =
    difficulty === 'hard' ? 1.5 : difficulty === 'medium' ? 1.25 : 1

  const altitudeBonus = altitude >= 200 ? 40 : altitude >= 120 ? 25 : altitude >= 60 ? 10 : 0

  return Math.round(baseScore * multiplier + altitudeBonus)
}

function buildSchoolTestCheckpoints(center, label = '울산 언양고등학교') {
  const candidates = [
    {
      id: 'test-unyang-main-gate',
      title: `${label} 정문`,
      note: '등교 동선 테스트 지점입니다.',
      offsetLat: 0.00018,
      offsetLng: -0.00012,
      altitude: 42,
      difficulty: 'easy',
      directionHints: ['정문', '운동장 방향'],
    },
    {
      id: 'test-unyang-track',
      title: `${label} 운동장`,
      note: '운동장 중앙 위치 체크 테스트 지점입니다.',
      offsetLat: -0.00008,
      offsetLng: 0.00015,
      altitude: 58,
      difficulty: 'medium',
      directionHints: ['체육관 방면', '본관 방면'],
    },
    {
      id: 'test-unyang-back-yard',
      title: `${label} 후문`,
      note: '후문/골목 방향 이동 시 테스트 지점입니다.',
      offsetLat: -0.00019,
      offsetLng: -0.00009,
      altitude: 76,
      difficulty: 'hard',
      directionHints: ['후문', '주택가 방향', '우회 동선'],
    },
  ]

  return candidates.map((point, index) => ({
    ...point,
    poiId: `TEST-${index + 1}`,
    section: `${label} 테스트`,
    lat: center.lat + point.offsetLat,
    lng: center.lng + point.offsetLng,
    type: 'TEST',
  }))
}

function mapPoiToCheckpoint(section, item) {
  return {
    id: `poi-${item.poiId}`,
    poiId: item.poiId,
    title: item.name,
    lat: item.lat,
    lng: item.lng,
    section: section.name,
    note: item.description || '설명 정보 없음',
    directionHints: item.destinations ?? [],
    difficulty: 'medium',
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

  const [isCheckingLocation, setIsCheckingLocation] = useState(false)
  const [checkInMessage, setCheckInMessage] = useState('')
  const [checkInError, setCheckInError] = useState('')
  const [autoCheckInEnabled, setAutoCheckInEnabled] = useState(
    AUTO_CHECKIN_DEFAULT_ENABLED,
  )
  const [liveLocation, setLiveLocation] = useState(null)

  const [isTestMenuOpen, setIsTestMenuOpen] = useState(false)
  const [isTestMode, setIsTestMode] = useState(false)
  const [testCheckpoints, setTestCheckpoints] = useState(() =>
    buildSchoolTestCheckpoints(UNYANG_TEST_CENTER),
  )
  const [isBuildingNearbyTest, setIsBuildingNearbyTest] = useState(false)

  const autoCheckThrottleRef = useRef({
    at: 0,
    key: '',
  })

  const dynamicCheckpoints = useMemo(() => {
    const flattened = TRAIL_SECTIONS.flatMap((section) => {
      const items = poiBySection[section.id]?.items ?? []
      return items.map((item) => mapPoiToCheckpoint(section, item))
    }).filter((checkpoint) => checkpoint.lat && checkpoint.lng)

    return flattened
  }, [poiBySection])

  const checkpoints = useMemo(() => {
    if (isTestMode) {
      return testCheckpoints
    }
    if (dynamicCheckpoints.length > 0) {
      return dynamicCheckpoints
    }
    return trailCourse.checkpoints
  }, [dynamicCheckpoints, isTestMode, testCheckpoints])

  const checkpointScoreMap = useMemo(() => {
    return checkpoints.reduce((acc, checkpoint) => {
      acc[checkpoint.id] = getCheckpointScore(checkpoint, BASE_CHECKPOINT_SCORE)
      return acc
    }, {})
  }, [checkpoints])

  useEffect(() => {
    if (!selectedCheckpoint || !checkpoints.some((it) => it.id === selectedCheckpoint.id)) {
      setSelectedCheckpoint(checkpoints[0] ?? null)
    }
  }, [checkpoints, selectedCheckpoint])

  useEffect(() => {
    setStampedIds((current) =>
      current.filter((checkpointId) => checkpoints.some((cp) => cp.id === checkpointId)),
    )
  }, [checkpoints])

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

  useEffect(() => {
    if (!autoCheckInEnabled) {
      return undefined
    }

    if (!navigator.geolocation) {
      setCheckInError('이 브라우저는 위치 추적을 지원하지 않습니다.')
      return undefined
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLiveLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
      },
      (error) => {
        setCheckInError(`실시간 위치 추적 실패: ${error.message}`)
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 12000,
      },
    )

    return () => {
      navigator.geolocation.clearWatch(watchId)
    }
  }, [autoCheckInEnabled])

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
  const progressRate = checkpoints.length
    ? Math.round((completedCount / checkpoints.length) * 100)
    : 0
  const remainingCount = Math.max(checkpoints.length - completedCount, 0)
  const totalScore = stampedIds.reduce(
    (sum, checkpointId) => sum + (checkpointScoreMap[checkpointId] ?? BASE_CHECKPOINT_SCORE),
    0,
  )

  const nextCheckpoint = useMemo(
    () => checkpoints.find((checkpoint) => !stampedIds.includes(checkpoint.id)) ?? null,
    [checkpoints, stampedIds],
  )

  useEffect(() => {
    async function loadNavigationPath() {
      if (!selectedCheckpoint || !nextCheckpoint || selectedCheckpoint.id === nextCheckpoint.id) {
        setNavigationPath([])
        setNavigationInfo(null)
        return
      }

      try {
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
      } catch (error) {
        setNavigationPath([])
        setNavigationInfo(null)
      }
    }

    loadNavigationPath()
  }, [selectedCheckpoint, nextCheckpoint])

  useEffect(() => {
    if (!autoCheckInEnabled || !liveLocation || !checkpoints.length) {
      return
    }

    const now = Date.now()
    const fingerprint = `${liveLocation.lat.toFixed(5)}:${liveLocation.lng.toFixed(5)}:${stampedIds.length}`

    if (
      autoCheckThrottleRef.current.key === fingerprint &&
      now - autoCheckThrottleRef.current.at < AUTO_CHECKIN_INTERVAL_MS
    ) {
      return
    }

    autoCheckThrottleRef.current = {
      at: now,
      key: fingerprint,
    }

    applyLocationCheckIn(liveLocation, {
      source: 'gps-auto',
      silentMiss: true,
    })
  }, [autoCheckInEnabled, liveLocation, checkpoints, stampedIds])

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

  function updateSectionCompletion(checkpointId, stampedSnapshot = stampedIds) {
    if (!currentUser?.userId) {
      return
    }

    const checkpoint = checkpoints.find((item) => item.id === checkpointId)
    if (!checkpoint?.section) {
      return
    }

    const sectionPoints = checkpoints.filter((item) => item.section === checkpoint.section)
    const sectionComplete = sectionPoints.every((item) => stampedSnapshot.includes(item.id))

    if (sectionComplete) {
      completeSection(currentUser.userId, checkpoint.section).catch((error) => {
        console.warn('구간 완주 기록 실패:', error)
      })
    }
  }

  function persistStamp(checkpoint, locationData = {}, source = 'gps-manual') {
    if (!currentUser?.userId) {
      return
    }

    const score = checkpointScoreMap[checkpoint.id] ?? BASE_CHECKPOINT_SCORE

    recordStamp(currentUser.userId, checkpoint.id, {
      lat: locationData.lat,
      lng: locationData.lng,
      source,
      distanceMeter: locationData.distanceMeter,
      score,
      difficulty: resolveDifficulty(checkpoint),
      altitude: checkpoint.altitude ?? null,
    }).catch((error) => {
      console.warn('스탬프 기록 실패:', error)
    })

    getUserProgress(currentUser.userId)
      .then((progressRes) => setUserProgress(progressRes))
      .catch(() => {})
  }

  async function getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('이 브라우저는 위치 정보를 지원하지 않습니다.'))
        return
      }

      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 12000,
      })
    })
  }

  function applyLocationCheckIn(currentLocation, options = {}) {
    const { source = 'gps-manual', silentMiss = false } = options

    const unstamped = checkpoints.filter((checkpoint) => !stampedIds.includes(checkpoint.id))
    if (!unstamped.length) {
      if (!silentMiss) {
        setCheckInMessage('모든 체크포인트를 이미 획득했습니다.')
      }
      return
    }

    const withDistance = unstamped.map((checkpoint) => ({
      checkpoint,
      distanceMeter: getDistanceMeter(currentLocation, checkpoint),
    }))

    const nearby = withDistance.filter((item) => item.distanceMeter <= CHECKIN_RADIUS_METER)

    if (!nearby.length) {
      if (!silentMiss) {
        const nearest = [...withDistance].sort((a, b) => a.distanceMeter - b.distanceMeter)[0]
        setCheckInMessage(
          `획득 실패: 가장 가까운 지점(${nearest.checkpoint.title})까지 ${Math.round(nearest.distanceMeter)}m 남았습니다.`,
        )
      }
      return
    }

    const earnedIds = nearby.map((item) => item.checkpoint.id)
    const updatedStampedIds = Array.from(new Set([...stampedIds, ...earnedIds]))

    setStampedIds(updatedStampedIds)

    let earnedScore = 0

    nearby.forEach((item) => {
      const score = checkpointScoreMap[item.checkpoint.id] ?? BASE_CHECKPOINT_SCORE
      earnedScore += score

      persistStamp(
        item.checkpoint,
        {
          lat: currentLocation.lat,
          lng: currentLocation.lng,
          distanceMeter: Math.round(item.distanceMeter),
        },
        source,
      )
      updateSectionCompletion(item.checkpoint.id, updatedStampedIds)
    })

    setCheckInMessage(
      `${nearby.length}개 지점 도착 인증 완료! +${earnedScore.toLocaleString()}점 획득 (${CHECKIN_RADIUS_METER}m 반경)`,
    )
  }

  async function handleLocationCheckIn() {
    if (!checkpoints.length) {
      return
    }

    setCheckInMessage('')
    setCheckInError('')
    setIsCheckingLocation(true)

    try {
      const position = await getCurrentPosition()
      const currentLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      }

      setLiveLocation(currentLocation)
      applyLocationCheckIn(currentLocation, { source: 'gps-manual', silentMiss: false })
    } catch (error) {
      setCheckInError(error?.message || '위치 확인 중 오류가 발생했습니다.')
    } finally {
      setIsCheckingLocation(false)
    }
  }

  async function handleBuildNearbyTestCourse() {
    setIsBuildingNearbyTest(true)
    setCheckInError('')

    try {
      const position = await getCurrentPosition()
      const center = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      }
      const generated = buildSchoolTestCheckpoints(center, '현위치 테스트 캠퍼스')
      setTestCheckpoints(generated)
      setIsTestMode(true)
      setStampedIds([])
      setSelectedCheckpoint(generated[0])
      setCheckInMessage('현위치 기반 테스트 코스를 생성했습니다.')
    } catch (error) {
      setCheckInError(error?.message || '현위치 테스트 코스 생성에 실패했습니다.')
    } finally {
      setIsBuildingNearbyTest(false)
    }
  }

  function handleEnableUnyangTestCourse() {
    const generated = buildSchoolTestCheckpoints(UNYANG_TEST_CENTER)
    setTestCheckpoints(generated)
    setIsTestMode(true)
    setStampedIds([])
    setSelectedCheckpoint(generated[0])
    setCheckInMessage('울산 언양고등학교 테스트 코스를 활성화했습니다.')
  }

  function handleDisableTestCourse() {
    setIsTestMode(false)
    setCheckInMessage('테스트 코스를 종료하고 기본 트레일로 돌아왔습니다.')
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
            <button
              type="button"
              className="primary-button secondary"
              onClick={() => setIsTestMenuOpen((prev) => !prev)}
            >
              {isTestMenuOpen ? '테스트 메뉴 닫기' : '테스트 메뉴 열기'}
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
            <span>누적 점수</span>
            <strong>{(userProgress?.totalScore ?? totalScore).toLocaleString()}점</strong>
          </article>
          <article>
            <span>기본 점수</span>
            <strong>{BASE_CHECKPOINT_SCORE}점</strong>
          </article>
          <article>
            <span>획득 반경</span>
            <strong>{CHECKIN_RADIUS_METER}m</strong>
          </article>
          <article>
            <span>구간 진행</span>
            <strong>
              {userProgress?.completedSections?.length ?? 0}/{TRAIL_SECTIONS.length}
            </strong>
          </article>
        </div>
      </section>

      {isTestMenuOpen ? (
        <section className="panel test-menu-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">테스트 메뉴</p>
              <h2>울산 언양고등학교 테스트</h2>
            </div>
            <span className="status-chip">{isTestMode ? '테스트 코스 활성' : '테스트 코스 비활성'}</span>
          </div>

          <div className="test-menu-actions">
            <button type="button" className="primary-button" onClick={handleEnableUnyangTestCourse}>
              언양고 테스트 코스 활성화
            </button>
            <button
              type="button"
              className="primary-button secondary"
              onClick={handleBuildNearbyTestCourse}
              disabled={isBuildingNearbyTest}
            >
              {isBuildingNearbyTest ? '현위치 테스트 생성 중...' : '현위치 기반 테스트 코스 생성'}
            </button>
            <button
              type="button"
              className="primary-button secondary"
              onClick={handleDisableTestCourse}
              disabled={!isTestMode}
            >
              테스트 코스 종료
            </button>
          </div>

          <p className="subtle-text">
            언양고 좌표 중심 테스트 코스가 기본 제공됩니다. 학교 안에서 자동 획득 모드를 켜면 버튼 없이 점수를 획득할 수 있습니다.
          </p>
        </section>
      ) : null}

      <section className="overview-grid">
        <MapPanel
          checkpoints={checkpoints}
          selectedCheckpoint={selectedCheckpoint}
          apiPreview={apiPreview}
          nextCheckpoint={nextCheckpoint}
          navigationPath={navigationPath}
          navigationInfo={navigationInfo}
          onLocationCheckIn={handleLocationCheckIn}
          isCheckingLocation={isCheckingLocation}
          autoCheckInEnabled={autoCheckInEnabled}
          onToggleAutoCheckIn={() => setAutoCheckInEnabled((prev) => !prev)}
          liveLocation={liveLocation}
        />

        <section className="panel progress-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">진행 현황</p>
              <h2>{isTestMode ? '언양고 테스트 코스' : trailCourse.name}</h2>
            </div>
            <span className="status-chip">{autoCheckInEnabled ? '자동 획득 ON' : '자동 획득 OFF'}</span>
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
            <article>
              <span>위치 인증 반경</span>
              <strong>{CHECKIN_RADIUS_METER}m</strong>
            </article>
            <article>
              <span>자동 획득 주기</span>
              <strong>{Math.round(AUTO_CHECKIN_INTERVAL_MS / 1000)}초</strong>
            </article>
          </div>

          {checkInMessage ? <p className="subtle-text">{checkInMessage}</p> : null}
          {checkInError ? <p className="error-text">{checkInError}</p> : null}

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
        scoreByCheckpoint={checkpointScoreMap}
        radiusMeter={CHECKIN_RADIUS_METER}
      />

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
            <article>
              <span>누적 점수</span>
              <strong>{(userProgress?.totalScore ?? totalScore).toLocaleString()}점</strong>
            </article>
          </div>
        ) : (
          <p>사용자 등록 중...</p>
        )}

        {backendError ? <p className="error-text">백엔드 동기화 오류: {backendError}</p> : null}
        {isLoadingPois ? <p className="subtle-text">POI 데이터 로드 중...</p> : null}
        {Object.keys(poiBySection).length > 0 && !isTestMode ? (
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
