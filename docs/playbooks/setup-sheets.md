# Playbook — Google Sheets 백엔드 세팅 (v4)

## 📄 이 문서는 무엇인가요?

- **한 줄 요약**: 신규 기수 / 신규 수강생 시작 시 admin 이 따라야 할 시트 prep 운영 가이드.
- **누가 읽나요**: admin (운영자), 시트 권한 트러블슈팅 중인 개발자.
- **어떤 기능·작업과 연결?**: claim 흐름, SA write 권한, registry users 탭.
- **읽고 나면 알 수 있는 것**:
  - 신규 수강생 시트는 어디에 만들어야 SA 가 자동으로 권한 받는가?
  - 새 기수 시작 시 어떤 순서로 prep 해야 권한 누락이 없는가?
  - "The caller does not have permission" 받았을 때 무엇부터 확인하는가?
- **관련 문서**: `docs/decisions/0004-post-incident-hardening-2026-05-13.md` (권한 모델 v4 결정), `docs/domains/sheet-structure.md` (시트 탭 구조).

---

## 0. 권한 모델 진화사 (왜 v4 인가)

이 운영 가이드는 4번 변경됨. 같은 함정 다시 안 빠지게 history 박제:

- **v1 (~ 2026-05-11)**: 수강생이 직접 시트 만듦. SA 권한을 admin 이 시트마다 수동 추가. → 빠뜨림 흔함.
- **v2 (5/11~5/12)**: admin 이 시트 복제·소유. Drive 폴더 단위 공유. → 폴더 외부에 만든 시트들 권한 누락 (6기·4기 사고).
- **v3 (5/12)**: OAuth `drive` scope + admin token 으로 자동 share API 신설. → 외부 수강생 OAuth 동의 시 sensitive scope 가 access_denied (김현지 사고).
- **v4 (현재)**: `drive` scope 제거. 폴더 권한 상속 방식으로 회귀 + 운영 절차 강화.

---

## 1. Google Cloud 프로젝트
1. https://console.cloud.google.com/ 에서 프로젝트 생성.
2. **API 및 서비스 → 라이브러리** 에서 두 개 활성화:
   - Google Sheets API
   - Google Drive API
3. **OAuth 동의 화면** 구성 (외부). 수강생 이메일을 test users 에 등록.
   - scope: `openid email profile` 만. **`drive` scope 추가 금지** — 외부 사용자가 sensitive scope 동의 어려움 (v3 사고).
4. **사용자 인증 정보 → OAuth 2.0 클라이언트 ID** 생성 (웹 애플리케이션).
   - 승인된 리디렉션 URI: `https://<your-domain>/api/auth/callback/google` + 로컬은 `http://localhost:3000/api/auth/callback/google`
   - Client ID / Client Secret 을 `.env.production` 의 `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` 에 주입.

## 2. 서비스 계정 (시트 접근용)
1. **IAM → 서비스 계정 → 만들기**. 역할은 비워도 됨.
2. **키 → 새 키 → JSON** 발급 → 레포 **바깥** 안전한 경로에 저장. 절대 커밋 X.
3. JSON 에서 `client_email` 과 `private_key` 를 `.env.production` 에 주입:
   ```
   GOOGLE_SERVICE_ACCOUNT_EMAIL=...@....iam.gserviceaccount.com
   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```
   (Vercel/VPS 환경변수에는 개행을 `\n` 문자열로 넣고, 앱이 런타임에 복원)

## 3. admin Drive 폴더 + SA 권한 상속 (v4 핵심)

**모든 trainee 시트는 이 폴더 안에 들어가야 한다.** 폴더 밖에 만든 시트는 SA 권한 누락으로 사고 발생.

1. admin 운영 계정 (예: `leadbzcenter@gmail.com`) 으로 Google Drive 접속.
2. "세일즈PT 수강생 시트" 폴더 생성 (이름 자유, 한 곳에 통일).
3. 폴더 우클릭 → 공유 → SA email 을 **편집자 (Editor)** 로 추가.
   - "알림 보내기" 체크 해제 (SA 에 메일 안 보내도 됨).
4. 이후 모든 trainee 시트는 이 폴더 안에서 만들거나 만들고 폴더로 이동시킴.
5. 폴더 권한이 자식 파일에 자동 상속 → SA 가 자동으로 writer 권한.

**확인 명령** (VPS 에서):
```bash
node -e "
const {google}=require('googleapis');
const auth=new google.auth.JWT({email:process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key:process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\\\n/g,'\\n'),
  scopes:['https://www.googleapis.com/auth/drive']});
google.drive({version:'v3',auth}).files.get({
  fileId:'<sheetId>',
  fields:'capabilities(canEdit)',supportsAllDrives:true
}).then(r=>console.log(r.data));
"
# capabilities.canEdit: true 면 정상
```

## 4. 마스터 레지스트리 시트 (`users` 탭)

1. 새 스프레드시트 생성 → 이름 예: `salespt-master-registry`.
2. 탭 이름 `users`. 첫 행:
   ```
   email | cohort | name | spreadsheetId | role | status | assignedTrainer
   ```
3. SA email 을 **편집자**로 공유 (또는 위 폴더에 두면 상속).
4. 스프레드시트 ID 복사 → `.env.production` 의 `SHEETS_REGISTRY_ID`.

## 5. 신규 기수 시작 시 운영 순서

### A. 시트 템플릿 준비
- 표준 템플릿 (대시보드 수식 + 4탭 구조) 을 admin 폴더 안 별도 "_템플릿" 폴더에 보관.
- 새 수강생 시작 시 템플릿을 **"사본 만들기"** 로 복제.

### B. 시트 이름 패턴 강제
```
세일즈PT_ N기 [이름] 수강생 경영일지
```
- 패턴 어긋나면 `findSheetByCohortName` 의 Drive 검색이 실패.

### C. 시트 데이터 초기화 (중요!)
복제하면 템플릿의 B3/C3/O1/O2 데이터가 그대로 따라옴. 다음 셀을 명시 정정:

| 셀 | 값 |
|---|---|
| B3 (01 영업관리) | 정확한 기수 숫자 (예: "7") |
| C3 (01 영업관리) | 수강생 이름 |
| O1 (01 영업관리) | 수강시작일 (full date, year 포함) |
| O2 (01 영업관리) | `=O1+57` 또는 직접 입력 |

**O1/O2 에 `"5/15"` 같은 month/day 만 입력 금지** — `new Date("5/15")` Invalid Date → 헤더 깨짐. 반드시 full date (YYYY-MM-DD).

> 코드 차원에서는 `claimAccount` 가 B3/C3 빈 셀을 self-claim 시 채워주지만, O1/O2 는 운영자 입력 책임.

### D. registry 등록
admin 웹 화면 `/admin/users` 에서:
- **단일 prep**: 시트 URL + cohort + name → `POST /api/admin/add-trainee-prep`
- **일괄 prep**: paste 모드로 여러 줄 한 번에 → `POST /api/admin/bulk-add-trainee-prep`

prep row 의 email 컬럼은 비워두면 됨 — 수강생 self-claim 시 채워짐.

### E. 수강생 안내
수강생에게 다음만 안내:
- 사이트 주소
- 본인 Gmail 계정으로 로그인
- /claim 페이지에서 기수·이름 입력

수강생 본인이 시트 직접 만들면 안 됨 (admin 폴더 밖 → 권한 누락).

## 6. 트러블슈팅

### "The caller does not have permission" (시트 write 실패)
- 원인: SA 가 그 시트에 writer 권한 없음.
- 해결: 시트가 admin 폴더 안에 있는지 확인. 폴더 밖이면 폴더로 이동 또는 시트 공유 설정에서 SA 를 editor 로 명시 추가.
- 일괄 점검 스크립트: `audit-permissions.mjs` (이전 사고 시 작성).

### /claim 무한루프 (오류 메시지 없음)
- 원인 후보:
  1. registry 의 cohort 컬럼이 number 로 저장 → `parseRow` 의 String() wrap 빠짐. (PR #158 에서 fix 됨, 재발 시 `lib/repo/sheets-client.ts:readRange` 의 string 정규화 확인)
  2. /api/me 가 500 (`getFullYear is not a function` 류) → `unstable_cache` 에 Date 객체 들어감. (PR #161 에서 fix 됨, 재발 시 `lib/service/me.ts` cache wrapper 확인)
  3. 시트 O1/O2 가 `"5/15"` 같은 invalid date string → 운영자 입력 정정.

### 헤더 cohort/name placeholder ("—")
- 시트 B3/C3 빈 셀. 운영자 직접 입력 또는 self-claim 재시도.
- 새 신규 수강생은 `claimAccount` 멱등 fix (PR #fix/post-incident...) 후 자동 채워짐.

### 여러 trainee 번갈아 조회 시 첫 사람 시트 고정
- impersonation cache 잔존. PR #163 (queryClient.clear 도입) 후 해결.

### PR 머지했는데 prod 에 fix 안 들어간 듯
- GitHub Actions deploy job 로그 확인. OOM build 가 silent 하게 죽었을 수 있음.
- VPS 에서: `ls /opt/salespt-log/.next/BUILD_ID` 와 `pm2 list | grep salespt-log` 의 uptime 비교.
- BUILD_ID 가드 (PR #162) 이후로는 명시 fail 됨.

## 7. 가드레일 (자동 강제)

`tests/structural/layers.test.ts` 가 다음을 막는다:
- `lib/repo/` 밖에서 `googleapis` import → ❌
- `SHEET_RANGES.dashboard` 를 쓰기 API 근처에서 사용 → ❌

우회하지 말고 Repo 에 메서드를 추가해 호출을 위임하라.
