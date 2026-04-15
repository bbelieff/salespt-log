# Playbook — Google Sheets 백엔드 세팅

## 1. Google Cloud 프로젝트
1. https://console.cloud.google.com/ 에서 프로젝트 생성.
2. **API 및 서비스 → 라이브러리** 에서 두 개 활성화:
   - Google Sheets API
   - Google Drive API
3. **OAuth 동의 화면** 구성 (내부 또는 외부). 수강생이 외부면 testing 단계 또는 publish.
4. **사용자 인증 정보 → OAuth 2.0 클라이언트 ID** 생성 (웹 애플리케이션).
   - 승인된 리디렉션 URI: `https://<your-domain>/api/auth/callback/google` 그리고 로컬은 `http://localhost:3000/api/auth/callback/google`
   - Client ID / Client Secret 을 `.env.local` 의 `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` 에 주입.

## 2. 서비스 계정 (시트 접근용)
1. **IAM → 서비스 계정 → 만들기**. 역할은 비워도 됨.
2. **키 → 새 키 → JSON** 발급 → 레포 **바깥** 안전한 경로에 저장. 절대 커밋 X.
3. JSON 에서 `client_email` 과 `private_key` 를 `.env.local` 에 주입:
   ```
   GOOGLE_SERVICE_ACCOUNT_EMAIL=...@....iam.gserviceaccount.com
   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```
   (Vercel/Docker 환경변수에는 개행을 `\n` 문자열로 넣고, 앱이 런타임에 복원)

## 3. 마스터 레지스트리 시트
1. 새 스프레드시트 생성 → 이름 예: `salespt-users-registry`.
2. 탭 이름 `users`. 첫 행:
   ```
   email | cohort | name | spreadsheetId | role
   ```
3. 서비스 계정 이메일을 **편집자**로 공유.
4. 스프레드시트 ID 복사 → `.env.local` 의 `SHEETS_REGISTRY_ID`.
5. 기존 수강생 시트들을 한 줄씩 등록. 예:
   ```
   student1@gmail.com | PRM 5기 | 김철수 | 1AbCd...efg | trainee
   ```

## 4. 수강생 개별 시트
- 각 수강생은 **기존에 복제된 시트**를 그대로 사용.
- 각 시트에 서비스 계정을 **편집자** 공유 추가 (읽기·쓰기 둘 다 필요).
- 앱이 쓰기 위해 **`앱_일일입력`** 이라는 전용 탭이 있어야 한다. 없으면 앱이 첫 쓰기 시 생성(또는 트레이너가 미리 템플릿에 추가).
- 시트 대시보드(탭1) 수식이 `앱_일일입력!B:E` 를 집계하도록 한 번만 연결해두면, 이후 앱이 쓸 때마다 자동 갱신.

## 5. 연결 확인
```bash
npm run dev
# 다른 터미널
curl http://localhost:3000/api/debug/sheets  # (나중에 추가할 디버그 엔드포인트)
```

오류 대응:
- `PermissionDenied` → 3-3 또는 4-2 공유 누락.
- `Requested entity was not found` → spreadsheetId 오타.
- `429 Quota exceeded` → 캐시/배치화 필요. ADR 을 열고 캐시 레이어 도입.

## 6. 가드레일 (자동 강제)
`tests/structural/layers.test.ts` 가 다음을 막는다:
- `lib/repo/` 밖에서 `googleapis` import → ❌
- `SHEET_RANGES.dashboard` 를 쓰기 API 근처에서 사용 → ❌

우회하지 말고 Repo 에 메서드를 추가해 호출을 위임하라.
