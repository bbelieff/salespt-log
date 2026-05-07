> **📄 이 디렉토리는 무엇인가요?**
> - **한 줄 요약**: claude.ai 프로젝트 → Claude Code로 들어오는 핸드오프 패키지를 원본 그대로 보존하는 inbox
> - **누가 읽나요**: Claude Code, 외부 세션 (디스커버리/포팅 시 참조)
> - **읽고 나면 알 수 있는 것**:
>   - 각 timestamped 폴더가 어떤 작업의 input이었는지
>   - 핸드오프 받은 시점의 prototype·결정사항·디스커버리 체크리스트
> - **관련 문서**: 각 폴더 내부의 `HANDOFF_README.md`

# Handoff Inbox

claude.ai 프로젝트가 보낸 prototype HTML / 결정 로그 / 데이터 디스커버리 체크리스트
원본을 **읽기 전용 보존**.

## 원칙

1. **원본 그대로 (immutable)** — 받은 그대로 git에 박제. 절대 수정하지 않는다.
2. **timestamped 폴더** — `<topic>-<YYYY-MM-DD>/` 네이밍.
3. **SSOT 갱신은 별도** — 이 inbox 내용을 SSOT(`docs/domains/`, `docs/design/`)에 옮길 때는
   별도 PR로 SSOT 문서를 수정. inbox 자체는 손대지 않는다.

## 폴더 목록

| 폴더 | 받은 일자 | 내용 |
|---|---|---|
| `dashboard-2026-05-07/` | 2026-05-07 | Dashboard 페이지 prototype + 결정 로그 + 시트 디스커버리 체크리스트 |

## 작업 흐름

```
claude.ai 프로젝트 → 핸드오프 zip → wt/_handoff_inbox 임시 추출 →
  여기 inbox/ 에 timestamped 폴더로 git add (immutable) →
  별도 PR로 SSOT 갱신 (data-model.md / components.md / sheet-structure.md / tokens.md)
```
