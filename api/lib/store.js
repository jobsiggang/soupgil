/**
 * 메모리 기반 임시 데이터 저장소
 * Vercel Serverless는 파일 시스템 쓰기 불가능하므로 메모리 사용
 * 주의: 배포 재시작 시 데이터 손실
 * 프로덕션: Supabase/MongoDB/Firebase 사용 권장
 */

const store = {
  users: {},
  records: {},
}

export function getUsers() {
  return store.users
}

export function setUsers(data) {
  store.users = data
}

export function getRecords() {
  return store.records
}

export function setRecords(data) {
  store.records = data
}

export function getUser(userId) {
  return store.users[userId] || null
}

export function createUser(userId, nickname) {
  const user = {
    userId,
    nickname: nickname || `사용자${Math.floor(Math.random() * 10000)}`,
    createdAt: new Date().toISOString(),
    trails: {},
  }
  store.users[userId] = user
  return user
}

export function getRecordsForUser(userId) {
  return (
    store.records[userId] || {
      userId,
      stamps: [],
      completedSections: [],
    }
  )
}

export function addStamp(userId, stamp) {
  if (!store.records[userId]) {
    store.records[userId] = {
      userId,
      stamps: [],
      completedSections: [],
    }
  }

  // 중복 확인
  const existingIndex = store.records[userId].stamps.findIndex(
    (s) => s.checkpointId === stamp.checkpointId,
  )

  if (existingIndex >= 0) {
    store.records[userId].stamps[existingIndex] = stamp
  } else {
    store.records[userId].stamps.push(stamp)
  }

  return store.records[userId]
}

export function completeSection(userId, sectionId) {
  if (!store.records[userId]) {
    store.records[userId] = {
      userId,
      stamps: [],
      completedSections: [],
    }
  }

  const alreadyCompleted = store.records[userId].completedSections.some(
    (s) => s.sectionId === sectionId,
  )

  if (!alreadyCompleted) {
    store.records[userId].completedSections.push({
      sectionId,
      completedAt: new Date().toISOString(),
    })
  }

  return store.records[userId]
}
