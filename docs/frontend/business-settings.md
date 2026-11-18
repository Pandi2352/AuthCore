# Business settings

**Site name, description, logos and favicon — edited by an admin, shown on every page.**

Sidebar → **Administration → Settings → Business settings** (`/settings/business`) lets an administrator rebrand the running app without a deploy. The values live in the backend (`business_settings` collection, one document) and reach every page, including the sign-in pages, through a public endpoint.

## What can be set

| Setting | Where it appears | Fallback when not set |
| --- | --- | --- |
| Site name (1–60 chars, required) | Browser tab (`Page · Site name`), sidebar / navbar when there is no logo, sign-in and sign-up texts, home link labels | `project.config.json → name` |
| Site description (0–300) | `<meta name="description">` (search engines show ~155 chars), split auth layout panel | `project.config.json → description` |
| Logo | Expanded sidebar, navbar on small screens, public pages | `app.config.ts → logos`, else initial + name |
| Logo mark (square) | Collapsed sidebar, next to the name when there is no logo | `app.config.ts → logos.mark`, else the initial |
| Sign-in logo | Sign-in, sign-up, password pages (top-left) | the logo |
| Favicon | Browser tab, bookmarks, search results | `app.config.ts → favicon` |

Images: PNG, WebP or JPEG up to `UPLOAD_AVATAR_MAX_SIZE_MB` (2 MB). **SVG is refused** (it can carry scripts). The backend detects the type from the bytes, virus-scans, strips metadata and re-encodes: logos fit 1024 × 512 (never enlarged); the mark and favicon are centred on a 256 × 256 canvas (transparent for PNG / WebP).

## API (backend `modules/business-settings`)

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/settings/business/public` | none | Name, description, image URLs (null = default). `Cache-Control: no-cache` + ETag |
| GET | `/settings/business` | `BUSINESS_SETTINGS_READ` | Same + file details (name, size, dimensions, upload time), `isDefault`, `version`, `updatedBy` |
| PATCH | `/settings/business` | `BUSINESS_SETTINGS_MANAGE` | `{ siteName?, siteDescription?, version? }` — only changed fields; a stale `version` → 409 `VERSION_CONFLICT` |
| POST | `/settings/business/assets/:slot` | `BUSINESS_SETTINGS_MANAGE` | multipart `file`; slot = `logo` · `logo-mark` · `auth-logo` · `favicon`; replaces (and deletes) the previous image |
| DELETE | `/settings/business/assets/:slot` | `BUSINESS_SETTINGS_MANAGE` | Removes the image; the default is used again |

- Permissions are seeded at startup with the system role **BUSINESS_SETTINGS_ADMIN**; the `ADMIN` role passes every check.
- Images are stored by the files module under internal purposes (`BRAND_LOGO`, `BRAND_LOGO_MARK`, `BRAND_AUTH_LOGO`, `BRAND_FAVICON`), owner `business-settings`, public URL `/files/public/:id`. The generic `POST /files` refuses these purposes and `DELETE /files/:id` refuses their files (409), so the settings never point at a missing file.
- Reads are cached 15 s per instance (a save clears it at once on that instance). Every write is versioned; image writes retry a version race themselves.

## Frontend

| Piece | File | Role |
| --- | --- | --- |
| Branding store | `lib/branding/branding-store.ts` | Current values (validated; image URLs must be `http(s)://` or `/…`), cached in localStorage (`<slug>:branding:v1`), synced across tabs; `applyBrandingToHead()` sets favicon and meta tags |
| `useBranding()` | `hooks/useBranding.ts` | Live values for components (re-renders on change) |
| `BrandingSync` | `app/layouts/components/BrandingSync.tsx` | Loads the public endpoint once per page load (root layout, so auth pages too); failures keep cached / built-in values |
| No-flash script | `vite.config.ts → brandingNoFlash()` | Applies the cached name, description and favicon before the first paint |
| Title | `PageTitle` / `formatDocumentTitle()` | `Page · Site name`, follows renames immediately |
| `Logo` | `components/common/Logo.tsx` | `variant`: `full` (sidebar), `mark` (collapsed), `auth` (sign-in pages) |
| Page | `features/settings/pages/BusinessSettingsPage.tsx` | Form, image slots, live preview |

### The page

- **Site identity:** name and description with counters, client rules + backend field errors, *Save changes* / *Discard* in the header (Ctrl / Cmd + S saves), status chip (Project defaults · Unsaved changes · Saved · time). Leaving with unsaved text asks first (in-app) or warns (closing the tab).
- **Logos / Favicon:** one card per image — checkerboard preview (shows transparency), *Default* / *Custom* badge, size advice, file details, *Upload / Replace* (button or drag and drop), progress bar, *Remove* with confirmation. Type and size are checked before uploading.
- **Live preview:** browser tab, sidebar expanded and collapsed, sign-in card, search result — from the unsaved text and the current images.
- **Toasts:** success for save / upload / remove (with what happens next); errors as toasts plus an inline message (field errors under the field, upload errors under the image). A version conflict shows a toast with a *Reload* action.
- **Permissions:** the route and the sidebar item need `BUSINESS_SETTINGS_READ`; without `BUSINESS_SETTINGS_MANAGE` the page is read-only with a notice.

Every save, upload or remove updates the branding store, so the sidebar, tab title, favicon and other open tabs change without a reload.

## Checklist (manual)

- [ ] Fresh database: page shows *Project defaults*, the sidebar shows the initial + name.
- [ ] Rename → tab title, sidebar label, sign-in text change at once; reload keeps the new name (no flash of the old one).
- [ ] Upload a wide logo, a square mark, a favicon → sidebar (expanded / collapsed), sign-in page and tab icon update; replacing deletes the old file.
- [ ] Remove each image → the documented fallback appears.
- [ ] SVG, > 2 MB, empty file → readable error (inline + toast).
- [ ] Empty name → error under the field; 61 characters impossible (maxlength) and refused by the API.
- [ ] Two tabs: save in one, the other updates; stale save → conflict toast with *Reload*.
- [ ] User without `BUSINESS_SETTINGS_READ`: no sidebar item, route → 403. With READ only: read-only page.
- [ ] Light / dark, desktop / phone (no horizontal scroll).
