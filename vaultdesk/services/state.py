from __future__ import annotations

from typing import Any

import frappe
from frappe.utils import cint, now_datetime

from vaultdesk.services import security


def touch(item: Any, event: str = "opened", user: str | None = None) -> None:
    """Update private recent-item state after a permitted content interaction."""
    user = user or frappe.session.user
    if not user or user == "Guest":
        return

    item = frappe.get_doc("VaultDesk Item", item) if isinstance(item, str) else item
    state_name = frappe.db.get_value("VaultDesk User Item State", {"user": user, "vaultdesk_item": item.name})
    if state_name:
        state = frappe.get_doc("VaultDesk User Item State", state_name)
    else:
        state = frappe.get_doc({"doctype": "VaultDesk User Item State", "user": user, "vaultdesk_item": item.name})

    timestamp_field = {
        "opened": "last_opened_on",
        "previewed": "last_previewed_on",
        "downloaded": "last_downloaded_on",
    }.get(event, "last_opened_on")
    state.set(timestamp_field, now_datetime())
    if event == "opened":
        state.open_count = cint(state.open_count) + 1

    state.flags.from_vaultdesk_service = True
    if state.is_new():
        state.insert(ignore_permissions=True)
    else:
        state.save(ignore_permissions=True)


def set_starred(item: Any, starred: bool, user: str | None = None) -> None:
    """Persist a user's favorite flag only after checking current visibility."""
    user = user or frappe.session.user
    item = frappe.get_doc("VaultDesk Item", item) if isinstance(item, str) else item
    security.require(item, "view", user)

    state_name = frappe.db.get_value("VaultDesk User Item State", {"user": user, "vaultdesk_item": item.name})
    state = (
        frappe.get_doc("VaultDesk User Item State", state_name)
        if state_name
        else frappe.get_doc({"doctype": "VaultDesk User Item State", "user": user, "vaultdesk_item": item.name})
    )
    state.is_starred = cint(starred)
    state.flags.from_vaultdesk_service = True
    if state.is_new():
        state.insert(ignore_permissions=True)
    else:
        state.save(ignore_permissions=True)
