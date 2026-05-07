'use client';

import { useSuiClientQuery } from '@mysten/dapp-kit';

/**
 * Query the listing price of a FormTemplate inside a Kiosk. Sui Kiosk stores
 * listings as dynamic fields keyed `0x2::kiosk::Listing` on the Kiosk object.
 * Call this on-demand when the user actually wants to buy — don't fan out to
 * every template in the marketplace list.
 */
export function useKioskListingPrice(input: {
  kioskId?: string;
  templateId?: string;
  enabled?: boolean;
}): {
  priceMist: bigint | null;
  isLoading: boolean;
  error: Error | null;
} {
  const enabled = input.enabled !== false && !!input.kioskId && !!input.templateId;

  const query = useSuiClientQuery(
    'getDynamicFieldObject',
    {
      parentId: input.kioskId ?? '',
      name: {
        type: '0x2::kiosk::Listing',
        value: { id: input.templateId ?? '', is_exclusive: false },
      },
    },
    { enabled },
  );

  const content = query.data?.data?.content as unknown as
    | { dataType: 'moveObject'; fields: { value?: string | number } }
    | undefined;
  const raw = content?.fields?.value;
  const priceMist = raw != null ? BigInt(raw) : null;

  return {
    priceMist,
    isLoading: enabled && query.isPending,
    error: (query.error as Error | null) ?? null,
  };
}
