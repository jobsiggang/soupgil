/**
 * MongoDB 연결 및 데이터 접근
 * Vercel Serverless 환경에서 동작하는 MongoDB 클라이언트
 */

import { MongoClient } from 'mongodb'

const MONGODB_URI = process.env.MONGODB_URI
const DEFAULT_CHECKPOINT_SCORE = Number(process.env.CHECKPOINT_BASE_SCORE) || 100

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI 환경 변수가 설정되지 않았습니다.')
}

let cachedClient = null

async function getMongoClient() {
  if (cachedClient) {
    return cachedClient
  }

  const client = new MongoClient(MONGODB_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
  })

  await client.connect()
  cachedClient = client
  return client
}

export async function getDB() {
  const client = await getMongoClient()
  return client.db('easygo')
}

// 사용자 컬렉션
export async function getUser(userId) {
  const db = await getDB()
  const user = await db.collection('users').findOne({ userId })
  return user
}

export async function createOrGetUser(userId, nickname) {
  const db = await getDB()
  const existingUser = await db.collection('users').findOne({ userId })

  if (existingUser) {
    return { ...existingUser, _id: existingUser._id.toString() }
  }

  const newUser = {
    userId,
    nickname: nickname || `사용자${Math.floor(Math.random() * 10000)}`,
    createdAt: new Date().toISOString(),
    trails: {},
  }

  const result = await db.collection('users').insertOne(newUser)
  return { ...newUser, _id: result.insertedId.toString() }
}

// 스탬프 기록
export async function addStamp(userId, stamp) {
  const db = await getDB()

  // 사용자가 없으면 생성
  await db.collection('users').updateOne(
    { userId },
    { $setOnInsert: { userId, nickname: `사용자${Math.floor(Math.random() * 10000)}`, createdAt: new Date().toISOString(), trails: {} } },
    { upsert: true }
  )

  // 스탬프 추가 또는 업데이트 (같은 체크포인트면 덮어쓰기)
  const recordResult = await db.collection('records').updateOne(
    { userId },
    {
      $set: {
        userId,
      },
      $addToSet: {
        stamps: {
          $each: [
            {
              checkpointId: stamp.checkpointId,
              lat: stamp.lat || null,
              lng: stamp.lng || null,
              source: stamp.source || 'gps-radius',
              distanceMeter: stamp.distanceMeter ?? null,
              score: Number.isFinite(stamp.score) ? stamp.score : DEFAULT_CHECKPOINT_SCORE,
              difficulty: stamp.difficulty || null,
              altitude: stamp.altitude ?? null,
              createdAt: stamp.createdAt || new Date().toISOString(),
            },
          ],
          $position: 0,
        },
      },
    },
    { upsert: true }
  )

  const userRecord = await db.collection('records').findOne({ userId })
  return {
    userId,
    stamp,
    totalStamps: userRecord?.stamps?.length ?? 1,
  }
}

export async function getUserStamps(userId) {
  const db = await getDB()
  const record = await db.collection('records').findOne({ userId })

  return {
    userId,
    stamps: record?.stamps ?? [],
    completedSections: record?.completedSections ?? [],
  }
}

// 구간 완주
export async function completeSection(userId, sectionId) {
  const db = await getDB()

  const alreadyCompleted = await db.collection('records').findOne({
    userId,
    'completedSections.sectionId': sectionId,
  })

  if (!alreadyCompleted) {
    await db.collection('records').updateOne(
      { userId },
      {
        $push: {
          completedSections: {
            sectionId,
            completedAt: new Date().toISOString(),
          },
        },
      },
      { upsert: true }
    )
  }

  const record = await db.collection('records').findOne({ userId })
  return {
    userId,
    sectionId,
    completedSections: record?.completedSections ?? [],
  }
}

// 전체 진행 상황
export async function getUserProgress(userId) {
  const db = await getDB()
  const user = await db.collection('users').findOne({ userId })
  const record = await db.collection('records').findOne({ userId })

  if (!user) {
    return null
  }

  return {
    userId,
    nickname: user.nickname,
    createdAt: user.createdAt,
    totalStamps: record?.stamps?.length ?? 0,
    totalScore: (record?.stamps ?? []).reduce(
      (sum, stamp) =>
        sum + (Number.isFinite(stamp.score) ? stamp.score : DEFAULT_CHECKPOINT_SCORE),
      0,
    ),
    completedSections: record?.completedSections ?? [],
    completionRate: record
      ? Math.round(((record.completedSections?.length ?? 0) / 12) * 100)
      : 0,
  }
}
