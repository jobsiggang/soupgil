import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

const app = express()
const PORT = process.env.PORT || 5174
const DEFAULT_CHECKPOINT_SCORE = Number(process.env.CHECKPOINT_BASE_SCORE) || 100

app.use(cors())
app.use(express.json())

// 간단한 JSON 파일 기반 저장소 (프로덕션에서는 데이터베이스 사용)
const DATA_DIR = 'data'
const USERS_FILE = path.join(DATA_DIR, 'users.json')
const RECORDS_FILE = path.join(DATA_DIR, 'records.json')
const authSessions = new Map()

function stripWrappingQuotes(value) {
  if (typeof value !== 'string') {
    return ''
  }
  return value.trim().replace(/^['"]|['"]$/g, '')
}

function resolveKakaoRestApiKey() {
  return stripWrappingQuotes(process.env.KAKAO_REST_API_KEY || process.env.VITE_KAKAO_REST_API_KEY)
}

function resolveKakaoRedirectUri(req, redirectUriFromBody) {
  if (redirectUriFromBody) {
    return stripWrappingQuotes(String(redirectUriFromBody))
  }

  const fromEnv = stripWrappingQuotes(process.env.KAKAO_REDIRECT_URI || process.env.VITE_KAKAO_REDIRECT_URI)
  if (fromEnv) {
    return fromEnv
  }

  return `${req.protocol}://${req.get('host')}/auth/kakao/callback`
}

function extractBearerToken(req) {
  const header = req.headers.authorization || ''
  if (!header.startsWith('Bearer ')) {
    return ''
  }
  return header.slice(7).trim()
}

function loadLocalEnv(filePath = '.env.local') {
  if (!fs.existsSync(filePath)) {
    return
  }

  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split('\n')

  lines.forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
      return
    }

    const [key, ...rest] = trimmed.split('=')
    const value = rest.join('=')
    if (!process.env[key]) {
      process.env[key] = value
    }
  })
}

// 데이터 디렉토리 및 파일 초기화
function initializeDataFiles() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }

  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify({}, null, 2))
  }

  if (!fs.existsSync(RECORDS_FILE)) {
    fs.writeFileSync(RECORDS_FILE, JSON.stringify({}, null, 2))
  }
}

function readUsers() {
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'))
}

function writeUsers(data) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2))
}

function readRecords() {
  return JSON.parse(fs.readFileSync(RECORDS_FILE, 'utf8'))
}

function writeRecords(data) {
  fs.writeFileSync(RECORDS_FILE, JSON.stringify(data, null, 2))
}

// 사용자 등록 또는 조회
app.post('/api/users/register', (req, res) => {
  const { userId, nickname } = req.body

  if (!userId) {
    return res.status(400).json({ error: '사용자 ID가 필요합니다.' })
  }

  const users = readUsers()

  if (users[userId]) {
    return res.status(200).json({ userId, user: users[userId] })
  }

  const newUser = {
    userId,
    nickname: nickname || `사용자${Math.floor(Math.random() * 10000)}`,
    createdAt: new Date().toISOString(),
    trails: {},
  }

  users[userId] = newUser
  writeUsers(users)

  res.status(201).json({ userId, user: newUser })
})

// 사용자 스탬프 기록 조회
app.get('/api/users/:userId/stamps', (req, res) => {
  const { userId } = req.params
  const records = readRecords()

  const userRecords = records[userId] || {
    userId,
    stamps: [],
    completedSections: [],
  }

  res.json(userRecords)
})

// 스탐프 기록 추가
app.post('/api/users/:userId/stamps', (req, res) => {
  const { userId } = req.params
  const { checkpointId, lat, lng, source, distanceMeter, score, difficulty, altitude, timestamp } = req.body

  if (!checkpointId) {
    return res.status(400).json({ error: 'checkpointId가 필요합니다.' })
  }

  const records = readRecords()

  if (!records[userId]) {
    records[userId] = {
      userId,
      stamps: [],
      completedSections: [],
    }
  }

  // 중복 방지: 같은 체크포인트는 최근 기록만 유지
  const existingIndex = records[userId].stamps.findIndex(
    (s) => s.checkpointId === checkpointId,
  )

  const stamp = {
    checkpointId,
    lat: lat || null,
    lng: lng || null,
    source: source || 'gps-radius',
    distanceMeter: distanceMeter ?? null,
    score: Number.isFinite(score) ? score : DEFAULT_CHECKPOINT_SCORE,
    difficulty: difficulty || null,
    altitude: altitude ?? null,
    createdAt: timestamp || new Date().toISOString(),
  }

  if (existingIndex >= 0) {
    // 기존 기록 업데이트
    records[userId].stamps[existingIndex] = stamp
  } else {
    // 새 기록 추가
    records[userId].stamps.push(stamp)
  }

  writeRecords(records)

  res.status(201).json({
    userId,
    stamp,
    totalStamps: records[userId].stamps.length,
  })
})

// 구간 완주 기록
app.post('/api/users/:userId/complete-section', (req, res) => {
  const { userId } = req.params
  const { sectionId, completedAt } = req.body

  if (!sectionId) {
    return res.status(400).json({ error: 'sectionId가 필요합니다.' })
  }

  const records = readRecords()

  if (!records[userId]) {
    records[userId] = {
      userId,
      stamps: [],
      completedSections: [],
    }
  }

  // 중복 확인
  const alreadyCompleted = records[userId].completedSections.some(
    (s) => s.sectionId === sectionId,
  )

  if (!alreadyCompleted) {
    records[userId].completedSections.push({
      sectionId,
      completedAt: completedAt || new Date().toISOString(),
    })
  }

  writeRecords(records)

  res.json({
    userId,
    sectionId,
    completedSections: records[userId].completedSections,
  })
})

// 사용자 전체 진행 상황 조회
app.get('/api/users/:userId/progress', (req, res) => {
  const { userId } = req.params
  const users = readUsers()
  const records = readRecords()

  const user = users[userId]
  const userRecords = records[userId]

  if (!user) {
    return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' })
  }

  res.json({
    userId,
    nickname: user.nickname,
    createdAt: user.createdAt,
    totalStamps: userRecords?.stamps.length ?? 0,
    totalScore: (userRecords?.stamps ?? []).reduce(
      (sum, stamp) =>
        sum + (Number.isFinite(stamp.score) ? stamp.score : DEFAULT_CHECKPOINT_SCORE),
      0,
    ),
    completedSections: userRecords?.completedSections ?? [],
    completionRate: userRecords
      ? Math.round((userRecords.completedSections.length / 12) * 100)
      : 0,
  })
})

// 카카오 OAuth 인가 코드 교환
app.post('/api/auth/kakao/exchange', async (req, res) => {
  const { code, redirectUri } = req.body || {}
  const restApiKey = resolveKakaoRestApiKey()

  if (!code) {
    return res.status(400).json({ error: '인가 코드(code)가 필요합니다.' })
  }

  if (!restApiKey) {
    return res.status(503).json({ error: 'KAKAO_REST_API_KEY가 설정되지 않았습니다.' })
  }

  try {
    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: restApiKey,
      redirect_uri: resolveKakaoRedirectUri(req, redirectUri),
      code: String(code),
    })

    const clientSecret = stripWrappingQuotes(process.env.KAKAO_CLIENT_SECRET)
    if (clientSecret) {
      tokenBody.set('client_secret', clientSecret)
    }

    const tokenResponse = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
      body: tokenBody.toString(),
    })

    const tokenPayload = await tokenResponse.json()
    if (!tokenResponse.ok || !tokenPayload.access_token) {
      return res.status(tokenResponse.status || 500).json({
        error: '카카오 토큰 발급 실패',
        detail: tokenPayload,
      })
    }

    const profileResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: {
        Authorization: `Bearer ${tokenPayload.access_token}`,
      },
    })

    const profilePayload = await profileResponse.json()
    if (!profileResponse.ok || !profilePayload.id) {
      return res.status(profileResponse.status || 500).json({
        error: '카카오 사용자 조회 실패',
        detail: profilePayload,
      })
    }

    const kakaoId = String(profilePayload.id)
    const userId = `kakao-${kakaoId}`
    const nickname =
      profilePayload.kakao_account?.profile?.nickname ||
      profilePayload.properties?.nickname ||
      `사용자${Math.floor(Math.random() * 10000)}`

    const users = readUsers()
    const existing = users[userId]
    const nextUser = existing
      ? {
          ...existing,
          nickname,
          kakaoId,
          lastLoginAt: new Date().toISOString(),
        }
      : {
          userId,
          nickname,
          kakaoId,
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
          trails: {},
        }

    users[userId] = nextUser
    writeUsers(users)

    const sessionToken = randomUUID()
    authSessions.set(sessionToken, {
      userId,
      issuedAt: new Date().toISOString(),
    })

    return res.status(200).json({
      token: sessionToken,
      user: nextUser,
    })
  } catch (error) {
    return res.status(500).json({
      error: '카카오 로그인 처리 중 오류',
      detail: error.message,
    })
  }
})

// 현재 로그인 사용자 조회
app.get('/api/auth/me', (req, res) => {
  const token = extractBearerToken(req)
  if (!token) {
    return res.status(401).json({ error: '인증 토큰이 필요합니다.' })
  }

  const session = authSessions.get(token)
  if (!session?.userId) {
    return res.status(401).json({ error: '유효하지 않은 토큰입니다.' })
  }

  const users = readUsers()
  const user = users[session.userId]
  if (!user) {
    return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' })
  }

  return res.json({ user })
})

// 헬스 체크
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// 카카오 길찾기 API를 프록시해 브라우저에서 실제 경로를 폴리라인으로 그릴 수 있게 한다.
app.get('/api/navigation/route', async (req, res) => {
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
    return res.status(500).json({
      error: '길찾기 프록시 처리 중 오류',
      detail: error.message,
    })
  }
})

loadLocalEnv()
initializeDataFiles()

app.listen(PORT, () => {
  console.log(`Trail stamp backend running at http://localhost:${PORT}`)
})
