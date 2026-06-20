'use client';

import { useCurrentAccount } from '@mysten/dapp-kit';
import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';

import { useCollabSession } from '../../hooks/use-collab-session';
import { colorForAddress, getAnonymousIdentity } from '../../lib/collab-identity';
import { useFormBuilderStore } from '../../store/form-builder-store';

import type { ReactNode } from 'react';
import type { Awareness } from 'y-protocols/awareness';
import type { CollabSessionStatus, PresenceCursor } from '../../../types';

interface CollabContextValue {
  status: CollabSessionStatus;
  awareness: Awareness | null;
  enabled: boolean;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  setCursor: (cursor: PresenceCursor | null) => void;
}

const NULL_COLLAB: CollabContextValue = {
  status: 'idle',
  awareness: null,
  enabled: false,
  undo: () => {},
  redo: () => {},
  canUndo: false,
  canRedo: false,
  setCursor: () => {},
};

const CollabContext = createContext<CollabContextValue | null>(null);

/** Read the active collab session. Returns a no-op session outside a provider. */
export function useCollab(): CollabContextValue {
  return useContext(CollabContext) ?? NULL_COLLAB;
}

interface CollabProviderProps {
  formId: string;
  enabled: boolean;
  mode: 'host' | 'join';
  /** Share token from the invite link; gates the PartyKit room. */
  token: string | null;
  children: ReactNode;
}

export function CollabProvider({ formId, enabled, mode, token, children }: CollabProviderProps) {
  const account = useCurrentAccount();
  const session = useCollabSession({ formId, mode, enabled, token });
  const { awareness, status, undo, redo, canUndo, canRedo } = session;
  const selectedFieldId = useFormBuilderStore((s) => s.selectedFieldId);
  const activePageId = useFormBuilderStore((s) => s.activePageId);

  useEffect(() => {
    if (!awareness) return;
    // Wallet identity when connected; otherwise a stable anonymous identity so
    // a no-wallet collaborator still shows up with a cursor + color + label.
    const user = account
      ? { address: account.address, color: colorForAddress(account.address) }
      : getAnonymousIdentity();
    awareness.setLocalStateField('user', user);
  }, [awareness, account]);

  useEffect(() => {
    if (!awareness) return;
    awareness.setLocalStateField('selectedFieldId', selectedFieldId);
  }, [awareness, selectedFieldId]);

  useEffect(() => {
    if (!awareness) return;
    awareness.setLocalStateField('activePageId', activePageId);
  }, [awareness, activePageId]);

  const setCursor = useCallback(
    (cursor: PresenceCursor | null) => {
      awareness?.setLocalStateField('cursor', cursor);
    },
    [awareness],
  );

  const value = useMemo<CollabContextValue>(
    () => ({ status, awareness, enabled, undo, redo, canUndo, canRedo, setCursor }),
    [status, awareness, enabled, undo, redo, canUndo, canRedo, setCursor],
  );

  return <CollabContext.Provider value={value}>{children}</CollabContext.Provider>;
}
