'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
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
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from '../../../ui/card';
import { FORM_COLORS } from '../../lib/form-appearance';
import { getFormFont } from '../../lib/form-fonts';
import { FormStatusBadge } from './FormStatusBadge';
import type { StoredForm } from '../../../types';

interface FormCardProps {
  form: StoredForm;
  onDelete: (id: string) => Promise<void>;
}

export function FormCard({ form, onDelete }: FormCardProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fieldCount = form.schema.fields.length;
  const title = form.schema.title || 'Untitled Form';
  const primaryColorKey = form.schema.settings.primaryColor ?? 'default';
  const formFont = getFormFont(form.schema.settings.fontFamily);
  const color = FORM_COLORS.find((c) => c.key === primaryColorKey);
  const showColorDot = color !== undefined && color.primary !== null;
  const coverImage = form.schema.coverImage;

  const handleCardClick = () => {
    router.push(`/forms/${form.id}`);
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await onDelete(form.id);
    } finally {
      setIsDeleting(false);
      setConfirmOpen(false);
    }
  };

  return (
    <>
      <Card
        onClick={handleCardClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleCardClick();
          }
        }}
        tabIndex={0}
        role="button"
        aria-label={`Open form: ${title}`}
        className="focus-visible:ring-ring cursor-pointer pt-0 transition-shadow hover:shadow-lg focus-visible:ring-2 focus-visible:outline-none"
      >
        <div className="aspect-cover relative">
          {coverImage ? (
            <img src={coverImage} alt="" aria-hidden className="size-full" />
          ) : (
            <div
              aria-hidden
              className="size-full"
              style={{
                backgroundImage: `linear-gradient(135deg, #ffffff 0%, ${color?.hex ?? 'var(--primary)'} 100%)`,
              }}
            />
          )}
        </div>

        <CardHeader>
          <CardTitle className="line-clamp-2" style={{ fontFamily: formFont.fontFamily }}>
            {title}
          </CardTitle>
          <CardDescription>
            {fieldCount} {fieldCount === 1 ? 'field' : 'fields'} ·{' '}
            {formatDistanceToNow(new Date(form.updatedAt), { addSuffix: true })}
          </CardDescription>
          <CardAction>
            <div className="flex items-center gap-1.5">
              <FormStatusBadge status="draft" />
              {showColorDot && (
                <span
                  className="inline-block size-3 rounded-full ring-1 ring-black/10 ring-inset"
                  style={{ backgroundColor: color!.hex }}
                  aria-hidden
                />
              )}
            </div>
          </CardAction>
        </CardHeader>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete form?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{title}&rdquo; will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteConfirm();
              }}
            >
              {isDeleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
