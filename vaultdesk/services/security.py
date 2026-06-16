from __future__ import annotations

from typing import Any

import frappe
from frappe import _
from frappe.utils import cint, get_datetime, now_datetime

from vaultdesk.services.constants import ADMIN_ROLES, CAPABILITIES, CAPABILITY_FIELDS


def is_vaultdesk_administrator(user: str | None = None) -> bool:
    """Return whether a user may administer every active VaultDesk object."""
    user = user or frappe.session.user
    if user == "Administrator":
        return True
    return bool(ADMIN_ROLES.intersection(frappe.get_roles(user)))


def principal_keys(user: str | None = None) -> list[str]:
    """Build the ACL principals represented by a current Frappe user."""
    user = user or frappe.session.user
    if not user or user == "Guest":
        return []
    return [f"user:{user}", *(f"role:{role}" for role in frappe.get_roles(user))]


def effective_permissions(item: Any, user: str | None = None) -> dict[str, bool]:
    """Calculate action rights inherited from the nearest ACL boundary upwards."""
    user = user or frappe.session.user
    if is_vaultdesk_administrator(user):
        return {capability: True for capability in CAPABILITIES}

    result = {capability: False for capability in CAPABILITIES}
    keys = principal_keys(user)
    if not keys:
        return result

    item = _as_item_doc(item)
    ancestor_names = _inheritance_scope(item)
    if not ancestor_names:
        return result

    grants = frappe.get_all(
        "VaultDesk Permission",
        filters={
            "vaultdesk_item": ("in", ancestor_names),
            "principal_key": ("in", keys),
        },
        fields=["expires_on", *CAPABILITY_FIELDS.values()],
    )
    current_time = now_datetime()
    for grant in grants:
        if grant.expires_on and get_datetime(grant.expires_on) < current_time:
            continue
        for capability, fieldname in CAPABILITY_FIELDS.items():
            result[capability] = result[capability] or bool(cint(grant.get(fieldname)))
    # Ownership confers no implicit authority. `business_owner` is attacker-controllable
    # (every creator owns what they create via new_item), so granting it an implicit
    # `manage_permissions` let any user holding `upload` mint a self-managed subtree,
    # delegate rights and break_inheritance to escape the parent ACL boundary (VD-002).
    # The recoverable owner of a Space instead receives an *explicit*, revocable grant
    # seeded by `permissions.create_root_owner_grant`; sub-managers are delegated
    # explicitly and remain bound by `_ensure_delegable`. This also keeps this analyzer
    # consistent with the SQL `get_permission_query_conditions` hook (which never trusts
    # ownership), so direct list reads and computed access cannot diverge.
    return result


def can(item: Any, capability: str, user: str | None = None) -> bool:
    """Safely check one VaultDesk capability on an active space."""
    validate_capability(capability)
    item = _as_item_doc(item)
    if not _space_is_active(item):
        return False
    return effective_permissions(item, user).get(capability, False)


def public_effective_permissions(item_name: str, user: str | None = None) -> dict[str, bool]:
    """Return caller rights without making access-hint APIs useful for ID probing.

    Mirrors the execution path's gating (active space, not trashed) so a usability hint can
    never report access the enforcing endpoints would refuse (VD-INFO-003).
    """
    denied = {capability: False for capability in CAPABILITIES}
    try:
        item = frappe.get_doc("VaultDesk Item", item_name)
    except frappe.DoesNotExistError:
        return denied
    if item.trash_root or not _space_is_active(item):
        return denied
    resolved = effective_permissions(item, user)
    return resolved if resolved.get("view") else denied


def deny() -> None:
    """Raise the single uniform authorization error used across VaultDesk.

    Missing items, forbidden items and unknown grants all funnel through this identical
    PermissionError so endpoints cannot be turned into an existence oracle (404 vs 403).
    """
    frappe.throw(_("Not permitted for this VaultDesk item."), frappe.PermissionError)


def require(item: Any, capability: str, user: str | None = None) -> None:
    """Reject an operation unless the current user has the required capability."""
    if not can(item, capability, user):
        deny()


def require_item_access(item_name: str, capability: str, user: str | None = None) -> Any:
    """Load an item and authorize a capability, masking existence behind a uniform 403.

    A non-existent item and an existing-but-forbidden item raise the identical
    PermissionError, so a caller cannot probe which random item names are valid
    (VD-IDOR-001/002).
    """
    try:
        item = frappe.get_doc("VaultDesk Item", item_name)
    except frappe.DoesNotExistError:
        item = None
    if item is None or not can(item, capability, user):
        deny()
    return item


def get_permission_query_conditions(user: str | None = None) -> str:
    """Filter direct VaultDesk Item list reads through inherited view permission.

    API methods still make explicit permission checks. This hook prevents
    accidental leakage through normal permission-aware DocType list requests.
    """
    user = user or frappe.session.user
    active_space_condition = """
        EXISTS (
            SELECT 1
            FROM `tabVaultDesk Space` active_space
            WHERE active_space.name = `tabVaultDesk Item`.space
                AND active_space.is_active = 1
        )
    """
    if is_vaultdesk_administrator(user):
        return active_space_condition

    keys = principal_keys(user)
    if not keys:
        return "1 = 0"
    keys_sql = ", ".join(frappe.db.escape(key) for key in keys)

    return f"""
        {active_space_condition}
        AND COALESCE(`tabVaultDesk Item`.trash_root, '') = ''
        AND EXISTS (
            SELECT 1
            FROM `tabVaultDesk Permission` grant_row
            INNER JOIN `tabVaultDesk Item` ancestor
                ON ancestor.name = grant_row.vaultdesk_item
            WHERE ancestor.space = `tabVaultDesk Item`.space
                AND ancestor.lft <= `tabVaultDesk Item`.lft
                AND ancestor.rgt >= `tabVaultDesk Item`.rgt
                AND grant_row.principal_key IN ({keys_sql})
                AND grant_row.can_view = 1
                AND (
                    grant_row.expires_on IS NULL
                    OR grant_row.expires_on >= NOW()
                )
                AND NOT EXISTS (
                    SELECT 1
                    FROM `tabVaultDesk Item` boundary
                    WHERE boundary.space = `tabVaultDesk Item`.space
                        AND boundary.lft <= `tabVaultDesk Item`.lft
                        AND boundary.rgt >= `tabVaultDesk Item`.rgt
                        AND boundary.lft > ancestor.lft
                        AND boundary.break_inheritance = 1
                )
        )
    """


def has_doctype_permission(
    doc: Any,
    user: str | None = None,
    permission_type: str | None = None,
    ptype: str | None = None,
    **kwargs: Any,
) -> bool:
    """Map standard Frappe document actions onto VaultDesk capabilities."""
    if getattr(doc, "trash_root", None) and not is_vaultdesk_administrator(user):
        return False
    permission_type = ptype or permission_type or "read"
    capability = {
        "read": "view",
        "select": "view",
        "write": "edit",
        "delete": "delete",
        "share": "manage_permissions",
    }.get(permission_type)
    if not capability:
        return False
    return can(doc, capability, user)


def has_file_permission(
    doc: Any,
    user: str | None = None,
    permission_type: str | None = None,
    ptype: str | None = None,
    **kwargs: Any,
) -> bool | None:
    """Keep VaultDesk-managed private binaries reachable only through checked downloads.

    Returns None (no opinion) for any File VaultDesk does not manage, so ordinary ERPNext
    attachments are unaffected. For a File backing a VaultDesk Item it denies *all* direct
    access to non-administrators: the bytes must flow through the permission-checked
    `storage.download`/`storage.preview` path, never the raw `/private/files` route or the
    File list view (VD-FILE-10). The service layer reads the File via `frappe.get_doc`
    (no permission check), so this hook never blocks VaultDesk's own authorized downloads.
    """
    name = getattr(doc, "name", None)
    if not name:
        return None
    if not frappe.db.exists("VaultDesk Item", {"native_file": name}):
        return None
    return is_vaultdesk_administrator(user)


def set_vaultdesk_response_headers(response: Any, request: Any) -> Any:
    """`after_request` hook: add sniffing protections to VaultDesk binary/preview responses.

    Scoped to VaultDesk's own download/preview endpoints by request path, so unrelated ERPNext
    responses are never touched (the app does not modify core). `X-Content-Type-Options: nosniff`
    stops a browser from re-interpreting checked bytes as an active type, and the restrictive CSP
    neutralizes any HTML-ish payload on a direct hit to these URLs (VD-PREVIEW-02). A response
    hook must never raise, so failures are swallowed.
    """
    try:
        path = getattr(request, "path", "") or ""
        if "vaultdesk.api.files.preview_file" in path or "vaultdesk.api.files.download_file" in path:
            response.headers["X-Content-Type-Options"] = "nosniff"
            response.headers["Content-Security-Policy"] = (
                "default-src 'none'; img-src 'self' blob: data:; object-src 'none'; sandbox"
            )
    except Exception:
        pass
    return response


def _inheritance_scope(item: Any) -> list[str]:
    ancestors = frappe.get_all(
        "VaultDesk Item",
        filters=[
            ["space", "=", item.space],
            ["lft", "<=", item.lft],
            ["rgt", ">=", item.rgt],
        ],
        fields=["name", "break_inheritance", "lft"],
        order_by="lft desc",
    )
    scope: list[str] = []
    for ancestor in ancestors:
        scope.append(ancestor.name)
        if cint(ancestor.break_inheritance):
            break
    return scope


def inheritance_scope_root(item: Any) -> str | None:
    """Return the nearest ACL boundary at or above an item.

    Two locations share an inheritance scope (the same source of effective grants) when
    this value matches; used to detect a move that would cross ACL contexts (VD-001).
    """
    scope = _inheritance_scope(_as_item_doc(item))
    return scope[-1] if scope else None


def _as_item_doc(item: Any) -> Any:
    if isinstance(item, str):
        return frappe.get_doc("VaultDesk Item", item)
    return item


def _space_is_active(item: Any) -> bool:
    return bool(cint(frappe.db.get_value("VaultDesk Space", item.space, "is_active")))


def validate_capability(capability: str) -> None:
    if capability not in CAPABILITIES:
        frappe.throw(_("Unknown VaultDesk capability: {0}").format(capability))


def escape_like(value: str) -> str:
    """Neutralize LIKE wildcards in user input so a search term cannot widen its own scan.

    Values are already passed as bound parameters (so this is not an SQLi fix); escaping
    `%`, `_` and the escape character keeps `%`-only queries from scanning every row
    (VD-SQLI-01). MariaDB/MySQL honor backslash as the default LIKE escape character.
    """
    return (value or "").replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
