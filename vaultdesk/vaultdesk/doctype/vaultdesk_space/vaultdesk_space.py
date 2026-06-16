from __future__ import annotations

import frappe
from frappe import _
from frappe.model.document import Document


class VaultDeskSpace(Document):
    """Top-level ACL boundary for a logical VaultDesk library."""

    def validate(self) -> None:
        if self.root_item and self.has_value_changed("root_item") and not self.flags.from_vaultdesk_service:
            frappe.throw(
                _("Root Folder can only be assigned by the VaultDesk service."),
                frappe.PermissionError,
            )

    def after_insert(self) -> None:
        """Create a restricted root folder and grant its business owner control."""
        from vaultdesk.services.items import create_space_root

        create_space_root(self)

    def on_trash(self) -> None:
        frappe.throw(
            _(
                "VaultDesk Spaces cannot be deleted directly; deactivate the space and"
                " retain its audit history."
            ),
            frappe.PermissionError,
        )


def on_doctype_update() -> None:
    frappe.db.add_index("VaultDesk Space", ["space_type", "is_active"])
    frappe.db.add_index("VaultDesk Space", ["owner_user", "is_active"])
