from __future__ import annotations

from typing import Any

import frappe

from vaultdesk.api.utils import parse_capabilities, require_post
from vaultdesk.services import permissions, security


@frappe.whitelist()
def add_user_permission(
    item: str,
    user: str,
    capabilities: str | dict[str, Any],
    expires_on: str | None = None,
) -> dict[str, Any]:
    """Add or replace an explicit user grant after share-authority validation."""
    require_post()
    return permissions.add_user_grant(item, user, parse_capabilities(capabilities), expires_on)


@frappe.whitelist()
def add_role_permission(
    item: str,
    role: str,
    capabilities: str | dict[str, Any],
    expires_on: str | None = None,
) -> dict[str, Any]:
    """Add or replace an explicit role grant after share-authority validation."""
    require_post()
    return permissions.add_role_grant(item, role, parse_capabilities(capabilities), expires_on)


@frappe.whitelist()
def update_permission(
    grant: str,
    capabilities: str | dict[str, Any],
    expires_on: str | None = None,
) -> dict[str, Any]:
    """Replace one grant's capabilities, enforcing delegation restrictions."""
    require_post()
    return permissions.update_grant(grant, parse_capabilities(capabilities), expires_on)


@frappe.whitelist()
def remove_permission(grant: str) -> None:
    """Remove one explicit grant without orphaning an ACL boundary."""
    require_post()
    permissions.remove_grant(grant)


@frappe.whitelist()
def get_permissions(item: str) -> list[dict[str, Any]]:
    """List explicit sharing rows for authorized permission managers only."""
    return permissions.get_explicit_grants(item)


@frappe.whitelist()
def get_permission_overview(item: str) -> dict[str, Any]:
    """Return owner, direct ACL rows and inherited read-only ACL rows."""
    return permissions.get_permission_overview(item)


@frappe.whitelist()
def search_principals(
    item: str,
    query: str,
    principal_type: str,
    page_length: int = 10,
) -> list[dict[str, str]]:
    """Find enabled ERP users or roles to grant on an authorized VaultDesk item."""
    return permissions.search_principals(item, query, principal_type, page_length)


@frappe.whitelist()
def set_permission_inheritance(item: str, break_inheritance: bool) -> dict[str, Any]:
    """Set a custom ACL boundary after ensuring an explicit manager remains."""
    require_post()
    return permissions.set_inheritance_boundary(item, break_inheritance)


@frappe.whitelist()
def get_effective_permissions(item: str) -> dict[str, bool]:
    """Return the current caller's computed inherited capability set."""
    return security.public_effective_permissions(item)


@frappe.whitelist()
def check_access(item: str, capability: str) -> bool:
    """Check one current-user action; server endpoints never rely on this hint."""
    capability = {"share": "manage_permissions"}.get(capability, capability)
    security.validate_capability(capability)
    return security.public_effective_permissions(item).get(capability, False)
