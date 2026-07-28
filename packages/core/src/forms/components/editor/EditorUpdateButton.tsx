'use client';

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../ui/alert-dialog';
import { Button } from '../../../ui/button';
import { useUpdateForm } from '../../hooks/use-update-form';
import { formsRoute } from '../../lib/routes';

interface EditorUpdateButtonProps {
  /** Shared Form object id being edited in place. */
  formObjectId: string;
  /** On-chain submission count — a non-zero count warns before overwriting. */
  submissionCount: number;
  /** Form was published with a Seal-encrypted schema — re-encrypt before writing. */
  schemaSealed?: boolean;
}

/**
 * Replaces the Publish button when the editor is editing an already-published
 * form. Pushes the current schema to chain via `update_schema`. When the form
 * already has responses, a confirm dialog warns that removing/retyping existing
 * fields can orphan response data in Results (adding new fields is safe).
 */
export function EditorUpdateButton({
  formObjectId,
  submissionCount,
  schemaSealed,
}: EditorUpdateButtonProps) {
  const navigate = useNavigate();
  const { isSubmitting, update, isReady } = useUpdateForm({ formObjectId, schemaSealed });
  const [confirmOpen, setConfirmOpen] = useState(false);

  const doUpdate = async () => {
    const result = await update();
    setConfirmOpen(false);
    if (result) navigate(formsRoute.results(formObjectId));
  };

  const handleClick = () => {
    if (submissionCount > 0) setConfirmOpen(true);
    else void doUpdate();
  };

  return (
    <>
      <Button
        variant="default"
        onClick={handleClick}
        disabled={!isReady || isSubmitting}
        title={!isReady ? 'You must own this form and be on its network to update it' : 'Update form'}
        className="gap-1.5"
      >
        <Save className="h-4 w-4" />
        {isSubmitting ? 'Updating…' : 'Update'}
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update a form that has responses?</AlertDialogTitle>
            <AlertDialogDescription>
              This form already has {submissionCount}{' '}
              {submissionCount === 1 ? 'response' : 'responses'}. Removing or changing existing
              fields can orphan that response data when viewing Results — adding new fields is safe.
              Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSubmitting}
              onClick={(e) => {
                e.preventDefault();
                void doUpdate();
              }}
            >
              {isSubmitting ? 'Updating…' : 'Update anyway'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
