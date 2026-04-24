# EASYGO

동서 트레일 구간을 시작부터 종점까지 인증하며 기록하는 스탬프 앱입니다. React + Vite 기반으로 구성했고, 카카오맵과 공공데이터 POI API, **GPS 반경 기반 체크인 점수 획득**, **거리 인식 경로 선택**(GPS 거리 임계값 + 구간별 고정 경로 혼합)을 포함합니다.

## 핵심 기능

- 둘레길 체크포인트 목록과 진행률 대시보드
- 카카오맵 기반 구간 시각화
- **보행자 중심 경로 표시** (거리 임계값에 따라 적응형 모드 선택)
  - 1km 이상: 등산로 전용 경로(파란색) / 1km 미만: 카카오맵 API(초록색) / 직선(회색)
  - 우회율(detour ratio) 표시로 실제 보행 거리 안내
- 구간별 고정 GPS 좌표 기반 경로 데이터 (GPX)
- 공공데이터 POI API XML 응답 파싱
- GPS 위치 반경 도착 체크인 (+점수 획득)
- 난이도/고도 기반 체크포인트 차등 점수
- 실시간 위치 추적 자동 획득 모드 (버튼 없이 체크인)
- 울산 언양고등학교 테스트 메뉴 (고정 코스 + 현위치 코스)
- 사용자별 완주/스탬프 기록 백엔드

## 환경 변수

프로젝트 루트에 `.env.local` 파일을 만들고 아래 값을 넣습니다.

```bash
VITE_KAKAO_MAP_APP_KEY=your_kakao_javascript_key
VITE_PUBLIC_DATA_SERVICE_KEY=your_data_go_kr_service_key
KAKAO_REST_API_KEY=your_kakao_rest_api_key

# 위치 인증/점수 설정
VITE_CHECKIN_RADIUS_METER=80
VITE_BASE_CHECKPOINT_SCORE=100
VITE_AUTO_CHECKIN_DEFAULT=true
VITE_AUTO_CHECKIN_INTERVAL_MS=6000

# 울산 언양고 테스트 코스 기본 중심 좌표
VITE_UNYANG_TEST_LAT=35.56746
VITE_UNYANG_TEST_LNG=129.12597

# 서버(로컬/Vercel API) 기본 점수 fallback
CHECKPOINT_BASE_SCORE=100

# 선택값: 프론트와 API를 분리 배포할 때만 사용
# VITE_API_URL=http://localhost:5174
```

- 언양고 실제 중심 좌표와 다르면 `VITE_UNYANG_TEST_LAT`, `VITE_UNYANG_TEST_LNG`만 수정하세요.
- 자동 획득을 기본 ON으로 시작하려면 `VITE_AUTO_CHECKIN_DEFAULT=true`를 유지하세요.
- 자동 체크 주기는 `VITE_AUTO_CHECKIN_INTERVAL_MS`로 조절하며, 권장 범위는 3000~10000입니다.

## 실행

### 프론트엔드만 실행

```bash
npm install
npm run dev
```

### 프론트엔드 + 백엔드 함께 실행

```bash
npm run dev:full
```

### 백엔드만 실행

```bash
npm run server
```

## 빌드

```bash
npm run build
```

## 🚀 배포 (Vercel + MongoDB)

### 빠른 배포 가이드
[DEPLOYMENT_MONGODB_QUICK.md](DEPLOYMENT_MONGODB_QUICK.md) ⭐ **이것을 읽으세요**

### 상세 배포 정보
- [DEPLOYMENT_VERCEL_ONLY.md](DEPLOYMENT_VERCEL_ONLY.md): Vercel만 사용한 풀스택 배포

### 배포 아키텍처
```
Vercel (프론트엔드 + Serverless API)
    ↓
MongoDB Atlas (데이터베이스)
    ↓
Kakao Maps API (지도 렌더링)
```

**특징:**
- 백엔드 서버 불필요 (Vercel Serverless Functions로 자동 처리)
- MongoDB로 영구 데이터 저장
- 모든 요청이 Vercel을 통해 CORS 해결
- 자동 배포 (GitHub → Vercel)

## 경로 선택 규칙 (적응형 모드)

앱은 출발지와 도착지 사이의 **거리 임계값**에 따라 경로를 자동 선택합니다:

| 거리 | 우선 경로 | 색상 | 설명 |
|------|---------|------|------|
| 1km 이상 | 등산로(GPX) | 🔵 파란색 | 구간별 사전 정의 경로, 보행로 최적화 |
| 500m ~ 1km | 카카오맵 API | 🟢 초록색 | 내비게이션 API 결과 |
| 500m 이하 | 직선 연결 | ⚫ 회색 | 출발-도착 직선 |

- **우회율(Detour Ratio)**: 직선 거리 대비 실제 보행 거리 비율 표시 (1.5 = 50% 더 긴 경로)
- **경로 소스 표시**: "📍 등산로(고정) · 2.4km (+45% 우회)" 형식으로 선택 사유 명시

## 구간별 경로 데이터

각 구간은 `src/data/sectionRoutes.js`에 GPS 좌표 배열로 저장됩니다:

```javascript
{
  'section-01': {
    name: '가덕도 구간',
    distanceMeters: 2400,
    preferredOverCardinal: true,
    detailedPath: [
      { lat: 35.019238, lng: 128.837509 },
      // ... 중간 경로점들 ...
      { lat: 35.025, lng: 128.845 }
    ]
  }
}
```

서버의 카카오맵 Directions API 응답을 분석하여 거리가 아래 조건 중 하나를 만족하면:
- 구간이 `preferredOverCardinal: true`
- 거리가 임계값 이상

`detailedPath`가 선택됩니다.

## 현재 구조

- `src/App.jsx`: 대시보드, 상태 관리, 경로 선택 로직
- `src/App.jsx`: 대시보드, 상태 관리, 차등 점수 계산, 자동 위치 추적, 테스트 메뉴
- `src/components/MapPanel.jsx`: 카카오맵 렌더링, 다중 경로 시각화
- `src/components/StampBoard.jsx`: 체크포인트 카드와 위치 도착 안내
- `src/services/poiService.js`: 공공데이터 POI 파싱
- `src/services/poiCache.js`: 구간별 POI 캐시 및 조회
- `src/services/apiClient.js`: 백엔드 API 연동
- `src/data/sectionRoutes.js`: **구간별 고정 경로 + 거리 임계값 규칙**
- `src/data/trails.js`: 샘플 트레일 및 체크포인트
- `server.js`: 사용자 기록 및 경로 프록시 백엔드

## 참고

- Kakao Maps JavaScript Key는 **도메인 등록**이 필수입니다 (localhost 포함)
- REST API Key는 서버에서만 사용됩니다 (CORS 우회 프록시)
- 위치 체크인은 브라우저 위치 권한 허용이 필요합니다
- POI 데이터는 공공데이터 포털 서비스 승인이 필요합니다

