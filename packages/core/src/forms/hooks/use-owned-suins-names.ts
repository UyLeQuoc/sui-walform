'use client';

import { useQuery } from '@tanstack/react-query';
import { useCurrentAccount, useSuiClientContext } from '@mysten/dapp-kit';
import { getJsonObjects, listOwnedObjectIds } from '../../sui/grpc/objects';
import { useSuiGrpcClient } from '../../sui/grpc/use-grpc-client';

/**
 * SuiNS V1 packageIds — the `SuinsRegistration` NFT struct is defined here.
 * Sourced from `@mysten/suins` constants.mjs (mainPackage[net].packageIdV1).
 * Hardcoded so we don't pay an extra round-trip just to read constants the
 * SDK already ships in its bundle.
 */
const SUINS_REGISTRATION_TYPE: Record<'testnet' | 'mainnet', string> = {
  mainnet: '0xd22b24490e0bae52676651b4f56660a5ff8022a2576e0089f79b3c88d44e08f0::suins_registration::SuinsRegistration',
  testnet: '0x22fa05f21b1ad71442491220bb9338f7b7095fe35000ef88d5400d28523bdd93::suins_registration::SuinsRegistration',
};

export interface OwnedSuinsName {
  /** Object id of the SuinsRegistration NFT — pass to `setUserData({ nft })`. */
  nftId: string;
  /** Domain name like `alice.sui` (ends with `.sui` on both nets). */
  domainName: string;
  /** Unix ms when this name expires. */
  expirationTimestampMs: number;
  /** Image URL stored on the NFT (svg or hosted png). */
  imageUrl: string | null;
}

export interface UseOwnedSuinsNamesResult {
  names: OwnedSuinsName[];
  isLoading: boolean;
  error: Error | null;
  /** True when the active network supports SuiNS (testnet/mainnet only). */
  isReady: boolean;
}

interface SuinsRegistrationFields {
  domain_name?: string;
  expiration_timestamp_ms?: string;
  image_url?: string;
}

/**
 * Lists SuinsRegistration NFTs owned by the connected wallet on the active
 * network. Used by `LinkSuinsPanel` to let the user pick a name to link to a
 * freshly deployed Walrus Site.
 *
 * `SuinsRegistration` is a foreign type with no generated struct here, so this
 * reads gRPC's `json` rendering. Every field used below is a String/u64, which
 * JSON renders unambiguously.
 */
export function useOwnedSuinsNames(): UseOwnedSuinsNamesResult {
  const account = useCurrentAccount();
  const { network } = useSuiClientContext();
  const client = useSuiGrpcClient();
  const net = network === 'testnet' || network === 'mainnet' ? network : null;
  const structType = net ? SUINS_REGISTRATION_TYPE[net] : null;
  const owner = account?.address;

  const query = useQuery({
    queryKey: [network, 'walform:owned-suins', owner ?? null, structType],
    enabled: !!owner && !!structType,
    queryFn: async ({ signal }) => {
      const ids = await listOwnedObjectIds(client, {
        owner: owner!,
        type: structType!,
        signal,
      });
      return getJsonObjects(client, ids, signal);
    },
  });

  const names: OwnedSuinsName[] = (query.data ?? [])
    .map((obj) => {
      const fields = obj.json as SuinsRegistrationFields;
      if (!fields.domain_name) return null;
      return {
        nftId: obj.objectId,
        domainName: fields.domain_name,
        expirationTimestampMs: fields.expiration_timestamp_ms
          ? Number(fields.expiration_timestamp_ms)
          : 0,
        imageUrl: fields.image_url ?? null,
      } satisfies OwnedSuinsName;
    })
    .filter((x): x is OwnedSuinsName => x !== null)
    .sort((a, b) => a.domainName.localeCompare(b.domainName));

  return {
    names,
    isLoading: query.isPending,
    error: (query.error as Error | null) ?? null,
    isReady: !!net,
  };
}
