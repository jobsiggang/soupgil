# EASYGO

동서 트레일 구간을 시작부터 종점까지 인증하며 기록하는 스탬프 앱 프로토타입입니다. React + Vite 기반으로 구성했고, 카카오맵과 공공데이터 POI API, ESP32 비콘 체크인 흐름을 붙일 수 있는 최소 구조를 포함합니다.

## 핵심 기능

- 둘레길 체크포인트 목록과 진행률 대시보드
- 카카오맵 기반 구간 시각화
- 공공데이터 POI API XML 응답 파싱
- ESP32 비콘 체크인 시뮬레이션 버튼

## 환경 변수

프로젝트 루트에 `.env` 파일을 만들고 아래 값을 넣습니다.

```bash
VITE_KAKAO_MAP_APP_KEY=your_kakao_javascript_key
VITE_PUBLIC_DATA_SERVICE_KEY=your_data_go_kr_service_key
```

## 실행

```bash
npm install
npm run dev
```

프론트엔드와 백엔드를 함께 실행하려면 아래를 사용합니다.

```bash
npm run dev:full
```

백엔드만 실행하려면 아래를 사용합니다.

```bash
npm run server
```

## 빌드

```bash
npm run build
```

## 현재 구조

- `src/App.jsx`: 대시보드와 상태 관리
- `src/components/MapPanel.jsx`: 카카오맵 렌더링 및 지도 fallback
- `src/components/StampBoard.jsx`: 체크포인트 카드와 체크인 시뮬레이션
- `src/components/BeaconDetector.jsx`: Web Bluetooth 기반 ESP32 비콘 감지
- `src/services/poiService.js`: 공공데이터 POI URL 생성과 XML 파싱
- `src/services/poiCache.js`: 구간별 POI 수집 및 캐시
- `src/services/apiClient.js`: 사용자 기록 API 연동
- `server.js`: 사용자별 완주/스탬프 기록 백엔드
- `src/data/trails.js`: 샘플 트레일 및 체크포인트 데이터
# soupgil
