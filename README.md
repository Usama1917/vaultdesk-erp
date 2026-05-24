# VaultDesk

VaultDesk is an isolated Frappe/ERPNext custom app for secure internal document
management. It provides a business-focused file manager experience similar to
Google Drive while retaining document metadata, permissions and private file
storage inside the ERP environment.

## Features

- Folder and nested-folder navigation with breadcrumbs and tree browsing.
- Private file upload, protected download and preview for images, PDFs and
  safe text formats.
- Grid/list views, recent items, starred items, search and item details.
- User- and role-based capabilities for view, download, upload, edit, move,
  delete and permission administration.
- Permission inheritance boundaries for restricted folders.
- Soft delete/restore workflow and append-only activity logging.
- Isolated UI demo plus a Frappe Desk page at `/app/vaultdesk`.

## Tech Stack

- Frappe Framework / ERPNext custom app architecture.
- Python whitelisted APIs, DocType controllers and domain services.
- Native private Frappe `File` records for stored content.
- Vanilla ES modules and CSS for the Desk frontend.

## Domain Model

VaultDesk uses one tree DocType for files and folders rather than separate
folder records:

- `VaultDesk Space`: top-level library and administration boundary.
- `VaultDesk Item`: folder/file tree and stored-file metadata.
- `VaultDesk Permission`: explicit user/role capability grant.
- `VaultDesk User Item State`: starred and recent state.
- `VaultDesk Activity Log`: immutable usage/security audit trail.
- `VaultDesk Settings`: storage, preview, retention and upload policy.

## Development Setup

Use a development Bench site, never a production site, while installing or
validating this app. This repository targets patched Frappe v15 releases
(`>=15.104.0,<16.0.0`).

```bash
cd /path/to/frappe-bench
bench get-app /path/to/VaultDesk
bench --site <development-site> install-app vaultdesk
bench --site <development-site> migrate
bench build --app vaultdesk
```

Assign `VaultDesk User`, `VaultDesk Manager`, `VaultDesk Administrator` or
`System Manager` as appropriate, then open `/app/vaultdesk`.

For frontend-only design work, serve `vaultdesk/public/vaultdesk/demo.html`;
the installed Desk page always uses live protected APIs and never mock storage.

## ERPNext Integration

VaultDesk is a standalone custom app and does not modify ERPNext core. Its
DocTypes, standard Desk Page, assets and API namespace are installed through
normal Frappe migrations. Add a Workspace shortcut to route `vaultdesk` only
after validation on a staging site matching production.

## Security Notes

- Every content and mutation API performs server-side capability checks.
- Uploaded files are created as private native `File` records; storage
  references are not returned by public item responses.
- Preview and download deliver bytes only through checked VaultDesk methods.
- Disabled spaces deny item API access, and recursive trash/restore refuses
  to modify descendants outside the caller's delete authority.
- Uploads require an explicit extension allowlist. The included defaults are
  intentionally limited to previewable document/image/text types.
- Deploy only on a Frappe release patched for CVE-2026-39351, and confirm
  private-file proxy routing before using real documents.

## Current Status

VaultDesk is an isolated staging-ready scaffold, not a production release.
Rename consistency, protected delivery, permission hooks and core tree
operations are prepared for development-site testing. Production readiness
still requires the controls and automated tests listed below.

## Required Before Production

- Streamed/resumable uploads or strict upstream body limits, malware scanning,
  storage quotas and endpoint rate limiting.
- Secure live endpoints for `Shared with me` and global `Trash` sections.
- Scheduled purge/retention processing and backup/restore validation including
  private file binaries.
- Frappe integration tests for ACL inheritance, URL guessing, large uploads,
  concurrent tree mutations and REST permission behavior.

## Repository Layout

```text
vaultdesk/
  api/                         Whitelisted API facade
  services/                    ACL, storage, tree and audit domain services
  vaultdesk/doctype/           VaultDesk DocTypes and controllers
  vaultdesk/page/vaultdesk/    Desk route `/app/vaultdesk`
  public/vaultdesk/            Frontend assets and isolated demo
docs/                          Architecture and testing notes
```

## License

MIT. See [license.txt](license.txt).
