import {
	attribute,
	escapeHtml,
	formatBytes,
	formatDate,
	hasCapability,
	icon,
	itemIcon,
} from "../utils.js";

export function renderBreadcrumbs(items, label) {
	if (!items.length) {
		return `<span class="data-section-title">${escapeHtml(label)}</span>`;
	}
	return items.map((item, index) => `
		${index ? icon("chevron") : ""}
		<button data-action="open-folder" data-id="${attribute(item.name)}"
			data-context-item="${attribute(item.name)}">${escapeHtml(item.display_name)}</button>
	`).join("");
}

export function renderLoading(view, i18n, motionClass = "") {
	const cells = Array.from({ length: view === "grid" ? 8 : 5 }, () => `
		<div class="data-skeleton ${view === "grid" ? "is-card" : "is-row"}"></div>
	`).join("");
	return `<div class="data-${view} data-content-motion ${attribute(motionClass)}"
		aria-label="${attribute(i18n.t("loading.items"))}">${cells}</div>`;
}

export function renderError(message, i18n, motionClass = "") {
	const t = i18n.t;
	return `
		<div class="data-state data-content-motion ${attribute(motionClass)}">
			${icon("warning", "data-state-icon")}
			<h3>${t("error.title")}</h3>
			<p>${escapeHtml(message)}</p>
			<button class="data-btn data-btn-secondary" data-action="retry">${t("action.try_again")}</button>
		</div>
	`;
}

export function renderEmpty(section, canUpload, i18n, motionClass = "") {
	const t = i18n.t;
	const key = ["my", "shared", "recent", "starred", "trash", "search"].includes(section) ? section : "my";
	return `
		<div class="data-state data-content-motion ${attribute(motionClass)}">
			${icon(section === "trash" ? "trash" : "folder", "data-state-icon")}
			<h3>${t(`empty.${key}.title`)}</h3>
			<p>${t(`empty.${key}.text`)}</p>
			${section === "my" && canUpload ? `
				<button class="data-btn data-btn-primary" data-action="choose-upload">${icon("upload")} ${t("action.upload_file")}</button>
			` : ""}
		</div>
	`;
}

export function renderItems(items, state, i18n, motionClass = "") {
	if (!items.length) return renderEmpty(state.section, state.canUpload, i18n, motionClass);
	return state.view === "grid"
		? renderGrid(items, state, i18n, motionClass)
		: renderList(items, state, i18n, motionClass);
}

function renderGrid(items, state, i18n, motionClass) {
	return `
		<div class="data-grid data-content-motion ${attribute(motionClass)}">
			${items.map((item, index) => `
				<article class="data-card ${state.selected === item.name ? "is-selected" : ""}"
					data-action="select" data-id="${attribute(item.name)}"
					data-context-item="${attribute(item.name)}" tabindex="0" style="--item-index: ${index}">
					<div class="data-card-header">
						<div class="data-file-icon is-${itemIcon(item)}">${icon(itemIcon(item))}</div>
						${item.is_starred ? icon("star", "is-starred") : ""}
						${renderActionButton(item, i18n)}
					</div>
					<button class="data-card-name" data-action="${item.type === "folder" ? "open-folder" : "preview"}"
						data-id="${attribute(item.name)}">
						${escapeHtml(item.display_name)}
					</button>
					<div class="data-card-meta">
						<span>${formatDate(item.modified, i18n.language)}</span>
						<span>${escapeHtml(item.business_owner || "-")}</span>
					</div>
					${renderMenu(item, state, i18n)}
				</article>
			`).join("")}
		</div>
	`;
}

function renderList(items, state, i18n, motionClass) {
	const t = i18n.t;
	return `
		<div class="data-table-wrap data-content-motion ${attribute(motionClass)}">
			<table class="data-table">
				<thead>
					<tr><th>${t("table.name")}</th><th>${t("table.type")}</th><th>${t("table.owner")}</th><th>${t("table.modified")}</th><th>${t("table.size")}</th><th aria-label="${t("table.actions")}"></th></tr>
				</thead>
				<tbody>
					${items.map((item, index) => `
						<tr class="${state.selected === item.name ? "is-selected" : ""}" data-action="select"
							data-id="${attribute(item.name)}" data-context-item="${attribute(item.name)}"
							style="--item-index: ${index}">
							<td>
								<button class="data-table-name" data-action="${item.type === "folder" ? "open-folder" : "preview"}"
									data-id="${attribute(item.name)}">
									<span class="data-file-icon is-${itemIcon(item)}">${icon(itemIcon(item))}</span>
									<span class="data-item-label">${escapeHtml(item.display_name)}</span>
								</button>
							</td>
							<td>${escapeHtml(item.type === "folder" ? t("item.folder") : item.file_extension?.toUpperCase() || t("item.file"))}</td>
							<td>${escapeHtml(item.business_owner || "-")}</td>
							<td>${formatDate(item.modified, i18n.language)}</td>
							<td>${item.type === "folder" ? "-" : formatBytes(item.file_size)}</td>
							<td class="data-row-actions">${item.is_starred ? icon("star", "is-starred") : ""}${renderActionButton(item, i18n)}${renderMenu(item, state, i18n)}</td>
						</tr>
					`).join("")}
				</tbody>
			</table>
		</div>
	`;
}

function renderActionButton(item, i18n) {
	return `
		<button class="data-icon-btn data-more" data-action="toggle-menu" data-id="${attribute(item.name)}"
			aria-label="${attribute(i18n.t("permissions.access_for", { name: item.display_name }))}">
			${icon("more")}
		</button>
	`;
}

function renderMenu(item, state, i18n) {
	const t = i18n.t;
	const action = (name, label, symbol) => `
		<button data-action="${name}" data-id="${attribute(item.name)}">${icon(symbol)} ${label}</button>
	`;
	const entries = [];
	if (state.section === "trash") {
		if (hasCapability(item, "delete")) entries.push(action("restore", t("action.restore"), "recent"));
	} else {
		if (item.type === "folder") entries.push(action("open-folder", t("action.open"), "folder"));
		if (item.type === "file" && hasCapability(item, "view")) {
			entries.push(action("preview", t("action.preview"), "info"));
		}
		if (item.type === "file" && hasCapability(item, "download")) {
			entries.push(action("download", t("action.download"), "download"));
		}
		entries.push(action("star", item.is_starred ? t("action.unstar") : t("action.star"), "star"));
		if (hasCapability(item, "edit")) entries.push(action("rename", t("action.rename"), "edit"));
		if (hasCapability(item, "move")) entries.push(action("move", t("action.move"), "move"));
		if (state.supportsVersions && item.type === "file" && hasCapability(item, "view")) {
			entries.push(action("versions", t("action.manage_versions"), "history"));
		}
		if (state.supportsVersions && item.type === "file" && hasCapability(item, "edit")) {
			entries.push(action("choose-version-upload", t("action.upload_new_version"), "upload"));
		}
		if (hasCapability(item, "manage_permissions")) entries.push(action("share", t("action.manage_access"), "share"));
		if (hasCapability(item, "delete")) entries.push(action("trash", t("action.move_to_trash"), "trash"));
	}
	entries.push(action("details", t("action.details"), "info"));
	return `<div class="data-menu" data-menu="${attribute(item.name)}" hidden>${entries.join("")}</div>`;
}

export function renderTree(root, childrenByParent, currentFolder, i18n) {
	if (!root) return renderLoading("list", i18n);
	const node = (item, depth = 0) => {
		const children = childrenByParent[item.name] || [];
		return `
			<div class="data-tree-node" style="--depth: ${depth}">
				<button data-action="open-folder" data-id="${attribute(item.name)}"
					data-context-item="${attribute(item.name)}"
					class="${currentFolder === item.name ? "is-current" : ""}">
					${icon("folder")}<span>${escapeHtml(item.display_name)}</span>
				</button>
				${children.map((child) => node(child, depth + 1)).join("")}
			</div>
		`;
	};
	return node(root);
}

export function renderDetails(item, options = {}) {
	const i18n = options.i18n;
	const t = i18n.t;
	if (!item) {
		return `
			<div class="data-details-empty">
				${icon("info")}
				<h3>${t("details.title")}</h3>
				<p>${t("details.empty")}</p>
			</div>
		`;
	}
	const capabilities = Object.entries(item.capabilities || {})
		.filter(([, enabled]) => enabled)
		.map(([name]) => `<span>${escapeHtml(t(`capability.${name}`))}</span>`)
		.join("");
	return `
		<div class="data-details-header">
			<div class="data-file-icon is-${itemIcon(item)}">${icon(itemIcon(item))}</div>
			<div><h2>${escapeHtml(item.display_name)}</h2><p>${item.type === "folder" ? t("item.folder") : escapeHtml(item.mime_type || t("item.file"))}</p></div>
			<button class="data-icon-btn" data-action="close-details" aria-label="${t("action.close")}">${icon("close")}</button>
		</div>
		<dl class="data-metadata">
			<div><dt>${t("details.owner")}</dt><dd>${escapeHtml(item.business_owner || "-")}</dd></div>
			<div><dt>${t("details.modified")}</dt><dd>${formatDate(item.modified, i18n.language)}</dd></div>
			<div><dt>${t("details.size")}</dt><dd>${item.type === "folder" ? "-" : formatBytes(item.file_size)}</dd></div>
			<div><dt>${t("details.created_by")}</dt><dd>${escapeHtml(item.created_by || "-")}</dd></div>
			${item.type === "file" && item.version_count ? `<div><dt>${t("details.versions")}</dt><dd>${item.version_count}</dd></div>` : ""}
		</dl>
		<div class="data-capabilities"><h3>${t("details.access")}</h3><div>${capabilities || `<span>${t("details.view_only")}</span>`}</div></div>
		<div class="data-detail-actions">
			${item.type === "file" && hasCapability(item, "view") ? `<button class="data-btn data-btn-primary" data-action="preview" data-id="${attribute(item.name)}">${t("action.preview")}</button>` : ""}
			${options.supportsVersions && item.type === "file" && hasCapability(item, "view") ? `<button class="data-btn data-btn-secondary" data-action="versions" data-id="${attribute(item.name)}">${t("action.manage_versions")}</button>` : ""}
			${hasCapability(item, "manage_permissions") ? `<button class="data-btn data-btn-secondary" data-action="share" data-id="${attribute(item.name)}">${t("action.manage_access")}</button>` : ""}
		</div>
	`;
}

export function renderModal(title, content, footer = "", extraClass = "", i18n) {
	return `
		<div class="data-modal-backdrop" data-action="close-modal">
			<section class="data-modal ${attribute(extraClass)}" role="dialog" aria-modal="true" aria-label="${attribute(title)}">
				<header><h2>${escapeHtml(title)}</h2><button class="data-icon-btn" data-action="close-modal" aria-label="${attribute(i18n.t("action.close"))}">${icon("close")}</button></header>
				<div class="data-modal-body">${content}</div>
				${footer ? `<footer>${footer}</footer>` : ""}
			</section>
		</div>
	`;
}

export function renderFormDialog(title, fieldLabel, initialValue, submitAction, submitLabel, i18n) {
	return renderModal(
		title,
		`<label class="data-field"><span>${escapeHtml(fieldLabel)}</span><input data-role="dialog-value" value="${attribute(initialValue || "")}" autocomplete="off"></label>`,
		`<button class="data-btn data-btn-secondary" data-action="close-modal">${i18n.t("action.cancel")}</button>
		 <button class="data-btn data-btn-primary" data-action="${submitAction}">${escapeHtml(submitLabel)}</button>`
		, "", i18n
	);
}

export function renderMoveDialog(item, folders, i18n) {
	const t = i18n.t;
	return renderModal(
		t("dialog.move", { name: item.display_name }),
		`<label class="data-field"><span>${t("dialog.destination")}</span>
			<select data-role="destination">
				${folders.filter((folder) => folder.name !== item.name).map((folder) => `
					<option value="${attribute(folder.name)}">${escapeHtml(folder.display_name)}</option>
				`).join("")}
			</select>
		</label>`,
		`<button class="data-btn data-btn-secondary" data-action="close-modal">${t("action.cancel")}</button>
		 <button class="data-btn data-btn-primary" data-action="confirm-move" data-id="${attribute(item.name)}">${t("action.move")}</button>`,
		"",
		i18n
	);
}

export function renderDeleteDialog(item, i18n) {
	const t = i18n.t;
	return renderModal(
		t("dialog.trash_title"),
		`<div class="data-confirm">${icon("trash")}<p>${t("dialog.trash_text", { name: `<strong>${escapeHtml(item.display_name)}</strong>` })}</p></div>`,
		`<button class="data-btn data-btn-secondary" data-action="close-modal">${t("action.cancel")}</button>
		 <button class="data-btn data-btn-danger" data-action="confirm-trash" data-id="${attribute(item.name)}">${t("action.move_to_trash")}</button>`,
		"",
		i18n
	);
}

export function renderContextMenu(entries, i18n) {
	return `
		<div class="data-context-menu" role="menu" aria-label="${attribute(i18n.t("context.label"))}">
			${entries.map((entry) => entry.separator
		? '<div class="data-context-separator" role="separator"></div>'
		: `<button role="menuitem" data-command="${attribute(entry.action)}"
				${entry.disabled ? "disabled" : `data-action="${attribute(entry.action)}"`}
				${entry.id ? `data-id="${attribute(entry.id)}"` : ""}
				${entry.view ? `data-view="${attribute(entry.view)}"` : ""}
				${entry.sort ? `data-sort="${attribute(entry.sort)}"` : ""}>
				${icon(entry.icon)}<span>${escapeHtml(entry.label)}</span>
			</button>`).join("")}
		</div>
	`;
}
