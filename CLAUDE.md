# CLAUDE.md

Guidance for working in this repository. VaultDesk is an **isolated Frappe/ERPNext v15 custom app** for secure internal document management — a Google Drive-style file manager that keeps file metadata, permissions and private binaries inside the ERP. It does **not** modify ERPNext core.

Status: staging-ready scaffold, **not a production release**. See README.md "Required Before Production".

## Architecture: the security boundary is the service layer

Every request flows top-down; permission and content checks happen on the **server**, never trusting the browser:

```
Whitelisted API method (vaultdesk/api/*.py)
  -> service operation (vaultdesk/services/*.py)
     -> centralized effective-ACL check (services/security.py)
        -> VaultDesk Item / VaultDesk Permission records
     -> native private File content, only when permitted (services/storage.py)
     -> append-only VaultDesk Activity Log (services/audit.py)
```

Layers and their rules:
- **`vaultdesk/api/`** — thin `@frappe.whitelist()` facade only. No business logic. State-changing methods call `require_post()`. `files.py`, `folders.py`, `permissions.py`, `utils.py`.
- **`vaultdesk/services/`** — all domain logic and authorization.
  - `security.py` — the ACL engine. `can()` / `require()` / `effective_permissions()`. Inheritance walks ancestors via nested-set `lft`/`rgt` and stops at the nearest `break_inheritance` boundary. Also hosts the `permission_query_conditions` + `has_permission` hooks that protect *direct* DocType reads.
  - `items.py` — tree CRUD, listing, search, recent/starred, soft-delete (`trash_item`) / `restore_item`, and `serialize()` (the **only** place a public item payload is built — never exposes `native_file`).
  - `storage.py` — upload/download/preview against native private `File`. Enforces extension allowlist, size limits, and re-validates that stored files stay private + owned by the storage user + unattached.
  - `permissions.py`, `state.py` (starred/recent), `audit.py`, `constants.py`.
- **`vaultdesk/vaultdesk/doctype/`** — 6 DocTypes (controllers + JSON schema).
- **`vaultdesk/vaultdesk/page/vaultdesk/`** — the Desk Page route `/app/vaultdesk`.
- **`vaultdesk/public/vaultdesk/`** — vanilla ES-module + CSS frontend (no build step, no npm).

## Domain model (6 DocTypes)

One **tree** DocType holds both folders and files — no separate folder records.

- **VaultDesk Space** — top-level library + ACL boundary. Cannot be deleted (deactivate via `is_active`); creates its root folder on insert.
- **VaultDesk Item** — `NestedSet` (parent field `parent_vaultdesk_item`); `is_group=1` is a folder, `0` is a file referencing a `native_file`. Soft-delete fields: `trash_root`, `is_trashed`, `original_parent_vaultdesk_item`, `purge_after`. `break_inheritance` makes an item an ACL boundary.
- **VaultDesk Permission** — explicit grant for a `principal_key` (`user:<x>` or `role:<x>`) with per-capability `can_*` flags + optional `expires_on`.
- **VaultDesk User Item State** — per-user starred / last-opened state.
- **VaultDesk Activity Log** — immutable audit trail (no binary paths/contents).
- **VaultDesk Settings** — single DocType: storage user, upload allowlist/size, preview MIME types, trash retention.

Capabilities (`services/constants.py`): `view, download, upload, edit, move, delete, manage_permissions`.
Admin roles that bypass ACL: `System Manager`, `VaultDesk Administrator` (+ `Administrator` user). App roles created on install: `VaultDesk User`, `VaultDesk Manager`, `VaultDesk Administrator`.

## Non-negotiable invariants — preserve these when editing

- **VaultDesk Items are only writable through the service layer.** Controllers reject any insert/save/trash lacking `flags.from_vaultdesk_service` (see `vaultdesk_item.py::_assert_service_write`). When you must write an Item directly, set that flag — do not remove the guard.
- **Never expose `native_file` or any storage path** in an API/serialize response. Bytes leave the server only through the checked `download`/`preview` methods.
- **Re-check permissions on every operation.** Browser capability hints (`check_access`, `get_effective_permissions`) are usability only; server endpoints must not rely on them.
- **Deletion is soft (trash) at this stage.** `delete_file`/`delete_folder` are compatibility aliases that call `trash_item`. Subtree trash/restore must verify `delete` rights on *every* descendant (`_require_subtree_delete_access`) — do not let an operation cross a restricted boundary.
- **Storage user must stay `Administrator`** and public sharing stays disabled (enforced in `VaultDeskSettings.validate`).
- **Uploads require an explicit extension allowlist**; preview is limited to safe image/PDF/text MIME types (`constants.py`). Text preview is forced to `text/plain` and byte-capped.
- **Inheritance boundaries must retain ≥1 permission manager** (`_ensure_boundary_manager`). A grantor cannot delegate a capability they don't hold (`_ensure_delegable`).

## Frontend (two adapters, one app)

`app.js` mounts the UI and picks an API adapter by mode:
- **Live** (`api.js` → `LiveVaultDeskApi`): used by the installed Desk Page; calls the whitelisted Python methods.
- **Mock** (`mock_api.js` → `MockVaultDeskApi`): in-browser memory only; used by the standalone preview. No server, no persistence, resets on refresh.

`index.html` always selects mock; the Desk page always selects live. i18n (`i18n.js`) drives English/LTR + Arabic/RTL. Components live in `public/vaultdesk/components/`.

## Commands

Local frontend preview (no install, no DB, mock data only):
```bash
python3 -m http.server 3000 --directory vaultdesk/public/vaultdesk
# http://localhost:3000/   (?lang=ar for Arabic; see README for ?preview= / ?versions= routes)
```

Install on a **development** Bench site (never production):
```bash
bench get-app /path/to/vaultdesk-erp
bench --site <dev-site> install-app vaultdesk
bench --site <dev-site> migrate
bench build --app vaultdesk
# then assign VaultDesk roles and open /app/vaultdesk
```

Lint (config in `pyproject.toml`, line length 110, rules E/F/I):
```bash
ruff check vaultdesk
ruff format vaultdesk
```

No test suite exists yet — Frappe integration tests for ACL/uploads/concurrency are listed as required before production.

## Conventions

- Python ≥ 3.10, `from __future__ import annotations`, full type hints, double quotes.
- Every service docstring states the security intent — keep that style when adding methods.
- User-facing strings go through `frappe._()` for i18n.
- Frontend is dependency-free vanilla ES modules + CSS; do not introduce a build toolchain.

## Reference docs (`docs/`)

`BACKEND_API.md` (API/security boundary), `FRONTEND_UI.md`, `PERMISSIONS_UI.md`, `PREVIEW_UI.md`, `VERSION_HISTORY_UI.md`, and **`SECURITY_TEST_PLAN.md`** — read the security test plan before changing any ACL, upload, preview or sharing behavior.

## Security caveats from README

Deploy only on a Frappe release patched for CVE-2026-39351 and confirm private-file proxy routing before using real documents. Version history is currently modeled in the mock preview only; the live version-history API/storage is still TODO.
