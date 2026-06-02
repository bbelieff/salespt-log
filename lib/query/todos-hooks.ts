/**
 * React Query 훅 — 실무투두 (Scope 2).
 *
 * 캐시 키: ['todos', contractRef] (슬롯 ToDo 섹션은 계약 단위로 조회).
 * mutation 성공 시 해당 계약 + 캘린더(['month']) 무효화.
 */
"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import type { Todo, TodoType } from "@/types";
import { track, EVENTS } from "@/analytics";

export const todosKey = (contractRef: string) =>
  ["todos", contractRef] as const;

async function fetchJSON<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data?.error === "string" ? data.error : `HTTP ${res.status}`,
    );
  }
  return data as T;
}

interface ListResponse {
  todos: Todo[];
}

/** 한 계약(contractRef)의 ToDo 목록. */
export function useTodosByContract(
  contractRef: string,
): UseQueryResult<ListResponse> {
  return useQuery({
    queryKey: todosKey(contractRef),
    queryFn: () =>
      fetchJSON<ListResponse>(
        `/api/todos?contractRef=${encodeURIComponent(contractRef)}`,
      ),
    enabled: !!contractRef,
  });
}

export interface CreateTodoArgs {
  contractRef: string;
  institutionRef: string;
  업체명: string;
  type: TodoType;
  제목: string;
  예정일자: string;
  예정시각: string;
  장소: string;
  상세: string;
  showOnCalendar: boolean;
}

/** ToDo 생성 → 해당 계약 + 캘린더 무효화. */
export function useCreateTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTodoArgs) =>
      fetchJSON<{ ok: true; todo: Todo }>(`/api/todos`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, { contractRef, type }) => {
      track(EVENTS.TODO_CREATED, { todo_type: type });
      qc.invalidateQueries({ queryKey: todosKey(contractRef) });
      qc.invalidateQueries({ queryKey: ["month"] }); // 캘린더 갱신
    },
  });
}

export interface PatchTodoArgs {
  contractRef: string; // 캐시 invalidate용
  id: string;
  partial: Partial<Omit<Todo, "id">>;
}

/** ToDo 부분 수정 (완료 토글 등). 낙관적 업데이트로 체크 즉시 반영(서버 왕복 대기 X). */
export function usePatchTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, partial }: PatchTodoArgs) =>
      fetchJSON<{ ok: true }>(`/api/todos/${id}`, {
        method: "PATCH",
        body: JSON.stringify(partial),
      }),
    onMutate: async ({ contractRef, id, partial }) => {
      await qc.cancelQueries({ queryKey: todosKey(contractRef) });
      const prev = qc.getQueryData<ListResponse>(todosKey(contractRef));
      if (prev) {
        qc.setQueryData<ListResponse>(todosKey(contractRef), {
          todos: prev.todos.map((t) => (t.id === id ? { ...t, ...partial } : t)),
        });
      }
      return { prev, contractRef };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(todosKey(ctx.contractRef), ctx.prev);
    },
    onSuccess: () => {
      track(EVENTS.TODO_UPDATED);
    },
    onSettled: (_d, _e, { contractRef }) => {
      qc.invalidateQueries({ queryKey: todosKey(contractRef) });
      qc.invalidateQueries({ queryKey: ["month"] });
    },
  });
}

export interface RemoveTodoArgs {
  contractRef: string;
  id: string;
}

/** ToDo 삭제. */
export function useRemoveTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: RemoveTodoArgs) =>
      fetchJSON<{ ok: true }>(`/api/todos/${id}`, { method: "DELETE" }),
    onSuccess: (_, { contractRef }) => {
      track(EVENTS.TODO_REMOVED);
      qc.invalidateQueries({ queryKey: todosKey(contractRef) });
      qc.invalidateQueries({ queryKey: ["month"] });
    },
  });
}
