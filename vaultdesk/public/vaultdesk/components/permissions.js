import { attribute, escapeHtml, icon } from "../utils.js";
import { renderModal } from "./content.js";

export const PERMISSION_LEVELS = [
	{
		value: "view",
	},
	{
		value: "upload",
		folderOnly: true,
	},
	{
		value: "edit",
	},
	{
		value: "delete",
	},
	{
		value: "manage",
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

export function renderPermissionDialog(item, overview, dialogState, i18n) {
	const t = i18n.t;
	const direct = overview.direct_grants || [];
	const inherited = overview.inherited_grants || [];
	const body = `
		<div class="permission-owner">
			<div class="permission-avatar">${escapeHtml(ownerInitials(overview.item.business_owner))}</div>
			<div>
				<p class="permission-caption">${t("permissions.owner")}</p>
				<strong>${escapeHtml(overview.item.business_owner || t("permissions.no_owner"))}</strong>
			</div>
			<span class="permission-access-badge">${t("permissions.owner")}</span>
		</div>
		${overview.can_manage_permissions ? renderAddAccess(item, dialogState, i18n) : ""}
		<section class="permission-section">
			<h3>${t("permissions.direct_access")} <span>${direct.length}</span></h3>
			${direct.length
		? direct.map((grant) => renderGrant(item, grant, dialogState, true, i18n)).join("")
		: `<p class="permission-empty">${t("permissions.direct_empty")}</p>`}
		</section>
		<section class="permission-section is-inherited">
			<h3>${t("permissions.inherited_access")} <span>${inherited.length}</span></h3>
			<p class="permission-note">
				${t("permissions.inherited_note")}
			</p>
			${inherited.length
		? inherited.map((grant) => renderGrant(item, grant, dialogState, false, i18n)).join("")
		: `<p class="permission-empty">${t("permissions.inherited_empty")}</p>`}
		</section>
	`;
	return renderModal(
		t("permissions.title", { name: item.display_name }),
		body,
		`<button class="data-btn data-btn-secondary" data-action="close-modal">${t("action.done")}</button>`,
		"data-permission-modal",
		i18n
	);
}

function renderAddAccess(item, state, i18n) {
	const t = i18n.t;
	const isUser = state.principalType === "User";
	return `
		<section class="permission-add">
			<h3>${t("permissions.add_access")}</h3>
			<div class="permission-type-switch" role="tablist" aria-label="${t("permissions.principal_type")}">
				<button class="${isUser ? "is-active" : ""}" data-action="permission-type" data-type="User">${t("permissions.users")}</button>
				<button class="${!isUser ? "is-active" : ""}" data-action="permission-type" data-type="Role">${t("permissions.roles")}</button>
			</div>
			<div class="permission-add-row">
				<label class="permission-search">
					${icon("search")}
					<input data-role="principal-search" value="${attribute(state.query)}"
						placeholder="${t(isUser ? "permissions.search_users" : "permissions.search_roles")}" autocomplete="off">
				</label>
				<select class="permission-level" data-role="new-permission-level" aria-label="${t("permissions.level")}">
					${levelOptions(item, state.newLevel, false, i18n)}
				</select>
				<button class="data-btn data-btn-primary" data-action="confirm-permission-add"
					${state.selectedPrincipal ? "" : "disabled"}>${t("action.add")}</button>
			</div>
			${renderPrincipalResults(state, i18n)}
			${state.selectedPrincipal ? `
				<div class="permission-selection">
					${icon(isUser ? "shared" : "folder")}
					<span>${escapeHtml(state.selectedPrincipal.label)}</span>
					<button data-action="clear-principal" aria-label="${t("permissions.clear_selection")}">${icon("close")}</button>
				</div>` : ""}
		</section>
	`;
}

function renderPrincipalResults(state, i18n) {
	const t = i18n.t;
	if (state.searching) {
		return `<div class="permission-results"><p>${t("permissions.searching")}</p></div>`;
	}
	if (state.query.length >= 2 && !state.results.length && !state.selectedPrincipal) {
		return `<div class="permission-results"><p>${t("permissions.no_match")}</p></div>`;
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

function renderGrant(item, grant, state, editable, i18n) {
	const t = i18n.t;
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
						${t(`principal.${grant.principal_type.toLowerCase()}`)}
						<span class="permission-scope ${editable ? "" : "is-inherited"}">
							${editable
		? t("permissions.direct")
		: t("permissions.inherited_from", { name: escapeHtml(grant.source_item?.display_name || t("permissions.parent_folder")) })}
						</span>
					</small>
				</div>
			</div>
			<div class="permission-grant-actions">
				<select data-role="grant-level" data-id="${attribute(grant.name)}"
					${editable ? "" : "disabled"} aria-label="${attribute(t("permissions.access_for", { name: principal }))}">
					${levelOptions(item, level, level === "custom", i18n)}
				</select>
				${editable ? (confirming
		? `<button class="permission-link is-danger" data-action="confirm-remove-permission" data-id="${attribute(grant.name)}">${t("action.confirm")}</button>
		   <button class="permission-link" data-action="cancel-remove-permission">${t("action.cancel")}</button>`
		: `<button class="data-icon-btn permission-remove" data-action="remove-permission" data-id="${attribute(grant.name)}" aria-label="${t("permissions.remove")}">${icon("trash")}</button>`)
		: ""}
			</div>
		</div>
	`;
}

function levelOptions(item, selected, allowCustom = false, i18n) {
	const custom = allowCustom ? `<option value="custom" selected disabled>${i18n.t("permissions.level_custom")}</option>` : "";
	return custom + PERMISSION_LEVELS
		.filter((level) => !level.folderOnly || item.type === "folder")
		.map((level) => `
			<option value="${level.value}" ${level.value === selected ? "selected" : ""}>
				${escapeHtml(i18n.t(`permissions.level_${level.value}`))}
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
