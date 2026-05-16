/**
 * Centralised URL builders for the form routes. We use flat paths with a
 * `formId` query string instead of `/forms/[id]/...` dynamic segments — keeps
 * the builder fully static-exportable (no `generateStaticParams` placeholders,
 * no Next 16 SSG `workStore` invariant on dynamic preview pages).
 */
export const formsRoute = {
  list: () => '/forms',
  edit: (formId: string) => `/forms/edit?formId=${encodeURIComponent(formId)}`,
  preview: (formId: string) => `/forms/preview?formId=${encodeURIComponent(formId)}`,
  results: (formId: string) => `/forms/results?formId=${encodeURIComponent(formId)}`,
  submit: (formId: string) => `/f?formId=${encodeURIComponent(formId)}`,
};
