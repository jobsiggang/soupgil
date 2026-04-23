// 동서 트레일 구간 정보와 POI 데이터 캐시 관리

export const TRAIL_SECTIONS = [
  {
    id: 'section-01',
    name: '가덕도 구간',
    startPoint: { lat: 35.019238, lng: 128.837509 },
    endPoint: { lat: 35.025, lng: 128.845 },
    description: '대항세바지에서 시작하는 해안선 따라 걷기',
  },
  {
    id: 'section-02',
    name: '생곡 구간',
    startPoint: { lat: 35.03, lng: 128.85 },
    endPoint: { lat: 35.04, lng: 128.86 },
    description: '산책로 중심의 숲 구간',
  },
  {
    id: 'section-03',
    name: '도시락 바위 구간',
    startPoint: { lat: 35.05, lng: 128.87 },
    endPoint: { lat: 35.06, lng: 128.88 },
    description: '암자 및 암봉 둘러보기',
  },
  // 실제 운영 시 전체 12개 구간 추가
]

// POI 캐시 (로컬 스토리지 활용 가능)
let poiCache = {
  trails: {},
  sections: {},
  lastFetch: {},
}

function normalizeServiceKey(serviceKey) {
  if (!serviceKey) {
    return ''
  }

  let normalized = serviceKey.trim()

  for (let i = 0; i < 2; i += 1) {
    try {
      const decoded = decodeURIComponent(normalized)
      if (decoded === normalized) {
        break
      }
      normalized = decoded
    } catch {
      break
    }
  }

  return normalized
}

export async function fetchPoisBySection({
  serviceKey,
  trailName,
  sectionId,
  pageNo = 1,
  numOfRows = 100,
}) {
  const normalizedKey = normalizeServiceKey(serviceKey)

  if (!normalizedKey) {
    // 데모: 캐시된 POI 반환
    return getDemoPoisBySection(sectionId)
  }

  const cacheKey = `${trailName}:${sectionId}`

  // 캐시된 데이터가 있고 최근이면 사용 (1시간 단위)
  if (
    poiCache.sections[cacheKey] &&
    Date.now() - (poiCache.lastFetch[cacheKey] ?? 0) < 3600000
  ) {
    return poiCache.sections[cacheKey]
  }

  const POI_API_URL =
    'https://apis.data.go.kr/B553662/poiInfoService/getPoiInfoList'
  const params = new URLSearchParams({
    serviceKey: normalizedKey,
    pageNo: String(pageNo),
    numOfRows: String(numOfRows),
    type: 'xml',
    srchFrtrlNm: trailName,
    srchPlaceTpeCd: 'SIGN',
  })

  const response = await fetch(`${POI_API_URL}?${params.toString()}`)
  if (!response.ok) {
    const error = new Error(`POI API 요청 실패: ${response.status}`)
    error.status = response.status
    throw error
  }

  const xmlText = await response.text()
  const xml = new DOMParser().parseFromString(xmlText, 'application/xml')

  // XML에서 POI 파싱
  const items = Array.from(xml.querySelectorAll('item')).map((item) => ({
    poiId: item.querySelector('poiId')?.textContent || '',
    name: item.querySelector('placeNm')?.textContent || '',
    lat: Number(item.querySelector('lat')?.textContent || 0),
    lng: Number(item.querySelector('lot')?.textContent || 0), // 주의: 'lot'으로 경도
    description: item.querySelector('dscrtCn')?.textContent || '',
    section: sectionId,
    destinations: [
      item.querySelector('sgnpstDstn1Nm')?.textContent,
      item.querySelector('sgnpstDstn2Nm')?.textContent,
      item.querySelector('sgnpstDstn3Nm')?.textContent,
    ].filter(Boolean),
  }))

  // 결과 구조화
  const result = {
    sectionId,
    trailName,
    totalCount: Number(xml.querySelector('totalCount')?.textContent || 0),
    items,
  }

  // 캐시 저장
  poiCache.sections[cacheKey] = result
  poiCache.lastFetch[cacheKey] = Date.now()

  return result
}

function getDemoPoisBySection(sectionId) {
  // 데모 포인트 데이터
  const demoData = {
    'section-01': [
      {
        poiId: '0000032799',
        name: '갈림길 31',
        lat: 35.019238,
        lng: 128.837509,
        description: '계단으로 오르면 연대봉으로 가는길',
        section: 'section-01',
        destinations: ['연대봉', '대항세바지'],
      },
      {
        poiId: '0000032800',
        name: '대항세바지',
        lat: 35.025,
        lng: 128.845,
        description: '해변 휴게소',
        section: 'section-01',
        destinations: ['생곡'],
      },
    ],
    'section-02': [
      {
        poiId: '0000032801',
        name: '생곡 입구',
        lat: 35.03,
        lng: 128.85,
        description: '생곡 구간 시작점',
        section: 'section-02',
        destinations: ['숲길'],
      },
    ],
  }

  return {
    sectionId,
    trailName: '부산광역시 둘레길',
    totalCount: demoData[sectionId]?.length ?? 0,
    items: demoData[sectionId] ?? [],
  }
}

export async function fetchAllSectionPois({
  serviceKey,
  trailName,
  sections = TRAIL_SECTIONS,
}) {
  const normalizedKey = normalizeServiceKey(serviceKey)

  if (!normalizedKey) {
    return sections.reduce((acc, section) => {
      acc[section.id] = getDemoPoisBySection(section.id)
      return acc
    }, {})
  }

  try {
    // 먼저 1개 구간으로 인증 상태를 확인해 401 반복 호출을 막는다.
    await fetchPoisBySection({
      serviceKey: normalizedKey,
      trailName,
      sectionId: sections[0].id,
      pageNo: 1,
      numOfRows: 1,
    })
  } catch (error) {
    if (error.status === 401) {
      console.warn('POI API 인증 실패(401): serviceKey 인코딩 상태를 확인하세요.')
      return sections.reduce((acc, section) => {
        acc[section.id] = getDemoPoisBySection(section.id)
        return acc
      }, {})
    }
  }

  const allResults = {}

  // 병렬로 모든 구간 데이터 페칭
  const promises = sections.map((section) =>
    fetchPoisBySection({
      serviceKey: normalizedKey,
      trailName,
      sectionId: section.id,
    })
      .then((result) => {
        allResults[section.id] = result
      })
      .catch((err) => {
        console.warn(`구간 ${section.id} 페칭 실패:`, err)
        allResults[section.id] = { sectionId: section.id, items: [] }
      }),
  )

  await Promise.all(promises)
  return allResults
}

export function clearPoiCache() {
  poiCache = {
    trails: {},
    sections: {},
    lastFetch: {},
  }
}
