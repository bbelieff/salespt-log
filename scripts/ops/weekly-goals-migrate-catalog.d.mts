export class MigrationGateError extends Error {
  constructor(code: string);
  code: string;
  diagnostic?: unknown;
}
export function formatMigrationFailure(error: unknown, fallback: string): string;
