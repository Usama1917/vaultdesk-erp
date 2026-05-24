from __future__ import annotations

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils.nestedset import NestedSet


class VaultDeskItem(NestedSet):
    """Logical folder or file; physical binary content remains in native File."""

    nsm_parent_field = "parent_vaultdesk_item"

    def autoname(self) -> None:
        self.name = frappe.generate_hash(length=20)

    def before_insert(self) -> None:
        self._assert_service_write()
        self.created_by_user = self.created_by_user or frappe.session.user

    def validate(self) -> None:
        self._assert_service_write()
        self._validate_shape()
        self._validate_parent()

    def on_trash(self) -> None:
        self._assert_service_write()

    def _assert_service_write(self) -> None:
        if not self.flags.from_vaultdesk_service:
            frappe.throw(
                _("VaultDesk Items may only be changed through secured VaultDesk operations."),
                frappe.PermissionError,
            )

    def _validate_shape(self) -> None:
        if self.is_group:
            if self.native_file:
                frappe.throw(_("A folder cannot reference stored file content."))
        elif not self.native_file:
            frappe.throw(_("A file VaultDesk Item must reference a private stored File."))

    def _validate_parent(self) -> None:
        if not self.parent_vaultdesk_item:
            if not self.flags.creating_space_root:
                frappe.throw(_("Only VaultDesk Space root folders may omit a parent folder."))
            if not self.is_group:
                frappe.throw(_("A VaultDesk Space root must be a folder."))
            self.break_inheritance = 1
            return

        parent: Document = frappe.get_doc("VaultDesk Item", self.parent_vaultdesk_item)
        if not parent.is_group:
            frappe.throw(_("The parent VaultDesk Item must be a folder."))
        if parent.space != self.space:
            frappe.throw(_("Files and folders cannot be placed outside their VaultDesk Space."))
        if parent.trash_root:
            frappe.throw(_("Items cannot be placed inside a trashed folder."))


def on_doctype_update() -> None:
    frappe.db.add_index("VaultDesk Item", ["space", "parent_vaultdesk_item", "trash_root"])
    frappe.db.add_index("VaultDesk Item", ["space", "original_parent_vaultdesk_item", "is_trashed"])
    frappe.db.add_index("VaultDesk Item", ["space", "lft", "rgt"])
    frappe.db.add_index("VaultDesk Item", ["native_file"])
    frappe.db.add_index("VaultDesk Item", ["business_owner", "modified"])
