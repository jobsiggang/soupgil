/**
 * 구간별 고정 경로(GPX) 데이터 및 거리 기반 우회 규칙
 * 보행자 친화적인 트레일을 미리 정의하고, 거리 임계값에 따라
 * Kakao API 결과 또는 고정 GPX를 선택하여 표시
 */

const DISTANCE_THRESHOLDS = {
  // 500m 이하: 직선 연결
  SHORT: 0.5,
  // 500m ~ 1km: Kakao API + GPX 비교 후 더 안전한 경로 선택
  MEDIUM: 1.0,
  // 1km 이상: 고정 GPX 우선 (등산로/보행로 데이터)
  LONG: 1.0,
}

/**
 * 각 구간별 고정 경로 (GPS 좌표 배열)
 * - detauledPath: 보행자 중심의 상세 경로
 * - distanceMeters: 실제 보행 거리
 * - preferredOverCardinal: Kakao API 결과와 비교할 때 이 경로 우선 여부
 */
export const SECTION_ROUTES = {
  'section-01': {
    name: '가덕도 구간',
    distanceMeters: 2400,
    preferredOverCardinal: true,
    // 해안선을 따라 우회하는 실제 등산로
    detailedPath: [
      { lat: 35.019238, lng: 128.837509 }, // 시작: 대항세바지
      { lat: 35.019800, lng: 128.838100 },
      { lat: 35.020500, lng: 128.839000 },
      { lat: 35.021200, lng: 128.840000 },
      { lat: 35.022100, lng: 128.841000 },
      { lat: 35.022900, lng: 128.842000 },
      { lat: 35.023700, lng: 128.843100 },
      { lat: 35.024400, lng: 128.843900 },
      { lat: 35.025, lng: 128.845 }, // 종료: 다음 체크포인트
    ],
  },
  'section-02': {
    name: '생곡 구간',
    distanceMeters: 1800,
    preferredOverCardinal: true,
    // 산책로 중심의 숲길
    detailedPath: [
      { lat: 35.03, lng: 128.85 }, // 시작
      { lat: 35.030600, lng: 128.850600 },
      { lat: 35.031300, lng: 128.851200 },
      { lat: 35.032100, lng: 128.852100 },
      { lat: 35.033000, lng: 128.853000 },
      { lat: 35.034000, lng: 128.854100 },
      { lat: 35.035100, lng: 128.855200 },
      { lat: 35.04, lng: 128.86 }, // 종료
    ],
  },
  'section-03': {
    name: '도시락 바위 구간',
    distanceMeters: 2100,
    preferredOverCardinal: true,
    // 암자 및 암봉을 둘러보는 경로
    detailedPath: [
      { lat: 35.05, lng: 128.87 }, // 시작
      { lat: 35.050600, lng: 128.870600 },
      { lat: 35.051300, lng: 128.871300 },
      { lat: 35.052200, lng: 128.872200 },
      { lat: 35.053200, lng: 128.873200 },
      { lat: 35.054200, lng: 128.874200 },
      { lat: 35.055100, lng: 128.875100 },
      { lat: 35.06, lng: 128.88 }, // 종료
    ],
  },
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

function getPathDistanceMeter(path) {
  if (!path || path.length < 2) {
    return 0
  }

  let total = 0
  for (let i = 1; i < path.length; i += 1) {
    total += getDistanceMeter(path[i - 1], path[i])
  }
  return Math.round(total)
}

function findNearestPointIndex(points, target) {
  if (!points.length) {
    return -1
  }

  let nearestIndex = 0
  let nearestDistance = Number.POSITIVE_INFINITY

  for (let i = 0; i < points.length; i += 1) {
    const distance = getDistanceMeter(points[i], target)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestIndex = i
    }
  }

  return nearestIndex
}

function parseGpxTrackPoints(gpxText) {
  const xml = new DOMParser().parseFromString(gpxText, 'application/xml')
  const parserError = xml.querySelector('parsererror')
  if (parserError) {
    throw new Error('GPX 파싱에 실패했습니다.')
  }

  return Array.from(xml.querySelectorAll('trkpt'))
    .map((node) => ({
      lat: Number(node.getAttribute('lat')),
      lng: Number(node.getAttribute('lon')),
    }))
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
}

export function buildSectionRoutesFromGpx(gpxText, sections, fallbackRoutes = SECTION_ROUTES) {
  const points = parseGpxTrackPoints(gpxText)
  if (points.length < 2) {
    return fallbackRoutes
  }

  const built = { ...fallbackRoutes }

  sections.forEach((section) => {
    const startIndex = findNearestPointIndex(points, section.startPoint)
    const endIndex = findNearestPointIndex(points, section.endPoint)

    if (startIndex < 0 || endIndex < 0) {
      return
    }

    const from = Math.min(startIndex, endIndex)
    const to = Math.max(startIndex, endIndex)
    const sampledPath = points.slice(from, to + 1)

    if (sampledPath.length < 2) {
      return
    }

    const downSampleStep = sampledPath.length > 240 ? Math.ceil(sampledPath.length / 240) : 1
    const detailedPath = sampledPath.filter((_, index) => index % downSampleStep === 0)

    built[section.id] = {
      name: section.name,
      distanceMeters: getPathDistanceMeter(detailedPath),
      preferredOverCardinal: true,
      detailedPath,
    }
  })

  return built
}

/**
 * 두 지점 간 거리 계산 (Haversine 공식)
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number} 거리 (km)
 */
export function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371 // 지구 반지름 (km)
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * 직선 거리와 실제 경로 거리의 비율 계산
 * 비율이 높을수록 더 많이 우회하는 경로
 * @param {number} cardinalDistance - 직선 거리 (km)
 * @param {number} actualDistance - 실제 경로 거리 (km)
 * @returns {number} 비율 (1.0 = 직선, 1.5 = 50% 더 긺)
 */
export function calculateDetourRatio(cardinalDistance, actualDistance) {
  if (cardinalDistance === 0) return 0
  return actualDistance / cardinalDistance
}

/**
 * 경로 선택 규칙 적용
 * 거리 임계값과 구간별 설정에 따라 Kakao API 또는 GPX 경로를 선택
 * @param {Object} params
 * @param {number} params.originLat
 * @param {number} params.originLng
 * @param {number} params.destLat
 * @param {number} params.destLng
 * @param {String} params.sectionId
 * @param {Array} params.kakaoPath - Kakao API로부터의 경로
 * @param {number} params.kakaoDistance - Kakao API로부터의 거리 (미터)
 * @returns {{ path: Array, source: 'gpx'|'kakao'|'cardinal', distanceMeters: number, detourRatio: number }}
 */
export function selectRouteByThreshold({
  originLat,
  originLng,
  destLat,
  destLng,
  sectionId,
  kakaoPath,
  kakaoDistance,
  routeMap = SECTION_ROUTES,
}) {
  const sectionRoute = routeMap[sectionId]
  const cardinalDistance = calculateDistance(originLat, originLng, destLat, destLng)
  const cardinalDistanceMeters = cardinalDistance * 1000

  // 구간이 없으면 Kakao 결과 사용
  if (!sectionRoute) {
    return {
      path: kakaoPath ?? [],
      source: kakaoPath ? 'kakao' : 'cardinal',
      distanceMeters: kakaoDistance ?? cardinalDistanceMeters,
      detourRatio: kakaoDistance
        ? calculateDetourRatio(cardinalDistance, kakaoDistance / 1000)
        : 1.0,
    }
  }

  // 거리 임계값에 따른 경로 선택
  const useGpx =
    cardinalDistance >= DISTANCE_THRESHOLDS.LONG &&
    sectionRoute.preferredOverCardinal

  if (useGpx && sectionRoute.detailedPath?.length > 0) {
    const gpxDistance = sectionRoute.distanceMeters
    return {
      path: sectionRoute.detailedPath,
      source: 'gpx',
      distanceMeters: gpxDistance,
      detourRatio: calculateDetourRatio(cardinalDistance, gpxDistance / 1000),
    }
  }

  // Kakao 경로 또는 직선
  if (kakaoPath?.length > 0 && kakaoDistance >= cardinalDistanceMeters * 1.05) {
    // Kakao 경로가 충분히 긴 경우 사용
    return {
      path: kakaoPath,
      source: 'kakao',
      distanceMeters: kakaoDistance,
      detourRatio: calculateDetourRatio(cardinalDistance, kakaoDistance / 1000),
    }
  }

  // 직선 동선
  return {
    path: [
      { lat: originLat, lng: originLng },
      { lat: destLat, lng: destLng },
    ],
    source: 'cardinal',
    distanceMeters: cardinalDistanceMeters,
    detourRatio: 1.0,
  }
}

/**
 * 현재 선택된 경로 정보를 사람이 읽을 수 있는 형식으로 반환
 */
export function getRouteDescription(routeResult) {
  if (!routeResult) return ''

  const { source, distanceMeters, detourRatio } = routeResult
  const distanceKm = (distanceMeters / 1000).toFixed(2)
  const detourPercent = Math.round((detourRatio - 1) * 100)

  let sourceLabel = source === 'gpx' ? '📍 등산로(고정)' : '🗺️ 카카오맵'
  if (source === 'cardinal') sourceLabel = '➡️ 직선'

  if (detourPercent === 0) {
    return `${sourceLabel} · ${distanceKm}km`
  }

  return `${sourceLabel} · ${distanceKm}km (+${detourPercent}% 우회)`
}
