/**
 * 수리3 레이아웃 회귀 픽스처 — /admin/trainers 페이지 셸과 /trainer 상단 카드.
 *
 * 실제 제품 컴포넌트와 실제 Tailwind CSS를 쓰고, 서버 경계(API·세션)만 합성한다.
 * 셸 마크업은 app/admin/trainers/page.tsx · app/trainer/page.tsx 의 return 블록을
 * verbatim 으로 옮긴 것이다 — 여기서 폭 클래스를 바꾸면 검증 의미가 없어진다.
 */
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import TopHeader from "@/components/TopHeader";
import TrainerInvites from "@/components/auth/TrainerInvites";
import TrainerAccessEditor from "@/components/auth/TrainerAccessEditor";
import TrainerMgmtPanel from "@/components/auth/TrainerMgmtPanel";
import type { PanelUser } from "@/components/auth/TrainerMgmtSections";
import type { TrainerAccessPerson } from "@/types/trainer-access";
import { defaultTrainerGrants } from "@/util/trainer-access-policy";

const trainee = (n: number, cohort: string): PanelUser => ({
  email: `trainee${n}@example.com`,
  name: `테스트 수강생${n}`,
  cohort,
  spreadsheetId: "",
  role: "trainee",
  status: "active",
  assignedTrainer: "trainer1@example.com",
});

const trainers: PanelUser[] = [
  {
    email: "trainer1@example.com",
    name: "테스트 트레이너",
    cohort: "T",
    spreadsheetId: "",
    role: "trainer",
    status: "active",
    assignedTrainer: "",
  },
];

const trainees: PanelUser[] = [trainee(1, "7기"), trainee(2, "8기")];

const people: TrainerAccessPerson[] = [
  {
    email: "trainer1@example.com",
    name: "테스트 트레이너",
    status: "active",
    grade: null,
    version: 0,
    grants: defaultTrainerGrants(null),
  },
];

/** app/admin/trainers/page.tsx 의 return 블록과 동일 구조. */
function AdminTrainersFixture() {
  return (
    <>
      <div className="mx-auto max-w-3xl pc:max-w-5xl space-y-8 px-6 py-6">
        <div data-qa="invites">
          <TrainerInvites />
        </div>
        <div data-qa="access-editor">
          <TrainerAccessEditor initialPeople={people} />
        </div>
      </div>
      <div data-qa="mgmt-panel">
        <TrainerMgmtPanel
          sessionEmail="admin@example.com"
          pendingTrainers={[]}
          activeTrainers={trainers}
          managementStaff={[]}
          trainees={trainees}
        />
      </div>
    </>
  );
}

/** app/trainer/page.tsx 의 상단 두 블록 + layout 의 TopHeader 와 동일 구조. */
function TrainerFixture() {
  return (
    <>
      <TopHeader
        pageEmoji=""
        pageTitle="트레이너"
        pageAction={{ href: "/admin", label: "← 마스터 메뉴" }}
      />
      <div className="mx-auto max-w-3xl px-6 pt-6">
        <a
          data-qa="weekly-goal"
          href="/trainer/weekly-goals"
          className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 hover:bg-gray-50"
        >
          <span aria-hidden className="text-lg">📋</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-gray-900">담당 수강생 주간 목표·PT과제</span>
            <span className="block text-xs text-gray-500">이번 주 목표와 PT과제 확인</span>
          </span>
          <span aria-hidden className="shrink-0 text-gray-400">→</span>
        </a>
      </div>
      <div className="mx-auto max-w-3xl px-6">
        <div data-qa="invites">
          <TrainerInvites />
        </div>
      </div>
    </>
  );
}

function App() {
  const mode = new URLSearchParams(window.location.search).get("fixture");
  return mode === "trainer" ? <TrainerFixture /> : <AdminTrainersFixture />;
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("fixture: #root 없음");
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(rootEl).render(
  <QueryClientProvider client={client}>
    <App />
  </QueryClientProvider>,
);
