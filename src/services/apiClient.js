// 백엔드 API 클라이언트

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5174'

export async function registerUser(userId, nickname) {
  const response = await fetch(`${API_URL}/api/users/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, nickname }),
  })

  if (!response.ok) {
    throw new Error(`사용자 등록 실패: ${response.status}`)
  }

  return response.json()
}

export async function getUserProgress(userId) {
  const response = await fetch(`${API_URL}/api/users/${userId}/progress`)

  if (!response.ok) {
    throw new Error(`진행 상황 조회 실패: ${response.status}`)
  }

  return response.json()
}

export async function recordStamp(userId, checkpointId, beaconData = {}) {
  const response = await fetch(`${API_URL}/api/users/${userId}/stamps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      checkpointId,
      lat: beaconData.lat,
      lng: beaconData.lng,
      beaconId: beaconData.beaconId,
      timestamp: new Date().toISOString(),
    }),
  })

  if (!response.ok) {
    throw new Error(`스탬프 기록 실패: ${response.status}`)
  }

  return response.json()
}

export async function completeSection(userId, sectionId) {
  const response = await fetch(
    `${API_URL}/api/users/${userId}/complete-section`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sectionId,
        completedAt: new Date().toISOString(),
      }),
    },
  )

  if (!response.ok) {
    throw new Error(`구간 완주 기록 실패: ${response.status}`)
  }

  return response.json()
}

export async function getUserStamps(userId) {
  const response = await fetch(`${API_URL}/api/users/${userId}/stamps`)

  if (!response.ok) {
    throw new Error(`스탬프 조회 실패: ${response.status}`)
  }

  return response.json()
}
