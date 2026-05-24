from __future__ import annotations

import json
from typing import Any

import frappe
from frappe.utils import now_datetime


def record(
    item: Any,
    action: str,
    *,
    source_parent: str | None = None,
    target_parent: str | None = None,
    affected_principal: str | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    """Write an append-only event without storing binary paths or file contents."""
    if isinstance(item, str):
        item = frappe.get_doc("VaultDesk Item", item)

    activity = frappe.get_doc(
        {
            "doctype": "VaultDesk Activity Log",
            "vaultdesk_item": item.name,
            "space": item.space,
            "action": action,
            "actor": frappe.session.user,
            "action_on": now_datetime(),
            "source_parent": source_parent,
            "target_parent": target_parent,
            "affected_principal": affected_principal,
            "details_json": json.dumps(details or {}, sort_keys=True),
        }
    )
    activity.flags.from_vaultdesk_service = True
    activity.insert(ignore_permissions=True)
