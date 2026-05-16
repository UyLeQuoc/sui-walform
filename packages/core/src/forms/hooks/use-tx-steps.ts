'use client';

import { useCallback, useState } from 'react';
import type { StepStatus, TxStep } from '../components/shared/TxSteps';

export interface TxStepDescriptor {
  id: string;
  label: string;
}

export interface UseTxStepsResult {
  steps: TxStep[];
  /** True from `start()` until `finish('done'|'error')` or `reset()`. */
  isRunning: boolean;
  /** Reset to all-pending and start the flow. */
  start: (descriptors: TxStepDescriptor[]) => void;
  /** Switch to an existing step by id; previous steps auto-mark as done. */
  advance: (id: string, detail?: string) => void;
  /** Mark the entire flow done — all remaining steps become done. */
  finishOk: () => void;
  /** Mark the current active step as errored; remaining stay pending. */
  finishError: () => void;
  reset: () => void;
}

/**
 * Step-state machine for multi-stage transactions (publish, submit). Renders
 * via the `<TxSteps>` component. Caller defines the sequence up front via
 * `start()` and then calls `advance()` per stage. Marking previous stages
 * done is automatic — caller only ever names the *current* step.
 */
export function useTxSteps(): UseTxStepsResult {
  const [steps, setSteps] = useState<TxStep[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const start = useCallback((descriptors: TxStepDescriptor[]) => {
    setSteps(descriptors.map((d) => ({ ...d, status: 'pending' as StepStatus })));
    setIsRunning(true);
  }, []);

  const advance = useCallback((id: string, detail?: string) => {
    setSteps((current) => {
      const idx = current.findIndex((s) => s.id === id);
      if (idx < 0) return current;
      return current.map((s, i) => {
        if (i < idx) return { ...s, status: 'done' as StepStatus, detail: undefined };
        if (i === idx) return { ...s, status: 'active' as StepStatus, detail };
        return { ...s, status: 'pending' as StepStatus, detail: undefined };
      });
    });
  }, []);

  const finishOk = useCallback(() => {
    setSteps((current) =>
      current.map((s) => ({
        ...s,
        status: 'done' as StepStatus,
        detail: undefined,
      })),
    );
    setIsRunning(false);
  }, []);

  const finishError = useCallback(() => {
    setSteps((current) => {
      // Mark the currently-active step as error; leave earlier as done and
      // later as pending so the user can see exactly where it failed.
      const activeIdx = current.findIndex((s) => s.status === 'active');
      return current.map((s, i) => {
        if (activeIdx >= 0 && i === activeIdx) return { ...s, status: 'error' as StepStatus };
        return s;
      });
    });
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    setSteps([]);
    setIsRunning(false);
  }, []);

  return { steps, isRunning, start, advance, finishOk, finishError, reset };
}
