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
- Local-preview version history with upload, restore, protected-revision and
  explicit manual delete flows.
- Permission-aware right-click menus on empty space, items, folder tree nodes
  and breadcrumbs.
- English/LTR and Arabic/RTL rendering driven through a centralized
  translation dictionary and language-aware layout.
- CSS-driven micro-interactions for navigation, cards, view changes, menus,
  dialogs, details, drag/drop and version updates, with reduced-motion support.
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
    i18n.js                English/Arabic dictionaries and language resolution
    utils.js               Formatting, icons and permission helpers
    vaultdesk.css         Responsive visual system
    index.html             Standalone local-preview mock entry
    demo.html              Compatibility redirect to index.html
    components/
      layout.js            Shell, toolbar, sidebar and content regions
      content.js           Cards, table, states, details, preview and dialogs
      versions.js          Local-preview version history modal and delete confirmation
```

No ERPNext core files are edited. Frappe discovers the standard Page from this
custom app when it is installed and migrated on a development or staging site.

## Modes

The installed Desk Page at `/app/vaultdesk` always uses protected live
VaultDesk APIs. It cannot silently present browser-only demo content to ERP
users.

Mock mode is confined to `public/vaultdesk/index.html` for isolated UI work. It
exercises folders, uploads, drag/drop, grid/list, search, previews, favorites,
trash/restore, sharing, context menus and permanent-in-session version history
entirely in the browser; mock changes disappear after reload.

Version actions are exposed only when an adapter implements the preview
version API. The live adapter currently does not implement version endpoints,
so this design can be evaluated without implying backend storage behavior.
The intended live policy is that revisions have no automatic cleanup or
expiry: only an authorized confirmed manual deletion of an unlocked,
non-current version may remove one.

## Language And Direction

All interface copy is referenced through translation keys in `i18n.js`.
English uses `dir="ltr"`; Arabic uses `dir="rtl"`, with mirrored sidebar and
details borders, navigation arrows, menu placement and responsive detail
drawer positioning.

In the standalone preview, choose a language from the header control or use:

```text
http://localhost:3000/?lang=en
http://localhost:3000/?lang=ar
```

For the installed Desk page, the UI reads the available current-session
Frappe language value at mount time. Server-returned document names, user
names, uploaded document contents and backend exception bodies are business
data rather than translated UI copy; the server must return localized
exceptions when live Arabic sessions are enabled.

## Motion And Accessibility

The local preview uses only CSS transitions and compact state classes from
`app.js`; it does not load an animation framework. Page entry, folder/section
loads, grid/list changes, item hover/selection, context menus, modal open and
close, toast feedback, drag/drop and the details panel use short transforms
and opacity transitions. Version restore is confirmed before it becomes
current, while mock version uploads display a small progress state and newly
current versions receive a brief success emphasis.

RTL mode reverses inline slide offsets and responsive panel direction. Under
`prefers-reduced-motion: reduce`, decorative transitions and looping shimmer
or progress animation are collapsed to near-instant updates while controls
and status content remain available.

## Standalone Responsive Layout

`index.html` marks the mock preview as a standalone viewport-sized page so it
does not inherit Desk-page negative margins or reduced-height assumptions.
The local shell fills `100dvh` where supported, contains its internal scroll
regions, and uses shrinkable sidebar/main/details grid tracks. At narrower
desktop widths the details panel becomes an in-shell overlay, while mobile
navigation and header controls reflow without creating horizontal document
scrolling. Long list and breadcrumb labels truncate rather than increasing the
layout width.

The standalone bootstrap renders a loading state before importing application
modules. If a script fails to load or initialization fails, it replaces the
mount with a localized retry message instead of leaving a blank page.

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

The version preservation and context-menu design is documented in
`VERSION_HISTORY_UI.md`.

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

Then open `http://localhost:8090/`. The former `demo.html` address remains an
alias for bookmarks and preview links.

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
