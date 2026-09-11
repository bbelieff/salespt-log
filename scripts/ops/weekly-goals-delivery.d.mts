export const PAYLOAD: string[];
export function sha256(bytes: string | Uint8Array): string;
export interface Inputs { sha: string; actualSha: string; sqlChecksum: string; mode: string; execute: string; runId: string; attempt: string; repairHistoryAcl?: string; compareRuntime?: string }
export function validateInputs(input: Inputs): string;
export function validateInventory(input: unknown): { version: string; checksum: string }[];
export function buildArtifact(root: string, destination: string, inputs: Inputs): Promise<{ manifestChecksum: string; sha: string; sqlChecksum: string; files: Record<string, string> }>;
export function verifyArtifact(root: string, sha: string, manifest: string, sql: string): Promise<{ manifest: Record<string, unknown>; files: { version: string; checksum: string; sql: string }[] }>;
