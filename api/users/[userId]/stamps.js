/**
 * Vercel Serverless API: GET /api/users/[userId]/stamps (조회), POST (추가)
 * 사용자 스탬프 기록 관리
 */

import { getUserStamps, addStamp } from '../../lib/db.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  try {
    const { userId } = req.query

    if (!userId) {
      return res.status(400).json({ error: '사용자 ID가 필요합니다.' })
    }

    if (req.method === 'GET') {
      const stamps = await getUserStamps(userId)
      res.json(stamps)
    } else if (req.method === 'POST') {
      const { checkpointId, lat, lng, beaconId, timestamp } = req.body

      if (!checkpointId) {
        return res.status(400).json({ error: 'checkpointId가 필요합니다.' })
      }

      const stamp = {
        checkpointId,
        lat: lat || null,
        lng: lng || null,
        beaconId: beaconId || null,
        createdAt: timestamp || new Date().toISOString(),
      }

      const result = await addStamp(userId, stamp)
      res.status(201).json(result)
    } else {
      res.status(405).json({ error: '메서드가 허용되지 않습니다.' })
    }
  } catch (error) {
    console.error('스탬프 처리 실패:', error)
    res.status(500).json({ error: '스탬프 처리 중 오류 발생' })
  }
}
