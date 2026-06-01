/**
 * Layer: service — 실무투두 유스케이스 (Scope 2).
 *
 * 05 실무투두 탭 CRUD. payment 슬롯 ToDo 섹션 + 캘린더(읽기)가 사용.
 * id/생성시각은 서버에서 생성 (호출 측은 도메인 필드만 전달).
 */
import { randomUUID } from "node:crypto";
import { findUserByEmail } from "@/repo/users";
import {
  appendTodo,
  clearTodo,
  listTodosByContract,
  updateTodo as updateTodoRow,
} from "@/repo/todos";
import { Todo } from "@/types";

async function resolveSheet(email: string): Promise<string> {
  const user = await findUserByEmail(email);
  if (!user) throw new Error(`[todos] 등록되지 않은 사용자: ${email}`);
  return user.spreadsheetId;
}

/** 한 계약(contractRef)의 ToDo 목록 (슬롯 ToDo 섹션용). */
export async function listTodos(
  email: string,
  contractRef: string,
): Promise<Todo[]> {
  const spreadsheetId = await resolveSheet(email);
  return listTodosByContract(spreadsheetId, contractRef);
}

/** 생성 입력 — id/생성시각/완료여부는 서버 기본값. */
export type CreateTodoInput = Omit<Todo, "id" | "생성시각" | "완료여부">;

/** ToDo 1건 생성 (id=UUID, 생성시각=ISO, 완료여부=false). */
export async function createTodo(
  email: string,
  input: CreateTodoInput,
): Promise<Todo> {
  const spreadsheetId = await resolveSheet(email);
  const todo = Todo.parse({
    ...input,
    id: randomUUID(),
    완료여부: false,
    생성시각: new Date().toISOString(),
  });
  return appendTodo(spreadsheetId, todo);
}

/** ToDo 부분 수정 (완료 토글·내용 변경 등). */
export async function patchTodo(
  email: string,
  id: string,
  partial: Partial<Omit<Todo, "id">>,
): Promise<void> {
  const spreadsheetId = await resolveSheet(email);
  await updateTodoRow(spreadsheetId, id, partial);
}

/** ToDo 삭제 (행 clear). */
export async function removeTodo(email: string, id: string): Promise<void> {
  const spreadsheetId = await resolveSheet(email);
  await clearTodo(spreadsheetId, id);
}
