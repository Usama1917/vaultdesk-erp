from __future__ import annotations

import frappe
from frappe import _
from frappe.model.document import Document


class VaultDeskUserItemState(Document):
    """Private per-user state for favorites and recent files."""

    def validate(self) -> None:
        if not self.flags.from_vaultdesk_service:
            frappe.throw(_("Item state is managed by the VaultDesk service."), frappe.PermissionError)

    def on_trash(self) -> None:
        if not self.flags.from_vaultdesk_service:
            frappe.throw(_("Item state is managed by the VaultDesk service."), frappe.PermissionError)


def on_doctype_update() -> None:
    frappe.db.add_unique("VaultDesk User Item State", ["user", "vaultdesk_item"])
    frappe.db.add_index("VaultDesk User Item State", ["user", "is_starred", "modified"])
    frappe.db.add_index("VaultDesk User Item State", ["user", "last_opened_on"])
