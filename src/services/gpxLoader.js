const DONGSEO_SECTION_NUMBERS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
  47, 48, 49, 50, 51, 52, 53, 54, 55,
]

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
  for (let index = 1; index < path.length; index += 1) {
    total += getDistanceMeter(path[index - 1], path[index])
  }

  return Math.round(total)
}

function downSamplePath(path, maxPoints = 260) {
  if (path.length <= maxPoints) {
    return path
  }

  const step = Math.ceil(path.length / maxPoints)
  return path.filter((_, index) => index % step === 0 || index === path.length - 1)
}

function parseTrackPoints(gpxText) {
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

function buildCumulativeDistances(points) {
  const cumulative = [0]

  for (let index = 1; index < points.length; index += 1) {
    cumulative[index] = cumulative[index - 1] + getDistanceMeter(points[index - 1], points[index])
  }

  return cumulative
}

function findClosestIndexByDistance(cumulative, targetDistance) {
  let bestIndex = 0
  let bestGap = Number.POSITIVE_INFINITY

  for (let index = 0; index < cumulative.length; index += 1) {
    const gap = Math.abs(cumulative[index] - targetDistance)
    if (gap < bestGap) {
      bestGap = gap
      bestIndex = index
    }
  }

  return bestIndex
}

export async function loadDongseoTrailData(gpxPath = '/dongseo-trail-full.gpx') {
  const response = await fetch(gpxPath)
  if (!response.ok) {
    throw new Error(`GPX 파일 로드 실패: ${response.status}`)
  }

  const gpxText = await response.text()
  const points = parseTrackPoints(gpxText)

  if (points.length < 2) {
    throw new Error('GPX 경로 포인트가 부족합니다.')
  }

  const cumulative = buildCumulativeDistances(points)
  const totalDistanceMeter = cumulative[cumulative.length - 1]
  const sectionDistance = totalDistanceMeter / DONGSEO_SECTION_NUMBERS.length

  const sections = []
  const routesMap = {}

  DONGSEO_SECTION_NUMBERS.forEach((sectionNumber, sectionIndex) => {
    const startDistance = sectionDistance * sectionIndex
    const endDistance =
      sectionIndex === DONGSEO_SECTION_NUMBERS.length - 1
        ? totalDistanceMeter
        : sectionDistance * (sectionIndex + 1)

    const startIndex = findClosestIndexByDistance(cumulative, startDistance)
    const endIndex = findClosestIndexByDistance(cumulative, endDistance)
    const rawPath = points.slice(startIndex, Math.max(endIndex, startIndex + 1) + 1)
    const detailedPath = downSamplePath(rawPath)
    const startPoint = detailedPath[0] ?? points[startIndex]
    const endPoint = detailedPath[detailedPath.length - 1] ?? points[endIndex]
    const distanceMeters = getPathDistanceMeter(detailedPath)
    const id = `section-${sectionNumber}`

    sections.push({
      id,
      number: sectionNumber,
      name: `동서트레일 ${sectionNumber}구간`,
      description: `제공된 GPX 전체 경로에서 자동 분할한 동서트레일 ${sectionNumber}구간입니다.`,
      startPoint,
      endPoint,
      distanceMeters,
    })

    routesMap[id] = {
      name: `동서트레일 ${sectionNumber}구간`,
      distanceMeters,
      preferredOverCardinal: true,
      detailedPath,
    }
  })

  return {
    sections,
    routesMap,
    summary: {
      totalDistanceMeter: Math.round(totalDistanceMeter),
      totalPointCount: points.length,
      sectionCount: sections.length,
    },
  }
}
