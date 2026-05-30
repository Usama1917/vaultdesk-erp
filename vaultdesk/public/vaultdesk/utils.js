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

export function formatDate(value, language = "en") {
	if (!value) return "-";
	return new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en", {
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

// Local Lucide icon paths keep the Desk page independent from external CDNs.
const LUCIDE_ICONS = {
	folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />',
	file: '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" /><path d="M14 2v5a1 1 0 0 0 1 1h5" />',
	image: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />',
	pdf: '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" /><path d="M14 2v5a1 1 0 0 0 1 1h5" /><path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" />',
	text: '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" /><path d="M14 2v5a1 1 0 0 0 1 1h5" /><path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" />',
	sheet: '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" /><path d="M14 2v5a1 1 0 0 0 1 1h5" /><path d="M8 13h2" /><path d="M14 13h2" /><path d="M8 17h2" /><path d="M14 17h2" />',
	search: '<path d="m21 21-4.34-4.34" /><circle cx="11" cy="11" r="8" />',
	upload: '<path d="M12 3v12" /><path d="m17 8-5-5-5 5" /><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />',
	plus: '<path d="M5 12h14" /><path d="M12 5v14" />',
	grid: '<rect width="7" height="7" x="3" y="3" rx="1" /><rect width="7" height="7" x="14" y="3" rx="1" /><rect width="7" height="7" x="14" y="14" rx="1" /><rect width="7" height="7" x="3" y="14" rx="1" />',
	list: '<path d="M3 5h.01" /><path d="M3 12h.01" /><path d="M3 19h.01" /><path d="M8 5h13" /><path d="M8 12h13" /><path d="M8 19h13" />',
	columns: '<rect width="18" height="18" x="3" y="3" rx="2" /><path d="M9 3v18" /><path d="M15 3v18" />',
	more: '<circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" />',
	star: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />',
	recent: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l4 2" />',
	trash: '<path d="M10 11v6" /><path d="M14 11v6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />',
	shared: '<path d="M18 21a8 8 0 0 0-16 0" /><circle cx="10" cy="8" r="5" /><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3" />',
	home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" /><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />',
	chevron: '<path d="m9 18 6-6-6-6" />',
	close: '<path d="M18 6 6 18" /><path d="m6 6 12 12" />',
	download: '<path d="M12 15V3" /><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" />',
	edit: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" /><path d="m15 5 4 4" />',
	move: '<path d="M12 2v20" /><path d="m15 19-3 3-3-3" /><path d="m19 9 3 3-3 3" /><path d="M2 12h20" /><path d="m5 9-3 3 3 3" /><path d="m9 5 3-3 3 3" />',
	copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />',
	paste: '<path d="M11 14h10" /><path d="M16 4h2a2 2 0 0 1 2 2v1.344" /><path d="m17 18 4-4-4-4" /><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 1.793-1.113" /><rect x="8" y="2" width="8" height="4" rx="1" />',
	info: '<circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />',
	share: '<circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" x2="15.42" y1="13.51" y2="17.49" /><line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />',
	warning: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" />',
	history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l4 2" />',
	refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" />',
	lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />',
	unlock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" />',
};

export function icon(name, classes = "") {
	const iconName = LUCIDE_ICONS[name] ? name : "file";
	return `<svg class="data-icon lucide-icon lucide-${iconName} ${classes}" viewBox="0 0 24 24" aria-hidden="true">${LUCIDE_ICONS[iconName]}</svg>`;
}

export function isPreviewable(item) {
	return previewKind(item) !== "unsupported";
}
