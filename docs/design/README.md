> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 세일즈PT 영업일지의 디자인 시스템 폴더 인덱스와 사용 가이드
> - **누가 읽나요**: 개발자, UI/UX 디자이너, PM
> - **어떤 기능·작업과 연결?**: 모든 UI 개발, 브랜딩, 시각적 일관성 유지
> - **읽고 나면 알 수 있는 것**:
>   - 디자인 토큰과 컴포넌트 시스템 구조
>   - 각 문서의 역할과 사용법
>   - 쇼케이스 페이지 여는 방법
> - **관련 문서**: [CLAUDE.md](../../CLAUDE.md), [wireframes.md](../domains/wireframes.md)

# 🎨 Design System

세일즈PT 영업일지의 디자인 시스템 문서 모음입니다. 모든 UI 요소의 일관성과 사용성을 보장하기 위한 중앙 집중식 디자인 규칙을 정의합니다.

## 📁 폴더 구성

| 파일 | 역할 | 업데이트 빈도 | 의존성 |
|------|------|---------------|--------|
| `tokens.md` | 색상, 타이포, 간격 정의 | 낮음 | 브랜드 가이드라인 |
| `components.md` | UI 컴포넌트 카탈로그 | 높음 | tokens.md |
| `preview.html` | 브라우저 쇼케이스 | 중간 | tokens.md, components.md |
| `README.md` | 이 파일 (폴더 인덱스) | 낮음 | 전체 시스템 |

## 🎯 디자인 원칙

### 1. 일관성 (Consistency)
- **채널 4색 고정**: 매입DB(blue), 직접생산(green), 현수막(amber), 콜·지·기·소(purple)
- **토큰 우선**: 임의 값(`text-[15px]`) 사용 금지, 토큰에 없으면 토큰부터 정의
- **컴포넌트 재사용**: 같은 용도에는 동일한 컴포넌트 사용

### 2. 접근성 (Accessibility)
- **터치 타겟**: 최소 44px × 44px 크기
- **대비비**: 텍스트 4.5:1, 배지/라벨 3:1 이상 (WCAG AA)
- **키보드 네비게이션**: 모든 인터랙티브 요소에 focus 상태

### 3. 반응성 (Responsiveness)
- **모바일 우선**: 375px 기준 설계 후 확장
- **Progressive Enhancement**: 모바일 → 태블릿 → 데스크톱 순 대응
- **터치 친화적**: 충분한 간격과 명확한 시각적 피드백

## 📖 사용 가이드

### 🚀 빠른 시작

1. **색상이 필요할 때**: [tokens.md](./tokens.md) → "색상 시스템" 섹션
2. **새 버튼/카드 만들 때**: [components.md](./components.md) → 해당 컴포넌트 섹션  
3. **시각적으로 확인하고 싶을 때**: [preview.html](./preview.html) 브라우저로 열기

### 📝 디자인 토큰 사용법

```html
<!-- ✅ 올바른 사용 -->
<span class="badge badge-purchase">매입DB</span>
<div class="bg-blue-50 text-blue-700 p-3 rounded-lg">영업이익: +125만원</div>

<!-- ❌ 잘못된 사용 -->
<span class="text-[14px] bg-[#e0f2fe] text-[#0277bd]">매입DB</span>
<div style="color: #1976d2; background: #e3f2fd;">영업이익: +125만원</div>
```

### 🧩 컴포넌트 사용법

```html
<!-- 스테퍼 컴포넌트 -->
<div class="flex items-center gap-2">
  <button class="stepper-btn bg-gray-200 hover:bg-gray-300 text-gray-700">-</button>
  <input type="number" class="stepper-val" value="12">
  <button class="stepper-btn bg-blue-500 hover:bg-blue-600 text-white">+</button>
</div>
```

## 🌐 쇼케이스 페이지 (preview.html)

모든 디자인 요소를 실제 브라우저에서 확인할 수 있는 인터랙티브 페이지입니다.

### 로컬에서 여는 방법

**방법 1: 정적 서버 사용 (권장)**
```bash
npx serve docs/design -l 5556
# → http://localhost:5556/preview.html
```

**방법 2: 직접 파일 열기**
```bash
open docs/design/preview.html
# 또는 브라우저에서 파일://경로로 직접 열기
```

**방법 3: VS Code Live Server**
```
VS Code → preview.html 우클릭 → "Open with Live Server"
```

### 포함된 섹션
- 🎨 **색상**: 브랜드, 채널, 시맨틱 색상 팔레트
- ✏️ **타이포그래피**: text-xs부터 text-3xl까지 실제 한국어 렌더링
- 📐 **간격**: gap-1부터 gap-6까지 시각적 비교
- 🧩 **컴포넌트**: 모든 버튼, 입력, 카드, 배지 실제 렌더링
- 💰 **재무 시각화**: 양수/음수 케이스별 색상 규칙
- 📊 **채널 탭**: 4개 채널 클릭 시 색상 변화 데모

## 🔄 업데이트 규칙

### 디자인 변경 시 필수 작업
1. **토큰 변경** → `tokens.md` 업데이트 → `preview.html` 반영
2. **새 컴포넌트** → `components.md`에 등록 → `preview.html`에 추가
3. **기존 컴포넌트 수정** → `components.md` 업데이트 → `preview.html` 동기화

### 문서 동기화 체크
```bash
# 토큰과 쇼케이스 일치 여부
diff <(grep -o "text-[a-z0-9-]*\|bg-[a-z0-9-]*" docs/design/tokens.md | sort -u) \
     <(grep -o "text-[a-z0-9-]*\|bg-[a-z0-9-]*" docs/design/preview.html | sort -u)

# 컴포넌트와 쇼케이스 일치 여부  
grep "###" docs/design/components.md | wc -l  # 컴포넌트 수
grep -c "class.*font-semibold.*mb-4" docs/design/preview.html  # 쇼케이스 섹션 수
```

## 🚫 금지 사항

### 절대 하지 말 것
- **채널 색상 변경**: 4개 채널 색상은 사용자 학습 완료로 변경 금지
- **임의 값 사용**: `text-[15px]`, `bg-[#abcdef]` 등 토큰에 없는 값 사용
- **인라인 스타일**: `style=""` 속성으로 디자인 적용 금지
- **쇼케이스 미동기화**: 토큰/컴포넌트 변경 시 `preview.html` 업데이트 생략

### 주의해야 할 것
- **다크모드**: 현재 미지원. 추가 시 전체 토큰 체계 재검토 필요
- **브라우저 호환성**: IE 미지원, Chrome/Safari/Firefox 최신 버전 기준
- **성능**: 쇼케이스는 데모용. 실제 앱에서는 필요한 컴포넌트만 로드

## 🔗 관련 문서

### 프로젝트 전체
- [CLAUDE.md](../../CLAUDE.md): 하네스 철학과 전체 구조
- [architecture.md](../architecture.md): 레이어 규칙과 제약

### 도메인 문서  
- [wireframes.md](../domains/wireframes.md): 4개 탭별 와이어프레임
- [user-journeys.md](../domains/user-journeys.md): 사용자 시나리오

### 기술 문서
- [api-spec.md](../domains/api-spec.md): REST API 엔드포인트
- [quality.md](../quality.md): 품질 매트릭스

---

## 💡 이런 상황에 이 폴더를 사용하세요

- **"이 버튼은 어떤 색이어야 하지?"** → [tokens.md](./tokens.md)
- **"스테퍼는 어떻게 만들지?"** → [components.md](./components.md)
- **"실제로 어떻게 보이는지 확인하고 싶어"** → [preview.html](./preview.html)
- **"채널 색상을 바꿔야겠어"** → ❌ **금지!** 채널 4색은 고정
- **"새로운 컴포넌트를 추가했어"** → `components.md` 등록 → `preview.html` 추가

---

🎨 **디자인 결정은 모두 이 폴더의 토큰·컴포넌트 카탈로그를 따릅니다.**
새로운 UI 요소는 반드시 이 시스템 안에서 정의되어야 합니다.