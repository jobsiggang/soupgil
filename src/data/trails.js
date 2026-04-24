export const trailCourse = {
  id: 'east-west-trail-busan',
  name: '부산광역시 둘레길',
  theme: '동서 트레일 스탬프 챌린지',
  description:
    '시작점부터 종점까지 주요 표지판과 갈림길 위치에 도착해 점수를 획득하며 완주 기록을 남기는 트레일 도장깨기 앱입니다.',
  totalPoiCount: 1326,
  distanceKm: 278,
  sectionsCompleted: 1,
  sectionsTotal: 12,
  checkpoints: [
    {
      id: 'poi-0000032799',
      poiId: '0000032799',
      title: '갈림길 31',
      type: 'SIGN',
      lat: 35.019238,
      lng: 128.837509,
      altitude: 123,
      section: '가덕도 구간',
      directionHints: ['직진: 대항세바지', '우회전: 연대봉'],
      note: '계단으로 오르면 연대봉, 직진하면 대항세바지로 이어집니다.',
      stampedAt: '2026-04-23T01:17:44+09:00',
      status: 'verified',
    },
    {
      id: 'poi-start',
      poiId: 'START-DONGSEO',
      title: '동서 트레일 시작점',
      type: 'START',
      lat: 35.10531,
      lng: 129.03202,
      altitude: 18,
      section: '도심 진입 구간',
      directionHints: ['직진: 구간 1 진입'],
      note: '첫 인증 지점입니다. 현위치 체크 후 출발 기록을 남깁니다.',
      stampedAt: null,
      status: 'ready',
    },
    {
      id: 'poi-finish',
      poiId: 'FINISH-DONGSEO',
      title: '동서 트레일 종점',
      type: 'FINISH',
      lat: 35.19627,
      lng: 129.22861,
      altitude: 27,
      section: '해안 마감 구간',
      directionHints: ['도착: 완주 인증'],
      note: '마지막 인증 지점입니다. 완주 배지를 지급합니다.',
      stampedAt: null,
      status: 'locked',
    },
  ],
}

export const initialStampedIds = trailCourse.checkpoints
  .filter((checkpoint) => checkpoint.status === 'verified')
  .map((checkpoint) => checkpoint.id)
