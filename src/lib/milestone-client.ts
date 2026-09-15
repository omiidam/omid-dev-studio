import type {
  ManagedMilestoneRecord,
  MilestoneInput,
} from "@/lib/managed-projects";

/**
 * Client bridge to the milestone API (Phase 6) — same conventions as
 * `managed-project-client.ts`: the backend is authoritative, errors are
 * Persian and user-safe, and no internal details reach the UI.
 */

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

const NETWORK_ERROR = "در برقراری ارتباط با سرور مشکلی پیش آمد.";

export class MilestoneApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new MilestoneApiError("NETWORK_ERROR", NETWORK_ERROR);
  }

  let body: ApiEnvelope<T> | null = null;
  try {
    body = (await response.json()) as ApiEnvelope<T>;
  } catch {
    // fall through — non-JSON is treated as a generic failure below
  }

  if (!response.ok || !body?.success || body.data === undefined) {
    throw new MilestoneApiError(
      body?.error?.code ?? `HTTP_${response.status}`,
      body?.error?.message ?? NETWORK_ERROR,
    );
  }
  return body.data;
}

function milestonePath(projectId: string, milestoneId?: string): string {
  const base = `/api/admin/managed-projects/${encodeURIComponent(projectId)}/milestones`;
  return milestoneId ? `${base}/${encodeURIComponent(milestoneId)}` : base;
}

export async function fetchMilestones(projectId: string): Promise<ManagedMilestoneRecord[]> {
  return request<ManagedMilestoneRecord[]>(milestonePath(projectId));
}

export async function createMilestoneViaApi(
  projectId: string,
  input: MilestoneInput,
): Promise<ManagedMilestoneRecord> {
  return request<ManagedMilestoneRecord>(milestonePath(projectId), {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateMilestoneViaApi(
  projectId: string,
  milestoneId: string,
  input: MilestoneInput,
): Promise<ManagedMilestoneRecord> {
  return request<ManagedMilestoneRecord>(
    milestonePath(projectId, milestoneId),
    { method: "PATCH", body: JSON.stringify(input) },
  );
}

export async function deleteMilestoneViaApi(
  projectId: string,
  milestoneId: string,
): Promise<void> {
  await request(milestonePath(projectId, milestoneId), { method: "DELETE" });
}
