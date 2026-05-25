export class LiveVaultDeskApi {
	constructor(i18n) {
		this.mode = "live";
		this.t = i18n.t;
	}

	async getSpaces() {
		return this.call("vaultdesk.api.folders.get_spaces");
	}

	async getFolderContents(folder, options = {}) {
		return this.call("vaultdesk.api.folders.get_folder_contents", {
			folder,
			sort_by: options.sortBy || "name",
			sort_order: options.sortOrder || "asc",
		});
	}

	async getBreadcrumbs(item) {
		return this.call("vaultdesk.api.folders.get_breadcrumb_path", { item });
	}

	async getFolderTree(parentFolder) {
		return this.call("vaultdesk.api.folders.get_folder_tree", { parent_folder: parentFolder });
	}

	async getSection(section) {
		if (section === "recent") {
			return this.call("vaultdesk.api.files.get_recent_files");
		}
		if (section === "starred") {
			return this.call("vaultdesk.api.files.get_starred_items");
		}
		throw new Error(
			this.t("api.aggregate_missing", { section: this.t(`section.${section}`) })
		);
	}

	async search(query) {
		return this.call("vaultdesk.api.files.search_items", { query });
	}

	async createFolder(parentFolder, name) {
		return this.call(
			"vaultdesk.api.folders.create_folder",
			{ parent_folder: parentFolder, folder_name: name },
			true
		);
	}

	async uploadFiles(folder, files) {
		const created = [];
		for (const file of files) {
			const body = new FormData();
			body.append("folder", folder);
			body.append("file", file);
			const headers = window.frappe && frappe.csrf_token
				? { "X-Frappe-CSRF-Token": frappe.csrf_token }
				: {};
			const response = await fetch("/api/method/vaultdesk.api.files.upload_file", {
				method: "POST",
				headers,
				body,
			});
			const json = await response.json();
			if (!response.ok || json.exc) throw new Error(json.message || this.t("api.upload_failed"));
			created.push(json.message);
		}
		return created;
	}

	async renameItem(item, newName) {
		const method = item.type === "folder" ? "rename_folder" : "rename_file";
		const key = item.type === "folder" ? "folder" : "file";
		return this.call(`vaultdesk.api.${item.type === "folder" ? "folders" : "files"}.${method}`, {
			[key]: item.name,
			new_name: newName,
		}, true);
	}

	async moveItem(item, destinationFolder) {
		const method = item.type === "folder" ? "move_folder" : "move_file";
		const key = item.type === "folder" ? "folder" : "file";
		return this.call(`vaultdesk.api.${item.type === "folder" ? "folders" : "files"}.${method}`, {
			[key]: item.name,
			destination_folder: destinationFolder,
		}, true);
	}

	async trashItem(item) {
		const method = item.type === "folder" ? "trash_folder" : "trash_file";
		const key = item.type === "folder" ? "folder" : "file";
		return this.call(`vaultdesk.api.${item.type === "folder" ? "folders" : "files"}.${method}`, {
			[key]: item.name,
		}, true);
	}

	async restoreItem(item) {
		const method = item.type === "folder" ? "restore_folder" : "restore_file";
		const key = item.type === "folder" ? "folder" : "file";
		return this.call(`vaultdesk.api.${item.type === "folder" ? "folders" : "files"}.${method}`, {
			[key]: item.name,
		}, true);
	}

	async setStarred(item, starred) {
		return this.call("vaultdesk.api.files.set_starred", { item: item.name, starred: starred ? 1 : 0 }, true);
	}

	async getPermissionOverview(item) {
		return this.call("vaultdesk.api.permissions.get_permission_overview", { item: item.name });
	}

	async searchPrincipals(item, query, principalType) {
		return this.call("vaultdesk.api.permissions.search_principals", {
			item: item.name,
			query,
			principal_type: principalType,
		});
	}

	async addPermission(item, grant) {
		const method = grant.principal_type === "Role" ? "add_role_permission" : "add_user_permission";
		const principalField = grant.principal_type === "Role" ? "role" : "user";
		return this.call(`vaultdesk.api.permissions.${method}`, {
			item: item.name,
			[principalField]: grant.principal,
			capabilities: JSON.stringify(grant.capabilities),
		}, true);
	}

	async updatePermission(grant, capabilities) {
		return this.call("vaultdesk.api.permissions.update_permission", {
			grant,
			capabilities: JSON.stringify(capabilities),
		}, true);
	}

	async removePermission(grant) {
		return this.call("vaultdesk.api.permissions.remove_permission", { grant }, true);
	}

	async getPreviewInfo(item) {
		return this.call("vaultdesk.api.files.get_preview_info", { file: item.name });
	}

	async loadPreviewContent(item, kind) {
		const response = await fetch(this.previewContentUrl(item), { credentials: "same-origin" });
		if (!response.ok) {
			let message = this.t("api.preview_failed");
			try {
				const payload = await response.json();
				message = payload.message || message;
			} catch (error) {
				// Preserve the general protected-content error when no JSON body is supplied.
			}
			throw new Error(message);
		}
		if (kind === "text") {
			return { text: await response.text() };
		}
		const url = URL.createObjectURL(await response.blob());
		return { url, dispose: () => URL.revokeObjectURL(url) };
	}

	previewContentUrl(item) {
		return `/api/method/vaultdesk.api.files.preview_file?file=${encodeURIComponent(item.name)}`;
	}

	download(item) {
		window.open(
			`/api/method/vaultdesk.api.files.download_file?file=${encodeURIComponent(item.name)}`,
			"_blank",
			"noopener"
		);
	}

	async call(method, args = {}, isPost = false) {
		if (!window.frappe || typeof frappe.call !== "function") {
			throw new Error(this.t("api.frappe_unavailable"));
		}
		const response = await frappe.call({ method, args, type: isPost ? "POST" : "GET" });
		return response.message;
	}
}
