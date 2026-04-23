/**
 * Vercel Serverless API: GET /api/health
 * 헬스 체크
 */

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method === 'GET') {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  } else {
    res.status(405).json({ error: '메서드가 허용되지 않습니다.' })
  }
}
