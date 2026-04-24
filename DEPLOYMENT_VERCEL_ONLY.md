# 🚀 Vercel + MongoDB 배포 가이드 (MongoDB만 사용)

## 📋 구조

```
프론트엔드 (Vite React)  →  Vercel
백엔드 API (Node.js)    →  Vercel Serverless Functions
데이터베이스 (MongoDB)  →  MongoDB Atlas
```

모든 서비스가 **Vercel 하나에서 배포**됩니다. ✨

---

## Step 1️⃣: GitHub에 코드 푸시

```bash
git add .
git commit -m "MongoDB 통합: Vercel Serverless API 추가"
git push origin main
```

---

## Step 2️⃣: Vercel 프로젝트 생성

### 1. vercel.com → "Add New Project"

### 2. GitHub 저장소 선택

### 3. 프로젝트 설정 확인
```
Framework: Vite ✅
Build Command: npm run build ✅
Output Directory: dist ✅
```

### 4. 환경 변수 추가 (Settings → Environment Variables)

**필수 변수:**

```
VITE_KAKAO_MAP_APP_KEY = your_kakao_javascript_key
VITE_PUBLIC_DATA_SERVICE_KEY = your_public_data_service_key
KAKAO_REST_API_KEY = your_kakao_rest_key
MONGODB_URI = your_mongodb_connection_string

# 체크인/점수 설정
VITE_CHECKIN_RADIUS_METER = 80
VITE_BASE_CHECKPOINT_SCORE = 100
VITE_AUTO_CHECKIN_DEFAULT = true
VITE_AUTO_CHECKIN_INTERVAL_MS = 6000
VITE_UNYANG_TEST_LAT = 35.56746
VITE_UNYANG_TEST_LNG = 129.12597
CHECKPOINT_BASE_SCORE = 100

# 선택값: 프론트와 API를 분리 배포할 때만 사용
# VITE_API_URL = https://your-project.vercel.app
```

**⚠️ 중요:**
- VITE 기본값은 Build 시점에 고정되므로 변경 후 반드시 Redeploy 하세요.
- VITE_AUTO_CHECKIN_INTERVAL_MS 권장 범위: 3000 ~ 10000
- 언양고 좌표 정확도 보정 시 VITE_UNYANG_TEST_LAT / VITE_UNYANG_TEST_LNG만 수정하면 됩니다.

---

## Step 3️⃣: 초기 배포

### Deploy 클릭

배포 진행 상황 확인:
```
✓ Build successful
✓ API routes deployed
✓ Frontend built
```

---

## Step 4️⃣: 환경 변수 최종 조정

배포 완료 후, Vercel 대시보드에서 **VITE_API_URL 업데이트**:

```
예: https://easygo-prod.vercel.app
```

그 후 **Redeploy** 클릭

---

## ✅ 배포 완료 확인

### 프론트엔드
```bash
curl https://easygo-prod.vercel.app
# HTML이 반환되면 ✅
```

### 백엔드 헬스 체크
```bash
curl https://easygo-prod.vercel.app/api/health
# {"status":"ok"} ✅
```

### MongoDB 연결 확인
```bash
# 브라우저에서 앱 열기 → BeaconDetector 클릭
# "스캔 시작" 후 스탬프 기록 → MongoDB에 저장되는지 확인
```

---

## 🔍 API 엔드포인트 (자동 배포됨)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/users` | 사용자 등록 |
| GET | `/api/users/[userId]/progress` | 진행 상황 조회 |
| GET | `/api/users/[userId]/stamps` | 스탬프 기록 조회 |
| POST | `/api/users/[userId]/stamps` | 스탐프 기록 추가 |
| POST | `/api/users/[userId]/complete-section` | 구간 완주 |
| GET | `/api/navigation/route` | 길찾기 (카카오) |
| GET | `/api/health` | 헬스 체크 |

---

## 🗄️ MongoDB Atlas 관리

### 데이터 확인

1. MongoDB Atlas 대시보드 접속
2. Cluster0 → Collections
3. `easygo` 데이터베이스 선택
4. 컬렉션 확인:
   - `users`: 사용자 정보
   - `records`: 스탬프 및 구간 완주 기록

---

## 🐛 문제 해결

### "MongoDB 연결 실패"
```
→ Vercel 환경 변수 확인
→ MONGODB_URI가 정확한지 확인
→ MongoDB Atlas: Network Access에 Vercel IP 추가
```

### "Vercel 로그 확인"
```bash
vercel logs easygo --follow
```

### "API 404 에러"
```
→ 엔드포인트 경로 확인
→ /api/users는 /api/users.js 파일에 매핑됨
→ /api/users/[userId]/stamps는 /api/users/[userId]/stamps.js 파일에 매핑됨
```

---

## 📊 Vercel 프로젝트 구조

```
/api                          # Serverless Functions
  /health.js                  # 헬스 체크
  /users.js                   # 사용자 등록
  /users/[userId]/progress.js # 진행 상황
  /users/[userId]/stamps.js   # 스탬프 관리
  /users/[userId]/complete-section.js  # 구간 완주
  /navigation/route.js        # 길찾기 프록시
  /lib/db.js                  # MongoDB 연결

/src                          # React 프론트엔드
/dist                         # 빌드 결과 (배포됨)
/vercel.json                  # Vercel 설정
```

---

## 💡 Vercel + MongoDB 비용

- **Vercel**: 무료 (월 300GB 대역폭, 함수 시간 무제한)
- **MongoDB Atlas**: 무료 (512MB, 또는 유료 확장)
- **총**: $0 (대부분의 소규모 프로젝트)

---

## 🎯 배포 후 확인 사항

- [ ] 프론트엔드: https://your-domain.vercel.app 접속 가능
- [ ] 백엔드: /api/health 응답 200 OK
- [ ] MongoDB: 스탬프 기록이 MongoDB에 저장되는지 확인
- [ ] Kakao Maps: 지도가 렌더링되는지 확인
- [ ] Navigation Route: 구간 경로가 표시되는지 확인

---

## 📚 추가 리소스

- Vercel Docs: https://vercel.com/docs
- Vercel Serverless Functions: https://vercel.com/docs/concepts/functions/serverless-functions
- MongoDB Atlas: https://docs.atlas.mongodb.com
