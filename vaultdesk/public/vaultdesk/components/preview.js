import {
	attribute,
	escapeHtml,
	formatBytes,
	formatDate,
	icon,
	itemIcon,
} from "../utils.js";

export function renderPreviewDialog(state, i18n) {
	const t = i18n.t;
	const item = state.item;
	return `
		<div class="data-modal-backdrop" data-action="close-modal">
			<section class="data-modal data-preview-modal" role="dialog" aria-modal="true"
				aria-label="${attribute(t("preview.label", { name: item.display_name }))}">
				<header class="preview-header">
					<div class="preview-title">
						<div class="data-file-icon is-${itemIcon(item)}">${icon(itemIcon(item))}</div>
						<div>
							<h2>${escapeHtml(item.display_name)}</h2>
							<small>${escapeHtml(displayFileType(item, i18n))}</small>
						</div>
					</div>
					<div class="preview-actions">
						<button class="data-btn data-btn-secondary" data-action="preview-details"
							aria-pressed="${state.showDetails ? "true" : "false"}">${icon("info")} ${t("action.details")}</button>
						${state.canDownload ? `
							<button class="data-btn data-btn-secondary" data-action="preview-download">
								${icon("download")} ${t("action.download")}
							</button>` : ""}
						<button class="data-icon-btn" data-action="close-modal" aria-label="${t("preview.close")}">${icon("close")}</button>
					</div>
				</header>
				<div class="preview-layout ${state.showDetails ? "has-details" : ""}">
					<button class="preview-navigate is-previous" data-action="preview-previous"
						${state.previous ? "" : "disabled"} aria-label="${t("preview.previous")}">${icon("chevron")}</button>
					<main class="data-preview" aria-live="polite">${renderPreviewStage(state, i18n)}</main>
					<button class="preview-navigate is-next" data-action="preview-next"
						${state.next ? "" : "disabled"} aria-label="${t("preview.next")}">${icon("chevron")}</button>
					${state.showDetails ? renderPreviewDetails(item, state, i18n) : ""}
				</div>
			</section>
		</div>
	`;
}

function renderPreviewStage(state, i18n) {
	const t = i18n.t;
	const item = state.item;
	if (state.status === "loading") {
		return `
			<div class="preview-state">
				<span class="data-spinner" aria-hidden="true"></span>
				<p>${t("preview.loading")}</p>
			</div>`;
	}
	if (state.status === "denied") {
		return `
			<div class="preview-state is-error">
				${icon("warning")}
				<h3>${t("preview.denied_title")}</h3>
				<p>${escapeHtml(state.error || t("preview.denied_text"))}</p>
			</div>`;
	}
	if (state.status === "error") {
		return `
			<div class="preview-state is-error">
				${icon("warning")}
				<h3>${t("preview.error_title")}</h3>
				<p>${escapeHtml(state.error || t("preview.error_text"))}</p>
				<button class="data-btn data-btn-secondary" data-action="preview-retry">${t("action.try_again")}</button>
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
				${state.textTruncated ? `<p class="preview-truncated">${t("preview.truncated")}</p>` : ""}
			</div>`;
	}
	return `
		<div class="data-preview-fallback">
			<div class="data-file-icon is-${itemIcon(item)}">${icon(itemIcon(item))}</div>
			<h3>${escapeHtml(item.display_name)}</h3>
			<p>${escapeHtml(displayFileType(item, i18n))} | ${formatBytes(item.file_size)}</p>
			<p>${t("preview.unavailable")}</p>
			${state.canDownload ? `
				<button class="data-btn data-btn-primary" data-action="preview-download">
					${icon("download")} ${t("action.download_file")}
				</button>` : ""}
		</div>`;
}

function renderPreviewDetails(item, state, i18n) {
	const t = i18n.t;
	return `
		<aside class="preview-details" aria-label="${t("preview.file_details")}">
			<h3>${t("action.details")}</h3>
			<dl>
				<div><dt>${t("table.type")}</dt><dd>${escapeHtml(displayFileType(item, i18n))}</dd></div>
				<div><dt>${t("details.size")}</dt><dd>${formatBytes(item.file_size)}</dd></div>
				<div><dt>${t("details.owner")}</dt><dd>${escapeHtml(item.business_owner || "-")}</dd></div>
				<div><dt>${t("details.modified")}</dt><dd>${formatDate(item.modified, i18n.language)}</dd></div>
				<div><dt>${t("preview.kind")}</dt><dd>${escapeHtml(displayPreviewKind(state.kind, i18n))}</dd></div>
			</dl>
		</aside>`;
}

function displayFileType(item, i18n) {
	return item.mime_type || (item.file_extension
		? i18n.t("item.file_suffix", { extension: item.file_extension.toUpperCase() })
		: i18n.t("item.file"));
}

function displayPreviewKind(kind, i18n) {
	if (kind === "unsupported") return i18n.t("preview.not_supported");
	return i18n.t(`preview.kind_${kind}`);
}
