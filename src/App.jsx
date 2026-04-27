import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import MapPanel from './components/MapPanel'
import {
  completeSection,
  createSectionReview,
  fetchNavigationRoute,
  fetchSectionReviews,
  getUserProgress,
  recordStamp,
  registerUser,
} from './services/apiClient'
import { loadDongseoTrailData } from './services/gpxLoader'

function parsePositiveInt(value, fallback) {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : fallback
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

const CHECKIN_RADIUS_METER = parsePositiveInt(import.meta.env.VITE_CHECKIN_RADIUS_METER, 80)
const REVIEW_CERT_DWELL_MS = parsePositiveInt(import.meta.env.VITE_REVIEW_CERT_DWELL_MS, 30000)
const WALKING_ROUTE_REFRESH_MS = parsePositiveInt(import.meta.env.VITE_WALKING_REFRESH_MS, 20000)

export default function App() {
  const [trailData, setTrailData] = useState({ sections: [], routesMap: {}, summary: null })
  const [selectedSectionId, setSelectedSectionId] = useState(null)

  const [currentUser, setCurrentUser] = useState(null)
  const [userProgress, setUserProgress] = useState(null)
  const [backendError, setBackendError] = useState('')

  const [liveLocation, setLiveLocation] = useState(null)
  const [locationError, setLocationError] = useState('')
  const [isRefreshingLocation, setIsRefreshingLocation] = useState(false)

  const [walkingPath, setWalkingPath] = useState([])
  const [walkingInfo, setWalkingInfo] = useState(null)
  const [walkingError, setWalkingError] = useState('')

  const [sectionReviews, setSectionReviews] = useState([])
  const [isLoadingReviews, setIsLoadingReviews] = useState(false)
  const [reviewContent, setReviewContent] = useState('')
  const [reviewCourseNote, setReviewCourseNote] = useState('')
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewImageData, setReviewImageData] = useState('')
  const [reviewMessage, setReviewMessage] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)

  const [arrivalStartedAt, setArrivalStartedAt] = useState(null)
  const [dwellElapsedMs, setDwellElapsedMs] = useState(0)

  const walkingRouteThrottleRef = useRef({
    at: 0,
    lat: 0,
    lng: 0,
    sectionId: '',
  })

  const sections = trailData.sections
  const routesMap = trailData.routesMap

  const selectedSection = useMemo(
    () => sections.find((section) => section.id === selectedSectionId) ?? null,
    [sections, selectedSectionId],
  )

  const selectedRoutePath = useMemo(
    () => routesMap[selectedSectionId]?.detailedPath ?? [],
    [routesMap, selectedSectionId],
  )

  const completedSectionIds = useMemo(
    () => new Set((userProgress?.completedSections ?? []).map((item) => item.sectionId)),
    [userProgress],
  )

  const distanceToGoal = useMemo(() => {
    if (!liveLocation || !selectedSection?.endPoint) {
      return null
    }

    return getDistanceMeter(liveLocation, selectedSection.endPoint)
  }, [liveLocation, selectedSection])

  const isArrived = distanceToGoal !== null && distanceToGoal <= CHECKIN_RADIUS_METER
  const isDwellSatisfied = dwellElapsedMs >= REVIEW_CERT_DWELL_MS
  const isSelectedSectionCompleted = selectedSectionId
    ? completedSectionIds.has(selectedSectionId)
    : false

  useEffect(() => {
    let isCancelled = false

    async function initialize() {
      try {
        const trail = await loadDongseoTrailData()

        if (isCancelled) {
          return
        }

        setTrailData(trail)
        setSelectedSectionId(trail.sections[0]?.id ?? null)

        const userId = localStorage.getItem('trailUserId') || `user-${Date.now()}`

        if (!localStorage.getItem('trailUserId')) {
          localStorage.setItem('trailUserId', userId)
        }

        try {
          const [userRes, progressRes] = await Promise.all([
            registerUser(userId),
            getUserProgress(userId).catch(() => null),
          ])

          if (isCancelled) {
            return
          }

          setCurrentUser(userRes.user)
          setUserProgress(progressRes)
          setBackendError('')
        } catch (error) {
          if (!isCancelled) {
            setBackendError(error.message)
          }
        }
      } catch (error) {
        if (!isCancelled) {
          setBackendError(error.message)
        }
      }
    }

    initialize()

    return () => {
      isCancelled = true
    }
  }, [])

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('이 브라우저는 위치 추적을 지원하지 않습니다.')
      return undefined
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLiveLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
        setLocationError('')
      },
      (error) => {
        setLocationError(`실시간 위치 추적 실패: ${error.message}`)
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
  }, [])

  useEffect(() => {
    if (!selectedSectionId) {
      return
    }

    let isCancelled = false

    async function loadReviews() {
      setIsLoadingReviews(true)
      setReviewError('')

      try {
        const response = await fetchSectionReviews(selectedSectionId)
        if (!isCancelled) {
          setSectionReviews(response.reviews ?? [])
        }
      } catch (error) {
        if (!isCancelled) {
          setReviewError(error.message)
          setSectionReviews([])
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingReviews(false)
        }
      }
    }

    loadReviews()

    return () => {
      isCancelled = true
    }
  }, [selectedSectionId])

  useEffect(() => {
    if (!isArrived) {
      setArrivalStartedAt(null)
      setDwellElapsedMs(0)
      return
    }

    setArrivalStartedAt((current) => current ?? Date.now())
  }, [isArrived, selectedSectionId])

  useEffect(() => {
    if (!arrivalStartedAt) {
      return undefined
    }

    const timerId = window.setInterval(() => {
      setDwellElapsedMs(Date.now() - arrivalStartedAt)
    }, 1000)

    return () => window.clearInterval(timerId)
  }, [arrivalStartedAt])

  useEffect(() => {
    async function loadWalkingRoute() {
      if (!liveLocation || !selectedSection?.endPoint) {
        setWalkingPath([])
        setWalkingInfo(null)
        setWalkingError('')
        return
      }

      const movedMeter = getDistanceMeter(liveLocation, {
        lat: walkingRouteThrottleRef.current.lat,
        lng: walkingRouteThrottleRef.current.lng,
      })
      const now = Date.now()
      const sameTarget = walkingRouteThrottleRef.current.sectionId === selectedSection.id

      if (
        sameTarget &&
        now - walkingRouteThrottleRef.current.at < WALKING_ROUTE_REFRESH_MS &&
        movedMeter < 20
      ) {
        return
      }

      walkingRouteThrottleRef.current = {
        at: now,
        lat: liveLocation.lat,
        lng: liveLocation.lng,
        sectionId: selectedSection.id,
      }

      try {
        const route = await fetchNavigationRoute({
          originLat: liveLocation.lat,
          originLng: liveLocation.lng,
          destLat: selectedSection.endPoint.lat,
          destLng: selectedSection.endPoint.lng,
        })

        setWalkingPath(route.path ?? [])
        setWalkingInfo(route.summary ?? null)
        setWalkingError('')
      } catch (error) {
        setWalkingPath([])
        setWalkingInfo(null)
        setWalkingError('도보 경로를 불러오지 못했습니다.')
      }
    }

    loadWalkingRoute()
  }, [liveLocation, selectedSection])

  async function refreshProgress() {
    if (!currentUser?.userId) {
      return
    }

    try {
      const progressRes = await getUserProgress(currentUser.userId)
      setUserProgress(progressRes)
    } catch {
      // no-op
    }
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

  async function handleRefreshLocation() {
    setIsRefreshingLocation(true)
    setLocationError('')

    try {
      const position = await getCurrentPosition()
      setLiveLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      })
    } catch (error) {
      setLocationError(error.message)
    } finally {
      setIsRefreshingLocation(false)
    }
  }

  function handleReviewImageChange(event) {
    const file = event.target.files?.[0]
    if (!file) {
      setReviewImageData('')
      return
    }

    if (!file.type.startsWith('image/')) {
      setReviewError('이미지 파일만 업로드할 수 있습니다.')
      return
    }

    if (file.size > 1024 * 1024 * 2) {
      setReviewError('이미지 용량은 2MB 이하만 지원합니다.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setReviewError('')
      setReviewImageData(String(reader.result || ''))
    }
    reader.onerror = () => {
      setReviewError('이미지 파일을 읽는 중 오류가 발생했습니다.')
    }
    reader.readAsDataURL(file)
  }

  async function handleSubmitReview(event) {
    event.preventDefault()

    if (!selectedSection || !currentUser?.userId) {
      return
    }

    setReviewError('')
    setReviewMessage('')
    setIsSubmittingReview(true)

    try {
      const response = await createSectionReview(selectedSection.id, {
        userId: currentUser.userId,
        nickname: currentUser.nickname,
        checkpointId: `goal-${selectedSection.id}`,
        rating: reviewRating,
        content: reviewContent,
        courseNote: reviewCourseNote,
        images: reviewImageData ? [reviewImageData] : [],
        lat: liveLocation?.lat,
        lng: liveLocation?.lng,
      })

      setSectionReviews((current) => [response.review, ...current])

      if (isArrived && isDwellSatisfied && !isSelectedSectionCompleted) {
        await Promise.all([
          completeSection(currentUser.userId, selectedSection.id),
          recordStamp(currentUser.userId, `goal-${selectedSection.id}`, {
            lat: liveLocation?.lat,
            lng: liveLocation?.lng,
            source: 'review-certification',
            distanceMeter: distanceToGoal ? Math.round(distanceToGoal) : 0,
            score: 100,
            difficulty: 'medium',
            altitude: null,
          }),
        ])

        await refreshProgress()
        setReviewMessage('후기 등록과 함께 인증을 획득했습니다.')
      } else if (!isArrived) {
        setReviewMessage(`후기는 등록됐지만 인증은 도착 반경 ${CHECKIN_RADIUS_METER}m 이내에서만 가능합니다.`)
      } else if (!isDwellSatisfied) {
        setReviewMessage(`후기는 등록됐지만 인증은 ${Math.floor(REVIEW_CERT_DWELL_MS / 1000)}초 체류 후 가능합니다.`)
      } else {
        setReviewMessage('후기를 등록했습니다. 이 구간은 이미 인증 완료 상태입니다.')
      }

      setReviewContent('')
      setReviewCourseNote('')
      setReviewRating(5)
      setReviewImageData('')
    } catch (error) {
      setReviewError(error.message)
    } finally {
      setIsSubmittingReview(false)
    }
  }

  const totalDistanceKm = trailData.summary
    ? (trailData.summary.totalDistanceMeter / 1000).toFixed(1)
    : '-'

  return (
    <main className="app-shell">
      <section className="hero-panel panel">
        <div className="hero-copy">
          <p className="eyebrow">DONGSEO TRAIL</p>
          <h1>1~12, 47~55 전체구간</h1>
          <p className="hero-description">
            제공된 GPX 전체 경로만 사용해 구성한 동서트레일 전용 화면입니다. 각 구간을 선택하면
            구간 경로, 도착 정보, 후기, 실시간 도보 경로만 확인할 수 있습니다.
          </p>
          <div className="hero-actions">
            <button
              type="button"
              className="primary-button"
              onClick={handleRefreshLocation}
              disabled={isRefreshingLocation}
            >
              {isRefreshingLocation ? '위치 갱신 중...' : '현재 위치 새로고침'}
            </button>
            <span className="subtle-text">
              인증 조건: 반경 {CHECKIN_RADIUS_METER}m 도착 + {Math.floor(REVIEW_CERT_DWELL_MS / 1000)}초 체류 + 후기 작성
            </span>
          </div>
        </div>

        <div className="hero-stats">
          <article>
            <span>총 구간</span>
            <strong>{sections.length || '-'}개</strong>
          </article>
          <article>
            <span>완료 구간</span>
            <strong>{completedSectionIds.size}개</strong>
          </article>
          <article>
            <span>총 거리</span>
            <strong>{totalDistanceKm}km</strong>
          </article>
          <article>
            <span>선택 구간</span>
            <strong>{selectedSection?.name ?? '불러오는 중'}</strong>
          </article>
        </div>
      </section>

      <section className="overview-grid">
        <MapPanel
          sections={sections}
          selectedSectionId={selectedSectionId}
          onSelectSection={setSelectedSectionId}
          routesMap={routesMap}
          selectedRoutePath={selectedRoutePath}
          liveLocation={liveLocation}
          walkingPath={walkingPath}
          walkingInfo={walkingInfo}
          walkingError={walkingError}
          onRefreshLocation={handleRefreshLocation}
          isRefreshingLocation={isRefreshingLocation}
          distanceToGoal={distanceToGoal}
          isArrived={isArrived}
        />

        <section className="panel progress-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">구간 상세</p>
              <h2>{selectedSection?.name ?? '구간 로드 중'}</h2>
            </div>
            <span className="status-chip">
              {isSelectedSectionCompleted ? '인증 완료' : '인증 대기'}
            </span>
          </div>

          {selectedSection ? (
            <>
              <div className="progress-summary">
                <article>
                  <span>구간 거리</span>
                  <strong>{(selectedSection.distanceMeters / 1000).toFixed(1)}km</strong>
                </article>
                <article>
                  <span>도착 지점 거리</span>
                  <strong>
                    {distanceToGoal === null ? '위치 대기' : `${Math.round(distanceToGoal)}m`}
                  </strong>
                </article>
                <article>
                  <span>체류 시간</span>
                  <strong>
                    {Math.floor(dwellElapsedMs / 1000)}초 / {Math.floor(REVIEW_CERT_DWELL_MS / 1000)}초
                  </strong>
                </article>
                <article>
                  <span>도착 상태</span>
                  <strong>{isArrived ? '도착 반경 진입' : `반경 ${CHECKIN_RADIUS_METER}m 필요`}</strong>
                </article>
              </div>

              <div className="preview-card section-info-card">
                <h3>구간 정보</h3>
                <p>{selectedSection.description}</p>
                <dl className="preview-meta">
                  <div>
                    <dt>시작 좌표</dt>
                    <dd>
                      {selectedSection.startPoint.lat.toFixed(5)}, {selectedSection.startPoint.lng.toFixed(5)}
                    </dd>
                  </div>
                  <div>
                    <dt>종료 좌표</dt>
                    <dd>
                      {selectedSection.endPoint.lat.toFixed(5)}, {selectedSection.endPoint.lng.toFixed(5)}
                    </dd>
                  </div>
                </dl>
              </div>
            </>
          ) : null}

          <div className="preview-card section-review-card">
            <h3>구간 후기</h3>
            <form className="review-form" onSubmit={handleSubmitReview}>
              <label>
                별점
                <select value={reviewRating} onChange={(event) => setReviewRating(Number(event.target.value))}>
                  <option value={5}>5점</option>
                  <option value={4}>4점</option>
                  <option value={3}>3점</option>
                  <option value={2}>2점</option>
                  <option value={1}>1점</option>
                </select>
              </label>
              <label>
                후기
                <textarea
                  value={reviewContent}
                  onChange={(event) => setReviewContent(event.target.value)}
                  placeholder="구간 상태, 난이도, 주의 지점을 남겨주세요."
                  required
                  minLength={5}
                />
              </label>
              <label>
                코스 메모
                <input
                  type="text"
                  value={reviewCourseNote}
                  onChange={(event) => setReviewCourseNote(event.target.value)}
                  placeholder="예: 중간 지점 우회로는 좌측이 편함"
                />
              </label>
              <label>
                후기 사진(선택, 2MB 이하)
                <input type="file" accept="image/*" onChange={handleReviewImageChange} />
              </label>
              {reviewImageData ? (
                <img className="review-image-preview" src={reviewImageData} alt="후기 이미지 미리보기" />
              ) : null}
              <button type="submit" className="stamp-button" disabled={isSubmittingReview}>
                {isSubmittingReview ? '후기 등록 중...' : '후기 등록 및 인증 시도'}
              </button>
            </form>

            {reviewMessage ? <p className="subtle-text">{reviewMessage}</p> : null}
            {reviewError ? <p className="error-text">{reviewError}</p> : null}
            {locationError ? <p className="error-text">{locationError}</p> : null}
            {backendError ? <p className="error-text">{backendError}</p> : null}
            {isLoadingReviews ? <p className="subtle-text">후기 불러오는 중...</p> : null}

            <ul className="section-review-list">
              {sectionReviews.map((review) => (
                <li key={review._id}>
                  <div className="section-review-header">
                    <strong>{review.nickname}</strong>
                    <span>{'★'.repeat(review.rating || 5)}</span>
                  </div>
                  <p>{review.content}</p>
                  {review.courseNote ? <p className="subtle-text">코스 메모: {review.courseNote}</p> : null}
                  {Array.isArray(review.images) && review.images.length > 0 ? (
                    <div className="review-image-grid">
                      {review.images.map((imageSrc, index) => (
                        <img key={`${review._id}-${index}`} src={imageSrc} alt="후기 첨부" />
                      ))}
                    </div>
                  ) : null}
                  <small>{new Date(review.createdAt).toLocaleString('ko-KR')}</small>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </section>

      <section className="panel user-section">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">사용자</p>
            <h2>인증 현황</h2>
          </div>
          <span className="status-chip">{currentUser ? '연결됨' : '연결 중'}</span>
        </div>

        {currentUser ? (
          <div className="user-info">
            <article>
              <span>닉네임</span>
              <strong>{currentUser.nickname}</strong>
            </article>
            <article>
              <span>누적 인증 구간</span>
              <strong>{completedSectionIds.size}개</strong>
            </article>
            <article>
              <span>누적 스탬프</span>
              <strong>{userProgress?.totalStamps ?? 0}개</strong>
            </article>
            <article>
              <span>생성일</span>
              <strong>{new Date(currentUser.createdAt).toLocaleDateString('ko-KR')}</strong>
            </article>
          </div>
        ) : (
          <p className="subtle-text">사용자 정보를 불러오는 중입니다.</p>
        )}
      </section>
    </main>
  )
}
