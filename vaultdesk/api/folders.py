from __future__ import annotations

from typing import Any

import frappe

from vaultdesk.api.utils import require_post
from vaultdesk.services import items, security


@frappe.whitelist()
def get_spaces() -> list[dict[str, Any]]:
    """List only active VaultDesk Spaces whose root folder is visible to the caller."""
    spaces = frappe.get_all(
        "VaultDesk Space",
        filters={"is_active": 1},
        fields=["name", "space_name", "space_type", "root_item"],
        order_by="space_name asc",
    )
    return [
        {
            "name": space.name,
            "space_name": space.space_name,
            "space_type": space.space_type,
            "root": items.serialize(items.get_item(space.root_item)),
        }
        for space in spaces
        if space.root_item and security.can(space.root_item, "view")
    ]


@frappe.whitelist()
def create_folder(parent_folder: str, folder_name: str) -> dict[str, Any]:
    """Create a child folder when the caller may upload into its parent."""
    require_post()
    return items.create_folder(parent_folder, folder_name)


@frappe.whitelist()
def rename_folder(folder: str, new_name: str) -> dict[str, Any]:
    """Rename a folder after an edit-capability check."""
    require_post()
    return items.rename_item(folder, new_name, folder_only=True)


@frappe.whitelist()
def trash_folder(folder: str) -> dict[str, Any]:
    """Move a folder and its visible subtree into logical trash."""
    require_post()
    return items.trash_item(folder, folder_only=True)


@frappe.whitelist()
def delete_folder(folder: str) -> dict[str, Any]:
    """Compatibility API name: deletion is always logical trash at this stage."""
    require_post()
    return items.trash_item(folder, folder_only=True)


@frappe.whitelist()
def restore_folder(folder: str, destination_folder: str | None = None) -> dict[str, Any]:
    """Restore a trashed folder to its prior or explicitly permitted parent."""
    require_post()
    return items.restore_item(folder, destination_folder, folder_only=True)


@frappe.whitelist()
def move_folder(folder: str, destination_folder: str) -> dict[str, Any]:
    """Move a folder within one VaultDesk Space after source and destination checks."""
    require_post()
    return items.move_item(folder, destination_folder, folder_only=True)


@frappe.whitelist()
def get_folder_contents(
    folder: str,
    start: int = 0,
    page_length: int = 50,
    sort_by: str = "name",
    sort_order: str = "asc",
    include_trashed: bool = False,
) -> dict[str, Any]:
    """Browse direct children; inaccessible children are never returned."""
    return items.list_folder(
        folder,
        start=start,
        page_length=page_length,
        sort_by=sort_by,
        sort_order=sort_order,
        include_trashed=frappe.utils.cint(include_trashed),
    )


@frappe.whitelist()
def get_breadcrumb_path(item: str) -> list[dict[str, Any]]:
    """Build a breadcrumb trail without disclosing inaccessible ancestors."""
    return items.breadcrumbs(item)


@frappe.whitelist()
def get_folder_tree(parent_folder: str) -> list[dict[str, Any]]:
    """Lazy-load child folders visible to the current user."""
    return items.folder_tree(parent_folder)
