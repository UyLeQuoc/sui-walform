'use client';

import { useQuery } from '@tanstack/react-query';
import { useSuiClientContext } from '@mysten/dapp-kit';
import { useSuiGrpcClient } from '../../sui/grpc/use-grpc-client';

/** An address's default SuiNS name (`alice.sui`), or null when it has none. */
export function useSuinsName(address: string | null | undefined): string | null {
  const { network } = useSuiClientContext();
  const client = useSuiGrpcClient();
  const query = useQuery({
    queryKey: [network, 'walform:suins-reverse', address],
    enabled: !!address,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const res = await client.core.defaultNameServiceName({ address: address! });
      return res.data.name;
    },
  });
  return query.data ?? null;
}
