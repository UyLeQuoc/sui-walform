export type FormStatus = 'draft' | 'live' | 'closed' | 'ended' | 'full';

export interface FormStatusInput {
  closed: boolean;
  closesAtMs: number;
  maxSubmissions: number;
  submissionCount: number;
}

/**
 * Resolve a published form's runtime status. Priority: manual close > capacity
 * limit > past deadline > live. `closesAtMs === 0` means no deadline;
 * `maxSubmissions === 0` means unlimited.
 */
export function deriveOnChainStatus(input: FormStatusInput, nowMs = Date.now()): FormStatus {
  if (input.closed) return 'closed';
  if (input.maxSubmissions > 0 && input.submissionCount >= input.maxSubmissions) return 'full';
  if (input.closesAtMs > 0 && nowMs >= input.closesAtMs) return 'ended';
  return 'live';
}

export const FORM_STATUS_LABEL: Record<FormStatus, string> = {
  draft: 'Draft',
  live: 'Live',
  closed: 'Closed',
  ended: 'Ended',
  full: 'Full',
};
