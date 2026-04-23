# 🚀 Vercel + Railway 배포 빠른 시작 가이드

## 📋 5분 안에 배포하기

### 준비물
- GitHub 계정 (또는 GitLab, Bitbucket)
- Vercel 계정 (free.vercel.com)
- Railway 계정 (railway.app)
- Kakao REST API Key (console.kakao.com)

---

## Step 1️⃣: GitHub에 코드 푸시 (2분)

```bash
# 저장소 초기화 (첫 배포인 경우)
git init
git add .
git commit -m "배포 준비"

# GitHub 저장소 생성 후
git remote add origin https://github.com/YOUR_USERNAME/easygo.git
git branch -M main
git push -u origin main
```

**✅ 확인**: GitHub에서 저장소 확인 (`.env.local` 없어야 함)

---

## Step 2️⃣: Vercel에 프론트엔드 배포 (1분)

### 2-A. vercel.com 접속 → "Add New Project"

### 2-B. GitHub 저장소 선택

### 2-C. 자동 설정 확인
```
Framework: Vite ✅
Build Command: npm run build ✅
Output Directory: dist ✅
```

### 2-D. 환경 변수 추가 (Settings → Environment Variables)
```
VITE_KAKAO_MAP_APP_KEY = [카카오 JavaScript Key]
VITE_PUBLIC_DATA_SERVICE_KEY = [공공데이터 Key]
VITE_API_URL = https://easygo-backend.railway.app
```

### 2-E. Deploy 클릭 ✅

**결과 URL**: `https://easygo.vercel.app` (또는 자신의 도메인)

---

## Step 3️⃣: Railway에 백엔드 배포 (1분)

### 3-A. railway.app 접속 → "New Project"

### 3-B. "Deploy from GitHub repo" → easygo 선택

### 3-C. 환경 변수 추가 (Variables 탭)
```
KAKAO_REST_API_KEY = [카카오 REST API Key 붙여넣기]
NODE_ENV = production
```

### 3-D. Redeploy 클릭 ✅

**결과 URL**: Railway Networking → Public URL 확인

---

## Step 4️⃣: 프론트엔드 재배포 (Vercel)

Vercel 대시보드 → Deployments → "Redeploy"

(Railway URL을 반영하기 위해)

---

## ✅ 배포 완료!

### 확인
```bash
# 프론트엔드
https://easygo.vercel.app

# 백엔드 헬스 체크
curl https://easygo-backend.railway.app/api/health

# 예상 응답: {"status":"ok"}
```

---

## 🔧 배포 후 주요 설정

| 항목 | Vercel | Railway |
|------|--------|---------|
| **도메인** | 자동 생성 | 자동 생성 |
| **환경 변수** | Settings → Environment Variables | Variables 탭 |
| **로그** | Logs 탭 | Logs 탭 |
| **재배포** | Deployments → Redeploy | Redeploy 버튼 |
| **삭제** | Settings → Danger Zone | Delete Project |

---

## 💡 Troubleshooting

### "API 연결 실패" (CORS 에러)
```
→ Vercel의 VITE_API_URL이 Railway의 공개 URL인지 확인
→ Railway의 Redeploy 클릭
→ Vercel 재배포
```

### "환경 변수가 미적용됨"
```
→ 변수 추가 후 반드시 Redeploy
→ 배포 로그에서 변수 확인
```

### "Railway가 404 반환"
```
→ Railway 로그 확인: "npm run start" 실행 중인지 확인
→ KAKAO_REST_API_KEY 설정 확인
```

---

## 📊 비용 (2024)

- **Vercel**: 무료 (월 300GB 대역폭)
- **Railway**: 무료 (월 $5 크레딧)
- **총**: $0 (대부분의 소규모 프로젝트)

---

## 🎯 다음 단계

- [ ] 커스텀 도메인 설정 (Vercel → Domains)
- [ ] 데이터베이스 마이그레이션 (Supabase 추천)
- [ ] 자동 테스트 설정 (GitHub Actions)
- [ ] 모니터링 및 알림 설정

---

## 📚 전체 문서

- `DEPLOYMENT.md`: 상세 배포 가이드
- `DEPLOYMENT_CHECKLIST.md`: 단계별 체크리스트
- `README.md`: 로컬 개발 및 기능 설명

---

**계속 지원이 필요하면 터미널 로그를 공유해주세요! 🚀**
