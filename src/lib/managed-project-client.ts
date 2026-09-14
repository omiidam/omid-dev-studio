import type {
  ManagedProject,
  ManagedProjectInput,
} from "@/lib/managed-projects";

/**
 * Client bridge to the managed-projects API (Phase 3).
 *
 * The backend is authoritative: every mutation waits for the server response
 * and the UI renders the persisted record — never an optimistic guess.
 * Errors are surfaced as Persian, user-safe messages; internal details
 * (stack, status internals) never reach the UI.
 */

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

/** User-safe failure text for anything the API didn't explain. */
const NETWORK_ERROR = "در برقراری ارتباط با سرور مشکلی پیش آمد.";

export class ManagedProjectApiError extends Error {
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
    throw new ManagedProjectApiError("NETWORK_ERROR", NETWORK_ERROR);
  }

  let body: ApiEnvelope<T> | null = null;
  try {
    body = (await response.json()) as ApiEnvelope<T>;
  } catch {
    // fall through — non-JSON is treated as a generic failure below
  }

  if (!response.ok || !body?.success || body.data === undefined) {
    throw new ManagedProjectApiError(
      body?.error?.code ?? `HTTP_${response.status}`,
      body?.error?.message ?? NETWORK_ERROR,
    );
  }
  return body.data;
}

/** Records may not carry the Phase-1 presentation arrays; default them. */
function withPresentationArrays(record: ManagedProject): ManagedProject {
  return {
    ...record,
    timeline: record.timeline ?? [],
    milestones: record.milestones ?? [],
    activity: record.activity ?? [],
    files: record.files ?? [],
  };
}

export async function fetchManagedProjects(): Promise<ManagedProject[]> {
  const records = await request<ManagedProject[]>("/api/admin/managed-projects");
  return records.map(withPresentationArrays);
}

export async function fetchManagedProject(id: string): Promise<ManagedProject> {
  const record = await request<ManagedProject>(
    `/api/admin/managed-projects/${encodeURIComponent(id)}`,
  );
  return withPresentationArrays(record);
}

export async function createManagedProjectViaApi(
  input: ManagedProjectInput,
): Promise<ManagedProject> {
  const record = await request<ManagedProject>("/api/admin/managed-projects", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return withPresentationArrays(record);
}

export async function updateManagedProjectViaApi(
  id: string,
  input: ManagedProjectInput,
): Promise<ManagedProject> {
  const record = await request<ManagedProject>(
    `/api/admin/managed-projects/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
  return withPresentationArrays(record);
}
