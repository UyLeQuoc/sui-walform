'use client';

import { useQuery } from '@tanstack/react-query';
import { useSuiClientContext } from '@mysten/dapp-kit';
import { useActiveNetwork, useReferralTypesPackageId } from '../../sui/env-network';
import { collectFormReferrals } from '../../sui/graphql/referrals';
import { referralLeaderboard } from '../lib/referrals';
import type { ReferralRecord, ReferrerStanding } from '../../types';

export type UseFormReferralsResult =
  | { status: 'unavailable' }
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'success'; records: ReferralRecord[]; leaderboard: ReferrerStanding[] };

/**
 * Every referral recorded on a form plus its leaderboard. `unavailable` on a
 * network where the `referral` upgrade isn't configured.
 */
export function useFormReferrals(formId: string | undefined): UseFormReferralsResult {
  const { network } = useSuiClientContext();
  const activeNetwork = useActiveNetwork();
  const typesPackage = useReferralTypesPackageId();
  const query = useQuery({
    queryKey: [network, 'walform:referrals', typesPackage, formId],
    enabled: !!typesPackage && !!activeNetwork && !!formId,
    staleTime: 15_000,
    queryFn: async () => {
      const records = await collectFormReferrals({
        network: activeNetwork!,
        referralTypesPackageId: typesPackage!,
        formId: formId!,
      });
      return { records, leaderboard: referralLeaderboard(records) };
    },
  });
  if (!typesPackage || !activeNetwork || !formId) return { status: 'unavailable' };
  if (query.isPending) return { status: 'loading' };
  if (query.isError) return { status: 'error', error: query.error };
  return { status: 'success', ...query.data };
}
