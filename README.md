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
- Business-safe version history preview with explicit restore and manual deletion flows.
- Permission-aware right-click menus for workspace, file and folder actions.
- English and Arabic interface support with automatic LTR/RTL presentation.
- Lightweight interface motion with reduced-motion support for accessible preview testing.
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

## Standalone Local Preview

The browser preview is deliberately isolated from Frappe and ERPNext. Its
entry point is `vaultdesk/public/vaultdesk/index.html`, which always selects
the in-memory adapter in `mock_api.js`. The Desk page continues to select the
live adapter in `api.js`; running the preview does not install an app, migrate
a site or connect to an ERP database.

### Requirements

- Python 3.10 or newer, already required by this repository.
- A modern browser supporting JavaScript modules.

### Install

There are no frontend packages to install for the local preview. From a clone
of this repository, start the included static assets directly:

```bash
cd /path/to/VaultDesk
python3 -m http.server 3000 --directory vaultdesk/public/vaultdesk
```

Open:

```text
http://localhost:3000/
```

No environment variables are required. Stop the preview server with
`Ctrl+C`.

### Mock Preview Coverage

The preview provides a browser-only document library with Books, Designs,
PDFs, Images, Invoices, Production Files and Shared Documents. It supports
folder navigation, breadcrumbs, search, grid/list views, details, image/PDF/
text preview, upload, new-folder, rename, move, trash/restore, favorites and
permission management flows. It also models permanent file-version history,
manual version deletion, protected versions and right-click menus. Loading
delays, empty folders, restricted files and a failed-preview fixture make
states easy to inspect. The preview also includes lightweight page, card,
menu, modal, details-panel, toast and view-switching motion using native CSS.
When the browser requests reduced motion, non-essential movement and looping
loading effects are reduced to near-instant state changes.

The preview header includes a mock user-language selector for `English / LTR`
and `العربية / RTL`. It preserves the selected mock language in the browser.
You can also open Arabic directly:

```text
http://localhost:3000/?lang=ar
```

The Desk frontend initializes its language from the current Frappe session
language when available (`frappe.boot.lang`, `frappe.boot.user.language` or
`frappe.lang`). The local selector is not shown in live mode.

Version history in the preview follows business-document preservation rules:
each upload becomes the current version while every earlier revision remains
available; restoring an earlier revision makes it current without removing the
previous current revision. There is no automatic cleanup or expiry for
versions. A non-current version can be removed only through an authorized,
confirmed manual delete action. Protected versions must be unlocked by an
administrator before manual deletion, and the current version cannot be
deleted.

Right-click the content canvas, a file/folder card, a folder in the sidebar or
a breadcrumb to access contextual actions. Available entries are derived from
the item permissions; unavailable actions appear disabled.

Useful direct preview routes:

```text
http://localhost:3000/?permissions
http://localhost:3000/?preview=config
http://localhost:3000/?preview=proposal
http://localhost:3000/?preview=restricted
http://localhost:3000/?preview=broken
http://localhost:3000/?versions=invoice
http://localhost:3000/?context=canvas
http://localhost:3000/?context=file
http://localhost:3000/?versions=invoice&lang=ar
http://localhost:3000/?context=file&lang=ar
```

All mutations, uploaded files, version changes and changed permissions exist
only in browser memory and reset on refresh. Downloads are generated demo
content; no actual Frappe user session, persistence, private storage, server
authorization or audit logging is exercised in this mode.

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

For frontend-only design work, use the standalone local preview above; the
installed Desk page always uses live protected APIs and never mock storage.

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
- A live version-history API/storage model that permanently retains revisions
  unless an authorized user confirms a permitted manual deletion.
- Scheduled trash purge processing and backup/restore validation including
  private file binaries and historical versions.
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
