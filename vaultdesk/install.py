from __future__ import annotations

import frappe

VAULTDESK_ROLES = ("VaultDesk User", "VaultDesk Manager", "VaultDesk Administrator")


def after_install() -> None:
    """Create application roles required by the isolated VaultDesk module."""
    for role_name in VAULTDESK_ROLES:
        if not frappe.db.exists("Role", role_name):
            frappe.get_doc({"doctype": "Role", "role_name": role_name}).insert(ignore_permissions=True)
