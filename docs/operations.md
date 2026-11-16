# AuthCore Operations Guide

Running AuthCore in production: what to back up and how to restore it, monitoring, and rotating secrets.

## 1. What holds state

| What | Where | Back up? |
| --- | --- | --- |
| Database | MongoDB (`MONGODB_URI`): users, sessions, roles / groups / permissions, policies, activity, files metadata, invites, audit logs | **Yes** |
| Uploaded files | `STORAGE_LOCAL_DIR` (default `./uploads`; in Docker `/app/uploads`, mount a volume) | **Yes**, together with the database |
| Secrets | `.env` / your secret manager: `JWT_ACCESS_SECRET`, `VERIFICATION_TOKEN_SECRET`, SMTP password, `METRICS_TOKEN` … | **Yes**, separately and encrypted (never next to the database backup) |
| Logs | stdout (and `logs/` when `LOG_FILE_ENABLED=true`) | Ship to your log platform; not needed for restore |

Collections cleaned up automatically by TTL indexes (sessions, codes, reset / verification tokens, sign-in attempts, activity after `USER_ACTIVITY_RETENTION_DAYS`, known devices) can be restored safely: expired documents are removed again within about a minute.

## 2. Backups

### MongoDB

Use `mongodump` (MongoDB Database Tools) from a machine that can reach the database:

```bash
# Replica set / Atlas: consistent point-in-time dump
mongodump --uri="$MONGODB_URI" --oplog --gzip --archive="authcore-$(date +%F-%H%M).archive.gz"

# Standalone (dev): no --oplog; stop writes or accept a "fuzzy" snapshot
mongodump --uri="$MONGODB_URI" --gzip --archive="authcore-$(date +%F-%H%M).archive.gz"
```

- Atlas / managed MongoDB: turn on the provider's continuous backups (point-in-time restore) and still keep a periodic `mongodump` copy elsewhere.
- Schedule: at least daily, keep 7 daily + 4 weekly + 12 monthly (adjust to your recovery point objective).
- Store backups encrypted, in another account / region. They contain personal data (emails, names, IPs) and password hashes.

### Uploaded files

Copy the storage folder at the same time as the database dump (files are immutable: new upload = new file, so an incremental sync is enough):

```bash
rsync -a --delete /app/uploads/ /backups/authcore-uploads/          # or
aws s3 sync /app/uploads s3://my-backups/authcore-uploads --delete
```

Take the file copy right **after** the database dump: a file record without its bytes shows "file not found"; extra bytes without a record are harmless.

## 3. Restore

1. Stop the API instances (or point them away from the database).
2. Restore the database:
   ```bash
   mongorestore --uri="$MONGODB_URI" --gzip --archive=authcore-2026-11-16-0200.archive.gz --drop --oplogReplay
   ```
   (`--oplogReplay` only for dumps taken with `--oplog`; `--drop` replaces existing collections.)
3. Restore the uploads folder to `STORAGE_LOCAL_DIR`.
4. Use the **same** `JWT_ACCESS_SECRET` and `VERIFICATION_TOKEN_SECRET` as at backup time, or users are signed out and pending codes / links stop working (sign-in itself still works).
5. Start the API. Indexes are created on startup (`MONGODB_AUTO_INDEX`); the seeded permissions, system roles and user-schema variables are re-checked.
6. Check `GET /api/v1/health/ready` (database, storage, virus scanner), sign in as an admin, open a user with a profile picture.

**Test a restore** into a separate database at least every quarter; a backup that was never restored is not a backup.

After a restore, sessions created after the backup are gone (those users sign in again), and accounts deleted after the backup are back. Run the deletion purge (`POST /api/v1/admin/users/deletion-purge/run`) if accounts were scheduled for deletion.

## 4. Monitoring

### Health

| Endpoint | Use |
| --- | --- |
| `GET /api/v1/health/live` | Liveness (process answers). Restart the container when it fails. |
| `GET /api/v1/health/ready` | Readiness: database reachable, storage writable, ClamAV reachable (when enabled). Take the instance out of the load balancer when it fails. |

### Metrics (Prometheus)

`GET /api/v1/metrics` with `Authorization: Bearer <METRICS_TOKEN>` (`METRICS_ENABLED=true`). Without a token it is open in development and **disabled in production**.

```yaml
# prometheus.yml
scrape_configs:
  - job_name: authcore
    metrics_path: /api/v1/metrics
    authorization:
      type: Bearer
      credentials_file: /etc/prometheus/authcore-metrics-token
    static_configs:
      - targets: ['authcore-1:3000', 'authcore-2:3000']
```

| Metric | Meaning |
| --- | --- |
| `authcore_http_request_duration_seconds{method,route,status_code}` | Latency histogram per route pattern (ids never appear) |
| `authcore_user_events_total{event,success}` | Sign-ins, failures, lockouts, new devices, password changes, exports … |
| `authcore_emails_total{template,result}` | Emails sent / failed per template |
| `authcore_process_*`, `authcore_nodejs_*` | CPU, memory, event-loop lag, GC, handles |

Suggested alerts:

- `rate(authcore_http_request_duration_seconds_count{status_code=~"5.."}[5m]) > 0.05 * rate(authcore_http_request_duration_seconds_count[5m])`: more than 5 % server errors.
- `histogram_quantile(0.95, sum by (le) (rate(authcore_http_request_duration_seconds_bucket[5m]))) > 1`: p95 latency above 1 s.
- `increase(authcore_user_events_total{event="LOGIN_FAILED"}[10m]) > 200` or `increase(authcore_user_events_total{event="ACCOUNT_LOCKED"}[10m]) > 20`: credential stuffing.
- `increase(authcore_emails_total{result="failed"}[15m]) > 0`: SMTP problems (verification / reset emails not arriving).
- `/health/ready` failing for more than 2 minutes.

Labels never contain user ids, emails or IPs. For a single user's history use `GET /api/v1/admin/activity`.

### Orphan files

Bytes without a record (a crash between writing a file and saving its record, a failed delete) and stale temp files are removed every `FILES_ORPHAN_CLEANUP_INTERVAL_HOURS` (one instance at a time). Run it on demand with `POST /api/v1/files/maintenance/orphan-cleanup` (FILE_DELETE). The result also counts records whose bytes are missing (`missingBytesCount`): after restoring a database from a newer backup than the files, restore the files too.

## 5. Rotating secrets

### `JWT_ACCESS_SECRET` (access tokens): no one is signed out

Access tokens carry `kid` (a hash of the signing secret), so the old secret can be kept for verification only:

1. Generate a new secret (`openssl rand -base64 48`).
2. Deploy with `JWT_ACCESS_SECRET=<new>` and `JWT_ACCESS_PREVIOUS_SECRETS=<old>` (comma-separate several). New tokens use the new secret; existing tokens keep working.
3. After at least `JWT_ACCESS_TTL_SECONDS` (default 15 min) every old token has expired: remove `JWT_ACCESS_PREVIOUS_SECRETS` and deploy again.

Refresh tokens are random values stored hashed, so they are not affected: users stay signed in. If the old secret **leaked**, skip step 2 (deploy the new secret only); signed-in users get a new access token through the normal refresh.

### `VERIFICATION_TOKEN_SECRET` (codes and links)

Used to hash email codes, reset tokens, invite links and account codes. Changing it invalidates the ones currently pending (they expire within minutes / `INVITE_TTL_DAYS` anyway); users request a new code. Rotate during a quiet period, and resend pending invites afterwards (`POST /user-invites/:id/resend`).

### Others

- SMTP password: update `SMTP_PASSWORD`, restart; watch `authcore_emails_total{result="failed"}`.
- `METRICS_TOKEN`: update the API and the Prometheus credentials file together.
- `BOOTSTRAP_ADMIN_PASSWORD`: only used once (first start). Change the admin's password in the app; the env value doesn't matter afterwards.

## 6. Data requests (GDPR-style)

| Request | How |
| --- | --- |
| Access / portability | The user: `POST /api/v1/users/me/export` (JSON file). |
| Erasure | The user: `DELETE /api/v1/users/me` (purged after `ACCOUNT_DELETION_GRACE_DAYS`). Admin: `DELETE /admin/users/:id`, then `DELETE /admin/users/:id/permanent`. Removes the user, sessions, memberships, codes, activity, known devices and uploaded files; audit logs are kept. |
| Rectification | `PATCH /users/me`, `/users/me/attributes`, or the admin equivalents. |

Remember that backups still contain erased users until they age out of your backup retention.
