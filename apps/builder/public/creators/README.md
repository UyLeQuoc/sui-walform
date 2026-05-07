# Creator avatars

Drop creator avatar images here. They're rendered in the `<Creators />` section
on the landing page (`@walform/core/ui/landing-pages/creators`).

Expected filenames (already referenced in `creators.tsx`):

- `uydev.jpg` — shows for "Uydev" card
- `huanngdev.jpg` — shows for "Huanngdev" card

Any square aspect ratio works. 512×512 is plenty; the avatar slot is rendered
at 64px.

If a file is missing or fails to load, the component falls back to initials
(`UY` / `HN`) on a primary-colored tile — the layout never breaks.

To change the paths, edit the `image` field in the `CREATORS` array inside
`packages/core/src/ui/landing-pages/creators.tsx`.
