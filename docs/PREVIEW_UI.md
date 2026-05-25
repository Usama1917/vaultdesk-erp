# VaultDesk File Preview System

## Architecture

The preview viewer is deliberately split into metadata and content requests:

```text
User opens visible VaultDesk Item
  -> get_preview_info(file)
       checks current view access and returns sanitized preview classification
  -> preview_file(file), only when a supported body is needed
       checks current view + download access again and returns protected bytes
  -> modal renders an image/PDF blob URL or escaped text
```

The browser never receives a native Frappe `File` URL or storage identifier.
Images and PDFs are fetched through the protected method and displayed from a
temporary browser blob URL, which is revoked when the viewer closes or moves
to another file.

## Modal UX

The large centered viewer provides:

- File-name header, type badge, close, download and details controls.
- Previous and next navigation among currently displayed visible files.
- A progress surface while preview metadata or content is loading.
- An access-denied state when content permission has been removed or withheld.
- A retryable failure state for delivery errors.
- A fallback card for unsupported formats with name, type, size and download.
- An optional details panel containing owner, modified date, size and type.

Navigation requests are tokenized in the page controller. If a user switches
files quickly, content from an earlier request is discarded rather than
rendered under the wrong filename.

## Backend Endpoints

| Method | Required Capability | Response |
| --- | --- | --- |
| `files.get_preview_info(file)` | `view` | Public item metadata, preview kind and current content/download availability |
| `files.preview_file(file)` | `view` and `download` | Supported private preview bytes only |
| `files.download_file(file)` | `download` | Attachment response for authorized download |

`get_preview_info` permits a visible item with no content right to open a
metadata/fallback or access-denied surface. It never permits reading file
bytes. `preview_file` performs its own fresh check, so revoked access applies
even if the modal was already open.

Opening the modal records the permitted file as viewed/opened for the user's
Recent list. Delivery of actual supported preview bytes records the separate
`Previewed` activity only after content authorization succeeds.

## Type Detection

Detection must agree on a supported extension and its stored MIME type. This
prevents an arbitrary file from becoming inline content merely by presenting
a misleading MIME value.

| Kind | Extensions | MIME Types | Rendering |
| --- | --- | --- | --- |
| Image | `jpg`, `jpeg`, `png`, `webp`, `gif` | Corresponding `image/*` allowlist | Image element from protected blob |
| PDF | `pdf` | `application/pdf` | PDF frame from protected blob |
| Text | `txt`, `csv`, `json`, `html`, `css`, `js`, `py` | Safe source allowlist in `VaultDesk Settings` | Escaped `<pre>` text |
| Unsupported | Anything else | Any | Metadata and authorized download only |

HTML, CSS and JavaScript source files are previewed as text only. The backend
forces their preview response to `text/plain; charset=utf-8`; the frontend
escapes the returned value before inserting it into the page. Text previews
are capped at 1 MB and display a truncation notice when the full file is
larger.

## Files

```text
services/constants.py                  Supported MIME/extension allowlists
services/storage.py                    Secure classification and byte serving
api/files.py                           Whitelisted preview-info/content APIs
public/vaultdesk/components/preview.js  Preview modal renderer
public/vaultdesk/app.js               Async viewer/navigation state
public/vaultdesk/api.js               Live protected-content adapter
public/vaultdesk/mock_api.js          Isolated preview fixtures
```

## Standalone Testing

Serve `vaultdesk/public/vaultdesk/` and use:

| URL | Demonstrates |
| --- | --- |
| `?preview=config` | JSON source rendered as escaped text |
| `?preview=proposal` | PDF viewer |
| `?preview=bundle` | Unsupported ZIP fallback |
| `?preview=restricted` | Visible metadata with denied content |
| `?preview=broken` | Retryable protected-content failure |
| `?preview=config&lang=ar` | Arabic/RTL viewer around a source document preview |
