from __future__ import annotations

from typing import Any

import frappe
from frappe import _


def require_post() -> None:
    """Prevent state-changing whitelisted calls from being invoked through GET."""
    request = getattr(frappe.local, "request", None)
    if request and request.method != "POST":
        frappe.throw(_("This VaultDesk operation requires an HTTP POST request."), frappe.PermissionError)


def reject_cross_site_request() -> None:
    """Refuse obvious cross-site invocations of side-effecting GET endpoints (VD-CSRF-001).

    GET is not CSRF-validated by Frappe, so a cross-origin ``<img>``/navigation could otherwise
    drive audit-log and recent-state writes with the victim's session. When the browser declares
    the request cross-site via ``Sec-Fetch-Site`` we refuse it; when the header is absent (older
    clients) we fall through, so legitimate same-origin use is never broken.
    """
    request = getattr(frappe.local, "request", None)
    if request is None:
        return
    if request.headers.get("Sec-Fetch-Site") == "cross-site":
        frappe.throw(
            _("This VaultDesk request must originate from the application."),
            frappe.PermissionError,
        )


def parse_capabilities(capabilities: str | dict[str, Any] | None) -> dict[str, Any]:
    """Accept a JSON RPC payload while retaining one normalized service input."""
    parsed = frappe.parse_json(capabilities) if isinstance(capabilities, str) else capabilities
    if not isinstance(parsed, dict):
        frappe.throw(_("Capabilities must be supplied as a JSON object."))
    return parsed
