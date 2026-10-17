'use client';

import type { ReactNode } from 'react';
import { UserPlus } from 'lucide-react';
import type { UseReferralResult } from '../../hooks/use-referral';
import { ReferrerName } from '../referrals/ReferrerName';

interface ReferralBannerProps {
  referral: UseReferralResult;
  /** Referral links are on for this form (and live on this network). */
  invitesOn: boolean;
}

/**
 * Above the form: who invited the respondent, and — when the form has
 * referral links — that submitting earns them their own link. Invalid links
 * stay silent.
 */
export function ReferralBanner({ referral, invitesOn }: ReferralBannerProps) {
  if (referral.status === 'self') {
    return (
      <Row>
        <span className="text-muted-foreground">
          This is your own referral link - share it so others can join through you.
        </span>
      </Row>
    );
  }
  if (referral.status === 'valid' && referral.referrer) {
    return (
      <Row>
        <span className="text-muted-foreground">
          Invited by{' '}
          <ReferrerName address={referral.referrer} className="text-foreground font-medium" />
          {invitesOn && ' - submit to get your own invite link.'}
        </span>
      </Row>
    );
  }
  if (!invitesOn) return null;
  return (
    <Row>
      <span className="text-muted-foreground">
        Submit to get your own invite link - see how many people join through you.
      </span>
    </Row>
  );
}

function Row({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b px-6 py-3 text-xs">
      <UserPlus className="text-primary size-3.5 shrink-0" />
      {children}
    </div>
  );
}
