// Forms package — all form-creation surface area (UI, state, persistence, helpers).
// Prefer the subpaths for smaller imports:
//   import { FormBuilder } from "@walform/core/forms/components/editor";
//   import { useFormBuilderStore } from "@walform/core/forms/store";
//   import { formDb } from "@walform/core/forms/services";
//   import { useForms, useAutoSave } from "@walform/core/forms/hooks";
//   import { FORM_COLORS, createStoredForm } from "@walform/core/forms/lib";

export * from './components';
export * from './hooks';
export * from './lib';
export * from './services';
export * from './store';
