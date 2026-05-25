import {
	attribute,
	escapeHtml,
	formatBytes,
	formatDate,
	icon,
} from "../utils.js";
import { renderModal } from "./content.js";

export function renderVersionDialog(item, versions, permissions, i18n) {
	const t = i18n.t;
	const content = `
		<div class="version-policy">
			${icon("lock")}
			<p>
				<strong>${t("versions.policy_title")}</strong>
				${t("versions.policy_text")}
			</p>
		</div>
		<div class="version-list">
			${versions.map((version, index) => renderVersionRow(item, version, permissions, i18n, index)).join("")}
		</div>
	`;
	const uploadButton = permissions.canEdit
		? `<button class="data-btn data-btn-primary" data-action="choose-version-upload"
				data-id="${attribute(item.name)}" ${permissions.uploading ? "disabled" : ""}>${icon("upload")} ${t("action.upload_new_version")}</button>`
		: "";
	const uploadStatus = permissions.uploading ? `
		<div class="version-upload-status" role="status" aria-live="polite">
			<span class="data-spinner" aria-hidden="true"></span>
			<span>${t("versions.uploading")}</span>
			<i aria-hidden="true"></i>
		</div>` : "";
	return renderModal(
		t("versions.title", { name: item.display_name }),
		content,
		`${uploadStatus}<button class="data-btn data-btn-secondary" data-action="close-modal">${t("action.done")}</button>${uploadButton}`,
		"data-version-modal",
		i18n
	);
}

export function renderVersionRestoreDialog(item, version, i18n) {
	const t = i18n.t;
	return renderModal(
		t("versions.restore_title"),
		`<div class="data-confirm is-restore">
			${icon("history")}
			<p>${t("versions.restore_text", {
		number: version.version_number,
		name: `<strong>${escapeHtml(item.display_name)}</strong>`,
	})}</p>
		</div>`,
		`<button class="data-btn data-btn-secondary" data-action="back-versions">${t("action.cancel")}</button>
		 <button class="data-btn data-btn-primary" data-action="confirm-restore-version"
			data-version="${attribute(version.name)}">${t("action.restore")}</button>`,
		"",
		i18n
	);
}

export function renderVersionDeleteDialog(item, version, i18n) {
	const t = i18n.t;
	return renderModal(
		t("versions.delete_title"),
		`<div class="data-confirm">
			${icon("trash")}
			<p>
				${t("versions.delete_text", {
		number: version.version_number,
		name: `<strong>${escapeHtml(item.display_name)}</strong>`,
	})}
			</p>
		</div>`,
		`<button class="data-btn data-btn-secondary" data-action="back-versions">${t("action.cancel")}</button>
		 <button class="data-btn data-btn-danger" data-action="confirm-delete-version"
			data-version="${attribute(version.name)}">${t("action.delete_version")}</button>`,
		"",
		i18n
	);
}

function renderVersionRow(item, version, permissions, i18n, index) {
	const t = i18n.t;
	const canRestore = permissions.canEdit && !version.is_current;
	const canDelete = permissions.canDelete && !version.is_current && !version.is_protected;
	const protectLabel = version.is_protected ? t("action.unlock") : t("action.protect");
	return `
		<article class="version-row ${version.is_current ? "is-current" : ""} ${version.name === permissions.highlightVersion ? "is-highlighted" : ""}"
			style="--item-index: ${index}">
			<div class="version-summary">
				<div class="version-title">
					<strong>${t("versions.version", { number: version.version_number })}</strong>
					${version.is_current ? `<span class="version-badge is-current">${t("versions.current")}</span>` : ""}
					${version.is_protected ? `<span class="version-badge is-protected">${icon("lock")} ${t("versions.protected")}</span>` : ""}
				</div>
				<p>${escapeHtml(version.uploaded_by)} | ${formatDate(version.uploaded_at, i18n.language)} | ${formatBytes(version.file_size)}</p>
				${version.note ? `<small>${escapeHtml(version.note)}</small>` : ""}
			</div>
			<div class="version-actions">
					${canRestore ? `<button class="data-btn data-btn-secondary" data-action="restore-version"
					data-id="${attribute(item.name)}" data-version="${attribute(version.name)}">${t("action.restore")}</button>` : ""}
				${permissions.canProtect ? `<button class="data-btn data-btn-secondary" data-action="toggle-version-protection"
					data-id="${attribute(item.name)}" data-version="${attribute(version.name)}"
					data-protected="${version.is_protected ? "0" : "1"}">${icon(version.is_protected ? "unlock" : "lock")} ${protectLabel}</button>` : ""}
				${canDelete ? `<button class="data-btn data-btn-danger" data-action="delete-version"
					data-id="${attribute(item.name)}" data-version="${attribute(version.name)}">${t("action.delete")}</button>` : ""}
			</div>
		</article>
	`;
}
