from __future__ import annotations

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint


class VaultDeskSettings(Document):
    """Security and retention settings for the VaultDesk module."""

    def validate(self) -> None:
        if self.storage_user != "Administrator":
            frappe.throw(
                _("Storage User must remain Administrator in this secure backend version.")
            )
        if cint(self.max_upload_size_mb) <= 0:
            frappe.throw(_("Maximum Upload Size must be greater than zero."))
        if cint(self.trash_retention_days) < 0:
            frappe.throw(_("Trash Retention Days cannot be negative."))
        if self.allow_public_sharing:
            frappe.throw(_("Public sharing is intentionally disabled in this backend version."))
