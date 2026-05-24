from __future__ import annotations

CAPABILITIES = (
    "view",
    "download",
    "upload",
    "edit",
    "move",
    "delete",
    "manage_permissions",
)

CAPABILITY_FIELDS = {capability: f"can_{capability}" for capability in CAPABILITIES}

ADMIN_ROLES = {"System Manager", "VaultDesk Administrator"}

ITEM_TYPE_FOLDER = "folder"
ITEM_TYPE_FILE = "file"

DEFAULT_PAGE_LENGTH = 50
MAX_PAGE_LENGTH = 200
MAX_SEARCH_SCAN = 1000

IMAGE_PREVIEW_EXTENSIONS = {"gif", "jpeg", "jpg", "png", "webp"}
IMAGE_PREVIEW_MIME_TYPES = {
    "image/gif",
    "image/jpeg",
    "image/png",
    "image/webp",
}

TEXT_PREVIEW_EXTENSIONS = {"css", "csv", "html", "js", "json", "py", "txt"}
TEXT_PREVIEW_MIME_TYPES = {
    "application/javascript",
    "application/json",
    "text/css",
    "text/csv",
    "text/html",
    "text/javascript",
    "text/plain",
    "text/x-python",
}

SAFE_PREVIEW_MIME_TYPES = {
    "application/pdf",
    *IMAGE_PREVIEW_MIME_TYPES,
    *TEXT_PREVIEW_MIME_TYPES,
}

MAX_TEXT_PREVIEW_BYTES = 1024 * 1024
