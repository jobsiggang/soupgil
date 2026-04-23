/**
 * Vercel Serverless API: POST /api/users/[userId]/complete-section
 * 구간 완주 기록
 */

import { completeSection } from '../../lib/db.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method === 'POST') {
    try {
      const { userId } = req.query
      const { sectionId, completedAt } = req.body

      if (!userId) {
        return res.status(400).json({ error: '사용자 ID가 필요합니다.' })
      }

      if (!sectionId) {
        return res.status(400).json({ error: 'sectionId가 필요합니다.' })
      }

      const result = await completeSection(userId, sectionId)
      res.json(result)
    } catch (error) {
      console.error('구간 완주 기록 실패:', error)
      res.status(500).json({ error: '구간 완주 기록 중 오류 발생' })
    }
  } else {
    res.status(405).json({ error: '메서드가 허용되지 않습니다.' })
  }
}
