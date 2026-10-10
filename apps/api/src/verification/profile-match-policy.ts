import type { ProfileMatchAudit } from "../db/schema";

export type { ProfileMatchAudit };

export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Only the live capture from the authenticated session, never an ID portrait. */
export function liveCaptureUrl(decision: Record<string, unknown>): string | null {
  const live = Array.isArray(decision.liveness_checks) ? decision.liveness_checks.map(record) : [];
  // Multiple successful captures are ambiguous; a reviewer must resolve them.
  const approved = live.filter((r) => r.status === "Approved");
  return approved.length === 1 && typeof approved[0].reference_image === "string"
    ? approved[0].reference_image
    : null;
}

export function profileMatchDecision(
  payload: unknown,
  threshold: number,
  mode: string,
): ProfileMatchAudit {
  const body = record(payload);
  const match = record(body.face_match);
  const score =
    typeof match.score === "number" &&
    Number.isFinite(match.score) &&
    match.score >= 0 &&
    match.score <= 100
      ? match.score
      : null;
  const singleFace = (image: unknown) => {
    const entities = record(image).entities;
    return (
      Array.isArray(entities) &&
      entities.length === 1 &&
      Object.keys(record(entities[0])).length > 0
    );
  };
  const requestId =
    typeof body.request_id === "string" && /^[a-zA-Z0-9-]{1,100}$/.test(body.request_id)
      ? body.request_id
      : null;
  const passed =
    requestId !== null &&
    match.status === "Approved" &&
    score !== null &&
    Number.isFinite(threshold) &&
    threshold >= 90 &&
    threshold <= 100 &&
    score > threshold &&
    Array.isArray(match.warnings) &&
    match.warnings.length === 0 &&
    singleFace(match.user_image) &&
    singleFace(match.ref_image);
  return {
    outcome: passed ? "matched" : "review",
    reason: passed ? null : "PROFILE_PHOTO_MATCH_INCONCLUSIVE",
    mode,
    threshold,
    score,
    requestId,
    providerStatus: ["Approved", "Declined", "In Review"].includes(String(match.status))
      ? String(match.status)
      : null,
  };
}
