from __future__ import annotations

import frappe
from frappe import _
from frappe.model.document import Document


class VaultDeskActivityLog(Document):
    """Append-only security and usage log."""

    def before_insert(self) -> None:
        if not self.flags.from_vaultdesk_service:
            frappe.throw(
                _("Activity records are written only by the VaultDesk service."),
                frappe.PermissionError,
            )

    def validate(self) -> None:
        if not self.is_new():
            frappe.throw(_("VaultDesk Activity Log records are append-only."), frappe.PermissionError)

    def on_trash(self) -> None:
        frappe.throw(_("VaultDesk Activity Log records cannot be deleted."), frappe.PermissionError)


def on_doctype_update() -> None:
    frappe.db.add_index("VaultDesk Activity Log", ["vaultdesk_item", "action_on"])
    frappe.db.add_index("VaultDesk Activity Log", ["space", "action_on"])
    frappe.db.add_index("VaultDesk Activity Log", ["actor", "action_on"])
    frappe.db.add_index("VaultDesk Activity Log", ["action", "action_on"])
