'use client';

import { useSuiClientContext, useSuiClientQuery } from '@mysten/dapp-kit';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { useActivePackageId } from '../../sui/package-id';

export interface FormTreasury {
  treasuryId: string;
  formId: string;
  balanceMist: bigint;
}

/**
 * Resolve the per-form `FormTreasury` by walking recent
 * `payment::create_and_share` txs and matching the created object's `form_id`.
 *
 * Stop-gap until we add a `TreasuryCreated` event. React Query dedupes the
 * underlying call across multiple cards.
 */
export function useFormTreasury(formId: string | undefined): {
  treasury: FormTreasury | null;
  isLoading: boolean;
  error: Error | null;
} {
  // MoveFunction filter matches the package used at call time — current,
  // not original. Same correction as `useTemplateListing`. Post-upgrade
  // `payment::create_and_share` txs target the active packageId.
  const activePackageId = useActivePackageId();
  const { network } = useSuiClientContext();

  const txQuery = useSuiClientQuery(
    'queryTransactionBlocks',
    {
      filter: activePackageId
        ? {
            MoveFunction: {
              package: activePackageId,
              module: 'payment',
              function: 'create_and_share',
            },
          }
        : ({} as never),
      options: { showObjectChanges: true },
      order: 'descending',
      limit: 50,
    },
    { enabled: !!activePackageId && !!formId },
  );

  const treasuryIds: string[] = [];
  if (formId) {
    const txs = txQuery.data?.data ?? [];
    for (const t of txs) {
      const changes = (t.objectChanges ?? []) as Array<{
        type?: string;
        objectType?: string;
        objectId?: string;
      }>;
      for (const c of changes) {
        if (
          c.type === 'created' &&
          c.objectType?.endsWith('::payment::FormTreasury') &&
          c.objectId
        ) {
          treasuryIds.push(c.objectId);
        }
      }
    }
  }

  const objectsQuery = useSuiClientQuery(
    'multiGetObjects',
    {
      ids: treasuryIds,
      options: { showContent: true, showType: true },
    },
    { enabled: treasuryIds.length > 0 },
  );

  const treasury = resolveTreasury(formId, objectsQuery.data);

  void network;
  return {
    treasury,
    isLoading: txQuery.isPending || (treasuryIds.length > 0 && objectsQuery.isPending),
    error: (txQuery.error as Error | null) ?? (objectsQuery.error as Error | null) ?? null,
  };
}

type MultiGetObjectsData = ReturnType<typeof useSuiClientQuery<'multiGetObjects'>>['data'];

function resolveTreasury(
  formId: string | undefined,
  data: MultiGetObjectsData,
): FormTreasury | null {
  if (!formId) return null;
  const target = normalizeSuiAddress(formId);
  const results = data ?? [];
  for (const entry of results) {
    const obj = entry.data;
    if (!obj?.objectId) continue;
    const content = obj.content as unknown as
      | {
          dataType: 'moveObject';
          fields: {
            form_id?: string;
            balance?: string | number;
          };
        }
      | undefined;
    const fields = content?.fields;
    if (!fields?.form_id) continue;
    if (normalizeSuiAddress(fields.form_id) !== target) continue;
    return {
      treasuryId: obj.objectId,
      formId: target,
      balanceMist: fields.balance ? BigInt(fields.balance) : 0n,
    };
  }
  return null;
}
