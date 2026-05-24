# VaultDesk Frontend UI

## What Was Built

The frontend is an isolated standard Frappe Desk Page at `/app/vaultdesk`. It is a
modern business-style file manager with:

- Header search, `Upload`, `New Folder`, sort and grid/list controls.
- Sidebar sections for My Vault, Shared with me, Recent, Starred and Trash.
- Lazy folder tree, breadcrumbs, responsive file grid/table and details panel.
- Protected image, PDF and escaped-source-text preview, with navigation,
  details and download fallback.
- Drag-and-drop upload, rename, move, trash/restore and sharing dialogs.
- Loading skeletons, empty views, recoverable error views and toast feedback.
- Permission-aware controls driven by each item's backend `capabilities`.

The backend remains authoritative. The UI suppresses unavailable actions for a
clearer experience, but every live operation is still permission checked by
the Python API.

## File Placement

```text
vaultdesk/
  vaultdesk/page/vaultdesk/
    vaultdesk.json              Standard Page record and allowed Desk roles
    vaultdesk.js                Desk mount loader for /app/vaultdesk
  public/vaultdesk/
    app.js                 UI state controller and event orchestration
    api.js                 Live Frappe API adapter
    mock_api.js            In-memory test adapter and sample data
    utils.js               Formatting, icons and permission helpers
    vaultdesk.css         Responsive visual system
    demo.html              Asset-only mock demonstration entry
    components/
      layout.js            Shell, toolbar, sidebar and content regions
      content.js           Cards, table, states, details, preview and dialogs
```

No ERPNext core files are edited. Frappe discovers the standard Page from this
custom app when it is installed and migrated on a development or staging site.

## Modes

The installed Desk Page at `/app/vaultdesk` always uses protected live
VaultDesk APIs. It cannot silently present browser-only demo content to ERP
users.

Mock mode is confined to `public/vaultdesk/demo.html` for isolated UI work. It
exercises folders, uploads, drag/drop, grid/list, search, previews, favorites,
trash/restore and sharing entirely in the browser; mock uploads disappear
after reload.

## Live Endpoint Mapping

| UI Feature | Backend Method |
| --- | --- |
| Visible spaces | `vaultdesk.api.folders.get_spaces` |
| Browse folder | `vaultdesk.api.folders.get_folder_contents` |
| Breadcrumbs / tree | `get_breadcrumb_path`, `get_folder_tree` |
| Create / rename / move / trash / restore folder | Folder API equivalents |
| Upload / rename / move / trash / restore file | File API equivalents |
| Preview / download | `get_preview_info`, `preview_file`, `download_file` |
| Search | `search_items` |
| Recent / starred | `get_recent_files`, `get_starred_items` |
| Star / unstar | `set_starred` |
| Sharing | Permission API methods |

The Manage Access dialog implementation and permission preset mapping are
documented in `PERMISSIONS_UI.md`.

The protected preview viewer, type detection and standalone test routes are
documented in `PREVIEW_UI.md`.

### Required Backend Extensions Before Full Live Launch

The existing backend intentionally does not yet expose global aggregation
queries for:

- `Shared with me`
- Global `Trash`

The standalone demo implements both UX flows. The installed Desk Page displays a controlled error for
these sections until secure endpoints are added. Those future endpoints must
apply the same ACL filtering as folder browsing and must not leak names of
revoked or restricted items.

## Installation On An Isolated Bench

Once this app directory is added to a development bench:

```bash
bench --site <test-site> install-app vaultdesk
bench --site <test-site> migrate
bench build --app vaultdesk
```

Assign one of `VaultDesk User`, `VaultDesk Manager`, `VaultDesk Administrator` or
`System Manager` to the test user, then open `/app/vaultdesk`.

The lightweight mock demo can also be served outside Desk from this directory:

```bash
cd vaultdesk/public/vaultdesk
python3 -m http.server 8090
```

Then open `http://localhost:8090/demo.html`.

## Security And UX Notes

- Preview/download links in live mode point only to checked VaultDesk endpoints.
- `capabilities` controls presentation only; it never authorizes an operation.
- Native storage references do not appear in the frontend response model.
- Preview metadata and every content fetch go through protected VaultDesk methods.
- HTML/CSS/JS source is displayed only as escaped plain text; SVG and office
  documents are not embedded.
- The move dialog currently offers visible loaded folders in live mode; a
  later secure folder-picker query should provide large-tree lazy discovery.
- Mobile layouts preserve section navigation and present details as a drawer.
