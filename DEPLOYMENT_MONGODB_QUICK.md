# 🚀 Vercel + MongoDB 배포 (5분 단계별 가이드)

## 준비물 확인

✅ GitHub에 코드 푸시됨  
✅ MongoDB URI: `.env.local`에 저장됨  
✅ Kakao Keys: `.env.local`에 저장됨  
✅ npm install mongodb: 완료됨  

---

## Step 1️⃣: 코드 푸시 (1분)

```bash
git add .
git commit -m "MongoDB + Vercel Serverless 통합"
git push origin main
```

---

## Step 2️⃣: Vercel 대시보드 접속

https://vercel.com/dashboard

---

## Step 3️⃣: 프로젝트 생성 (1분)

1. **"Add New Project"** 클릭
2. **GitHub 저장소** 선택: easygo
3. **"Import"** 클릭

---

## Step 4️⃣: 자동 설정 확인 (1분)

```
Framework: Vite ✅
Build Command: npm run build ✅
Output Directory: dist ✅
```

그대로 진행하면 됨

---

## Step 5️⃣: 환경 변수 설정 (2분)

### Settings → Environment Variables 탭에서 추가:

```bash
# 카카오맵 JavaScript Key
VITE_KAKAO_MAP_APP_KEY=7b6b514803b58ff1f2087e8bccbfbd7f

# 공공데이터 서비스 키
VITE_PUBLIC_DATA_SERVICE_KEY=eQaqrVvz7HoT3seuAaJ8rW4eNKU6GW%2BfLhDgLw8%2B6G3jtnJ6HqCSpZOoflkqNLy7E4n9VzxmVBg%2FHjQ3lFYRZQ%3D%3D

# MongoDB 연결 문자열 (중요!)
MONGODB_URI=mongodb+srv://jjchaser29_db_user:soupgil1004@cluster0.a89613a.mongodb.net/jjchaser29_db?retryWrites=true&w=majority

# 카카오 REST API Key
KAKAO_REST_API_KEY=ae254ada75303708017e804c98c90577

# API URL (배포 후 자동 생성되는 Vercel URL)
VITE_API_URL=https://your-project.vercel.app
```

**⚠️ VITE_API_URL은 배포 후 업데이트 필요**

---

## Step 6️⃣: Deploy 클릭 (1분 대기)

배포 진행 상황:
```
✓ Install dependencies
✓ Build Vite project
✓ Deploy Serverless Functions
✓ Ready to serve
```

**완료 URL**: `https://easygo-xxxxx.vercel.app`

---

## Step 7️⃣: VITE_API_URL 최종 업데이트 (선택)

Vercel 생성 URL로 VITE_API_URL 재설정:

```
VITE_API_URL = https://easygo-xxxxx.vercel.app
```

→ **Redeploy** 클릭

---

## ✅ 배포 완료 확인

### 프론트엔드 테스트
```bash
# 브라우저에서 열기
https://easygo-xxxxx.vercel.app

# 카카오맵이 보이면 ✅
```

### 백엔드 헬스 체크
```bash
curl https://easygo-xxxxx.vercel.app/api/health

# 응답: {"status":"ok","timestamp":"..."}  ✅
```

### MongoDB 연동 확인
```
1. 앱에서 "스캔 시작" 버튼 클릭
2. 체크포인트에서 체크인 (또는 비콘 시뮬레이션)
3. MongoDB Atlas에서 데이터 확인:
   - console.cloud.mongodb.com
   - Collections → easygo → records
   - 스탬프 기록이 저장되면 ✅
```

---

## 🎉 배포 완료!

**프론트엔드**: https://easygo-xxxxx.vercel.app  
**백엔드**: https://easygo-xxxxx.vercel.app/api/*  
**데이터베이스**: MongoDB Atlas  

모든 요청이 Vercel에서 처리됩니다! 🚀

---

## 📝 명령어 참고

```bash
# 로컬에서 API 테스트 (개발 중)
npm run dev:full

# 로컬에서 빌드 확인
npm run build

# Vercel 로그 보기
vercel logs easygo --follow

# 재배포 (환경 변수 변경 후)
vercel redeploy

# 프로덕션 배포
vercel --prod
```

---

## 🐛 에러 발생 시

### "MongoDB 연결 오류"
```
1. MONGODB_URI 확인 (콤마가 아닌 쉼표로 구분)
2. MongoDB Atlas 방화벽설정: IP 허용 0.0.0.0/0 (또는 Vercel IP 추가)
3. Vercel Logs에서 에러 메시지 확인
```

### "API 404 또는 timeout"
```
1. Vercel 로그 확인: vercel logs easygo
2. 환경 변수 모두 설정되었는지 확인
3. 재배포: vercel --prod
```

### "프론트엔드가 API 찾지 못함"
```
1. VITE_API_URL이 정확한 Vercel URL로 설정되었는지 확인
2. https:// (http가 아님!)
3. 끝에 슬래시 없음 (https://easygo-xxxxx.vercel.app 아님)
```

---

**이제 배포 완료! 🎊**

더 궁금한 점이나 문제가 있으면 터미널 로그를 공유해주세요.
