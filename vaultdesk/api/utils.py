from __future__ import annotations

from typing import Any

import frappe
from frappe import _


def require_post() -> None:
    """Prevent state-changing whitelisted calls from being invoked through GET."""
    request = getattr(frappe.local, "request", None)
    if request and request.method != "POST":
        frappe.throw(_("This VaultDesk operation requires an HTTP POST request."), frappe.PermissionError)


def parse_capabilities(capabilities: str | dict[str, Any] | None) -> dict[str, Any]:
    """Accept a JSON RPC payload while retaining one normalized service input."""
    parsed = frappe.parse_json(capabilities) if isinstance(capabilities, str) else capabilities
    if not isinstance(parsed, dict):
        frappe.throw(_("Capabilities must be supplied as a JSON object."))
    return parsed
