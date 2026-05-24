import { previewKind } from "./utils.js";

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

function makeItem(data) {
	return {
		business_owner: "Administrator",
		created_by: "Administrator",
		creation: "2026-04-03T09:00:00",
		modified: "2026-05-22T10:24:00",
		is_trashed: false,
		is_starred: false,
		capabilities: { ...FULL },
		...data,
	};
}

function seedItems() {
	return {
		root: makeItem({
			name: "root",
			display_name: "My Vault",
			type: "folder",
			parent_vaultdesk_item: null,
			break_inheritance: true,
		}),
		projects: makeItem({
			name: "projects",
			display_name: "Projects",
			type: "folder",
			parent_vaultdesk_item: "root",
			modified: "2026-05-23T16:32:00",
		}),
		finance: makeItem({
			name: "finance",
			display_name: "Finance",
			type: "folder",
			parent_vaultdesk_item: "root",
			modified: "2026-05-18T08:12:00",
		}),
		shared: makeItem({
			name: "shared",
			display_name: "Supplier Contracts",
			type: "folder",
			parent_vaultdesk_item: "root",
			business_owner: "Procurement Manager",
			capabilities: { ...VIEWER },
			shared_with_me: true,
			modified: "2026-05-20T13:48:00",
		}),
		brand: makeItem({
			name: "brand",
			display_name: "Brand Refresh",
			type: "folder",
			parent_vaultdesk_item: "projects",
			modified: "2026-05-22T11:20:00",
		}),
		proposal: makeItem({
			name: "proposal",
			display_name: "Q3 Proposal.pdf",
			type: "file",
			parent_vaultdesk_item: "projects",
			mime_type: "application/pdf",
			file_extension: "pdf",
			file_size: 2804451,
			business_owner: "Mona Hassan",
			is_starred: true,
			modified: "2026-05-23T13:14:00",
			shared_with_me: true,
			capabilities: { ...EDITOR },
		}),
		forecast: makeItem({
			name: "forecast",
			display_name: "Revenue Forecast.xlsx",
			type: "file",
			parent_vaultdesk_item: "finance",
			mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			file_extension: "xlsx",
			file_size: 824120,
			business_owner: "Ahmed Saleh",
			modified: "2026-05-21T09:45:00",
		}),
		notes: makeItem({
			name: "notes",
			display_name: "Meeting Notes.txt",
			type: "file",
			parent_vaultdesk_item: "root",
			mime_type: "text/plain",
			file_extension: "txt",
			file_size: 4192,
			business_owner: "You",
			modified: "2026-05-24T08:45:00",
			text_content:
				"VaultDesk rollout meeting\n\n- Finalize permission groups before staging.\n- Validate private file access and audit records.\n- Schedule UI review with Finance and Operations.",
		}),
		config: makeItem({
			name: "config",
			display_name: "workflow-rules.json",
			type: "file",
			parent_vaultdesk_item: "root",
			mime_type: "application/json",
			file_extension: "json",
			file_size: 214,
			business_owner: "Operations Lead",
			modified: "2026-05-23T10:12:00",
			text_content: '{\n  "approval_required": true,\n  "minimum_approvers": 2,\n  "teams": ["Finance", "Operations"]\n}\n',
		}),
		bundle: makeItem({
			name: "bundle",
			display_name: "design-assets.zip",
			type: "file",
			parent_vaultdesk_item: "root",
			mime_type: "application/zip",
			file_extension: "zip",
			file_size: 3461120,
			business_owner: "Design Team",
			modified: "2026-05-20T15:22:00",
		}),
		restricted: makeItem({
			name: "restricted",
			display_name: "Board Notes.txt",
			type: "file",
			parent_vaultdesk_item: "root",
			mime_type: "text/plain",
			file_extension: "txt",
			file_size: 890,
			business_owner: "Executive Office",
			modified: "2026-05-21T12:12:00",
			capabilities: { ...METADATA_ONLY },
			text_content: "This content is deliberately unavailable in the demo.",
		}),
		broken: makeItem({
			name: "broken",
			display_name: "Damaged Import.csv",
			type: "file",
			parent_vaultdesk_item: "root",
			mime_type: "text/csv",
			file_extension: "csv",
			file_size: 1460,
			business_owner: "Operations Lead",
			modified: "2026-05-19T11:10:00",
			preview_error: true,
		}),
		hero: makeItem({
			name: "hero",
			display_name: "Office Layout.png",
			type: "file",
			parent_vaultdesk_item: "brand",
			mime_type: "image/png",
			file_extension: "png",
			file_size: 1342180,
			business_owner: "Design Team",
			modified: "2026-05-19T14:06:00",
			preview_url:
				"data:image/svg+xml;charset=UTF-8," +
				encodeURIComponent(
					'<svg xmlns="http://www.w3.org/2000/svg" width="900" height="560">' +
					'<rect width="900" height="560" fill="#eef4ff"/><rect x="64" y="58" width="772" height="444" rx="18" fill="#fff" stroke="#cbd9ee" stroke-width="3"/>' +
					'<rect x="110" y="104" width="270" height="160" rx="12" fill="#e7f0ff"/><rect x="408" y="104" width="382" height="160" rx="12" fill="#f3f6fb"/>' +
					'<rect x="110" y="290" width="680" height="164" rx="12" fill="#f3f6fb"/><text x="110" y="88" font-family="Arial" font-size="22" fill="#2d476c">Office Layout Preview</text></svg>'
				),
		}),
		archived: makeItem({
			name: "archived",
			display_name: "Old Vendor Quote.pdf",
			type: "file",
			parent_vaultdesk_item: "root",
			mime_type: "application/pdf",
			file_extension: "pdf",
			file_size: 553000,
			is_trashed: true,
			original_parent_vaultdesk_item: "root",
			modified: "2026-05-12T12:10:00",
		}),
	};
}

export class MockVaultDeskApi {
	constructor() {
		this.mode = "mock";
		this.items = seedItems();
		this.items.proposal.preview_url = URL.createObjectURL(new Blob([demoPdf()], { type: "application/pdf" }));
		this.recentIds = ["notes", "proposal", "forecast"];
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
					role: "Project Contributor",
					capabilities: { ...EDITOR },
				},
			],
			proposal: [
				{
					name: "grant-project-role",
					principal_type: "Role",
					role: "Project Viewer",
					capabilities: { ...VIEWER },
				},
				],
			};
			this.users = [
				{ value: "mona.hassan@example.com", label: "Mona Hassan", principal_type: "User" },
				{ value: "ahmed.saleh@example.com", label: "Ahmed Saleh", principal_type: "User" },
				{ value: "operations@example.com", label: "Operations Lead", principal_type: "User" },
				{ value: "finance@example.com", label: "Finance Controller", principal_type: "User" },
			];
			this.roles = [
				{ value: "Accounts User", label: "Accounts User", principal_type: "Role" },
				{ value: "VaultDesk Manager", label: "VaultDesk Manager", principal_type: "Role" },
				{ value: "Project Contributor", label: "Project Contributor", principal_type: "Role" },
				{ value: "Project Viewer", label: "Project Viewer", principal_type: "Role" },
			];
		}

	async getSpaces() {
		await this.wait();
		return [{ name: "space-main", space_name: "My Vault", space_type: "Personal", root: this.clone("root") }];
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
			business_owner: "You",
			modified: new Date().toISOString(),
		});
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
				business_owner: "You",
				mime_type: file.type || "application/octet-stream",
				file_extension: extension,
				file_size: file.size,
				modified: new Date().toISOString(),
				preview_url: URL.createObjectURL(file),
			});
			if (previewKind(item) === "text") item.text_content = await file.text();
			this.items[name] = item;
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
		if (!grant) throw new Error("The selected direct permission no longer exists.");
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
		throw new Error("The selected direct permission no longer exists.");
	}

	async getPreviewInfo(item) {
		await this.wait(80);
		const securedItem = this.clone(item.name);
		if (!securedItem.capabilities.view) throw new Error("Access denied for this file.");
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
			throw new Error("Access denied for this file.");
		}
		if (securedItem.preview_error) throw new Error("Protected preview content could not be delivered.");
		if (kind === "text") return { text: securedItem.text_content || "" };
		return { url: securedItem.preview_url || "" };
	}

	download(item) {
		const content = item.text_content || `Demo download for ${item.display_name}`;
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

	id(prefix) {
		return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
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

function demoPdf() {
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
<< /Length 100 >>
stream
BT /F1 25 Tf 48 180 Td (Q3 Proposal) Tj 0 -45 Td /F1 14 Tf (Secure VaultDesk preview sample) Tj ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
trailer
<< /Root 1 0 R >>
%%EOF`;
}
