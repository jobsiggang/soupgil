# Vercel 배포 가이드

## 배포 전략

EASYGO는 **Vite React 프론트엔드 + Express 백엔드** 구조입니다.
가장 간단한 배포 방법:

### 1️⃣ 프론트엔드 배포 (Vercel)
```bash
npm run build
```
Vercel에서 자동으로 dist/ 폴더를 호스팅합니다.

### 2️⃣ 백엔드 배포 (Railway 또는 Render)
Express 서버를 별도 호스팅으로 배포합니다.

---

## ⚡ Vercel에 프론트엔드 배포

### 사전 준비
1. [vercel.com](https://vercel.com) 가입 (GitHub 연동 권장)
2. GitHub에 코드 푸시

### 배포 단계

#### 방법 1: GitHub 연동 (권장)

```bash
# 로컬에서 GitHub 저장소로 푸시
git add .
git commit -m "배포 준비: Vercel 설정 추가"
git push origin main
```

**Vercel 대시보드에서:**
1. "New Project" 클릭
2. GitHub 저장소 선택
3. Framework: "Vite" 선택 (자동 감지됨)
4. Build Command: `npm run build` (기본값)
5. Output Directory: `dist` (기본값)

#### 방법 2: Vercel CLI

```bash
# Vercel CLI 설치
npm i -g vercel

# 로그인
vercel login

# 배포
vercel

# 프로덕션 배포
vercel --prod
```

### 환경 변수 설정

Vercel 프로젝트 Settings → Environment Variables에 추가:

```
VITE_KAKAO_MAP_APP_KEY=<카카오 JavaScript key>
VITE_PUBLIC_DATA_SERVICE_KEY=<공공데이터 서비스 키>
VITE_API_URL=<백엔드 URL>  # 예: https://easygo-backend.railway.app
```

---

## 🚂 백엔드 배포 (Railway)

### 1. Railway 계정 생성

[railway.app](https://railway.app) 접속 → GitHub 연동

### 2. 새 프로젝트 생성

```bash
# GitHub 저장소 연동
# Railway 대시보드: "New" → "Project from repo"
```

### 3. 환경 변수 설정

Railway 프로젝트 Settings → Variables:

```
VITE_KAKAO_REST_API_KEY=<카카오 REST API key>
PORT=3000 (자동 할당)
NODE_ENV=production
```

### 4. 배포 확인

생성된 공개 URL을 `VITE_API_URL`로 사용합니다.

```bash
# 예: https://easygo-backend.railway.app
# 헬스 체크: curl https://easygo-backend.railway.app/api/health
```

---

## 기타 백엔드 호스팅 옵션

| 서비스 | 가격 | 특징 |
|--------|------|------|
| **Railway** | 무료: $5/월 | 간단, GitHub 연동 |
| **Render** | 무료 (슬립 있음) | 자유로운 배포 |
| **Fly.io** | 무료 (제한) | 전역 배포 |
| **AWS Elastic Beanstalk** | 저가 | 확장성 우수 |

---

## 🔗 프론트엔드 ↔ 백엔드 연결

배포 후 프론트엔드의 `VITE_API_URL`을 백엔드의 공개 URL로 설정:

```bash
# Vercel 환경 변수 설정
VITE_API_URL=https://easygo-backend.railway.app
```

---

## 🗄️ 데이터베이스 고려사항

현재: **파일 기반 JSON 저장** (Vercel Serverless 미지원)

프로덕션 권장:
- **Supabase** (PostgreSQL, 무료 호스팅)
- **MongoDB Atlas** (NoSQL, 무료 클러스터)
- **PlanetScale** (MySQL, 무료 티어)

마이그레이션 예시:

```javascript
// 기존: fs.writeFileSync()
// 변경: await supabase.from('users').insert(...)
```

---

## ✅ 배포 체크리스트

- [ ] GitHub에 코드 푸시
- [ ] Vercel에 프론트엔드 배포
- [ ] Railway에 백엔드 배포
- [ ] 환경 변수 모두 설정
- [ ] 보안: .env.local 파일은 .gitignore에 포함 (⚠️ 확인!)
- [ ] 헬스 체크: `/api/health` 응답 확인
- [ ] 통합 테스트: Vercel → Railway 통신 확인

---

## 🐛 배포 후 문제 해결

### CORS 에러
```
Access to XMLHttpRequest blocked
```
**해결:** 백엔드 cors 설정 확인
```javascript
app.use(cors({ origin: 'https://your-vercel-domain.vercel.app' }))
```

### API 연결 실패
```bash
# 백엔드 로그 확인
vercel logs <project-name>  # Vercel
railway logs                # Railway
```

### 환경 변수 미적용
```bash
# 변경 후 재배포 필요
vercel --prod
```

---

## 📚 추가 리소스

- [Vercel Docs: Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Railway Docs: Deploy](https://docs.railway.app/deploy/deployments)
- [Vite: Deployment](https://vitejs.dev/guide/static-deploy.html)
