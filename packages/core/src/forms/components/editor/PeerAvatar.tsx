'use client';

import { Avatar as Web3Avatar } from 'web3-avatar-react';

import { cn } from '../../../lib/utils';

import type { CSSProperties } from 'react';

interface PeerAvatarProps {
  /** Wallet address (or synthetic `anon:<id>`) the gradient is derived from. */
  address: string;
  size?: 'sm' | 'default' | 'lg';
  className?: string;
  style?: CSSProperties;
  title?: string;
}

const SIZE_CLASS: Record<NonNullable<PeerAvatarProps['size']>, string> = {
  sm: 'size-6',
  default: 'size-8',
  lg: 'size-10',
};

/**
 * Presence avatar for a collaborator — a deterministic gradient generated from
 * the (wallet or anonymous) address via web3-avatar-react. No initials or text:
 * the gradient itself is the identity. Carries `data-slot="avatar"` so it picks
 * up AvatarGroup ring/overlap styling, and `data-size` so AvatarGroupCount sizes
 * to match.
 */
export function PeerAvatar({ address, size = 'sm', className, style, title }: PeerAvatarProps) {
  return (
    <div
      data-slot="avatar"
      data-size={size}
      title={title}
      style={style}
      className={cn(
        'relative shrink-0 overflow-hidden rounded-full select-none',
        SIZE_CLASS[size],
        className,
      )}
    >
      <Web3Avatar address={address} className="size-full" />
    </div>
  );
}
