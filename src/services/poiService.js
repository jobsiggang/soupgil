const POI_API_URL =
  'https://apis.data.go.kr/B553662/poiInfoService/getPoiInfoList'

function normalizeServiceKey(serviceKey) {
  if (!serviceKey) {
    return ''
  }

  let normalized = serviceKey.trim()

  // .env 에 인코딩된 키(%2B, %3D)가 들어와도 URLSearchParams에서 한 번만 인코딩되도록 정규화.
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

export function buildPoiInfoUrl({
  serviceKey,
  trailName,
  placeType = 'SIGN',
  pageNo = 1,
  numOfRows = 1,
  responseType = 'xml',
}) {
  const normalizedKey = normalizeServiceKey(serviceKey)

  const params = new URLSearchParams({
    serviceKey: normalizedKey,
    pageNo: String(pageNo),
    numOfRows: String(numOfRows),
    type: responseType,
    srchFrtrlNm: trailName,
    srchPlaceTpeCd: placeType,
  })

  return `${POI_API_URL}?${params.toString()}`
}

function readTagValue(node, tagName) {
  return node.querySelector(tagName)?.textContent?.trim() ?? ''
}

export function parsePoiInfoXml(xmlText) {
  const xml = new DOMParser().parseFromString(xmlText, 'application/xml')
  const items = Array.from(xml.querySelectorAll('item')).map((item) => ({
    poiId: readTagValue(item, 'poiId'),
    frtrlId: readTagValue(item, 'frtrlId'),
    lat: Number(readTagValue(item, 'lat') || 0),
    lng: Number(readTagValue(item, 'lot') || 0),
    placeName: readTagValue(item, 'placeNm'),
    trailName: readTagValue(item, 'frtrlNm'),
    description: readTagValue(item, 'dscrtCn'),
    placeType: readTagValue(item, 'orgnPlaceTpeCd'),
    destination1: readTagValue(item, 'sgnpstDstn1Nm'),
    destination2: readTagValue(item, 'sgnpstDstn2Nm'),
    destination3: readTagValue(item, 'sgnpstDstn3Nm'),
    createdAt: readTagValue(item, 'crtrDt'),
  }))

  return {
    resultCode: readTagValue(xml, 'resultCode'),
    resultMessage: readTagValue(xml, 'resultMsg'),
    pageNo: Number(readTagValue(xml, 'pageNo') || 0),
    numOfRows: Number(readTagValue(xml, 'numOfRows') || 0),
    totalCount: Number(readTagValue(xml, 'totalCount') || 0),
    items,
  }
}

export async function fetchPoiPreview({ serviceKey, trailName }) {
  if (!serviceKey) {
    return null
  }

  const requestUrl = buildPoiInfoUrl({
    serviceKey,
    trailName,
    placeType: 'SIGN',
    pageNo: 1,
    numOfRows: 1,
  })

  const response = await fetch(requestUrl)
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(
        'POI API 401: 인증키가 잘못되었거나 활용 신청/승인이 완료되지 않았습니다.',
      )
    }
    throw new Error(`POI API request failed with status ${response.status}`)
  }

  const xmlText = await response.text()
  return parsePoiInfoXml(xmlText)
}
