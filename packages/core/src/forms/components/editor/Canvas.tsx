'use client';

/**
 * The original `Canvas` component has been replaced by the 3-column
 * `FormBuilder` layout, which composes:
 *   - `FieldPaletteSidebar` (left, draggable field types)
 *   - `CanvasViewport`       (dot-grid, pannable center)
 *   - `FormCard`              (the white form card, hosts field list)
 *   - `FieldSettings`         (right, docked properties panel)
 *
 * This file is kept so `@walform/core/forms/components/editor/Canvas`
 * continues to resolve. It re-exports `FormCard` under the `Canvas` name
 * for any callers that imported the low-level primitive directly.
 */

export { FormCard as Canvas } from './FormCard';
