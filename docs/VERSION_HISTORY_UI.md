# VaultDesk Version History And Context Menus

## Preservation Policy

VaultDesk treats versions as business records rather than transient upload
artifacts:

- A file may hold any number of historical versions.
- Uploading a new version marks it current and retains every earlier version.
- Restoring an earlier version marks that selected revision current and retains
  the previously current revision.
- Version history has no automatic cleanup, expiry or cleanup-candidate state.
- Only an authorized user may manually delete a specific non-current version,
  and the UI requires confirmation.
- A protected version cannot be manually deleted until an administrator
  explicitly unlocks it.
- A current version cannot be deleted; the user must first restore a different
  revision or upload a new version.

This policy is modeled in the local preview's browser-memory adapter. It is a
requirement for a future live Frappe version API, not an installed backend
endpoint in the current scaffold.

## Local Preview Flow

Right-click a file and choose `Manage Versions`, or open:

```text
http://localhost:3000/?versions=invoice
http://localhost:3000/?versions=invoice&lang=ar
```

The sample invoice includes a current version, a protected audit checkpoint
and an older manually deletable revision. Users with edit capability can
upload or request a confirmed restore; users with delete capability can
request deletion of a non-current unlocked revision; users with permission-management
capability can protect or unlock revisions.

In mock mode, uploading a new version displays a short progress indicator and
the new current revision receives a subtle success highlight. A restored
revision receives the same confirmation and success treatment without
discarding any previous history. These animations follow reduced-motion
preferences.

All local actions are in memory. Reloading the browser reconstructs the sample
history.

## Context Menus

The local preview supports right-click actions in these locations:

| Surface | Actions |
| --- | --- |
| Empty content space | New Folder, Upload File, Refresh, Sort options, Grid View, List View |
| File | Preview, Download, Rename, Move, Copy, Delete, Manage Versions, Upload New Version, Share / Manage Access, Details |
| Folder | Open, Rename, Move, Copy, Delete, Share / Manage Access, Details |
| Sidebar folder | Folder actions using that folder's current capabilities |
| Breadcrumb folder | Folder actions using that folder's current capabilities |

Entries remain visible when helpful for orientation, but mutation entries are
disabled when the item or destination permissions do not allow the action.
The mock adapter also repeats the permission checks before changing in-memory
state.

Useful deterministic preview routes for visual checks:

```text
http://localhost:3000/?context=canvas
http://localhost:3000/?context=file
http://localhost:3000/?context=folder
http://localhost:3000/?context=tree
http://localhost:3000/?context=breadcrumb
http://localhost:3000/?context=readonly
http://localhost:3000/?context=file&lang=ar
```
