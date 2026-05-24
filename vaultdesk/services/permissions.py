from __future__ import annotations

from typing import Any

import frappe
from frappe import _
from frappe.utils import cint, get_datetime, now_datetime

from vaultdesk.services import audit, security
from vaultdesk.services.constants import CAPABILITIES, CAPABILITY_FIELDS


def add_user_grant(
    item_name: str,
    user: str,
    capabilities: dict[str, Any],
    expires_on: str | None = None,
) -> dict[str, Any]:
    """Grant explicit item rights to one Frappe user."""
    return _upsert_grant(item_name, "User", user, capabilities, expires_on)


def add_role_grant(
    item_name: str,
    role: str,
    capabilities: dict[str, Any],
    expires_on: str | None = None,
) -> dict[str, Any]:
    """Grant explicit item rights to all users assigned one Frappe role."""
    return _upsert_grant(item_name, "Role", role, capabilities, expires_on)


def update_grant(
    grant_name: str,
    capabilities: dict[str, Any],
    expires_on: str | None = None,
) -> dict[str, Any]:
    """Replace the capabilities of an existing explicit grant."""
    grant = frappe.get_doc("VaultDesk Permission", grant_name)
    item = frappe.get_doc("VaultDesk Item", grant.vaultdesk_item)
    security.require(item, "manage_permissions")
    normalized = _normalize_capabilities(capabilities)
    _ensure_delegable(item, normalized)
    _apply_capabilities(grant, normalized)
    grant.expires_on = expires_on
    grant.flags.from_vaultdesk_service = True
    grant.save(ignore_permissions=True)
    _ensure_boundary_manager(item)
    audit.record(item, "Permission Updated", affected_principal=grant.principal_key)
    return serialize_grant(grant)


def remove_grant(grant_name: str) -> None:
    """Remove one explicit grant while preserving ACL-boundary recovery."""
    grant = frappe.get_doc("VaultDesk Permission", grant_name)
    item = frappe.get_doc("VaultDesk Item", grant.vaultdesk_item)
    security.require(item, "manage_permissions")
    principal = grant.principal_key
    grant.flags.from_vaultdesk_service = True
    grant.delete(ignore_permissions=True)
    _ensure_boundary_manager(item)
    audit.record(item, "Permission Removed", affected_principal=principal)


def get_explicit_grants(item_name: str) -> list[dict[str, Any]]:
    """Return explicit ACL rows only to users who can administer sharing."""
    item = frappe.get_doc("VaultDesk Item", item_name)
    security.require(item, "manage_permissions")
    grants = frappe.get_all(
        "VaultDesk Permission",
        filters={"vaultdesk_item": item.name},
        fields=["name"],
        order_by="principal_key asc",
    )
    return [serialize_grant(frappe.get_doc("VaultDesk Permission", row.name)) for row in grants]


def get_permission_overview(item_name: str) -> dict[str, Any]:
    """Return ownership plus direct and inherited ACL rows for permission managers."""
    item = frappe.get_doc("VaultDesk Item", item_name)
    security.require(item, "manage_permissions")
    direct_grants = _grants_for_item(item, scope="direct", editable=True)
    inherited_grants: list[dict[str, Any]] = []
    inherited_sources: list[dict[str, Any]] = []
    if item.parent_vaultdesk_item and not cint(item.break_inheritance):
        for ancestor in _inherited_ancestors(item):
            inherited_sources.append(
                {
                    "name": ancestor.name,
                    "display_name": ancestor.display_name,
                    "is_boundary": bool(cint(ancestor.break_inheritance)),
                }
            )
            inherited_grants.extend(_grants_for_item(ancestor, scope="inherited", editable=False))
            if cint(ancestor.break_inheritance):
                break
    return {
        "item": {
            "name": item.name,
            "display_name": item.display_name,
            "type": "folder" if item.is_group else "file",
            "business_owner": item.business_owner,
            "break_inheritance": bool(cint(item.break_inheritance)),
        },
        "can_manage_permissions": True,
        "direct_grants": direct_grants,
        "inherited_grants": inherited_grants,
        "inherited_sources": inherited_sources,
    }


def search_principals(
    item_name: str,
    query: str,
    principal_type: str,
    page_length: int = 10,
) -> list[dict[str, str]]:
    """Search shareable enabled users or ERP roles for an authorized manager."""
    item = frappe.get_doc("VaultDesk Item", item_name)
    security.require(item, "manage_permissions")
    query = (query or "").strip()
    if len(query) < 2:
        return []
    page_length = min(max(cint(page_length), 1), 20)
    like_query = f"%{query}%"
    if principal_type == "User":
        rows = frappe.db.sql(
            """
            SELECT name AS value, COALESCE(NULLIF(full_name, ''), name) AS label
            FROM `tabUser`
            WHERE enabled = 1
                AND name != 'Guest'
                AND (name LIKE %(query)s OR full_name LIKE %(query)s)
            ORDER BY
                CASE WHEN name LIKE %(starts)s THEN 0 ELSE 1 END,
                full_name, name
            LIMIT %(page_length)s
            """,
            {"query": like_query, "starts": f"{query}%", "page_length": page_length},
            as_dict=True,
        )
    elif principal_type == "Role":
        rows = frappe.db.sql(
            """
            SELECT name AS value, name AS label
            FROM `tabRole`
            WHERE name LIKE %(query)s
            ORDER BY
                CASE WHEN name LIKE %(starts)s THEN 0 ELSE 1 END,
                name
            LIMIT %(page_length)s
            """,
            {"query": like_query, "starts": f"{query}%", "page_length": page_length},
            as_dict=True,
        )
    else:
        frappe.throw(_("Principal Type must be User or Role."))
    return [
        {"value": row.value, "label": row.label, "principal_type": principal_type}
        for row in rows
    ]


def set_inheritance_boundary(item_name: str, enabled: bool) -> dict[str, Any]:
    """Enable or remove custom ACL inheritance on an authorized item."""
    item = frappe.get_doc("VaultDesk Item", item_name)
    security.require(item, "manage_permissions")
    enabled = bool(cint(enabled))
    if not item.parent_vaultdesk_item and not enabled:
        frappe.throw(_("A VaultDesk Space root must remain an inheritance boundary."))
    item.break_inheritance = cint(enabled)
    item.flags.from_vaultdesk_service = True
    item.save(ignore_permissions=True)
    if enabled:
        _ensure_boundary_manager(item)
    audit.record(item, "Inheritance Changed", details={"break_inheritance": enabled})
    return {"item": item.name, "break_inheritance": enabled}


def create_root_owner_grant(item: Any, user: str) -> None:
    """Seed a newly created space with one recoverable full-control principal."""
    grant = frappe.get_doc(
        {
            "doctype": "VaultDesk Permission",
            "vaultdesk_item": item.name,
            "principal_type": "User",
            "user": user,
            **{fieldname: 1 for fieldname in CAPABILITY_FIELDS.values()},
        }
    )
    grant.flags.from_vaultdesk_service = True
    grant.insert(ignore_permissions=True)


def serialize_grant(
    grant: Any,
    *,
    scope: str = "direct",
    editable: bool = True,
    source_item: Any | None = None,
) -> dict[str, Any]:
    return {
        "name": grant.name,
        "principal_type": grant.principal_type,
        "user": grant.user,
        "role": grant.role,
        "capabilities": {
            capability: bool(cint(grant.get(fieldname)))
            for capability, fieldname in CAPABILITY_FIELDS.items()
        },
        "expires_on": grant.expires_on,
        "granted_by": grant.granted_by,
        "granted_on": grant.granted_on,
        "scope": scope,
        "editable": editable,
        "source_item": (
            {"name": source_item.name, "display_name": source_item.display_name}
            if source_item
            else None
        ),
    }


def _upsert_grant(
    item_name: str,
    principal_type: str,
    principal: str,
    capabilities: dict[str, Any],
    expires_on: str | None,
) -> dict[str, Any]:
    item = frappe.get_doc("VaultDesk Item", item_name)
    security.require(item, "manage_permissions")
    normalized = _normalize_capabilities(capabilities)
    _ensure_delegable(item, normalized)
    principal_key = f"{principal_type.lower()}:{principal}"
    name = frappe.db.get_value(
        "VaultDesk Permission",
        {"vaultdesk_item": item.name, "principal_key": principal_key},
    )
    grant = frappe.get_doc("VaultDesk Permission", name) if name else frappe.new_doc("VaultDesk Permission")
    grant.vaultdesk_item = item.name
    grant.principal_type = principal_type
    grant.user = principal if principal_type == "User" else None
    grant.role = principal if principal_type == "Role" else None
    grant.expires_on = expires_on
    _apply_capabilities(grant, normalized)
    grant.flags.from_vaultdesk_service = True
    if grant.is_new():
        grant.insert(ignore_permissions=True)
        action = "Permission Added"
    else:
        grant.save(ignore_permissions=True)
        action = "Permission Updated"
    _ensure_boundary_manager(item)
    audit.record(item, action, affected_principal=principal_key)
    return serialize_grant(grant)


def _normalize_capabilities(capabilities: dict[str, Any]) -> dict[str, bool]:
    if not isinstance(capabilities, dict):
        frappe.throw(_("Capabilities must be a JSON object."))
    unknown = set(capabilities).difference(CAPABILITIES)
    if unknown:
        frappe.throw(_("Unknown capabilities: {0}").format(", ".join(sorted(unknown))))
    normalized = {capability: bool(cint(capabilities.get(capability))) for capability in CAPABILITIES}
    if any(value for capability, value in normalized.items() if capability != "view"):
        normalized["view"] = True
    if not any(normalized.values()):
        frappe.throw(_("At least one capability is required."))
    return normalized


def _ensure_delegable(item: Any, requested: dict[str, bool]) -> None:
    if security.is_vaultdesk_administrator():
        return
    actor_rights = security.effective_permissions(item)
    for capability, enabled in requested.items():
        if enabled and not actor_rights.get(capability):
            frappe.throw(
                _("You cannot grant a capability that you do not have: {0}.").format(capability),
                frappe.PermissionError,
            )


def _apply_capabilities(grant: Any, capabilities: dict[str, bool]) -> None:
    for capability, fieldname in CAPABILITY_FIELDS.items():
        grant.set(fieldname, cint(capabilities.get(capability)))


def _ensure_boundary_manager(item: Any) -> None:
    if not cint(item.break_inheritance):
        return
    rows = frappe.get_all(
        "VaultDesk Permission",
        filters={"vaultdesk_item": item.name, "can_manage_permissions": 1},
        fields=["expires_on"],
    )
    current_time = now_datetime()
    if not any(not row.expires_on or get_datetime(row.expires_on) >= current_time for row in rows):
        frappe.throw(_("An inheritance boundary must retain at least one permission manager."))


def _grants_for_item(item: Any, *, scope: str, editable: bool) -> list[dict[str, Any]]:
    rows = frappe.get_all(
        "VaultDesk Permission",
        filters={"vaultdesk_item": item.name},
        fields=["name"],
        order_by="principal_key asc",
    )
    return [
        serialize_grant(
            frappe.get_doc("VaultDesk Permission", row.name),
            scope=scope,
            editable=editable,
            source_item=item,
        )
        for row in rows
    ]


def _inherited_ancestors(item: Any) -> list[Any]:
    rows = frappe.get_all(
        "VaultDesk Item",
        filters=[
            ["space", "=", item.space],
            ["lft", "<", item.lft],
            ["rgt", ">", item.rgt],
        ],
        fields=["name"],
        order_by="lft desc",
    )
    return [frappe.get_doc("VaultDesk Item", row.name) for row in rows]
