import {
	attribute,
	escapeHtml,
	formatBytes,
	formatDate,
	hasCapability,
	icon,
	itemIcon,
	titleCase,
} from "../utils.js";

export function renderBreadcrumbs(items, label) {
	if (!items.length) {
		return `<span class="data-section-title">${escapeHtml(label)}</span>`;
	}
	return items.map((item, index) => `
		${index ? icon("chevron") : ""}
		<button data-action="open-folder" data-id="${attribute(item.name)}">${escapeHtml(item.display_name)}</button>
	`).join("");
}

export function renderLoading(view) {
	const cells = Array.from({ length: view === "grid" ? 8 : 5 }, () => `
		<div class="data-skeleton ${view === "grid" ? "is-card" : "is-row"}"></div>
	`).join("");
	return `<div class="data-${view}">${cells}</div>`;
}

export function renderError(message) {
	return `
		<div class="data-state">
			${icon("warning", "data-state-icon")}
			<h3>Something went wrong</h3>
			<p>${escapeHtml(message)}</p>
			<button class="data-btn data-btn-secondary" data-action="retry">Try again</button>
		</div>
	`;
}

export function renderEmpty(section, canUpload) {
	const labels = {
		my: ["This folder is empty", "Upload files or create a folder to get started."],
		shared: ["Nothing shared with you", "Files shared by colleagues will appear here."],
		recent: ["No recent files", "Files you open will appear here."],
		starred: ["No starred items", "Star important folders and files for quick access."],
		trash: ["Trash is empty", "Deleted files and folders will appear here temporarily."],
		search: ["No search results", "Try a different name or file type."],
	};
	const [title, text] = labels[section] || labels.my;
	return `
		<div class="data-state">
			${icon(section === "trash" ? "trash" : "folder", "data-state-icon")}
			<h3>${title}</h3>
			<p>${text}</p>
			${section === "my" && canUpload ? `
				<button class="data-btn data-btn-primary" data-action="choose-upload">${icon("upload")} Upload file</button>
			` : ""}
		</div>
	`;
}

export function renderItems(items, state) {
	if (!items.length) return renderEmpty(state.section, state.canUpload);
	return state.view === "grid" ? renderGrid(items, state) : renderList(items, state);
}

function renderGrid(items, state) {
	return `
		<div class="data-grid">
			${items.map((item) => `
				<article class="data-card ${state.selected === item.name ? "is-selected" : ""}"
					data-action="select" data-id="${attribute(item.name)}" tabindex="0">
					<div class="data-card-header">
						<div class="data-file-icon is-${itemIcon(item)}">${icon(itemIcon(item))}</div>
						${item.is_starred ? icon("star", "is-starred") : ""}
						${renderActionButton(item)}
					</div>
					<button class="data-card-name" data-action="${item.type === "folder" ? "open-folder" : "preview"}"
						data-id="${attribute(item.name)}">
						${escapeHtml(item.display_name)}
					</button>
					<div class="data-card-meta">
						<span>${formatDate(item.modified)}</span>
						<span>${escapeHtml(item.business_owner || "-")}</span>
					</div>
					${renderMenu(item, state.section)}
				</article>
			`).join("")}
		</div>
	`;
}

function renderList(items, state) {
	return `
		<div class="data-table-wrap">
			<table class="data-table">
				<thead>
					<tr><th>Name</th><th>Type</th><th>Owner</th><th>Last modified</th><th>Size</th><th aria-label="Actions"></th></tr>
				</thead>
				<tbody>
					${items.map((item) => `
						<tr class="${state.selected === item.name ? "is-selected" : ""}" data-action="select" data-id="${attribute(item.name)}">
							<td>
								<button class="data-table-name" data-action="${item.type === "folder" ? "open-folder" : "preview"}"
									data-id="${attribute(item.name)}">
									<span class="data-file-icon is-${itemIcon(item)}">${icon(itemIcon(item))}</span>
									${escapeHtml(item.display_name)}
								</button>
							</td>
							<td>${escapeHtml(item.type === "folder" ? "Folder" : item.file_extension?.toUpperCase() || "File")}</td>
							<td>${escapeHtml(item.business_owner || "-")}</td>
							<td>${formatDate(item.modified)}</td>
							<td>${item.type === "folder" ? "-" : formatBytes(item.file_size)}</td>
							<td class="data-row-actions">${item.is_starred ? icon("star", "is-starred") : ""}${renderActionButton(item)}${renderMenu(item, state.section)}</td>
						</tr>
					`).join("")}
				</tbody>
			</table>
		</div>
	`;
}

function renderActionButton(item) {
	return `
		<button class="data-icon-btn data-more" data-action="toggle-menu" data-id="${attribute(item.name)}"
			aria-label="Actions for ${attribute(item.display_name)}">
			${icon("more")}
		</button>
	`;
}

function renderMenu(item, section) {
	const action = (name, label, symbol) => `
		<button data-action="${name}" data-id="${attribute(item.name)}">${icon(symbol)} ${label}</button>
	`;
	const entries = [];
	if (section === "trash") {
		if (hasCapability(item, "delete")) entries.push(action("restore", "Restore", "recent"));
	} else {
		if (item.type === "folder") entries.push(action("open-folder", "Open", "folder"));
		if (item.type === "file" && hasCapability(item, "view")) {
			entries.push(action("preview", "Preview", "info"));
		}
		if (item.type === "file" && hasCapability(item, "download")) {
			entries.push(action("download", "Download", "download"));
		}
		entries.push(action("star", item.is_starred ? "Unstar" : "Star", "star"));
		if (hasCapability(item, "edit")) entries.push(action("rename", "Rename", "edit"));
		if (hasCapability(item, "move")) entries.push(action("move", "Move", "move"));
		if (hasCapability(item, "manage_permissions")) entries.push(action("share", "Manage access", "share"));
		if (hasCapability(item, "delete")) entries.push(action("trash", "Move to trash", "trash"));
	}
	entries.push(action("details", "Details", "info"));
	return `<div class="data-menu" data-menu="${attribute(item.name)}" hidden>${entries.join("")}</div>`;
}

export function renderTree(root, childrenByParent, currentFolder) {
	if (!root) return renderLoading("list");
	const node = (item, depth = 0) => {
		const children = childrenByParent[item.name] || [];
		return `
			<div class="data-tree-node" style="--depth: ${depth}">
				<button data-action="open-folder" data-id="${attribute(item.name)}"
					class="${currentFolder === item.name ? "is-current" : ""}">
					${icon("folder")}<span>${escapeHtml(item.display_name)}</span>
				</button>
				${children.map((child) => node(child, depth + 1)).join("")}
			</div>
		`;
	};
	return node(root);
}

export function renderDetails(item) {
	if (!item) {
		return `
			<div class="data-details-empty">
				${icon("info")}
				<h3>Details</h3>
				<p>Select a file or folder to see information and available actions.</p>
			</div>
		`;
	}
	const capabilities = Object.entries(item.capabilities || {})
		.filter(([, enabled]) => enabled)
		.map(([name]) => `<span>${escapeHtml(titleCase(name))}</span>`)
		.join("");
	return `
		<div class="data-details-header">
			<div class="data-file-icon is-${itemIcon(item)}">${icon(itemIcon(item))}</div>
			<div><h2>${escapeHtml(item.display_name)}</h2><p>${item.type === "folder" ? "Folder" : escapeHtml(item.mime_type || "File")}</p></div>
			<button class="data-icon-btn" data-action="close-details" aria-label="Close details">${icon("close")}</button>
		</div>
		<dl class="data-metadata">
			<div><dt>Owner</dt><dd>${escapeHtml(item.business_owner || "-")}</dd></div>
			<div><dt>Modified</dt><dd>${formatDate(item.modified)}</dd></div>
			<div><dt>Size</dt><dd>${item.type === "folder" ? "-" : formatBytes(item.file_size)}</dd></div>
			<div><dt>Created by</dt><dd>${escapeHtml(item.created_by || "-")}</dd></div>
		</dl>
		<div class="data-capabilities"><h3>Your Access</h3><div>${capabilities || "<span>View only</span>"}</div></div>
		<div class="data-detail-actions">
			${item.type === "file" && hasCapability(item, "view") ? `<button class="data-btn data-btn-primary" data-action="preview" data-id="${attribute(item.name)}">Preview</button>` : ""}
			${hasCapability(item, "manage_permissions") ? `<button class="data-btn data-btn-secondary" data-action="share" data-id="${attribute(item.name)}">Manage access</button>` : ""}
		</div>
	`;
}

export function renderModal(title, content, footer = "", extraClass = "") {
	return `
		<div class="data-modal-backdrop" data-action="close-modal">
			<section class="data-modal ${attribute(extraClass)}" role="dialog" aria-modal="true" aria-label="${attribute(title)}">
				<header><h2>${escapeHtml(title)}</h2><button class="data-icon-btn" data-action="close-modal">${icon("close")}</button></header>
				<div class="data-modal-body">${content}</div>
				${footer ? `<footer>${footer}</footer>` : ""}
			</section>
		</div>
	`;
}

export function renderFormDialog(title, fieldLabel, initialValue, submitAction, submitLabel) {
	return renderModal(
		title,
		`<label class="data-field"><span>${escapeHtml(fieldLabel)}</span><input data-role="dialog-value" value="${attribute(initialValue || "")}" autocomplete="off"></label>`,
		`<button class="data-btn data-btn-secondary" data-action="close-modal">Cancel</button>
		 <button class="data-btn data-btn-primary" data-action="${submitAction}">${escapeHtml(submitLabel)}</button>`
	);
}

export function renderMoveDialog(item, folders) {
	return renderModal(
		`Move ${item.display_name}`,
		`<label class="data-field"><span>Destination folder</span>
			<select data-role="destination">
				${folders.filter((folder) => folder.name !== item.name).map((folder) => `
					<option value="${attribute(folder.name)}">${escapeHtml(folder.display_name)}</option>
				`).join("")}
			</select>
		</label>`,
		`<button class="data-btn data-btn-secondary" data-action="close-modal">Cancel</button>
		 <button class="data-btn data-btn-primary" data-action="confirm-move" data-id="${attribute(item.name)}">Move</button>`
	);
}

export function renderDeleteDialog(item) {
	return renderModal(
		"Move to trash?",
		`<div class="data-confirm">${icon("trash")}<p><strong>${escapeHtml(item.display_name)}</strong> will be moved to Trash and can be restored later.</p></div>`,
		`<button class="data-btn data-btn-secondary" data-action="close-modal">Cancel</button>
		 <button class="data-btn data-btn-danger" data-action="confirm-trash" data-id="${attribute(item.name)}">Move to Trash</button>`
	);
}
