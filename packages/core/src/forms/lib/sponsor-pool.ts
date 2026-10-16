import type { SponsorPoolLimits } from '../../sui/tx/sponsor-pool';

/**
 * Limits a new pool opens with. One submission writes up to two blobs (the
 * encrypted body, plus one quilt when there are attachments), so 4 uploads per
 * address allows two submissions each. 0.5 WAL per upload covers ~100 MiB of
 * attachments for 10 epochs at current mainnet prices.
 */
export const DEFAULT_SPONSOR_POOL_LIMITS: SponsorPoolLimits = {
  maxWalPerUpload: 500_000_000n,
  maxTipPerUpload: 10_000_000n,
  maxUploadsPerAddress: 4n,
};
