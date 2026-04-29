# 🚀 Vercel + Railway 배포 체크리스트

## 사전 준비

- [ ] GitHub 계정 생성 (또는 기존 계정)
- [ ] Vercel 계정 생성 (https://vercel.com)
- [ ] Railway 계정 생성 (https://railway.app)
- [ ] Kakao 개발자 계정에서 REST API Key 준비
  - 자신의 API Key: [console.kakao.com](https://console.kakao.com/)

## 1단계: GitHub에 코드 푸시

```bash
# 저장소가 없으면 생성
git init
git add .
git commit -m "Initial commit: EASYGO trail app"
git branch -M main

# GitHub에 저장소 생성 후
git remote add origin https://github.com/YOUR_USERNAME/easygo.git
git push -u origin main
```

**⚠️ 중요: `.env.local` 파일이 .gitignore에 포함되어 있는지 확인**
```bash
cat .gitignore | grep "*.local"  # ✅ 결과: *.local이 있어야 함
```

---

## 2단계: Vercel에 프론트엔드 배포

### 2-1. Vercel 대시보드 접속
- https://vercel.com/dashboard

### 2-2. "Add New..." → "Project" 클릭

### 2-3. GitHub 저장소 연결
1. "Import Git Repository" 선택
2. 자신의 easygo 저장소 선택
3. "Import" 클릭

### 2-4. 프로젝트 설정
```
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
Install Command: npm ci
```

### 2-5. 환경 변수 설정
Settings → Environment Variables에서 추가:

```
VITE_KAKAO_MAP_APP_KEY = <카카오 JavaScript Key>
VITE_PUBLIC_DATA_SERVICE_KEY = <공공데이터 서비스 키>
VITE_API_URL = https://easygo-backend.railway.app
```

### 2-6. 배포
"Deploy" 클릭 → ✅ 배포 완료
생성된 URL (예: `https://easygo.vercel.app`) 메모

---

## 3단계: Railway에 백엔드 배포

### 3-1. Railway 대시보드 접속
- https://railway.app

### 3-2. "New Project" → "Deploy from GitHub repo"
자신의 easygo 저장소 선택

### 3-3. 자동 감지 설정 확인
```
✅ Buildpack: Node.js (자동)
✅ Start Command: npm run start
```

### 3-4. 환경 변수 설정
Variables 탭:

```
VITE_KAKAO_REST_API_KEY = <카카오 REST API Key 삭붙이기>
NODE_ENV = production
```

### 3-5. 배포 대기
로그를 보며 성공 메시지 대기:
```
✅ 서버가 포트 3000에서 실행 중입니다
```

### 3-6. 공개 URL 확인
Railway 대시보드 → Networking → Public URL
(예: `https://easygo-backend.railway.app`)

---

## 4단계: 프론트엔드 환경 변수 업데이트

### 4-1. Vercel 환경 변수 재설정
Railway의 공개 URL을 사용하여:

```
VITE_API_URL = https://easygo-backend.railway.app
```

### 4-2. 재배포
Vercel 대시보드 → Deployments → "Redeploy"

---

## ✅ 배포 완료 확인

### 프론트엔드
```bash
# 브라우저에서 접속
https://easygo.vercel.app

# 개발자 도구 (F12) → Network 탭에서 XHR 요청 확인
# API 호출이 Railway 백엔드로 가는지 확인
```

### 백엔드
```bash
# 헬스 체크
curl https://easygo-backend.railway.app/api/health

# 예상 응답
{"status":"ok"}
```

### 통합 테스트
```bash
# Vercel의 앱에서 지도 열기
# → 카카오맵이 렌더링되는지 확인
# → "스캔 시작" 버튼이 나타나는지 확인 (비콘 감지)
```

---

## 🐛 문제 해결

### A. "CORS 에러" 또는 "API 404"

**원인**: `VITE_API_URL` 환경 변수가 잘못 설정됨

**해결**:
```bash
# 1. Vercel 환경 변수 재확인
#    Settings → Environment Variables
#    VITE_API_URL = https://easygo-backend.railway.app (끝에 슬래시 없음)

# 2. 재배포
#    Deployments → Redeploy
```

### B. "Railway 백엔드가 시작되지 않음"

**확인**:
```bash
# 로그 확인: Railway 대시보드 → Logs 탭
# 에러 메시지 찾기
# - "Cannot find module" → npm install 다시 실행
# - "Port already in use" → 다른 프로세스 확인
```

### C. "환경 변수가 적용되지 않음"

**해결**:
```bash
# Vercel
vercel env list          # 환경 변수 확인
vercel --prod            # 프로덕션 재배포

# Railway
# 대시보드에서 변수 추가 후, Redeploy 버튼 클릭
```

---

## 📊 배포 후 모니터링

### Vercel Logs
```bash
vercel logs easygo --follow
```

### Railway Logs
```bash
railway logs --follow
```

### 실시간 메트릭
- Vercel: https://vercel.com/dashboard/project의 Analytics
- Railway: Railway 대시보드 → Monitoring

---

## 🔒 보안 체크

- [ ] `.env.local`이 GitHub에 업로드되지 않았는지 확인
  ```bash
  git log --all --full-history -- .env.local
  # 결과: "No commits" → ✅ 안전
  ```

- [ ] 민감한 키가 코드에 하드코딩되지 않았는지 확인
  ```bash
  grep -r "VITE_KAKAO_REST_API_KEY" src/
  # 결과: "No matches" → ✅ 안전
  ```

- [ ] 데이터베이스 마이그레이션 계획
  - 현재: 파일 기반 JSON (프로토타입)
  - 권장: Supabase, MongoDB Atlas, PlanetScale (프로덕션)

---

## 🎉 다음 단계

1. **커스텀 도메인 설정** (선택)
   - Vercel: Domains → Add custom domain
   - Railway: Custom Domain 설정

2. **CI/CD 자동화** (선택)
   - GitHub Actions로 자동 테스트/배포

3. **데이터베이스 마이그레이션** (필수)
   - 파일 저장 → Supabase PostgreSQL로 변경

4. **성능 최적화** (선택)
   - Caching, CDN, image optimization

---

## 📚 추가 문서

- [DEPLOYMENT.md](./DEPLOYMENT.md): 상세 배포 가이드
- [README.md](./README.md): 프로젝트 개요 및 로컬 실행
- Vercel Docs: https://vercel.com/docs
- Railway Docs: https://docs.railway.app

---

**문제 발생 시**: 터미널에서 로그를 복사하여 공유하면 빠르게 해결할 수 있습니다! 🚀
