from __future__ import annotations

import hashlib
import mimetypes
import os
import unicodedata
from typing import Any

import frappe
from frappe import _
from frappe.utils import cint

from vaultdesk.services import audit, security, state
from vaultdesk.services.constants import (
    IMAGE_PREVIEW_EXTENSIONS,
    IMAGE_PREVIEW_MIME_TYPES,
    MAX_TEXT_PREVIEW_BYTES,
    SAFE_PREVIEW_MIME_TYPES,
    TEXT_PREVIEW_EXTENSIONS,
    TEXT_PREVIEW_MIME_TYPES,
)


def create_uploaded_file(folder: Any) -> dict[str, Any]:
    """Persist an HTTP upload as a system-owned private native File and VaultDesk Item."""
    from vaultdesk.services.items import new_item, serialize

    security.require(folder, "upload")
    uploaded = _request_file()
    original_name = _safe_filename(uploaded.filename)
    extension = os.path.splitext(original_name)[1].lower().lstrip(".")
    settings = frappe.get_single("VaultDesk Settings")
    _validate_declared_upload_size(settings)
    content = uploaded.stream.read()
    _validate_upload(extension, content, settings)
    mime_type = _mime_type(original_name, uploaded.content_type)
    native_file = frappe.get_doc(
        {
            "doctype": "File",
            "file_name": original_name,
            "content": content,
            "is_private": 1,
        }
    )
    native_file.owner = _storage_user()
    native_file.insert(ignore_permissions=True)

    item = new_item(
        space=folder.space,
        display_name=original_name,
        is_group=0,
        parent_vaultdesk_item=folder.name,
        native_file=native_file.name,
        original_file_name=original_name,
        mime_type=mime_type,
        file_extension=extension,
        file_size=len(content),
        content_hash=hashlib.sha256(content).hexdigest(),
        storage_backend="Frappe Private File",
        preview_status="Available" if preview_kind_values(mime_type, extension) != "unsupported" else "Unsupported",
    )
    audit.record(
        item,
        "Uploaded",
        target_parent=folder.name,
        details={"size": len(content), "mime_type": mime_type},
    )
    return serialize(item)


def download(item: Any) -> None:
    """Return file content only after current visibility and content checks."""
    security.require(item, "view")
    security.require(item, "download")
    native = _private_native_file(item)
    content = native.get_content()
    if cint(frappe.db.get_single_value("VaultDesk Settings", "log_downloads") or 1):
        audit.record(item, "Downloaded")
    state.touch(item, "downloaded")
    _binary_response(item.display_name, content, item.mime_type, inline=False)


def preview(item: Any) -> None:
    """Return checked preview bytes, forcing code/document text to plain text."""
    security.require(item, "view")
    security.require(item, "download")
    kind = preview_kind(item)
    if kind == "unsupported":
        frappe.throw(_("This file type is not permitted for inline preview."))
    native = _private_native_file(item)
    content = native.get_content()
    content_type = item.mime_type
    if kind == "text":
        content = content[:MAX_TEXT_PREVIEW_BYTES]
        content_type = "text/plain; charset=utf-8"
    audit.record(item, "Previewed")
    state.touch(item, "previewed")
    _binary_response(item.display_name, content, content_type, inline=True)


def preview_info(item: Any) -> dict[str, Any]:
    """Return sanitized preview capabilities; never return native File paths."""
    from vaultdesk.services.items import serialize

    security.require(item, "view")
    state.touch(item, "opened")
    audit.record(item, "Viewed")
    kind = preview_kind(item)
    can_download = security.can(item, "download")
    return {
        "item": serialize(item),
        "preview_kind": kind,
        "content_available": bool(can_download and kind != "unsupported"),
        "download_available": bool(can_download),
        "text_truncated": bool(kind == "text" and cint(item.file_size) > MAX_TEXT_PREVIEW_BYTES),
        "max_text_preview_bytes": MAX_TEXT_PREVIEW_BYTES if kind == "text" else None,
    }


def _private_native_file(item: Any) -> Any:
    if item.is_group or not item.native_file:
        frappe.throw(_("The requested VaultDesk Item has no file content."))
    native = frappe.get_doc("File", item.native_file)
    if not cint(native.is_private):
        frappe.throw(_("Stored VaultDesk content is not private; access has been blocked."))
    if native.owner != _storage_user():
        frappe.throw(_("Stored VaultDesk content has an invalid storage owner; access has been blocked."))
    if native.attached_to_doctype or native.attached_to_name:
        frappe.throw(_("Stored VaultDesk content is attached outside VaultDesk; access has been blocked."))
    return native


def _request_file() -> Any:
    uploaded = getattr(frappe.request, "files", {}).get("file")
    if not uploaded:
        frappe.throw(_("Attach one file in the 'file' multipart upload field."))
    return uploaded


def _validate_upload(extension: str, content: bytes, settings: Any) -> None:
    max_size = cint(settings.max_upload_size_mb or 10) * 1024 * 1024
    if len(content) > max_size:
        frappe.throw(_("File exceeds the VaultDesk upload size limit."))
    allowed = {
        value.strip().lower().lstrip(".")
        for value in (settings.allowed_file_extensions or "").splitlines()
        if value.strip()
    }
    if not allowed:
        frappe.throw(_("VaultDesk uploads are disabled until an extension allowlist is configured."))
    if extension not in allowed:
        frappe.throw(_("This file extension is not allowed in VaultDesk."))


def _validate_declared_upload_size(settings: Any) -> None:
    """Reject obviously oversized multipart requests before reading their body into memory."""
    max_size = cint(settings.max_upload_size_mb or 10) * 1024 * 1024
    request_size = cint(getattr(frappe.request, "content_length", 0) or 0)
    if request_size and request_size > max_size + (1024 * 1024):
        frappe.throw(_("File exceeds the VaultDesk upload size limit."))


def _storage_user() -> str:
    return frappe.db.get_single_value("VaultDesk Settings", "storage_user") or "Administrator"


def preview_kind(item: Any) -> str:
    """Classify permitted preview rendering from stored extension and MIME metadata."""
    return preview_kind_values(item.mime_type, item.file_extension)


def preview_kind_values(mime_type: str | None, extension: str | None) -> str:
    mime_type = (mime_type or "").lower()
    extension = (extension or "").lower().lstrip(".")
    if not _is_configured_preview_type(mime_type):
        return "unsupported"
    if mime_type in IMAGE_PREVIEW_MIME_TYPES and extension in IMAGE_PREVIEW_EXTENSIONS:
        return "image"
    if mime_type == "application/pdf" and extension == "pdf":
        return "pdf"
    if mime_type in TEXT_PREVIEW_MIME_TYPES and extension in TEXT_PREVIEW_EXTENSIONS:
        return "text"
    return "unsupported"


def _is_configured_preview_type(mime_type: str) -> bool:
    configured = {
        value.strip().lower()
        for value in (
            frappe.db.get_single_value("VaultDesk Settings", "previewable_mime_types") or ""
        ).splitlines()
        if value.strip()
    }
    permitted = configured or SAFE_PREVIEW_MIME_TYPES
    return mime_type in SAFE_PREVIEW_MIME_TYPES.intersection(permitted)


def _mime_type(filename: str, submitted_type: str | None) -> str:
    guessed = mimetypes.guess_type(filename)[0]
    return (guessed or submitted_type or "application/octet-stream").lower()


def _safe_filename(filename: str | None) -> str:
    filename = unicodedata.normalize("NFKC", os.path.basename(filename or "")).strip()
    filename = filename.replace("/", "-").replace("\\", "-")
    if any(unicodedata.category(character) in {"Cc", "Cf"} for character in filename):
        frappe.throw(_("Uploaded filenames cannot contain control or formatting characters."))
    if not filename or filename in {".", ".."}:
        frappe.throw(_("A valid uploaded filename is required."))
    return filename[:255]


def _binary_response(filename: str, content: bytes, content_type: str, *, inline: bool) -> None:
    frappe.response.filename = filename
    frappe.response.filecontent = content
    frappe.response.type = "download"
    frappe.response.content_type = content_type or "application/octet-stream"
    if inline:
        frappe.response.display_content_as = "inline"
