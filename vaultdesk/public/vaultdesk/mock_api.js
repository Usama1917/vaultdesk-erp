import { previewKind } from "./utils.js";

// Local preview only: this in-memory adapter is selected by index.html and is never
// loaded by the Frappe Desk page, which explicitly selects the live adapter.
const FULL = {
	view: true,
	download: true,
	upload: true,
	edit: true,
	move: true,
	delete: true,
	manage_permissions: true,
};

const EDITOR = {
	view: true,
	download: true,
	upload: false,
	edit: true,
	move: true,
	delete: false,
	manage_permissions: false,
};

const VIEWER = {
	view: true,
	download: true,
	upload: false,
	edit: false,
	move: false,
	delete: false,
	manage_permissions: false,
};

const METADATA_ONLY = {
	...VIEWER,
	download: false,
};

function makeItem(data, t) {
	return {
		business_owner: t("value.administrator"),
		created_by: t("value.administrator"),
		creation: "2026-04-03T09:00:00",
		modified: "2026-05-22T10:24:00",
		is_trashed: false,
		is_starred: false,
		capabilities: { ...FULL },
		...data,
	};
}

function seedItems(t) {
	const item = (data) => makeItem(data, t);
	return {
		root: item({
			name: "root",
			display_name: t("fixture.root"),
			type: "folder",
			parent_vaultdesk_item: null,
			break_inheritance: true,
		}),
		projects: item({
			name: "projects",
			display_name: t("fixture.designs"),
			type: "folder",
			parent_vaultdesk_item: "root",
			modified: "2026-05-23T16:32:00",
		}),
		finance: item({
			name: "finance",
			display_name: t("fixture.invoices"),
			type: "folder",
			parent_vaultdesk_item: "root",
			modified: "2026-05-18T08:12:00",
		}),
		shared: item({
			name: "shared",
			display_name: t("fixture.shared"),
			type: "folder",
			parent_vaultdesk_item: "root",
			business_owner: t("fixture.owner.procurement"),
			capabilities: { ...VIEWER },
			shared_with_me: true,
			modified: "2026-05-20T13:48:00",
		}),
		books: item({
			name: "books",
			display_name: t("fixture.books"),
			type: "folder",
			parent_vaultdesk_item: "root",
			modified: "2026-05-15T15:08:00",
		}),
		pdfs: item({
			name: "pdfs",
			display_name: t("fixture.pdfs"),
			type: "folder",
			parent_vaultdesk_item: "root",
			modified: "2026-05-24T09:28:00",
		}),
		images: item({
			name: "images",
			display_name: t("fixture.images"),
			type: "folder",
			parent_vaultdesk_item: "root",
			modified: "2026-05-22T14:41:00",
		}),
		production: item({
			name: "production",
			display_name: t("fixture.production"),
			type: "folder",
			parent_vaultdesk_item: "root",
			modified: "2026-05-24T11:03:00",
		}),
		brand: item({
			name: "brand",
			display_name: t("fixture.brand"),
			type: "folder",
			parent_vaultdesk_item: "projects",
			modified: "2026-05-22T11:20:00",
		}),
		incoming: item({
			name: "incoming",
			display_name: t("fixture.incoming"),
			type: "folder",
			parent_vaultdesk_item: "production",
			modified: "2026-05-24T10:12:00",
		}),
		proposal: item({
			name: "proposal",
			display_name: t("fixture.proposal"),
			type: "file",
			parent_vaultdesk_item: "pdfs",
			mime_type: "application/pdf",
			file_extension: "pdf",
			file_size: 2804451,
			business_owner: t("fixture.owner.mona"),
			is_starred: true,
			modified: "2026-05-23T13:14:00",
			shared_with_me: true,
			capabilities: { ...EDITOR },
		}),
		forecast: item({
			name: "forecast",
			display_name: t("fixture.forecast"),
			type: "file",
			parent_vaultdesk_item: "finance",
			mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			file_extension: "xlsx",
			file_size: 824120,
			business_owner: t("fixture.owner.ahmed"),
			modified: "2026-05-21T09:45:00",
		}),
		notes: item({
			name: "notes",
			display_name: t("fixture.notes"),
			type: "file",
			parent_vaultdesk_item: "production",
			mime_type: "text/plain",
			file_extension: "txt",
			file_size: 4192,
			business_owner: t("value.you"),
			modified: "2026-05-24T08:45:00",
			text_content: t("fixture.text.notes"),
		}),
		config: item({
			name: "config",
			display_name: t("fixture.config"),
			type: "file",
			parent_vaultdesk_item: "production",
			mime_type: "application/json",
			file_extension: "json",
			file_size: 214,
			business_owner: t("fixture.owner.operations"),
			modified: "2026-05-23T10:12:00",
			text_content: '{\n  "approval_required": true,\n  "minimum_approvers": 2,\n  "teams": ["Finance", "Operations"]\n}\n',
		}),
		bundle: item({
			name: "bundle",
			display_name: t("fixture.bundle"),
			type: "file",
			parent_vaultdesk_item: "projects",
			mime_type: "application/zip",
			file_extension: "zip",
			file_size: 3461120,
			business_owner: t("fixture.owner.design"),
			modified: "2026-05-20T15:22:00",
		}),
		restricted: item({
			name: "restricted",
			display_name: t("fixture.restricted"),
			type: "file",
			parent_vaultdesk_item: "shared",
			mime_type: "text/plain",
			file_extension: "txt",
			file_size: 890,
			business_owner: t("fixture.owner.executive"),
			modified: "2026-05-21T12:12:00",
			capabilities: { ...METADATA_ONLY },
			shared_with_me: true,
			text_content: t("fixture.text.restricted"),
		}),
		broken: item({
			name: "broken",
			display_name: t("fixture.broken"),
			type: "file",
			parent_vaultdesk_item: "production",
			mime_type: "text/csv",
			file_extension: "csv",
			file_size: 1460,
			business_owner: t("fixture.owner.operations"),
			modified: "2026-05-19T11:10:00",
			preview_error: true,
		}),
		hero: item({
			name: "hero",
			display_name: t("fixture.hero"),
			type: "file",
			parent_vaultdesk_item: "images",
			mime_type: "image/png",
			file_extension: "png",
			file_size: 1342180,
			business_owner: t("fixture.owner.design"),
			modified: "2026-05-19T14:06:00",
			preview_url:
				"data:image/svg+xml;charset=UTF-8," +
				encodeURIComponent(
					'<svg xmlns="http://www.w3.org/2000/svg" width="900" height="560">' +
					'<rect width="900" height="560" fill="#eef4ff"/><rect x="64" y="58" width="772" height="444" rx="18" fill="#fff" stroke="#cbd9ee" stroke-width="3"/>' +
					'<rect x="110" y="104" width="270" height="160" rx="12" fill="#e7f0ff"/><rect x="408" y="104" width="382" height="160" rx="12" fill="#f3f6fb"/>' +
					`<rect x="110" y="290" width="680" height="164" rx="12" fill="#f3f6fb"/><text x="110" y="88" font-family="Arial" font-size="22" fill="#2d476c">${t("fixture.image_label")}</text></svg>`
				),
		}),
		handbook: item({
			name: "handbook",
			display_name: t("fixture.handbook"),
			type: "file",
			parent_vaultdesk_item: "books",
			mime_type: "text/plain",
			file_extension: "txt",
			file_size: 18642,
			business_owner: t("fixture.owner.operations_team"),
			modified: "2026-05-15T15:11:00",
			text_content: t("fixture.text.handbook"),
		}),
		invoice: item({
			name: "invoice",
			display_name: t("fixture.invoice"),
			type: "file",
			parent_vaultdesk_item: "finance",
			mime_type: "application/pdf",
			file_extension: "pdf",
			file_size: 148930,
			business_owner: t("fixture.owner.finance"),
			modified: "2026-05-24T09:11:00",
		}),
		contract: item({
			name: "contract",
			display_name: t("fixture.contract"),
			type: "file",
			parent_vaultdesk_item: "shared",
			mime_type: "application/pdf",
			file_extension: "pdf",
			file_size: 914440,
			business_owner: t("fixture.owner.procurement"),
			capabilities: { ...VIEWER },
			shared_with_me: true,
			modified: "2026-05-20T14:03:00",
		}),
		archived: item({
			name: "archived",
			display_name: t("fixture.archived"),
			type: "file",
			parent_vaultdesk_item: "finance",
			mime_type: "application/pdf",
			file_extension: "pdf",
			file_size: 553000,
			is_trashed: true,
			original_parent_vaultdesk_item: "finance",
			modified: "2026-05-12T12:10:00",
		}),
	};
}

function makeVersion(item, versionNumber, data = {}) {
	return {
		name: `${item.name}-version-${versionNumber}`,
		version_number: versionNumber,
		uploaded_at: item.modified,
		uploaded_by: item.business_owner,
		file_size: item.file_size,
		mime_type: item.mime_type,
		file_extension: item.file_extension,
		preview_url: item.preview_url || "",
		text_content: item.text_content || "",
		preview_error: Boolean(item.preview_error),
		is_current: false,
		is_protected: false,
		note: "",
		...data,
	};
}

function seedVersions(items, t) {
	const histories = {};
	Object.values(items).filter((item) => item.type === "file").forEach((item) => {
		histories[item.name] = [makeVersion(item, 1, { is_current: true, uploaded_by: t("value.you") })];
	});
	histories.invoice = [
		makeVersion(items.invoice, 3, {
			is_current: true,
			uploaded_at: "2026-05-24T09:11:00",
			uploaded_by: t("fixture.owner.finance"),
			note: t("fixture.note.approved_invoice"),
		}),
		makeVersion(items.invoice, 2, {
			uploaded_at: "2026-05-20T12:30:00",
			uploaded_by: t("fixture.owner.finance"),
			file_size: 143700,
			is_protected: true,
			note: t("fixture.note.audit_checkpoint"),
		}),
		makeVersion(items.invoice, 1, {
			uploaded_at: "2026-05-16T08:22:00",
			uploaded_by: t("fixture.owner.accounts"),
			file_size: 138240,
			note: t("fixture.note.initial_submission"),
		}),
	];
	histories.notes = [
		makeVersion(items.notes, 3, { is_current: true, uploaded_by: t("value.you") }),
		makeVersion(items.notes, 2, {
			uploaded_at: "2026-05-18T08:45:00",
			uploaded_by: t("value.you"),
			file_size: 3860,
			text_content: t("fixture.text.notes_review"),
		}),
		makeVersion(items.notes, 1, {
			uploaded_at: "2026-05-10T08:45:00",
			uploaded_by: t("value.you"),
			file_size: 2780,
			text_content: t("fixture.text.notes_initial"),
		}),
	];
	histories.proposal = [
		makeVersion(items.proposal, 2, { is_current: true, uploaded_by: t("fixture.owner.mona") }),
		makeVersion(items.proposal, 1, {
			uploaded_at: "2026-05-08T13:14:00",
			uploaded_by: t("fixture.owner.mona"),
			file_size: 2611000,
			note: t("fixture.note.first_draft"),
		}),
	];
	return histories;
}

export class MockVaultDeskApi {
	constructor(i18n) {
		this.mode = "mock";
		this.t = i18n.t;
		this.items = seedItems(this.t);
		Object.values(this.items)
			.filter((item) => item.mime_type === "application/pdf")
			.forEach((item) => {
				item.preview_url = URL.createObjectURL(
					new Blob([demoPdf(item.display_name, this.t("fixture.pdf.subtitle"))], { type: "application/pdf" })
				);
			});
		this.versions = seedVersions(this.items, this.t);
		Object.keys(this.versions).forEach((itemName) => this.syncCurrentVersion(itemName));
		this.recentIds = ["invoice", "notes", "proposal", "forecast"];
		this.grants = {
			root: [
				{
					name: "grant-root-owner",
					principal_type: "User",
					user: "you@example.com",
					capabilities: { ...FULL },
				},
				],
			projects: [
				{
					name: "grant-project-contributor",
					principal_type: "Role",
					role: this.t("fixture.role.contributor"),
					capabilities: { ...EDITOR },
				},
			],
			proposal: [
				{
					name: "grant-project-role",
					principal_type: "Role",
					role: this.t("fixture.role.viewer"),
					capabilities: { ...VIEWER },
				},
				],
			};
			this.users = [
				{ value: "mona.hassan@example.com", label: this.t("fixture.owner.mona"), principal_type: "User" },
				{ value: "ahmed.saleh@example.com", label: this.t("fixture.owner.ahmed"), principal_type: "User" },
				{ value: "operations@example.com", label: this.t("fixture.owner.operations"), principal_type: "User" },
				{ value: "finance@example.com", label: this.t("fixture.owner.finance"), principal_type: "User" },
			];
			this.roles = [
				{ value: "Accounts User", label: this.t("fixture.role.accounts"), principal_type: "Role" },
				{ value: "VaultDesk Manager", label: this.t("fixture.role.manager"), principal_type: "Role" },
				{ value: "Project Contributor", label: this.t("fixture.role.contributor"), principal_type: "Role" },
				{ value: "Project Viewer", label: this.t("fixture.role.viewer"), principal_type: "Role" },
			];
		}

	async getSpaces() {
		await this.wait();
		return [{ name: "space-main", space_name: this.t("fixture.root"), space_type: "Personal", root: this.clone("root") }];
	}

	async getFolderContents(folder, options = {}) {
		await this.wait();
		const target = this.items[folder];
		const children = Object.values(this.items).filter(
			(item) => item.parent_vaultdesk_item === folder && !item.is_trashed
		);
		return {
			folder: this.copy(target),
			items: this.sort(children.map((item) => this.copy(item)), options),
		};
	}

	async getBreadcrumbs(itemName) {
		await this.wait(70);
		const trail = [];
		let item = this.items[itemName];
		while (item) {
			trail.unshift(this.copy(item));
			item = this.items[item.parent_vaultdesk_item];
		}
		return trail;
	}

	async getFolderTree(parentFolder) {
		await this.wait(80);
		return Object.values(this.items)
			.filter((item) => item.type === "folder" && item.parent_vaultdesk_item === parentFolder && !item.is_trashed)
			.map((item) => this.copy(item));
	}

	async getAllFolders() {
		return Object.values(this.items)
			.filter((item) => item.type === "folder" && !item.is_trashed)
			.map((item) => this.copy(item));
	}

	async getSection(section, options = {}) {
		await this.wait();
		let rows = [];
		if (section === "shared") rows = Object.values(this.items).filter((item) => item.shared_with_me && !item.is_trashed);
		if (section === "recent") rows = this.recentIds.map((id) => this.items[id]).filter(Boolean);
		if (section === "starred") rows = Object.values(this.items).filter((item) => item.is_starred && !item.is_trashed);
		if (section === "trash") rows = Object.values(this.items).filter((item) => item.is_trashed);
		return this.sort(rows.map((item) => this.copy(item)), options);
	}

	async search(query, options = {}) {
		await this.wait();
		const needle = query.trim().toLowerCase();
		const found = Object.values(this.items).filter(
			(item) => !item.is_trashed && item.display_name.toLowerCase().includes(needle)
		);
		return this.sort(found.map((item) => this.copy(item)), options);
	}

	async createFolder(parentFolder, displayName) {
		await this.wait();
		const name = this.id("folder");
		this.items[name] = makeItem({
			name,
			display_name: displayName,
			type: "folder",
			parent_vaultdesk_item: parentFolder,
			business_owner: this.t("value.you"),
			modified: new Date().toISOString(),
		}, this.t);
		return this.copy(this.items[name]);
	}

	async uploadFiles(folder, files) {
		const uploaded = [];
		for (const file of files) {
			const name = this.id("file");
			const extension = file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "";
			const item = makeItem({
				name,
				display_name: file.name,
				type: "file",
				parent_vaultdesk_item: folder,
				business_owner: this.t("value.you"),
				mime_type: file.type || "application/octet-stream",
				file_extension: extension,
				file_size: file.size,
				modified: new Date().toISOString(),
				preview_url: URL.createObjectURL(file),
			}, this.t);
			if (previewKind(item) === "text") item.text_content = await file.text();
			this.items[name] = item;
			this.versions[name] = [makeVersion(item, 1, {
				is_current: true,
				uploaded_at: item.modified,
				uploaded_by: this.t("value.you"),
				note: this.t("fixture.note.initial_upload"),
			})];
			this.syncCurrentVersion(name);
			this.markRecent(name);
			uploaded.push(this.copy(item));
		}
		await this.wait();
		return uploaded;
	}

	async renameItem(item, newName) {
		await this.wait();
		this.items[item.name].display_name = newName;
		this.items[item.name].modified = new Date().toISOString();
		return this.clone(item.name);
	}

	async moveItem(item, destinationFolder) {
		await this.wait();
		this.items[item.name].parent_vaultdesk_item = destinationFolder;
		this.items[item.name].modified = new Date().toISOString();
		return this.clone(item.name);
	}

	async copyItem(item, destinationFolder) {
		await this.wait();
		this.requireCapability(this.items[destinationFolder], "upload", this.t("api.copy_denied"));
		const createCopy = (source, parentFolder, topLevel = false) => {
			const name = this.id(source.type);
			const copy = makeItem({
				...this.copy(source),
				name,
				display_name: topLevel ? this.t("fixture.copy", { name: source.display_name }) : source.display_name,
				parent_vaultdesk_item: parentFolder,
				business_owner: this.t("value.you"),
				is_starred: false,
				shared_with_me: false,
				modified: new Date().toISOString(),
			}, this.t);
			this.items[name] = copy;
			if (source.type === "file") {
				const current = this.currentVersion(source.name);
				this.versions[name] = [makeVersion(copy, 1, {
					...this.copy(current),
					name: `${name}-version-1`,
					version_number: 1,
					is_current: true,
					is_protected: false,
					uploaded_at: copy.modified,
					uploaded_by: this.t("value.you"),
					note: this.t("fixture.note.copied", { name: source.display_name }),
				})];
				this.syncCurrentVersion(name);
			}
			Object.values(this.items)
				.filter((child) => child.parent_vaultdesk_item === source.name && !child.is_trashed && child.name !== name)
				.forEach((child) => createCopy(child, name));
			return copy;
		};
		return this.copy(createCopy(this.items[item.name], destinationFolder, true));
	}

	async trashItem(item) {
		await this.wait();
		const trash = (entry) => {
			entry.is_trashed = true;
			entry.original_parent_vaultdesk_item = entry.parent_vaultdesk_item;
			if (entry.type === "folder") {
				Object.values(this.items).filter((child) => child.parent_vaultdesk_item === entry.name).forEach(trash);
			}
		};
		trash(this.items[item.name]);
		return this.clone(item.name);
	}

	async restoreItem(item) {
		await this.wait();
		const restore = (entry) => {
			entry.is_trashed = false;
			if (entry.type === "folder") {
				Object.values(this.items).filter((child) => child.parent_vaultdesk_item === entry.name).forEach(restore);
			}
		};
		restore(this.items[item.name]);
		return this.clone(item.name);
	}

	async setStarred(item, starred) {
		await this.wait(60);
		this.items[item.name].is_starred = starred;
		return this.clone(item.name);
	}

	async getVersions(item) {
		await this.wait(90);
		this.requireCapability(this.items[item.name], "view", this.t("api.versions_denied"));
		return this.copy(this.versions[item.name] || []);
	}

	async uploadNewVersion(item, file) {
		await this.wait();
		const target = this.items[item.name];
		this.requireCapability(target, "edit", this.t("api.version_upload_denied"));
		const history = this.versions[item.name] || [];
		const number = history.reduce((highest, version) => Math.max(highest, version.version_number), 0) + 1;
		history.forEach((version) => { version.is_current = false; });
		const extension = file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : target.file_extension;
		const mimeType = file.type || target.mime_type;
		const current = makeVersion(target, number, {
			name: `${item.name}-version-${number}`,
			is_current: true,
			uploaded_at: new Date().toISOString(),
			uploaded_by: this.t("value.you"),
			file_size: file.size,
			mime_type: mimeType,
			file_extension: extension,
			preview_url: URL.createObjectURL(file),
			text_content: previewKind({ ...target, mime_type: mimeType, file_extension: extension }) === "text"
				? await file.text()
				: "",
			note: this.t("fixture.note.new_version"),
		});
		this.versions[item.name] = [current, ...history];
		this.syncCurrentVersion(item.name);
		this.markRecent(item.name);
		return this.copy(current);
	}

	async restoreVersion(item, versionName) {
		await this.wait();
		this.requireCapability(this.items[item.name], "edit", this.t("api.version_restore_denied"));
		const version = this.findVersion(item.name, versionName);
		if (version.is_current) return this.copy(version);
		this.versions[item.name].forEach((entry) => { entry.is_current = entry.name === versionName; });
		version.note = this.t("fixture.note.restored");
		this.syncCurrentVersion(item.name);
		this.markRecent(item.name);
		return this.copy(version);
	}

	async deleteVersion(item, versionName) {
		await this.wait();
		this.requireCapability(this.items[item.name], "delete", this.t("api.version_delete_denied"));
		const version = this.findVersion(item.name, versionName);
		if (version.is_current) throw new Error(this.t("api.current_delete_denied"));
		if (version.is_protected) throw new Error(this.t("api.protected_delete_denied"));
		this.versions[item.name] = this.versions[item.name].filter((entry) => entry.name !== versionName);
		this.syncCurrentVersion(item.name);
		return;
	}

	async setVersionProtected(item, versionName, isProtected) {
		await this.wait();
		this.requireCapability(this.items[item.name], "manage_permissions", this.t("api.protection_denied"));
		const version = this.findVersion(item.name, versionName);
		version.is_protected = Boolean(isProtected);
		return this.copy(version);
	}

	async getPermissionOverview(item) {
		await this.wait();
		const directGrants = this.decorateGrants(item.name, "direct", true);
		const inheritedGrants = [];
		const inheritedSources = [];
		let parent = item.break_inheritance ? null : this.items[item.parent_vaultdesk_item];
		while (parent) {
			inheritedSources.push({
				name: parent.name,
				display_name: parent.display_name,
				is_boundary: Boolean(parent.break_inheritance),
			});
			inheritedGrants.push(...this.decorateGrants(parent.name, "inherited", false));
			if (parent.break_inheritance) break;
			parent = this.items[parent.parent_vaultdesk_item];
		}
		return {
			item: {
				name: item.name,
				display_name: item.display_name,
				type: item.type,
				business_owner: item.business_owner,
				break_inheritance: Boolean(item.break_inheritance),
			},
			can_manage_permissions: Boolean(item.capabilities.manage_permissions),
			direct_grants: directGrants,
			inherited_grants: inheritedGrants,
			inherited_sources: inheritedSources,
		};
	}

	async searchPrincipals(item, query, principalType) {
		await this.wait(130);
		const needle = query.toLowerCase();
		const options = principalType === "Role" ? this.roles : this.users;
		return options.filter((entry) => (
			entry.label.toLowerCase().includes(needle) || entry.value.toLowerCase().includes(needle)
		));
	}

	async addPermission(item, grant) {
		await this.wait();
		const principalField = grant.principal_type === "Role" ? "role" : "user";
		const existing = (this.grants[item.name] || []).find(
			(entry) => entry.principal_type === grant.principal_type && entry[principalField] === grant.principal
		);
		if (existing) {
			existing.capabilities = { ...grant.capabilities };
			return structuredClone(existing);
		}
		const next = {
			name: this.id("grant"),
			principal_type: grant.principal_type,
			[principalField]: grant.principal,
			capabilities: { ...grant.capabilities },
		};
		this.grants[item.name] = [...(this.grants[item.name] || []), next];
		return structuredClone(next);
	}

	async updatePermission(grantName, capabilities) {
		await this.wait();
		const grant = Object.values(this.grants).flat().find((entry) => entry.name === grantName);
		if (!grant) throw new Error(this.t("api.grant_missing"));
		grant.capabilities = { ...capabilities };
		return structuredClone(grant);
	}

	async removePermission(grantName) {
		await this.wait();
		for (const [itemName, grants] of Object.entries(this.grants)) {
			const remaining = grants.filter((grant) => grant.name !== grantName);
			if (remaining.length !== grants.length) {
				this.grants[itemName] = remaining;
				return;
			}
		}
		throw new Error(this.t("api.grant_missing"));
	}

	async getPreviewInfo(item) {
		await this.wait(80);
		const securedItem = this.clone(item.name);
		if (!securedItem.capabilities.view) throw new Error(this.t("api.access_denied"));
		this.markRecent(item.name);
		const kind = previewKind(securedItem);
		return {
			item: securedItem,
			preview_kind: kind,
			content_available: kind !== "unsupported" && Boolean(securedItem.capabilities.download),
			download_available: Boolean(securedItem.capabilities.download),
			text_truncated: false,
		};
	}

	async loadPreviewContent(item, kind) {
		await this.wait(120);
		const securedItem = this.items[item.name];
		if (!securedItem?.capabilities.view || !securedItem.capabilities.download) {
			throw new Error(this.t("api.access_denied"));
		}
		if (securedItem.preview_error) throw new Error(this.t("api.preview_delivery_failed"));
		if (kind === "text") return { text: securedItem.text_content || "" };
		return { url: securedItem.preview_url || "" };
	}

	download(item) {
		const content = item.text_content || this.t("fixture.download", { name: item.display_name });
		const url = item.preview_url || URL.createObjectURL(new Blob([content], { type: item.mime_type }));
		const link = document.createElement("a");
		link.href = url;
		link.download = item.display_name;
		link.click();
	}

	copy(item) {
		return structuredClone(item);
	}

	clone(name) {
		return this.copy(this.items[name]);
	}

	decorateGrants(itemName, scope, editable) {
		return (this.grants[itemName] || []).map((grant) => ({
			...structuredClone(grant),
			scope,
			editable,
			source_item: {
				name: itemName,
				display_name: this.items[itemName].display_name,
			},
		}));
	}

	requireCapability(item, capability, message) {
		if (!item?.capabilities?.[capability]) throw new Error(message);
	}

	findVersion(itemName, versionName) {
		const version = (this.versions[itemName] || []).find((entry) => entry.name === versionName);
		if (!version) throw new Error(this.t("api.version_missing"));
		return version;
	}

	currentVersion(itemName) {
		const version = (this.versions[itemName] || []).find((entry) => entry.is_current);
		if (!version) throw new Error(this.t("api.current_missing"));
		return version;
	}

	syncCurrentVersion(itemName) {
		const item = this.items[itemName];
		const versions = this.versions[itemName] || [];
		if (!item || !versions.length) return;
		const current = this.currentVersion(itemName);
		Object.assign(item, {
			file_size: current.file_size,
			mime_type: current.mime_type,
			file_extension: current.file_extension,
			preview_url: current.preview_url,
			text_content: current.text_content,
			preview_error: current.preview_error,
			modified: current.uploaded_at,
			current_version: current.version_number,
			version_count: versions.length,
		});
	}

	id(prefix) {
		return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
	}

	markRecent(itemName) {
		this.recentIds = [itemName, ...this.recentIds.filter((id) => id !== itemName)].slice(0, 8);
	}

	sort(items, options) {
		const sortBy = options.sortBy || "name";
		const direction = options.sortOrder === "desc" ? -1 : 1;
		const field = { name: "display_name", modified: "modified", size: "file_size", type: "mime_type" }[sortBy];
		return items.sort((left, right) => String(left[field] || "").localeCompare(String(right[field] || "")) * direction);
	}

	wait(duration = 180) {
		return new Promise((resolve) => window.setTimeout(resolve, duration));
	}
}

function demoPdf(title, subtitle) {
	const safeTitle = title.replaceAll(/[()\\]/g, "");
	const safeSubtitle = subtitle.replaceAll(/[()\\]/g, "");
	const content = `BT /F1 25 Tf 48 180 Td (${safeTitle}) Tj 0 -45 Td /F1 14 Tf (${safeSubtitle}) Tj ET`;
	return `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 500 260] /Contents 4 0 R
/Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length ${content.length} >>
stream
${content}
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
trailer
<< /Root 1 0 R >>
%%EOF`;
}
