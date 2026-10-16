import { normalizeSuiAddress } from '@mysten/sui/utils';
import type { WalformNetwork } from '../env-network';
import type { ReferralRecord } from '../../types';
import { suiGraphqlRequest } from './client';

interface FormEventsPage {
  transactions: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: {
      effects: {
        events: { nodes: { contents: { type: { repr: string }; json: unknown } | null }[] };
      } | null;
    }[];
  };
}

// Every submit takes `&mut Form`, so filtering on the form finds each one —
// per-form cost, unlike a scan of every ReferralRecorded event on the network.
const FORM_EVENTS = `query($form: SuiAddress!, $after: String) {
  transactions(first: 50, after: $after, filter: { affectedObject: $form }) {
    pageInfo { hasNextPage endCursor }
    nodes { effects { events(first: 50) { nodes { contents { type { repr } json } } } } }
  }
}`;

interface ReferralRecordedJson {
  form_id: string;
  submission_id: string;
  submitter: string;
  referrer: string;
  referrer_submission_id: string;
  submitted_at_ms: string;
}

/**
 * Every referral recorded on a form, oldest first. `referralTypesPackageId` is
 * the package version that added the `referral` module (its event type is
 * tagged with it). `maxPages` is a runaway guard, not a product limit.
 */
export async function collectFormReferrals(opts: {
  network: WalformNetwork;
  referralTypesPackageId: string;
  formId: string;
  maxPages?: number;
}): Promise<ReferralRecord[]> {
  const form = normalizeSuiAddress(opts.formId);
  const eventType = `${normalizeSuiAddress(opts.referralTypesPackageId)}::referral::ReferralRecorded`;
  const out: ReferralRecord[] = [];
  let after: string | null = null;

  for (let page = 0; page < (opts.maxPages ?? 100); page++) {
    const res: FormEventsPage = await suiGraphqlRequest<FormEventsPage>(opts.network, FORM_EVENTS, {
      form,
      after,
    });
    for (const tx of res.transactions.nodes) {
      for (const event of tx.effects?.events.nodes ?? []) {
        const contents = event.contents;
        if (!contents || normalizeEventType(contents.type.repr) !== eventType) continue;
        const e = contents.json as ReferralRecordedJson;
        if (normalizeSuiAddress(e.form_id) !== form) continue;
        out.push({
          submissionId: normalizeSuiAddress(e.submission_id),
          submitter: normalizeSuiAddress(e.submitter),
          referrer: normalizeSuiAddress(e.referrer),
          referrerSubmissionId: normalizeSuiAddress(e.referrer_submission_id),
          submittedAtMs: Number(e.submitted_at_ms),
        });
      }
    }
    const { hasNextPage, endCursor } = res.transactions.pageInfo;
    if (!hasNextPage || !endCursor) break;
    after = endCursor;
  }
  return out;
}

function normalizeEventType(repr: string): string {
  const [pkg, ...rest] = repr.split('::');
  return pkg ? [normalizeSuiAddress(pkg), ...rest].join('::') : repr;
}
