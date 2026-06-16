from __future__ import annotations

from typing import Any

import frappe
from frappe import _
from frappe.utils import add_days, cint, now_datetime

from vaultdesk.services import audit, security, state
from vaultdesk.services.constants import DEFAULT_PAGE_LENGTH, MAX_PAGE_LENGTH, MAX_SEARCH_SCAN

SORT_COLUMNS = {
    "name": "display_name",
    "modified": "modified",
    "size": "file_size",
    "type": "mime_type",
}


def create_space_root(space: Any) -> Any:
    """Create a non-movable root folder and seed its initial owner ACL."""
    from vaultdesk.services.permissions import create_root_owner_grant

    root = frappe.get_doc(
        {
            "doctype": "VaultDesk Item",
            "space": space.name,
            "display_name": space.space_name,
            "is_group": 1,
            "business_owner": space.owner_user,
            "created_by_user": frappe.session.user,
            "break_inheritance": 1,
        }
    )
    root.flags.from_vaultdesk_service = True
    root.flags.creating_space_root = True
    root.insert(ignore_permissions=True)
    space.db_set("root_item", root.name, update_modified=False)
    create_root_owner_grant(root, space.owner_user)
    audit.record(root, "Created", details={"kind": "space_root"})
    return root


def create_folder(parent_name: str, display_name: str) -> dict[str, Any]:
    """Create an inheriting child folder after checking destination upload access."""
    parent = security.require_item_access(parent_name, "upload")
    assert_item_type(parent, True)
    require_active(parent)
    folder = new_item(
        space=parent.space,
        display_name=display_name,
        is_group=1,
        parent_vaultdesk_item=parent.name,
    )
    audit.record(folder, "Created", target_parent=parent.name, details={"kind": "folder"})
    return serialize(folder)


def rename_item(item_name: str, display_name: str, *, folder_only: bool | None = None) -> dict[str, Any]:
    """Rename a logical item while leaving its physical private path untouched."""
    item = security.require_item_access(item_name, "edit")
    assert_item_type(item, folder_only)
    require_active(item)
    old_name = item.display_name
    item.display_name = _clean_display_name(display_name)
    _save_item(item)
    audit.record(item, "Renamed", details={"from": old_name, "to": item.display_name})
    return serialize(item)


def move_item(item_name: str, destination_name: str, *, folder_only: bool | None = None) -> dict[str, Any]:
    """Move an item; crossing ACL contexts additionally requires manage_permissions (VD-001)."""
    item = security.require_item_access(item_name, "move")
    assert_item_type(item, folder_only)
    require_active(item)
    _require_not_root(item)
    destination = security.require_item_access(destination_name, "upload")
    assert_item_type(destination, True)
    require_active(destination)
    if item.space != destination.space:
        frappe.throw(_("Moving items between VaultDesk Spaces is not supported."))
    if item.is_group and destination.lft >= item.lft and destination.rgt <= item.rgt:
        frappe.throw(_("A folder cannot be moved inside itself."))
    source_parent = item.parent_vaultdesk_item
    if source_parent == destination.name:
        return serialize(item)
    _require_move_authority(item, destination)
    item.parent_vaultdesk_item = destination.name
    _save_item(item)
    audit.record(item, "Moved", source_parent=source_parent, target_parent=destination.name)
    return serialize(item)


def trash_item(item_name: str, *, folder_only: bool | None = None) -> dict[str, Any]:
    """Soft-delete an item after authorizing every descendant changed with it."""
    item = security.require_item_access(item_name, "delete")
    assert_item_type(item, folder_only)
    require_active(item)
    _require_not_root(item)
    descendant_count = _require_subtree_delete_access(item) if item.is_group else 0
    retention_days = cint(frappe.db.get_single_value("VaultDesk Settings", "trash_retention_days") or 30)
    item.original_parent_vaultdesk_item = item.parent_vaultdesk_item
    item.is_trashed = 1
    item.trash_root = item.name
    item.trashed_on = now_datetime()
    item.trashed_by = frappe.session.user
    item.purge_after = add_days(item.trashed_on, retention_days)
    _save_item(item)
    if item.is_group:
        # Re-read the just-saved nested-set bounds under a row lock so a concurrent move()
        # cannot leave us marking the wrong descendant set by stale lft/rgt (VD-RACE-07).
        bounds = frappe.db.get_value(
            "VaultDesk Item", item.name, ["lft", "rgt"], for_update=True, as_dict=True
        )
        frappe.db.sql(
            """
            UPDATE `tabVaultDesk Item`
            SET trash_root = %(root)s
            WHERE space = %(space)s
              AND lft > %(lft)s AND rgt < %(rgt)s
              AND COALESCE(trash_root, '') = ''
            """,
            {"root": item.name, "space": item.space, "lft": bounds.lft, "rgt": bounds.rgt},
        )
    audit.record(
        item,
        "Trashed",
        source_parent=item.original_parent_vaultdesk_item,
        details={"descendant_count": descendant_count},
    )
    return serialize(item)


def restore_item(
    item_name: str,
    destination_name: str | None = None,
    *,
    folder_only: bool | None = None,
) -> dict[str, Any]:
    """Restore an explicitly trashed item into an active permitted folder."""
    item = security.require_item_access(item_name, "delete")
    assert_item_type(item, folder_only)
    if not cint(item.is_trashed) or item.trash_root != item.name:
        frappe.throw(_("Only the top-level trashed item can be restored."))
    descendant_count = _require_subtree_delete_access(item, trash_root=item.name) if item.is_group else 0
    destination = security.require_item_access(
        destination_name or item.original_parent_vaultdesk_item, "upload"
    )
    assert_item_type(destination, True)
    require_active(destination)
    if destination.space != item.space:
        frappe.throw(_("An item must be restored within its original VaultDesk Space."))
    item.parent_vaultdesk_item = destination.name
    item.is_trashed = 0
    item.trash_root = None
    item.trashed_on = None
    item.trashed_by = None
    item.purge_after = None
    _save_item(item)
    frappe.db.sql(
        "UPDATE `tabVaultDesk Item` SET trash_root = NULL WHERE trash_root = %s",
        item.name,
    )
    audit.record(
        item,
        "Restored",
        target_parent=destination.name,
        details={"descendant_count": descendant_count},
    )
    return serialize(item)


def list_folder(
    folder_name: str,
    *,
    start: int = 0,
    page_length: int = DEFAULT_PAGE_LENGTH,
    sort_by: str = "name",
    sort_order: str = "asc",
    include_trashed: bool = False,
) -> dict[str, Any]:
    """Return only visible direct children of a folder."""
    folder = security.require_item_access(folder_name, "view")
    assert_item_type(folder, True)
    require_active(folder)
    if include_trashed:
        security.require(folder, "delete")
    start = max(cint(start), 0)
    page_length = min(max(cint(page_length), 1), MAX_PAGE_LENGTH)
    order_column = SORT_COLUMNS.get(sort_by, "display_name")
    direction = "desc" if str(sort_order).lower() == "desc" else "asc"
    filters: dict[str, Any] = (
        {"space": folder.space, "original_parent_vaultdesk_item": folder.name, "is_trashed": 1}
        if include_trashed
        else {"space": folder.space, "parent_vaultdesk_item": folder.name, "trash_root": ["is", "not set"]}
    )
    candidates = frappe.get_all(
        "VaultDesk Item",
        filters=filters,
        fields=["name"],
        order_by=f"{order_column} {direction}",
        limit_start=start,
        limit_page_length=page_length,
    )
    visible = [serialize(get_item(row.name)) for row in candidates if security.can(row.name, "view")]
    return {"folder": serialize(folder), "items": visible, "start": start, "page_length": page_length}


def breadcrumbs(item_name: str) -> list[dict[str, Any]]:
    """Return accessible ancestors only, preventing restricted parent-name leakage."""
    item = security.require_item_access(item_name, "view")
    ancestors = frappe.get_all(
        "VaultDesk Item",
        filters=[
            ["space", "=", item.space],
            ["lft", "<=", item.lft],
            ["rgt", ">=", item.rgt],
        ],
        fields=["name"],
        order_by="lft asc",
    )
    return [serialize(get_item(row.name)) for row in ancestors if security.can(row.name, "view")]


def folder_tree(parent_name: str) -> list[dict[str, Any]]:
    """Lazy-load visible active subfolders below one permitted parent."""
    parent = security.require_item_access(parent_name, "view")
    assert_item_type(parent, True)
    require_active(parent)
    folders = frappe.get_all(
        "VaultDesk Item",
        filters={
            "space": parent.space,
            "parent_vaultdesk_item": parent.name,
            "is_group": 1,
            "trash_root": ["is", "not set"],
        },
        fields=["name"],
        order_by="display_name asc",
    )
    return [serialize(get_item(row.name)) for row in folders if security.can(row.name, "view")]


def search(query: str, *, start: int = 0, page_length: int = DEFAULT_PAGE_LENGTH) -> list[dict[str, Any]]:
    """Search candidate metadata and ACL-filter every result before returning it."""
    query = (query or "").strip()
    if len(query) < 2:
        frappe.throw(_("Search requires at least two characters."))
    start = max(cint(start), 0)
    page_length = min(max(cint(page_length), 1), MAX_PAGE_LENGTH)
    candidates = frappe.get_all(
        "VaultDesk Item",
        filters={
            "display_name": ["like", f"%{security.escape_like(query)}%"],
            "trash_root": ["is", "not set"],
        },
        fields=["name"],
        order_by="modified desc",
        limit_page_length=MAX_SEARCH_SCAN,
    )
    visible = [serialize(get_item(row.name)) for row in candidates if security.can(row.name, "view")]
    return visible[start : start + page_length]


def recent_files(page_length: int = DEFAULT_PAGE_LENGTH) -> list[dict[str, Any]]:
    """Return a user's recently opened live files after rechecking current ACL."""
    page_length = min(max(cint(page_length), 1), MAX_PAGE_LENGTH)
    states = frappe.get_all(
        "VaultDesk User Item State",
        filters={"user": frappe.session.user, "last_opened_on": ["is", "set"]},
        fields=["vaultdesk_item"],
        order_by="last_opened_on desc",
        limit_page_length=page_length * 3,
    )
    results: list[dict[str, Any]] = []
    for row in states:
        item = get_item(row.vaultdesk_item)
        if not item.is_group and not item.trash_root and security.can(item, "view"):
            results.append(serialize(item))
        if len(results) == page_length:
            break
    return results


def starred_items(page_length: int = DEFAULT_PAGE_LENGTH) -> list[dict[str, Any]]:
    """Return live starred files and folders without retaining revoked visibility."""
    page_length = min(max(cint(page_length), 1), MAX_PAGE_LENGTH)
    states = frappe.get_all(
        "VaultDesk User Item State",
        filters={"user": frappe.session.user, "is_starred": 1},
        fields=["vaultdesk_item"],
        order_by="modified desc",
        limit_page_length=page_length * 3,
    )
    results: list[dict[str, Any]] = []
    for row in states:
        item = get_item(row.vaultdesk_item)
        if not item.trash_root and security.can(item, "view"):
            results.append(serialize(item))
        if len(results) == page_length:
            break
    return results


def get_details(item_name: str) -> dict[str, Any]:
    """Retrieve permitted metadata and mark a file as recently opened."""
    item = security.require_item_access(item_name, "view")
    require_active(item)
    if not item.is_group:
        state.touch(item, "opened")
        audit.record(item, "Viewed")
    return serialize(item)


def serialize(item: Any) -> dict[str, Any]:
    """Create the public item representation; never expose native File linkage."""
    permissions = security.effective_permissions(item)
    starred = bool(
        frappe.db.get_value(
            "VaultDesk User Item State",
            {"user": frappe.session.user, "vaultdesk_item": item.name},
            "is_starred",
        )
    )
    payload = {
        "name": item.name,
        "display_name": item.display_name,
        "type": "folder" if item.is_group else "file",
        "space": item.space,
        "parent_vaultdesk_item": item.parent_vaultdesk_item,
        "business_owner": item.business_owner,
        "created_by": item.created_by_user,
        "creation": item.creation,
        "modified": item.modified,
        "modified_by": item.modified_by,
        "is_trashed": bool(cint(item.is_trashed)),
        "is_starred": starred,
        "capabilities": permissions,
    }
    if not item.is_group:
        payload.update(
            {
                "original_file_name": item.original_file_name,
                "mime_type": item.mime_type,
                "file_extension": item.file_extension,
                "file_size": item.file_size,
                "preview_status": item.preview_status,
            }
        )
    return payload


def get_item(item_name: str) -> Any:
    if not item_name:
        frappe.throw(_("A VaultDesk Item is required."))
    return frappe.get_doc("VaultDesk Item", item_name)


def require_folder(item_name: str | None) -> Any:
    if not item_name:
        frappe.throw(_("A destination folder is required."))
    item = get_item(item_name)
    if not item.is_group:
        frappe.throw(_("The requested VaultDesk Item is not a folder."))
    return item


def require_active(item: Any) -> None:
    if item.trash_root:
        frappe.throw(_("This VaultDesk item is currently in trash."))


def new_item(**values: Any) -> Any:
    item = frappe.get_doc({"doctype": "VaultDesk Item", **values})
    item.display_name = _clean_display_name(item.display_name)
    item.business_owner = item.business_owner or frappe.session.user
    item.created_by_user = item.created_by_user or frappe.session.user
    item.flags.from_vaultdesk_service = True
    item.insert(ignore_permissions=True)
    return item


def _save_item(item: Any) -> None:
    item.flags.from_vaultdesk_service = True
    item.save(ignore_permissions=True)


def _clean_display_name(display_name: str) -> str:
    cleaned = (display_name or "").strip().replace("/", "-").replace("\\", "-")
    if not cleaned or cleaned in {".", ".."}:
        frappe.throw(_("A valid file or folder name is required."))
    return cleaned[:255]


def _require_not_root(item: Any) -> None:
    if not item.parent_vaultdesk_item:
        frappe.throw(_("A VaultDesk Space root folder cannot be moved or deleted."))


def _require_move_authority(item: Any, destination: Any) -> None:
    """Block a plain `move` right from escalating access by relocating across ACL contexts.

    An item that is itself an inheritance boundary keeps its own ACL wherever it lands, and a
    move within the same inheritance scope leaves every effective grant unchanged — both are
    safe with just `move` + destination `upload`. But moving a non-boundary item into a
    *different* scope rebinds the effective ACL of the item and its open descendants (e.g.
    view -> download on content the actor could previously only view). Authorizing that ACL
    change requires `manage_permissions` on the moved item (VD-001).
    """
    if cint(item.break_inheritance):
        return
    if security.inheritance_scope_root(item) == security.inheritance_scope_root(destination):
        return
    security.require(item, "manage_permissions")


def _require_subtree_delete_access(item: Any, *, trash_root: str | None = None) -> int:
    """Prevent a parent trash/restore operation from crossing a restricted boundary."""
    filters: list[list[Any]] = [
        ["space", "=", item.space],
        ["lft", ">", item.lft],
        ["rgt", "<", item.rgt],
    ]
    filters.append(["trash_root", "=", trash_root] if trash_root else ["trash_root", "is", "not set"])
    descendants = frappe.get_all("VaultDesk Item", filters=filters, fields=["name"])
    for descendant in descendants:
        if not security.can(descendant.name, "delete"):
            frappe.throw(
                _("This folder contains restricted items that you are not permitted to change."),
                frappe.PermissionError,
            )
    return len(descendants)


def assert_item_type(item: Any, folder_only: bool | None) -> None:
    if folder_only is True and not item.is_group:
        frappe.throw(_("The requested VaultDesk Item is not a folder."))
    if folder_only is False and item.is_group:
        frappe.throw(_("The requested VaultDesk Item is not a file."))
