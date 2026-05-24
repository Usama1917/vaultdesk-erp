import { attribute, escapeHtml, icon } from "../utils.js";
import { renderModal } from "./content.js";

export const PERMISSION_LEVELS = [
	{
		value: "view",
		label: "View only",
		description: "View, preview and download.",
	},
	{
		value: "upload",
		label: "Upload",
		description: "View and add files to a folder.",
		folderOnly: true,
	},
	{
		value: "edit",
		label: "Edit",
		description: "View, rename and move.",
	},
	{
		value: "delete",
		label: "Delete",
		description: "Edit and move items to trash.",
	},
	{
		value: "manage",
		label: "Manage permissions",
		description: "Full access including sharing.",
	},
];

export function capabilitiesForLevel(level, isFolder) {
	const capabilities = {
		view: true,
		download: true,
		upload: false,
		edit: false,
		move: false,
		delete: false,
		manage_permissions: false,
	};
	if (level === "upload" && isFolder) capabilities.upload = true;
	if (["edit", "delete", "manage"].includes(level)) {
		capabilities.edit = true;
		capabilities.move = true;
	}
	if (["delete", "manage"].includes(level)) capabilities.delete = true;
	if (level === "manage") {
		capabilities.manage_permissions = true;
		if (isFolder) capabilities.upload = true;
	}
	return capabilities;
}

export function levelForCapabilities(capabilities, isFolder) {
	const matching = PERMISSION_LEVELS
		.filter((level) => !level.folderOnly || isFolder)
		.find((level) => sameCapabilities(capabilitiesForLevel(level.value, isFolder), capabilities));
	return matching ? matching.value : "custom";
}

export function renderPermissionDialog(item, overview, dialogState) {
	const direct = overview.direct_grants || [];
	const inherited = overview.inherited_grants || [];
	const body = `
		<div class="permission-owner">
			<div class="permission-avatar">${escapeHtml(ownerInitials(overview.item.business_owner))}</div>
			<div>
				<p class="permission-caption">Owner</p>
				<strong>${escapeHtml(overview.item.business_owner || "No owner assigned")}</strong>
			</div>
			<span class="permission-access-badge">Owner</span>
		</div>
		${overview.can_manage_permissions ? renderAddAccess(item, dialogState) : ""}
		<section class="permission-section">
			<h3>Direct access <span>${direct.length}</span></h3>
			${direct.length
		? direct.map((grant) => renderGrant(item, grant, dialogState, true)).join("")
		: '<p class="permission-empty">No direct permissions. Access is currently inherited.</p>'}
		</section>
		<section class="permission-section is-inherited">
			<h3>Inherited access <span>${inherited.length}</span></h3>
			<p class="permission-note">
				Inherited permissions come from parent folders and cannot be edited here.
			</p>
			${inherited.length
		? inherited.map((grant) => renderGrant(item, grant, dialogState, false)).join("")
		: '<p class="permission-empty">No permissions inherited from a parent folder.</p>'}
		</section>
	`;
	return renderModal(
		`Manage access: ${item.display_name}`,
		body,
		'<button class="data-btn data-btn-secondary" data-action="close-modal">Done</button>',
		"data-permission-modal"
	);
}

function renderAddAccess(item, state) {
	const isUser = state.principalType === "User";
	return `
		<section class="permission-add">
			<h3>Add access</h3>
			<div class="permission-type-switch" role="tablist" aria-label="Principal type">
				<button class="${isUser ? "is-active" : ""}" data-action="permission-type" data-type="User">Users</button>
				<button class="${!isUser ? "is-active" : ""}" data-action="permission-type" data-type="Role">Roles</button>
			</div>
			<div class="permission-add-row">
				<label class="permission-search">
					${icon("search")}
					<input data-role="principal-search" value="${attribute(state.query)}"
						placeholder="Search ERP ${isUser ? "users" : "roles"}" autocomplete="off">
				</label>
				<select class="permission-level" data-role="new-permission-level" aria-label="Permission level">
					${levelOptions(item, state.newLevel)}
				</select>
				<button class="data-btn data-btn-primary" data-action="confirm-permission-add"
					${state.selectedPrincipal ? "" : "disabled"}>Add</button>
			</div>
			${renderPrincipalResults(state)}
			${state.selectedPrincipal ? `
				<div class="permission-selection">
					${icon(isUser ? "shared" : "folder")}
					<span>${escapeHtml(state.selectedPrincipal.label)}</span>
					<button data-action="clear-principal" aria-label="Clear selection">${icon("close")}</button>
				</div>` : ""}
		</section>
	`;
}

function renderPrincipalResults(state) {
	if (state.searching) {
		return '<div class="permission-results"><p>Searching...</p></div>';
	}
	if (state.query.length >= 2 && !state.results.length && !state.selectedPrincipal) {
		return '<div class="permission-results"><p>No matching ERP principal found.</p></div>';
	}
	if (!state.results.length || state.selectedPrincipal) return "";
	return `
		<div class="permission-results" role="listbox">
			${state.results.map((principal) => `
				<button data-action="select-principal" data-value="${attribute(principal.value)}"
					data-label="${attribute(principal.label)}" data-type="${attribute(principal.principal_type)}">
					${icon(principal.principal_type === "User" ? "shared" : "folder")}
					<strong>${escapeHtml(principal.label)}</strong>
					${principal.label !== principal.value ? `<small>${escapeHtml(principal.value)}</small>` : ""}
				</button>
			`).join("")}
		</div>
	`;
}

function renderGrant(item, grant, state, editable) {
	const principal = grant.user || grant.role;
	const level = state.levels[grant.name] || levelForCapabilities(grant.capabilities, item.type === "folder");
	const confirming = state.confirmRemove === grant.name;
	return `
		<div class="permission-grant ${editable ? "is-direct" : "is-inherited"}">
			<div class="permission-principal">
				<div class="permission-avatar is-small">${escapeHtml(ownerInitials(principal))}</div>
				<div>
					<strong>${escapeHtml(principal)}</strong>
					<small>
						${escapeHtml(grant.principal_type)}
						<span class="permission-scope ${editable ? "" : "is-inherited"}">
							${editable ? "Direct" : `Inherited from ${escapeHtml(grant.source_item?.display_name || "parent folder")}`}
						</span>
					</small>
				</div>
			</div>
			<div class="permission-grant-actions">
				<select data-role="grant-level" data-id="${attribute(grant.name)}"
					${editable ? "" : "disabled"} aria-label="Access for ${attribute(principal)}">
					${levelOptions(item, level, level === "custom")}
				</select>
				${editable ? (confirming
		? `<button class="permission-link is-danger" data-action="confirm-remove-permission" data-id="${attribute(grant.name)}">Confirm</button>
		   <button class="permission-link" data-action="cancel-remove-permission">Cancel</button>`
		: `<button class="data-icon-btn permission-remove" data-action="remove-permission" data-id="${attribute(grant.name)}" aria-label="Remove access">${icon("trash")}</button>`)
		: ""}
			</div>
		</div>
	`;
}

function levelOptions(item, selected, allowCustom = false) {
	const custom = allowCustom ? '<option value="custom" selected disabled>Custom access</option>' : "";
	return custom + PERMISSION_LEVELS
		.filter((level) => !level.folderOnly || item.type === "folder")
		.map((level) => `
			<option value="${level.value}" ${level.value === selected ? "selected" : ""}>
				${escapeHtml(level.label)}
			</option>
		`).join("");
}

function sameCapabilities(expected, supplied) {
	return Object.keys(expected).every((key) => Boolean(expected[key]) === Boolean(supplied[key]));
}

function ownerInitials(value) {
	return String(value || "?")
		.split(/[\s@._-]+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0].toUpperCase())
		.join("");
}
