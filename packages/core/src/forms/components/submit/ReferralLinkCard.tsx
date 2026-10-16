'use client';

import { useState } from 'react';
import { Check, Copy, UserPlus } from 'lucide-react';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { useFormReferrals } from '../../hooks/use-form-referrals';
import { useMyReferralLink } from '../../hooks/use-referral';
import { referralCountFor } from '../../lib/referrals';
import { copyText } from '../../lib/share-link';

interface ReferralLinkCardProps {
  formId: string;
  /** The respondent's Submission — the link credits it. */
  submissionId: string;
  submitter: string;
}

/** Thank-you screen block: the respondent's personal link and how many joined through them. */
export function ReferralLinkCard({ formId, submissionId, submitter }: ReferralLinkCardProps) {
  const link = useMyReferralLink(submissionId);
  const referrals = useFormReferrals(formId);
  const [copied, setCopied] = useState(false);
  if (!link || referrals.status === 'unavailable') return null;

  const count =
    referrals.status === 'success' ? referralCountFor(referrals.records, submitter) : null;
  const onCopy = async () => {
    if (await copyText(link)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="bg-primary/5 flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-start gap-2">
        <UserPlus className="text-primary mt-0.5 size-4 shrink-0" />
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold">Invite others</h2>
          <p className="text-muted-foreground text-xs">
            Share your link - everyone who submits through it is credited to you, on-chain.
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Input
          readOnly
          value={link}
          aria-label="Your referral link"
          onFocus={(e) => e.currentTarget.select()}
          className="h-8 font-mono text-xs"
        />
        <Button size="sm" variant="outline" onClick={onCopy} className="shrink-0">
          {copied ? <Check className="mr-1.5 size-3.5" /> : <Copy className="mr-1.5 size-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        {count === null
          ? 'Counting people who joined through you…'
          : count === 0
            ? 'No one has joined through your link yet.'
            : `${count} ${count === 1 ? 'person has' : 'people have'} joined through your link.`}
      </p>
    </div>
  );
}
