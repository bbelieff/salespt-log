> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 세일즈PT 영업일지 docs/ 폴더의 전체 문서 인덱스와 사용 가이드
> - **누가 읽나요**: 전체 팀 (개발자, PM, 수강생)
> - **어떤 기능·작업과 연결?**: 문서 네비게이션, 지식 베이스 활용
> - **읽고 나면 알 수 있는 것**:
>   - 상황별 참고할 문서 위치
>   - 각 폴더의 역할과 문서 구조
> - **관련 문서**: 모든 하위 문서와 연결

# 📚 Documentation Index

⚠️ **이 프로젝트는 8주 수강생 전용 MVP입니다. 스코프는 [scope.md](./scope.md) 참조**

세일즈PT 영업일지 프로젝트의 모든 문서를 정리한 인덱스입니다.

## 📁 폴더 구조

| 폴더 | 설명 | 대상 독자 | 수정 권한 |
|------|------|-----------|-----------|
| **`scope.md`** | **MVP 스코프 정의와 용어** | **전체 팀** | **핵심 문서** |
| `domains/` | 기능별 설계 문서 | 개발자 | status에 따라 |
| `design/` | 디자인 토큰·컴포넌트 카탈로그·쇼케이스 | 개발자, 디자이너 | 토큰 변경 시 컴포넌트·preview 함께 업데이트 |
| `decisions/` | 아키텍처 결정 기록 (ADR) | 전체 팀 | 불변 (새 ADR로 supersede) |
| `plans/` | 작업 계획서 | 개발자, PM | active ↔ completed 이동 |
| `playbooks/` | 운영 매뉴얼 | 개발자 | 수시 업데이트 |
| `future/` | 향후 확장 기능 로드맵 | 전체 팀 | 트리거 기반 업데이트 |

## 📋 상황별 문서 가이드

### 🏗️ 개발을 시작할 때
1. **프로젝트 개요**: [CLAUDE.md](../CLAUDE.md) - 하네스 철학과 전체 구조
2. **MVP 스코프**: [scope.md](./scope.md) - 8주 수강생 전용 경계와 용어
3. **아키텍처**: [architecture.md](./architecture.md) - 레이어 규칙과 제약
4. **작업 시작**: [start-task.md](./playbooks/start-task.md) - Git Worktree 설정

### 📊 데이터 모델을 이해하고 싶을 때
1. **전체 개요**: [data-model.md](./domains/data-model.md) - Google Sheets 매핑
2. **관계 구조**: [er-diagram.md](./domains/er-diagram.md) - 엔티티 관계도
3. **상태 흐름**: [state-machines.md](./domains/state-machines.md) - 비즈니스 로직
4. **API 연동**: [api-spec.md](./domains/api-spec.md) - 엔드포인트 명세

### 🔧 기능 구현할 때
1. **MVP 범위**: [scope.md](./scope.md) - 8주 수강생 전용 IN/OUT 테이블
2. **화면별 기능**: [storyboard-mvp.md](./domains/storyboard-mvp.md) - 스토리보드
3. **사용자 여정**: [user-journeys.md](./domains/user-journeys.md) - 7개 핵심 시나리오
4. **화면 설계**: [wireframes.md](./domains/wireframes.md) - 4개 탭 와이어프레임
5. **예외 처리**: [edge-cases.md](./domains/edge-cases.md) - 엣지케이스 대응 방안
6. **품질 기준**: [quality.md](./quality.md) - 도메인×레이어 매트릭스
7. **활성 계획**: [plans/active/](./plans/active/) - 현재 진행 중인 작업

### 🎨 UI 색/간격 찾거나 새 컴포넌트 만들 때
1. **디자인 토큰**: [design/tokens.md](./design/tokens.md) - 색·타이포·간격 시스템
2. **컴포넌트 카탈로그**: [design/components.md](./design/components.md) - 41개 컴포넌트 스펙
3. **브라우저로 눈으로 보기**: [design/preview.html](./design/preview.html) - 인터랙티브 쇼케이스
   실행: `npx serve docs/design -l 5556` → http://localhost:5556/preview.html
4. **사용 가이드**: [design/README.md](./design/README.md) - 디자인 시스템 활용법

### 🚀 배포와 운영
1. **VPS 배포**: [deploy-vps.md](./playbooks/deploy-vps.md)
2. **Google Sheets 설정**: [setup-sheets.md](./playbooks/setup-sheets.md)
3. **하네스 문제 해결**: [fix-harness.md](./playbooks/fix-harness.md)

### 🤔 의사결정 히스토리
1. **하네스 도입**: [0001-adopt-harness.md](./decisions/0001-adopt-harness.md)
2. **기술 스택**: [0002-stack-nextjs-sheets.md](./decisions/0002-stack-nextjs-sheets.md)

### 🔮 향후 확장 기능
1. **확장 로드맵**: [future/extensions.md](./future/extensions.md) - P2/P3/P4 기능 우선순위

## 📄 전체 문서 목록

### 📋 핵심 문서
| 문서 | 한 줄 요약 | 대상 |
|------|------------|------|
| **[scope.md](./scope.md)** | **8주 수강생 전용 MVP 스코프 및 용어 정의** | **전체 팀** |

### 🎯 domains/ (기능별 설계)
| 문서 | Status | 한 줄 요약 | 대상 |
|------|--------|------------|------|
| [data-model.md](./domains/data-model.md) | draft | Google Sheets 1:1 매핑과 TypeScript 모델 | 개발자 |
| [er-diagram.md](./domains/er-diagram.md) | verified | 엔티티 관계도와 시트 매핑 | 개발자 |
| [state-machines.md](./domains/state-machines.md) | verified | Meeting/Payment/DBOrder 상태 전이 | 개발자 |
| [api-spec.md](./domains/api-spec.md) | verified | REST API 엔드포인트 명세 (동적 계산 원칙) | 개발자 |
| [storyboard-mvp.md](./domains/storyboard-mvp.md) | draft | 화면별 기능과 사용자 스토리 | PM, 개발자 |
| [user-journeys.md](./domains/user-journeys.md) | draft | 7개 핵심 사용자 시나리오 (유예 기간 포함) | 개발자, 기획자 |
| [wireframes.md](./domains/wireframes.md) | draft | 4개 탭별 와이어프레임 (편집 제한 포함) | 개발자, 디자이너 |
| [edge-cases.md](./domains/edge-cases.md) | draft | 예외 상황 (기간 제한 케이스 보강) | 개발자, QA |

### ⚖️ decisions/ (ADR - 불변)
| 문서 | 제목 | 결정 날짜 |
|------|------|-----------|
| [0001-adopt-harness.md](./decisions/0001-adopt-harness.md) | 하네스 엔지니어링 도입 | 2026-04-17 |
| [0002-stack-nextjs-sheets.md](./decisions/0002-stack-nextjs-sheets.md) | Next.js + Google Sheets 스택 선택 | 2026-04-17 |

### 📋 plans/ (작업 계획)
#### active/ (진행 중)
| 계획 | 우선순위 | 담당자 | 마감일 |
|------|----------|--------|--------|
| [01-auth-onboarding.md](./plans/active/01-auth-onboarding.md) | P0 | belie | 2026-04-25 |
| [02-meeting-booking.md](./plans/active/02-meeting-booking.md) | P1 | belie | 2026-04-30 |
| [03-meeting-results.md](./plans/active/03-meeting-results.md) | P1 | belie | 2026-05-05 |

#### completed/ (완료)
_현재 완료된 계획 없음_

### 🛠️ playbooks/ (운영 매뉴얼)
| 매뉴얼 | 용도 | 실행 시점 |
|--------|------|-----------|
| [start-task.md](./playbooks/start-task.md) | 새 작업 시작 환경 구성 | 매 작업 시작 시 |
| [setup-sheets.md](./playbooks/setup-sheets.md) | Google Sheets API 설정 | 프로젝트 초기 설정 |
| [deploy-vps.md](./playbooks/deploy-vps.md) | VPS 배포 및 Caddy 설정 | 배포 시 |
| [fix-harness.md](./playbooks/fix-harness.md) | 하네스 문제 해결 | 에이전트 실수 반복 시 |

### 🔮 future/ (향후 확장)
| 문서 | 한 줄 요약 | 업데이트 방식 |
|------|------------|---------------|
| [extensions.md](./future/extensions.md) | P2/P3/P4 확장 기능 로드맵과 트리거 조건 | 트리거 충족 시 |

## 🔄 문서 관리 규칙

### Status 관리 (domains/ 문서)
- **draft**: 초안, 검토 필요
- **verified**: 검토 완료, 안정
- **stale**: 코드와 불일치, 업데이트 필요

### 업데이트 규칙
1. **코드 변경 시**: 관련 domains/ 문서의 status를 stale로 강등
2. **월 1회**: 전체 문서 lint (고아 문서, 죽은 링크 점검)
3. **ADR은 불변**: 새로운 결정은 새 ADR로 작성

### 문서 작성 필수 요소
모든 `.md` 문서는 다음 요소를 포함해야 함:
- **문서 요약 카드**: 맨 위에 목적과 대상 명시
- **관련 문서 링크**: 연결된 문서들과의 관계
- **Status 프론트매터**: domains/ 문서는 상태 표시

---

## 🎯 이런 상황엔 이 문서를 읽으세요

- **"이 기능이 MVP 스코프에 포함되나?"** → [scope.md](./scope.md)
- **"8주/10주 기간 제한을 어떻게 구현하지?"** → [scope.md](./scope.md) + [edge-cases.md](./domains/edge-cases.md)
- **"사용자 입장에서 화면을 그리고 싶다"** → [wireframes.md](./domains/wireframes.md)
- **"예외 상황을 어떻게 처리할지 모르겠다"** → [edge-cases.md](./domains/edge-cases.md)
- **"새 기능 설계 전 비슷한 시나리오 찾고 싶다"** → [user-journeys.md](./domains/user-journeys.md)
- **"API 에러 코드가 무슨 의미인지 모르겠다"** → [api-spec.md](./domains/api-spec.md)
- **"데이터가 어떤 시트에 저장되는지 헷갈린다"** → [er-diagram.md](./domains/er-diagram.md)
- **"이 기능은 언제 구현하면 되지?"** → [future/extensions.md](./future/extensions.md)

---

💡 **TIP**: 특정 문서를 찾지 못하겠다면, 이 README의 "상황별 문서 가이드"를 먼저 확인하세요!