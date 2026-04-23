/**
 * Vercel Serverless API: GET /api/users/[userId]/progress
 * 사용자 전체 진행 상황 조회
 */

import { getUserProgress } from '../../lib/db.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method === 'GET') {
    try {
      const { userId } = req.query

      if (!userId) {
        return res.status(400).json({ error: '사용자 ID가 필요합니다.' })
      }

      const progress = await getUserProgress(userId)

      if (!progress) {
        return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' })
      }

      res.json(progress)
    } catch (error) {
      console.error('진행 상황 조회 실패:', error)
      res.status(500).json({ error: '진행 상황 조회 중 오류 발생' })
    }
  } else {
    res.status(405).json({ error: '메서드가 허용되지 않습니다.' })
  }
}
