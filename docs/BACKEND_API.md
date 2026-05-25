# VaultDesk Backend API Architecture

## Purpose

This app is a standalone backend and Desk Page for a Google Drive-like
`VaultDesk` module on Frappe/ERPNext. It does not alter ERPNext core.

The security boundary is the service layer:

```text
Whitelisted method
  -> service operation
     -> centralized effective ACL check
        -> VaultDesk Item / VaultDesk Permission records
     -> native private File content, when permitted
     -> append-only VaultDesk Activity Log
```

Generic browser-side capability checks are only usability hints. Every
mutation and content request checks permissions again on the server.

## Domain Boundary

- `VaultDesk Space` is a top-level security/library boundary.
- `VaultDesk Item` is the single logical record type for folders and files.
- `VaultDesk Permission` gives action capabilities to a Frappe `User` or `Role`.
- `VaultDesk User Item State` records a user's recent/starred state.
- `VaultDesk Activity Log` records security-sensitive actions.
- `File` remains the native Frappe storage record for binary content.

Uploaded VaultDesk content is stored as a private, unattached native `File` owned
by `VaultDesk Settings.storage_user`. This secure initial version validates that
the value remains `Administrator`; normal uploaders never become native
`File` owners. The public API response never exposes `native_file` or a
physical/private URL.

## Capability Resolution

Capabilities are:

```text
view, download, upload, edit, move, delete, manage_permissions
```

Capabilities are evaluated against explicit user and role grants. Starting at
an item, the server combines matching grants on ancestors until it encounters
the nearest item whose `break_inheritance` flag is enabled. VaultDesk Space root
folders always have this flag enabled.

Additional rules:

- A grant containing any capability other than `view` also receives `view`.
- `upload` is valid only on folders.
- A non-administrator may grant only capabilities they already hold.
- An inheritance boundary must retain at least one explicit permission manager.
- The `business_owner` may manage permissions on that owned item, even when
  their ordinary content capability is not otherwise inherited.
- `Administrator`, `System Manager`, and `VaultDesk Administrator` can administer
  all VaultDesk items; their activity still passes through audited services.

`move` is deliberately sensitive: moving an inheriting item into a different
folder may change who inherits access. Only delegate `move` to users trusted
to make that visibility change. A later policy layer may require approval for
cross-team moves; cross-space moves are rejected in this backend version.

## API Conventions

- Methods are invoked as `/api/method/vaultdesk.api.<module>.<method>`.
- State-changing methods require authenticated HTTP `POST`.
- Frappe's normal CSRF/session or token protections apply.
- Read methods still enforce ACL and never use client-supplied permissions.
- Names are high-entropy document identifiers, but security never depends on
  secrecy of those identifiers.
- Capability-hint methods return denied rights for unknown or invisible item
  identifiers instead of confirming that a hidden item exists.
- Delete operations below mean soft-delete to trash; no purge API is exposed.
- Deactivated `VaultDesk Space` records deny item capabilities until an
  administrator reactivates the space.

## Folder APIs

| Method | HTTP | Required Capability | Purpose |
| --- | --- | --- | --- |
| `folders.get_spaces` | GET/POST | `view` on each root | List visible active libraries |
| `folders.create_folder` | POST | `upload` on parent | Create inheriting child folder |
| `folders.rename_folder` | POST | `edit` on folder | Rename logical folder |
| `folders.trash_folder` | POST | `delete` on folder and affected descendants | Trash folder subtree |
| `folders.delete_folder` | POST | `delete` on folder | Alias of trash, never hard delete |
| `folders.restore_folder` | POST | `delete` on item/affected descendants, `upload` on target | Restore folder |
| `folders.move_folder` | POST | `move` on item, `upload` on target | Move within same space |
| `folders.get_folder_contents` | GET/POST | `view` on folder | List visible direct children |
| `folders.get_breadcrumb_path` | GET/POST | `view` on item | Return visible path segments only |
| `folders.get_folder_tree` | GET/POST | `view` on parent | Lazy-load visible subfolders |

`include_trashed=1` on `get_folder_contents` also requires `delete` on the
parent and returns explicitly trashed children originally located there.

## File APIs

| Method | HTTP | Required Capability | Purpose |
| --- | --- | --- | --- |
| `files.upload_file` | POST multipart | `upload` on folder | Store a private File and logical VaultDesk Item |
| `files.rename_file` | POST | `edit` on file | Rename metadata only |
| `files.trash_file` | POST | `delete` on file | Soft-delete one file |
| `files.delete_file` | POST | `delete` on file | Alias of trash |
| `files.restore_file` | POST | `delete` on item, `upload` on target | Restore a file |
| `files.move_file` | POST | `move` on item, `upload` on target | Move within same space |
| `files.download_file` | GET/POST | `view` and `download` on live file | Deliver private bytes |
| `files.get_preview_info` | GET/POST | `view` on live file | Return sanitized classification and content availability |
| `files.preview_file` | GET/POST | `view` and `download` on live file | Deliver approved private preview bytes |
| `files.get_file_details` | GET/POST | `view` on live file | Return sanitized metadata/actions |
| `files.search_items` | GET/POST | Result-by-result `view` | Search file/folder names |
| `files.get_recent_files` | GET/POST | Current `view` per result | User-private recents |
| `files.set_starred` | POST | `view` on item | Star/unstar for current user |
| `files.get_starred_items` | GET/POST | Current `view` per result | User-private favorites |

Upload request:

```text
multipart/form-data
folder=<VaultDesk Item ID of destination folder>
file=<binary>
```

Preview allows only configured MIME types intersected with a hardcoded
extension/MIME allowlist. Images and PDFs are delivered for protected blob
display. `txt`, `csv`, `json`, `html`, `css`, `js` and `py` source is returned
as forced `text/plain` content for escaped display, never executed or embedded
as markup. Office formats, archives and SVG are download/fallback only. Text
preview bodies are limited to 1 MB. Opening preview metadata marks a visible
file as opened for Recent; delivery of supported content is separately logged
as `Previewed`.

## Permission APIs

Capability payload example:

```json
{
  "view": true,
  "download": true,
  "upload": false,
  "edit": false,
  "move": false,
  "delete": false,
  "manage_permissions": false
}
```

| Method | HTTP | Required Capability | Purpose |
| --- | --- | --- | --- |
| `permissions.add_user_permission` | POST | `manage_permissions` | Upsert a user grant |
| `permissions.add_role_permission` | POST | `manage_permissions` | Upsert a role grant |
| `permissions.update_permission` | POST | `manage_permissions` | Replace grant capabilities |
| `permissions.remove_permission` | POST | `manage_permissions` | Remove grant safely |
| `permissions.get_permissions` | GET/POST | `manage_permissions` | Retrieve explicit grants |
| `permissions.get_permission_overview` | GET/POST | Owner or `manage_permissions` | Return owner, direct grants and inherited read-only grants |
| `permissions.search_principals` | GET/POST | Owner or `manage_permissions` | Search enabled ERP users or roles for sharing |
| `permissions.set_permission_inheritance` | POST | `manage_permissions` | Set/remove ACL boundary |
| `permissions.get_effective_permissions` | GET/POST | Current caller only | Return resolved capabilities |
| `permissions.check_access` | GET/POST | Current caller only | Test one capability hint (`share` maps to `manage_permissions`) |

Restricted subfolder workflow:

1. A parent permission manager creates the subfolder.
2. They add an explicit user/role grant containing `manage_permissions` to
   the subfolder for its intended manager.
3. They call `set_permission_inheritance(..., break_inheritance=1)`.
4. Parent ACLs no longer apply beneath that subfolder.

The service refuses step 3 if it would leave the new boundary unmanaged.

`business_owner` is an explicit product-level administration authority for
sharing. If a manager must no longer be able to regain access or grant access
to an owned item, transfer its ownership in addition to removing its grants.

## Content Security

The following controls are intentional:

- `File.is_private` is always set for VaultDesk uploads.
- The native `File.owner` is the controlled storage user, not the uploader.
- Native `File` records are not attached to an ERP document automatically.
- Delivery refuses a native file that was later attached to another document
  or moved away from the controlled storage owner.
- `VaultDesk Item.native_file` and `content_hash` use restricted field permission.
- Download/preview load the native record only after checking the VaultDesk ACL.
- Preview metadata requires `view`; preview bytes require both `view` and
  `download`, and access is checked again on the byte request.
- A stored native file unexpectedly marked public is refused by the service.
- Trash preserves binary content until a future controlled purge job.
- An empty extension allowlist disables uploading rather than accepting
  arbitrary content.

The web server/site configuration must continue to route `/private/files`
through Frappe authorization; a reverse proxy must never expose private files
as public static content.

## Hooks And Direct DocType Access

`hooks.py` adds:

- `permission_query_conditions` for `VaultDesk Item`, using inherited visible
  grants for normal permission-aware list reads.
- `has_permission` for direct `VaultDesk Item` document access.

Controllers reject direct inserts, edits, and deletes of VaultDesk items, grants,
state, and audit logs unless the write originates from the secured service.
This prevents generic REST CRUD from skipping action-specific audit and ACL
rules. Normal direct DocType reads also hide logically trashed items; trash
browsing and restore are service operations with fresh ACL checks.

Internal application code must not return results from unrestricted
`frappe.get_all` calls without applying VaultDesk ACL filtering.

## Known First-Version Constraints

- Upload rejects plainly oversized declared requests early, but still reads an
  accepted file into application memory. Upstream body limits and later
  streamed/resumable upload work remain required for production.
- Search scans bounded metadata candidates then verifies ACL item by item.
  Large repositories should add a synchronously maintained effective-access
  projection before enabling high-volume global search.
- This version provides trash/restore, but deliberately exposes no permanent
  purge or public-link sharing API.
- Preview is not document conversion; unsupported content shows metadata and
  remains download-only for users with download access.
- Version history is currently represented only in the isolated local preview.
  Future live version endpoints must preserve every historical revision unless
  an authorized user confirms manual deletion of an unlocked, non-current
  version; automatic revision cleanup and expiry are outside the product policy.

## Integration Sequence

1. Install the app on a separate bench site matching the target ERPNext and
   Frappe major version.
2. Migrate to create DocTypes and roles.
3. Configure `VaultDesk Settings`, especially size limits, allowed extensions,
   preview MIME types, and retention. Storage ownership remains Administrator
   in this initial secured version.
4. As a VaultDesk Administrator, create a `VaultDesk Space`; its root folder and owner
   full-access grant are created automatically.
5. Exercise the security tests in `SECURITY_TEST_PLAN.md` before adding UI.
6. Build the Desk page only against these APIs, treating returned capabilities
   as display controls and not authorization.
