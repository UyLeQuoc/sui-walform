'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentAccount, useSuiClientContext } from '@mysten/dapp-kit';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { useReferralTypesPackageId } from '../../sui/env-network';
import { Submission } from '../../sui/gen/walform/submission';
import { getMoveObject } from '../../sui/grpc/objects';
import { useSuiGrpcClient } from '../../sui/grpc/use-grpc-client';
import {
  buildReferralLink,
  chooseReferral,
  parseReferralParam,
  referralsEnabled,
} from '../lib/referrals';
import { forgetReferral, readStoredReferral, storeReferral } from '../services/referral-store';
import type { FormSettings } from '../../types';

export type ReferralStatus =
  /** No link, referrals off, or the network lacks the upgrade. */
  | 'none'
  | 'loading'
  /** Credits `referrer` on submit. */
  | 'valid'
  /** The respondent opened their own link — submit without a referral. */
  | 'self'
  /** Unknown Submission or one from another form — ignored. */
  | 'invalid';

export interface UseReferralResult {
  status: ReferralStatus;
  /** Who shared the link (valid / self only). */
  referrer: string | null;
  /** Pass to the submit tx — set only when `status === 'valid'`. */
  creditSubmissionId: string | null;
}

/**
 * The referral this visit credits: the link the page was opened with
 * (`?ref=<Submission id>`), or one remembered on this browser for up to 30
 * days (first touch wins — see `chooseReferral`). Checked against the chain:
 * the Submission must belong to this form. The contract enforces the same
 * rules; checking first keeps a bad link from failing the respondent's submit.
 */
export function useReferral(form: {
  formObjectId: string;
  schema: { settings: FormSettings };
}): UseReferralResult {
  const { network } = useSuiClientContext();
  const client = useSuiGrpcClient();
  const account = useCurrentAccount();
  const typesPackage = useReferralTypesPackageId();
  const [choice] = useState(() =>
    typeof window === 'undefined'
      ? null
      : chooseReferral(
          parseReferralParam(window.location.search, window.location.hash),
          readStoredReferral(form.formObjectId),
          Date.now(),
        ),
  );
  const refId = choice?.submissionId ?? null;
  const active = !!refId && !!typesPackage && referralsEnabled(form.schema.settings);

  const query = useQuery({
    queryKey: [network, 'walform:referrer', refId],
    enabled: active,
    staleTime: Infinity,
    queryFn: async ({ signal }) => {
      const obj = await getMoveObject(client, Submission, refId!, signal);
      if (!obj) return null;
      return {
        formId: normalizeSuiAddress(obj.fields.form_id),
        submitter: normalizeSuiAddress(obj.fields.submitter),
      };
    },
  });

  const found = query.data;
  const belongs = !!found && found.formId === normalizeSuiAddress(form.formObjectId);
  const settled = active && !query.isPending;
  const isSelf = !!account && !!found && normalizeSuiAddress(account.address) === found.submitter;
  // Remember a fresh valid link (not the referrer's own visit); drop a
  // remembered one that no longer checks out.
  useEffect(() => {
    if (!settled || !refId || !choice) return;
    if (belongs && !isSelf && !choice.remembered) {
      storeReferral(form.formObjectId, { submissionId: refId, savedAtMs: Date.now() });
    } else if (!belongs && choice.remembered) {
      forgetReferral(form.formObjectId);
    }
  }, [settled, belongs, isSelf, refId, choice, form.formObjectId]);

  if (!active) return { status: 'none', referrer: null, creditSubmissionId: null };
  if (query.isPending) return { status: 'loading', referrer: null, creditSubmissionId: null };
  if (!found || !belongs) return { status: 'invalid', referrer: null, creditSubmissionId: null };
  if (isSelf) return { status: 'self', referrer: found.submitter, creditSubmissionId: null };
  return { status: 'valid', referrer: found.submitter, creditSubmissionId: refId };
}

/** The respondent's own referral link for `submissionId`, on the page they're on. */
export function useMyReferralLink(submissionId: string | null): string | null {
  const [href] = useState(() => (typeof window === 'undefined' ? null : window.location.href));
  return href && submissionId ? buildReferralLink(href, submissionId) : null;
}
