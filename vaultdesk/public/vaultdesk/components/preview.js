import {
	attribute,
	escapeHtml,
	formatBytes,
	formatDate,
	icon,
	itemIcon,
} from "../utils.js";

export function renderPreviewDialog(state) {
	const item = state.item;
	return `
		<div class="data-modal-backdrop" data-action="close-modal">
			<section class="data-modal data-preview-modal" role="dialog" aria-modal="true"
				aria-label="Preview: ${attribute(item.display_name)}">
				<header class="preview-header">
					<div class="preview-title">
						<div class="data-file-icon is-${itemIcon(item)}">${icon(itemIcon(item))}</div>
						<div>
							<h2>${escapeHtml(item.display_name)}</h2>
							<small>${escapeHtml(displayFileType(item))}</small>
						</div>
					</div>
					<div class="preview-actions">
						<button class="data-btn data-btn-secondary" data-action="preview-details"
							aria-pressed="${state.showDetails ? "true" : "false"}">${icon("info")} Details</button>
						${state.canDownload ? `
							<button class="data-btn data-btn-secondary" data-action="preview-download">
								${icon("download")} Download
							</button>` : ""}
						<button class="data-icon-btn" data-action="close-modal" aria-label="Close preview">${icon("close")}</button>
					</div>
				</header>
				<div class="preview-layout ${state.showDetails ? "has-details" : ""}">
					<button class="preview-navigate is-previous" data-action="preview-previous"
						${state.previous ? "" : "disabled"} aria-label="Previous file">${icon("chevron")}</button>
					<main class="data-preview" aria-live="polite">${renderPreviewStage(state)}</main>
					<button class="preview-navigate is-next" data-action="preview-next"
						${state.next ? "" : "disabled"} aria-label="Next file">${icon("chevron")}</button>
					${state.showDetails ? renderPreviewDetails(item, state) : ""}
				</div>
			</section>
		</div>
	`;
}

function renderPreviewStage(state) {
	const item = state.item;
	if (state.status === "loading") {
		return `
			<div class="preview-state">
				<span class="data-spinner" aria-hidden="true"></span>
				<p>Loading preview...</p>
			</div>`;
	}
	if (state.status === "denied") {
		return `
			<div class="preview-state is-error">
				${icon("warning")}
				<h3>Access denied</h3>
				<p>${escapeHtml(state.error || "You no longer have permission to preview this file.")}</p>
			</div>`;
	}
	if (state.status === "error") {
		return `
			<div class="preview-state is-error">
				${icon("warning")}
				<h3>Preview could not be loaded</h3>
				<p>${escapeHtml(state.error || "Try again or download the file.")}</p>
				<button class="data-btn data-btn-secondary" data-action="preview-retry">Try again</button>
			</div>`;
	}
	if (state.kind === "image" && state.url) {
		return `<img class="data-preview-image" src="${attribute(state.url)}" alt="${attribute(item.display_name)}">`;
	}
	if (state.kind === "pdf" && state.url) {
		return `<iframe class="data-preview-frame" title="${attribute(item.display_name)}" src="${attribute(state.url)}"></iframe>`;
	}
	if (state.kind === "text") {
		return `
			<div class="preview-text-wrap">
				<pre class="data-preview-text">${escapeHtml(state.text || "")}</pre>
				${state.textTruncated ? '<p class="preview-truncated">Preview truncated. Download to view the complete file.</p>' : ""}
			</div>`;
	}
	return `
		<div class="data-preview-fallback">
			<div class="data-file-icon is-${itemIcon(item)}">${icon(itemIcon(item))}</div>
			<h3>${escapeHtml(item.display_name)}</h3>
			<p>${escapeHtml(displayFileType(item))} | ${formatBytes(item.file_size)}</p>
			<p>Preview is not available for this file type.</p>
			${state.canDownload ? `
				<button class="data-btn data-btn-primary" data-action="preview-download">
					${icon("download")} Download file
				</button>` : ""}
		</div>`;
}

function renderPreviewDetails(item, state) {
	return `
		<aside class="preview-details" aria-label="File details">
			<h3>Details</h3>
			<dl>
				<div><dt>Type</dt><dd>${escapeHtml(displayFileType(item))}</dd></div>
				<div><dt>Size</dt><dd>${formatBytes(item.file_size)}</dd></div>
				<div><dt>Owner</dt><dd>${escapeHtml(item.business_owner || "-")}</dd></div>
				<div><dt>Modified</dt><dd>${formatDate(item.modified)}</dd></div>
				<div><dt>Preview</dt><dd>${escapeHtml(state.kind === "unsupported" ? "Not supported" : state.kind)}</dd></div>
			</dl>
		</aside>`;
}

function displayFileType(item) {
	return item.mime_type || (item.file_extension ? `${item.file_extension.toUpperCase()} file` : "File");
}
