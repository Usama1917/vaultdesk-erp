from __future__ import annotations

from typing import Any

import frappe
from frappe import _

from vaultdesk.api.utils import reject_cross_site_request, require_post
from vaultdesk.services import items, security, state, storage


@frappe.whitelist()
def upload_file(folder: str) -> dict[str, Any]:
    """Accept multipart field `file` and store it as private protected content."""
    require_post()
    parent = security.require_item_access(folder, "upload")
    items.assert_item_type(parent, True)
    items.require_active(parent)
    return storage.create_uploaded_file(parent)


@frappe.whitelist()
def rename_file(file: str, new_name: str) -> dict[str, Any]:
    """Rename logical file metadata; no stored path is returned or manipulated."""
    require_post()
    return items.rename_item(file, new_name, folder_only=False)


@frappe.whitelist()
def trash_file(file: str) -> dict[str, Any]:
    """Move one file into logical trash without destroying its binary."""
    require_post()
    return items.trash_item(file, folder_only=False)


@frappe.whitelist()
def delete_file(file: str) -> dict[str, Any]:
    """Compatibility API name: deletion is always logical trash at this stage."""
    require_post()
    return items.trash_item(file, folder_only=False)


@frappe.whitelist()
def restore_file(file: str, destination_folder: str | None = None) -> dict[str, Any]:
    """Restore a trashed file only into an upload-permitted folder."""
    require_post()
    return items.restore_item(file, destination_folder, folder_only=False)


@frappe.whitelist()
def move_file(file: str, destination_folder: str) -> dict[str, Any]:
    """Move one file after checking source move and destination upload rights."""
    require_post()
    return items.move_item(file, destination_folder, folder_only=False)


@frappe.whitelist()
def download_file(file: str) -> None:
    """Deliver private bytes only after current view and download checks."""
    reject_cross_site_request()
    item = security.require_item_access(file, "view")
    security.require(item, "download")
    items.require_active(item)
    items.assert_item_type(item, False)
    storage.download(item)


@frappe.whitelist()
def preview_file(file: str) -> None:
    """Deliver safe private preview bytes after fresh view/content checks."""
    reject_cross_site_request()
    item = security.require_item_access(file, "view")
    security.require(item, "download")
    items.require_active(item)
    items.assert_item_type(item, False)
    storage.preview(item)


@frappe.whitelist()
def get_preview_info(file: str) -> dict[str, Any]:
    """Describe secure preview presentation without exposing storage references.

    POST-only: it records a 'Viewed' audit event and recent-state, so it must not be triggerable
    by a cross-site GET (VD-CSRF-001).
    """
    require_post()
    item = security.require_item_access(file, "view")
    items.require_active(item)
    items.assert_item_type(item, False)
    return storage.preview_info(item)


@frappe.whitelist()
def get_file_details(file: str) -> dict[str, Any]:
    """Return file metadata and permitted actions without native storage fields.

    POST-only: get_details records a 'Viewed' audit event and recent-state (VD-CSRF-001).
    """
    require_post()
    details = items.get_details(file)
    if details["type"] != "file":
        frappe.throw(_("The requested VaultDesk Item is not a file."))
    return details


@frappe.whitelist()
def search_items(query: str, start: int = 0, page_length: int = 50) -> list[dict[str, Any]]:
    """Search logical files and folders while ACL-filtering every returned item."""
    return items.search(query, start=start, page_length=page_length)


@frappe.whitelist()
def get_recent_files(page_length: int = 50) -> list[dict[str, Any]]:
    """Return currently visible recent files for the signed-in user only."""
    return items.recent_files(page_length)


@frappe.whitelist()
def set_starred(item: str, starred: bool) -> None:
    """Set current-user favorite state after confirming current visibility."""
    require_post()
    state.set_starred(item, starred)


@frappe.whitelist()
def get_starred_items(page_length: int = 50) -> list[dict[str, Any]]:
    """Return current-user favorites after applying live VaultDesk ACL."""
    return items.starred_items(page_length)
