/**
 * Vercel Serverless API: POST /api/users/register
 * 사용자 등록 (apiClient.js와 호환)
 */

import { createOrGetUser } from '../../lib/db.js'

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
      const { userId, nickname } = req.body

      if (!userId) {
        return res.status(400).json({ error: '사용자 ID가 필요합니다.' })
      }

      const user = await createOrGetUser(userId, nickname)
      res.status(200).json({ userId, user })
    } catch (error) {
      console.error('사용자 등록 실패:', error)
      res.status(500).json({ error: '사용자 등록 중 오류 발생' })
    }
  } else {
    res.status(405).json({ error: '메서드가 허용되지 않습니다.' })
  }
}
