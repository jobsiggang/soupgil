/**
 * Vercel Serverless API: GET /api/navigation/route
 * 카카오 길찾기 API 프록시 (CORS 우회)
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method === 'GET') {
    const { originLat, originLng, destLat, destLng } = req.query
    const restApiKey = process.env.VITE_KAKAO_REST_API_KEY

    if (!originLat || !originLng || !destLat || !destLng) {
      return res.status(400).json({ error: 'origin/destination 좌표가 필요합니다.' })
    }

    if (!restApiKey) {
      return res.status(503).json({
        error: 'VITE_KAKAO_REST_API_KEY가 설정되지 않았습니다.',
      })
    }

    try {
      const url = new URL('https://apis-navi.kakaomobility.com/v1/directions')
      url.searchParams.set('origin', `${originLng},${originLat}`)
      url.searchParams.set('destination', `${destLng},${destLat}`)
      url.searchParams.set('priority', 'RECOMMEND')

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `KakaoAK ${restApiKey}`,
        },
      })

      if (!response.ok) {
        const payload = await response.text()
        return res.status(response.status).json({
          error: '카카오 길찾기 API 호출 실패',
          detail: payload,
        })
      }

      const payload = await response.json()
      const route = payload.routes?.[0]

      if (!route) {
        return res.status(404).json({ error: '경로를 찾지 못했습니다.' })
      }

      const path = []
      route.sections?.forEach((section) => {
        section.roads?.forEach((road) => {
          for (let i = 0; i < road.vertexes.length; i += 2) {
            path.push({
              lng: road.vertexes[i],
              lat: road.vertexes[i + 1],
            })
          }
        })
      })

      return res.json({
        summary: {
          distanceMeter: route.summary?.distance ?? 0,
          durationSecond: route.summary?.duration ?? 0,
        },
        path,
      })
    } catch (error) {
      console.error('길찾기 프록시 오류:', error)
      return res.status(500).json({
        error: '길찾기 프록시 처리 중 오류',
        detail: error.message,
      })
    }
  } else {
    res.status(405).json({ error: '메서드가 허용되지 않습니다.' })
  }
}
