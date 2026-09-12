/**
 * Server-side observability helper.
 *
 * Runs only on the server: emits a structured, one-line record (timestamp +
 * context + error) so operators can trace failures without ever exposing
 * internals to visitors. No request payload, credentials or user data are
 * ever written — error objects are logged as-is for debugging, exactly like
 * the previous raw console.error calls, just with context and a timestamp.
 */

export function logError(context: string, error: unknown): void {
  console.error(
    `[omid:error] ${new Date().toISOString()} — ${context}`,
    error instanceof Error ? error : String(error),
  );
}