# 2026-11-05 01:00 feat/contact-script-popup — 업체정보 팝업 「대본」

- 담당 파일: components/CompanyInfoEditor.tsx, components/company-info/{CompanyInfoLayoutToggle,ContactScriptPanel}.tsx, app/api/contact-script/route.ts, lib/{types,config,service,query}/contact-script*, lib/repo/db/contact-scripts.ts, lib/repo/db/migrations/0015_contact_scripts.sql, 시험 3개, components.md·data-model.md
- 순서: 병합·배포 → DB Migrate dry-run(대기 = 0015 하나) → 적용. 배포~적용 사이 몇 분은 「대본」이 「불러오지 못했어요」를 보인다(다른 화면 영향 없음).
- 계획: docs/plans/active/contact-script.md
