from __future__ import annotations

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint, now_datetime

CAPABILITY_FIELDS = (
    "can_view",
    "can_download",
    "can_upload",
    "can_edit",
    "can_move",
    "can_delete",
    "can_manage_permissions",
)


class VaultDeskPermission(Document):
    """Explicit capability grant for one user or one role on one VaultDesk Item."""

    def before_insert(self) -> None:
        self._assert_service_write()
        self.granted_by = self.granted_by or frappe.session.user
        self.granted_on = self.granted_on or now_datetime()

    def validate(self) -> None:
        self._assert_service_write()
        self._set_principal_key()
        self._validate_permissions()

    def on_trash(self) -> None:
        self._assert_service_write()

    def _assert_service_write(self) -> None:
        if not self.flags.from_vaultdesk_service:
            frappe.throw(
                _("Access grants may only be changed through secured VaultDesk operations."),
                frappe.PermissionError,
            )

    def _set_principal_key(self) -> None:
        if self.principal_type == "User":
            if not self.user or self.role:
                frappe.throw(_("Select exactly one user for a User permission grant."))
            self.principal_key = f"user:{self.user}"
        elif self.principal_type == "Role":
            if not self.role or self.user:
                frappe.throw(_("Select exactly one role for a Role permission grant."))
            self.principal_key = f"role:{self.role}"
        else:
            frappe.throw(_("Principal Type must be User or Role."))

    def _validate_permissions(self) -> None:
        if not any(cint(self.get(fieldname)) for fieldname in CAPABILITY_FIELDS):
            frappe.throw(_("An access grant must provide at least one capability."))
        implied_view_fields = (
            "can_download",
            "can_upload",
            "can_edit",
            "can_move",
            "can_delete",
            "can_manage_permissions",
        )
        if any(cint(self.get(fieldname)) for fieldname in implied_view_fields):
            self.can_view = 1

        item = frappe.get_doc("VaultDesk Item", self.vaultdesk_item)
        if not item.is_group and cint(self.can_upload):
            frappe.throw(_("Upload permission can only be granted on folders."))


def on_doctype_update() -> None:
    frappe.db.add_unique("VaultDesk Permission", ["vaultdesk_item", "principal_key"])
    frappe.db.add_index("VaultDesk Permission", ["principal_key", "vaultdesk_item"])
    frappe.db.add_index("VaultDesk Permission", ["vaultdesk_item", "principal_type"])
