'use client';

import { useId } from 'react';
import { Field, FieldLabel } from '../../../ui/field';
import { Switch } from '../../../ui/switch';
import { useReferralTypesPackageId } from '../../../sui/env-network';
import { useFormBuilderStore } from '../../store/form-builder-store';

/**
 * Referral-link toggles. Off by default: with it on, who invited whom is
 * recorded publicly on-chain, which a sensitive form shouldn't do silently.
 */
export function ReferralSettingsField() {
  const { schema, updateSettings } = useFormBuilderStore();
  const available = !!useReferralTypesPackageId();
  const enabledId = useId();
  const publicId = useId();
  const referrals = schema.settings.referrals ?? { enabled: false, publicLeaderboard: false };

  return (
    <Field>
      <div className="flex items-center justify-between gap-2">
        <FieldLabel htmlFor={enabledId}>Referral links</FieldLabel>
        <Switch
          id={enabledId}
          checked={referrals.enabled}
          disabled={!available}
          onCheckedChange={(enabled) => updateSettings({ referrals: { ...referrals, enabled } })}
        />
      </div>
      <span className="text-muted-foreground text-xs">
        {available
          ? 'After submitting, each respondent gets a personal link. Who joined through whom is recorded on-chain (public) and shown in Results.'
          : "Referral links aren't available on this network yet."}
      </span>
      {referrals.enabled && available && (
        <div className="mt-2 flex items-center justify-between gap-2">
          <label htmlFor={publicId} className="text-sm">
            Show top referrers on the form page
          </label>
          <Switch
            id={publicId}
            checked={referrals.publicLeaderboard}
            onCheckedChange={(publicLeaderboard) =>
              updateSettings({ referrals: { ...referrals, publicLeaderboard } })
            }
          />
        </div>
      )}
    </Field>
  );
}
