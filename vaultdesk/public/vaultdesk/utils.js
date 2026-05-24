export function escapeHtml(value) {
	return String(value ?? "")
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

export function attribute(value) {
	return escapeHtml(value);
}

export function formatBytes(bytes) {
	if (bytes === null || bytes === undefined || bytes === "") return "-";
	const value = Number(bytes);
	if (!value) return "0 B";
	const units = ["B", "KB", "MB", "GB"];
	const unit = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
	return `${(value / (1024 ** unit)).toFixed(unit ? 1 : 0)} ${units[unit]}`;
}

export function formatDate(value) {
	if (!value) return "-";
	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(value));
}

export function titleCase(value) {
	return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function debounce(callback, delay = 250) {
	let timer;
	return (...args) => {
		window.clearTimeout(timer);
		timer = window.setTimeout(() => callback(...args), delay);
	};
}

export function hasCapability(item, capability) {
	return Boolean(item && item.capabilities && item.capabilities[capability]);
}

const IMAGE_PREVIEW_EXTENSIONS = new Set(["gif", "jpeg", "jpg", "png", "webp"]);
const IMAGE_PREVIEW_MIMES = new Set(["image/gif", "image/jpeg", "image/png", "image/webp"]);
const TEXT_PREVIEW_EXTENSIONS = new Set(["css", "csv", "html", "js", "json", "py", "txt"]);
const TEXT_PREVIEW_MIMES = new Set([
	"application/javascript",
	"application/json",
	"text/css",
	"text/csv",
	"text/html",
	"text/javascript",
	"text/plain",
	"text/x-python",
]);

export function previewKind(item) {
	if (!item || item.type !== "file") return "unsupported";
	const mime = String(item.mime_type || "").toLowerCase();
	const extension = String(item.file_extension || "").toLowerCase().replace(/^\./, "");
	if (IMAGE_PREVIEW_MIMES.has(mime) && IMAGE_PREVIEW_EXTENSIONS.has(extension)) return "image";
	if (mime === "application/pdf" && extension === "pdf") return "pdf";
	if (TEXT_PREVIEW_MIMES.has(mime) && TEXT_PREVIEW_EXTENSIONS.has(extension)) return "text";
	return "unsupported";
}

export function itemIcon(item) {
	if (!item || item.type === "folder") return "folder";
	const kind = previewKind(item);
	const extension = String(item.file_extension || "").toLowerCase();
	if (kind === "image") return "image";
	if (kind === "pdf") return "pdf";
	if (extension === "csv") return "sheet";
	if (kind === "text") return "text";
	if ((item.mime_type || "").includes("spreadsheet") || ["xls", "xlsx"].includes(extension)) return "sheet";
	return "file";
}

export function icon(name, classes = "") {
	const icons = {
		folder: '<path d="M3.5 6.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
		file: '<path d="M7 3.5h7l4 4v13H7z"/><path d="M14 3.5v5h5"/>',
		image: '<path d="M5 3.5h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2z"/><circle cx="9" cy="9" r="2"/><path d="m4 17 5-5 4 4 3-3 5 5"/>',
		pdf: '<path d="M7 3.5h7l4 4v13H7z"/><path d="M14 3.5v5h5"/><path d="M9 15h6"/>',
		text: '<path d="M7 3.5h7l4 4v13H7z"/><path d="M14 3.5v5h5"/><path d="M9 12h6M9 16h6"/>',
		sheet: '<path d="M7 3.5h7l4 4v13H7z"/><path d="M9 11h6M9 15h6M12 10v7"/>',
		search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
		upload: '<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 20h16"/>',
		plus: '<path d="M12 5v14M5 12h14"/>',
		grid: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>',
		list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
		more: '<circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/>',
		star: '<path d="m12 3.5 2.7 5.5 6 .9-4.35 4.2 1.03 6-5.38-2.83L6.62 20.1l1.03-6L3.3 9.9l6-.9z"/>',
		recent: '<path d="M12 7v5l3 2"/><path d="M4.6 9A8 8 0 1 1 4 12"/><path d="M4 4v5h5"/>',
		trash: '<path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/>',
		shared: '<circle cx="9" cy="9" r="3"/><circle cx="17" cy="10" r="2.5"/><path d="M3.5 20c.5-4 10.5-4 11 0M15 15c3.5.4 4.8 2 5 4"/>',
		home: '<path d="m3 11 9-8 9 8"/><path d="M6 10v10h12V10M10 20v-6h4v6"/>',
		chevron: '<path d="m9 18 6-6-6-6"/>',
		close: '<path d="M6 6l12 12M18 6 6 18"/>',
		download: '<path d="M12 4v12"/><path d="m7 11 5 5 5-5"/><path d="M4 20h16"/>',
		edit: '<path d="m4 20 4.5-1 10-10-3.5-3.5-10 10z"/><path d="m13.5 6.5 3.5 3.5"/>',
		move: '<path d="M12 3v18M3 12h18"/><path d="m8 7 4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4"/>',
		info: '<circle cx="12" cy="12" r="9"/><path d="M12 10v7"/><circle cx="12" cy="7" r="1"/>',
		share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m9 13.5 6 3.5M9 10.5l6-3.5"/>',
		warning: '<path d="M12 3 2.5 20h19z"/><path d="M12 9v5"/><circle cx="12" cy="17" r="1"/>',
	};
	return `<svg class="data-icon ${classes}" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.file}</svg>`;
}

export function isPreviewable(item) {
	return previewKind(item) !== "unsupported";
}
