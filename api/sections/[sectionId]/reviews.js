/**
 * GET /api/sections/[sectionId]/reviews
 * POST /api/sections/[sectionId]/reviews
 */

import { addSectionReview, getSectionReviews } from '../../lib/db.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  const { sectionId } = req.query

  if (!sectionId) {
    res.status(400).json({ error: 'sectionId가 필요합니다.' })
    return
  }

  try {
    if (req.method === 'GET') {
      const reviews = await getSectionReviews(sectionId)
      res.status(200).json({ sectionId, reviews })
      return
    }

    if (req.method === 'POST') {
      const {
        userId,
        nickname,
        checkpointId,
        rating,
        content,
        courseNote,
        images,
        lat,
        lng,
      } = req.body

      if (!userId) {
        res.status(400).json({ error: 'userId가 필요합니다.' })
        return
      }

      if (!content || !content.trim()) {
        res.status(400).json({ error: '후기 내용을 입력해주세요.' })
        return
      }

      const review = await addSectionReview({
        sectionId,
        userId,
        nickname,
        checkpointId,
        rating: Number(rating),
        content: content.trim(),
        courseNote: courseNote?.trim() || '',
        images: Array.isArray(images) ? images.filter((item) => typeof item === 'string').slice(0, 4) : [],
        location:
          Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
            ? { lat: Number(lat), lng: Number(lng) }
            : null,
      })

      res.status(201).json({ review })
      return
    }

    res.status(405).json({ error: '메서드가 허용되지 않습니다.' })
  } catch (error) {
    console.error('섹션 후기 API 오류:', error)
    res.status(500).json({ error: '섹션 후기 처리 중 오류가 발생했습니다.' })
  }
}
