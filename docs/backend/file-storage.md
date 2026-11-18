# File storage

**One active storage for every upload: the server's folder or an S3-style bucket — chosen on Settings → File storage.**

| Provider | Id | How it connects |
| --- | --- | --- |
| Local folder (built in) | `LOCAL` | `STORAGE_LOCAL_DIR` on the server (never set through the API) |
| Amazon S3 | `AWS_S3` | Region endpoint chosen by the SDK |
| Backblaze B2 | `BACKBLAZE_B2` | `https://s3.<region>.backblazeb2.com` |
| Tigris | `TIGRIS` | `https://t3.storage.dev`, region `auto` |
| Supabase Storage | `SUPABASE` | `https://<ref>.storage.supabase.co/storage/v1/s3`, path-style |
| Other S3-compatible | `S3_COMPATIBLE` | Any endpoint (DigitalOcean Spaces, Cloudflare R2, Wasabi, MinIO …) |

All cloud providers speak the S3 API, so one driver serves them all; they only differ in endpoint, region, addressing style and public URL.

## How it works

- **Exactly one storage is active** (unique partial index on `isActive`). Every upload — `POST /uploads`, profile pictures, business logos / favicon, documents — goes there.
- **Each file remembers its storage** (`files.storageConfigId`). Reads and deletes use that storage, so switching never breaks older files. Files from before this feature (`null`) are in the local folder.
- **Activation tests first:** write, read back and delete a tiny object; on failure `400 STORAGE_CONNECTION_FAILED` with the provider's message.
- **Credentials:** secret fields are sealed with AES-256-GCM (`utils/secret-box.util.ts`) using `STORAGE_SECRETS_KEY` (or, if empty, a key derived from `JWT_ACCESS_SECRET` — a warning is logged; set the key so a JWT rotation doesn't make saved keys unreadable). The API returns only `{ isSet, hint: "••••last4" }`.
- **Delete guards:** not the built-in folder, not the active storage, not a storage that still holds files (409 with the count). Nothing in the bucket is deleted.
- **Orphan cleanup** runs per storage; on buckets it only looks at keys the API created (`<purpose>/yyyy/mm/<uuid>.<ext>` inside its own folders), so a shared bucket's other files are never touched.
- **Public URLs:** only when *Bucket allows public reads* is on (then the provider's default public bucket URL) or a *Public URL* (CDN / custom domain) is entered. Private buckets (the default) are served through the API.
- **Usage:** the local folder reports its disk (used / free); buckets have no capacity API, so the optional *Storage limit (GB)* drives the usage bar. Used bytes come from the file records. Without one (local folder, private bucket, S3-compatible without a URL) files are served through `GET /files/public/:id`.

## API

### `POST /uploads` — any signed-in user

multipart `file`. Type detected from the content: JPEG, PNG, WebP, GIF, PDF, DOCX, XLSX, PPTX, CSV, TXT (UPLOAD_MAX_FILE_SIZE_MB). Images are re-encoded (metadata removed); everything is virus-scanned when scanning is on.

```json
{
  "success": true,
  "message": "File uploaded",
  "data": {
    "id": "01a1ed4f-dc0e-7efc-b93c-751479439c88",
    "name": "image (9).png",
    "key": "app/upload/2026/11/01a1ed4f-dc0e-7efc-b93c-751479439c88.png",
    "url": "https://my-bucket.sgp1.digitaloceanspaces.com/app/upload/2026/11/01a1ed4f-….png",
    "fileType": "image/png",
    "fileSize": 497225,
    "filePages": 0
  }
}
```

`filePages` = PDF page count (0 otherwise). `id` deletes it: `DELETE /files/:id`. Frontend: `uploadToStorage(file, { onProgress })` from `@/lib/api`.

### `/settings/storage` — `STORAGE_SETTINGS_READ` / `STORAGE_SETTINGS_MANAGE` (role `STORAGE_ADMIN`, or `ADMIN`)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/providers` | Providers and their form fields |
| GET | `/` | Storages (built-in first) with active flag, last test, file count, example URL |
| POST | `/` | Add `{ name, provider, settings, secrets }` (not active yet) |
| POST | `/test` | Test form values before saving (`id` = reuse saved secrets) |
| GET | `/:id` | One storage |
| PATCH | `/:id` | Edit; empty secrets keep the saved value; `version` → 409 on conflict |
| POST | `/:id/test` | Test a saved storage (result stored as `lastTest`) |
| POST | `/:id/activate` | Test, then make it the active storage |
| DELETE | `/:id` | Delete (guards above) |

## Code layout (copy to another project)

```
modules/storage/
  providers/                 one file per provider + storage-provider.types.ts + index.ts (registry)
  drivers/                   storage-driver.interface.ts, local.driver.ts, s3.driver.ts (plain classes)
  utils/secret-box.util.ts   seal / open / mask secrets (plain functions)
  schemas/storage-config.schema.ts
  services/storage-manager.service.ts   active storage, driver cache, decryption
  services/storage-configs.service.ts   CRUD, validation, test, activate
  storage-settings.controller.ts
```

`providers/`, `drivers/` and `utils/` have no framework code: copy them as they are; the services show how to wire them into NestJS (or any other server).

### Add a provider

1. Copy e.g. `providers/backblaze-b2.provider.ts` → `my-provider.provider.ts`; set `id`, `label`, `fields`, `toDriverConfig()` (endpoint / region / path-style) and `publicUrl()`.
2. Add the id to `StorageProviderId`, `STORAGE_PROVIDER_IDS` and `storageProviders()` in `providers/index.ts`.
3. Add an icon / accent in the frontend `features/settings/components/storage/provider-meta.ts`.

The settings API, the admin form and the upload code need no change. A provider without an S3 API needs its own driver implementing `StorageDriver`.

## Manual checklist

- [ ] Fresh database: "Local folder" exists and is active; uploads land in `STORAGE_LOCAL_DIR`.
- [ ] Add a bucket → *Test connection* passes; wrong key / bucket / endpoint → readable failure.
- [ ] *Make active* → `POST /uploads` returns the bucket URL; the file opens; profile picture and logo uploads also go there.
- [ ] Files uploaded before the switch still open.
- [ ] Response / page never shows a secret (only `••••last4`); DB holds `v1:…` sealed values.
- [ ] Delete blocked while active or while files are stored there.
- [ ] Unsupported type (exe, svg) → 415; empty file → 400; over the size limit → 413.
