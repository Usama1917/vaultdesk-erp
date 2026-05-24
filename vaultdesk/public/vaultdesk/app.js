import { LiveVaultDeskApi } from "./api.js";
import { MockVaultDeskApi } from "./mock_api.js";
import {
	renderBreadcrumbs,
	renderDeleteDialog,
	renderDetails,
	renderError,
	renderFormDialog,
	renderItems,
	renderLoading,
	renderMoveDialog,
	renderTree,
} from "./components/content.js";
import { renderShell } from "./components/layout.js";
import {
	capabilitiesForLevel,
	renderPermissionDialog,
} from "./components/permissions.js";
import { renderPreviewDialog } from "./components/preview.js";
import { debounce, hasCapability, icon } from "./utils.js";

const SECTION_LABELS = {
	my: "My Vault",
	shared: "Shared with me",
	recent: "Recent",
	starred: "Starred",
	trash: "Trash",
	search: "Search results",
};

export function mountVaultDesk(element, options = {}) {
	const app = new VaultDeskApp(element, options);
	app.initialize();
	return app;
}

class VaultDeskApp {
	constructor(element, options) {
		this.element = element;
		this.api = options.api || (options.apiMode === "live" ? new LiveVaultDeskApi() : new MockVaultDeskApi());
		this.state = {
			section: "my",
			originSection: "my",
			currentFolder: null,
			root: null,
			items: [],
			breadcrumbs: [],
			tree: {},
			selected: null,
			loading: true,
			error: null,
			query: "",
			view: window.localStorage.getItem("vaultdesk-view") || "grid",
			sortBy: "name",
			sortOrder: "asc",
		};
		this.searchLater = debounce((value) => this.search(value), 260);
		this.principalSearchLater = debounce((value) => this.searchPrincipals(value), 240);
	}

	async initialize() {
		this.element.innerHTML = renderShell(this.api.mode);
		this.regions = {
			items: this.element.querySelector('[data-region="items"]'),
			breadcrumbs: this.element.querySelector('[data-region="breadcrumbs"]'),
			tree: this.element.querySelector('[data-region="tree"]'),
			details: this.element.querySelector('[data-region="details"]'),
			modal: this.element.querySelector('[data-region="modal"]'),
			toasts: this.element.querySelector('[data-region="toasts"]'),
			drop: this.element.querySelector('[data-region="drop-surface"]'),
		};
		this.bindEvents();
		this.syncViewControls();
		await this.loadRoot();
	}

	async refresh() {
		if (this.state.section === "my" && this.state.currentFolder) {
			return this.openFolder(this.state.currentFolder.name);
		}
		if (this.state.section === "search" && this.state.query) {
			return this.search(this.state.query);
		}
		return this.openSection(this.state.section);
	}

	bindEvents() {
		this.element.addEventListener("click", (event) => {
			const target = event.target.closest("[data-action]");
			if (!target) return;
			if (target.classList.contains("data-modal-backdrop") && event.target !== target) return;
			event.preventDefault();
			this.handleAction(target.dataset.action, target);
		});

		this.element.querySelector('[data-role="search"]').addEventListener("input", (event) => {
			this.searchLater(event.target.value);
		});

		this.element.addEventListener("input", (event) => {
			if (event.target.dataset.role !== "principal-search" || !this.permissionDialog) return;
			this.permissionDialog.query = event.target.value;
			this.permissionDialog.selectedPrincipal = null;
			this.principalSearchLater(event.target.value);
		});

		this.element.querySelector('[data-role="sort"]').addEventListener("change", (event) => {
			const [sortBy, sortOrder] = event.target.value.split(":");
			this.state.sortBy = sortBy;
			this.state.sortOrder = sortOrder;
			this.refresh();
		});

		this.element.addEventListener("change", (event) => {
			if (event.target.dataset.role === "grant-level") {
				this.updatePermissionLevel(event.target.dataset.id, event.target.value);
			}
			if (event.target.dataset.role === "new-permission-level" && this.permissionDialog) {
				this.permissionDialog.newLevel = event.target.value;
			}
		});

		this.element.querySelector('[data-role="file-input"]').addEventListener("change", (event) => {
			const files = Array.from(event.target.files || []);
			event.target.value = "";
			if (files.length) this.upload(files);
		});

		["dragenter", "dragover"].forEach((name) => this.regions.drop.addEventListener(name, (event) => {
			event.preventDefault();
			if (this.canUpload()) this.regions.drop.classList.add("is-dragging");
		}));
		["dragleave", "drop"].forEach((name) => this.regions.drop.addEventListener(name, (event) => {
			event.preventDefault();
			this.regions.drop.classList.remove("is-dragging");
		}));
		this.regions.drop.addEventListener("drop", (event) => {
			if (!this.canUpload()) return this.toast("You do not have upload access in this folder.", "warning");
			const files = Array.from(event.dataTransfer.files || []);
			if (files.length) this.upload(files);
		});
	}

	async loadRoot() {
		this.startLoading();
		try {
			const spaces = await this.api.getSpaces();
			if (!spaces.length) throw new Error("No VaultDesk space is available for your account.");
			this.state.root = spaces[0].root;
			await this.loadTreeChildren(this.state.root.name);
			await this.openFolder(this.state.root.name);
		} catch (error) {
			this.fail(error);
		}
	}

	async openFolder(folderName) {
		this.startLoading();
		this.activateSection("my");
		this.state.query = "";
		this.element.querySelector('[data-role="search"]').value = "";
		try {
			const [content, breadcrumbs] = await Promise.all([
				this.api.getFolderContents(folderName, this.sortOptions()),
				this.api.getBreadcrumbs(folderName),
				this.loadTreeChildren(folderName),
			]);
			this.state.currentFolder = content.folder;
			this.state.items = content.items;
			this.state.breadcrumbs = breadcrumbs;
			this.state.selected = null;
			this.finishLoading();
		} catch (error) {
			this.fail(error);
		}
	}

	async openSection(section) {
		if (section === "my") {
			return this.openFolder(this.state.currentFolder?.name || this.state.root.name);
		}
		this.startLoading();
		this.activateSection(section);
		this.state.query = "";
		this.element.querySelector('[data-role="search"]').value = "";
		try {
			this.state.items = await this.api.getSection(section, this.sortOptions());
			this.state.breadcrumbs = [];
			this.state.selected = null;
			this.finishLoading();
		} catch (error) {
			this.fail(error);
		}
	}

	async search(query) {
		const value = query.trim();
		if (!value) return this.openSection(this.state.originSection || "my");
		if (value.length < 2) return;
		if (this.state.section !== "search") this.state.originSection = this.state.section;
		this.startLoading();
		this.activateSection("search");
		this.state.query = value;
		try {
			this.state.items = await this.api.search(value, this.sortOptions());
			this.state.breadcrumbs = [];
			this.state.selected = null;
			this.finishLoading();
		} catch (error) {
			this.fail(error);
		}
	}

	async loadTreeChildren(folderName) {
		const children = await this.api.getFolderTree(folderName);
		this.state.tree[folderName] = children;
		return children;
	}

	handleAction(action, target) {
		const item = target.dataset.id ? this.findItem(target.dataset.id) : null;
		const actions = {
			section: () => this.openSection(target.dataset.section),
			view: () => this.setView(target.dataset.view),
			retry: () => this.refresh(),
			"open-folder": () => this.openFolder(target.dataset.id),
			select: () => this.select(item),
			details: () => this.select(item),
			"close-details": () => this.select(null),
			"choose-upload": () => this.chooseUpload(),
			"new-folder": () => this.newFolder(),
			"toggle-menu": () => this.toggleMenu(target.dataset.id),
			preview: () => this.preview(item),
			download: () => this.api.download(item),
			"preview-download": () => this.downloadPreviewItem(),
			"preview-details": () => this.togglePreviewDetails(),
			"preview-previous": () => this.navigatePreview("previous"),
			"preview-next": () => this.navigatePreview("next"),
			"preview-retry": () => this.retryPreview(),
			rename: () => this.rename(item),
			move: () => this.move(item),
			trash: () => this.confirmTrash(item),
			restore: () => this.restore(item),
			star: () => this.star(item),
			share: () => this.share(item),
			"close-modal": () => this.closeModal(),
			"confirm-folder": () => this.confirmNewFolder(),
			"confirm-rename": () => this.confirmRename(),
			"confirm-move": () => this.confirmMove(item),
			"confirm-trash": () => this.trash(item),
			"permission-type": () => this.changePrincipalType(target.dataset.type),
			"select-principal": () => this.selectPrincipal(target),
			"clear-principal": () => this.clearPrincipal(),
			"confirm-permission-add": () => this.addPermission(),
			"remove-permission": () => this.askRemovePermission(target.dataset.id),
			"cancel-remove-permission": () => this.askRemovePermission(null),
			"confirm-remove-permission": () => this.removePermission(target.dataset.id),
		};
		if (actions[action]) actions[action]();
	}

	setView(view) {
		this.state.view = view === "list" ? "list" : "grid";
		window.localStorage.setItem("vaultdesk-view", this.state.view);
		this.syncViewControls();
		this.renderContent();
	}

	select(item) {
		this.state.selected = item;
		this.renderContent();
		this.regions.details.innerHTML = renderDetails(item);
	}

	chooseUpload() {
		if (!this.canUpload()) {
			return this.toast("You do not have upload permission in this folder.", "warning");
		}
		this.element.querySelector('[data-role="file-input"]').click();
	}

	newFolder() {
		if (!this.canUpload()) {
			return this.toast("You do not have permission to create a folder here.", "warning");
		}
		this.regions.modal.innerHTML = renderFormDialog("New Folder", "Folder name", "", "confirm-folder", "Create");
		this.focusDialogInput();
	}

	async confirmNewFolder() {
		const name = this.dialogValue();
		if (!name) return this.toast("Enter a folder name.", "warning");
		await this.perform(
			() => this.api.createFolder(this.state.currentFolder.name, name),
			"Folder created.",
			true
		);
	}

	rename(item) {
		if (!hasCapability(item, "edit")) return;
		this.state.dialogItem = item;
		this.regions.modal.innerHTML = renderFormDialog(
			`Rename ${item.type}`,
			"New name",
			item.display_name,
			"confirm-rename",
			"Rename"
		);
		this.focusDialogInput();
	}

	async confirmRename() {
		const name = this.dialogValue();
		if (!name) return this.toast("Enter a name.", "warning");
		await this.perform(() => this.api.renameItem(this.state.dialogItem, name), "Item renamed.", true);
	}

	async move(item) {
		if (!hasCapability(item, "move")) return;
		this.state.dialogItem = item;
		try {
			const folders = this.api.getAllFolders
				? await this.api.getAllFolders()
				: [this.state.root, ...Object.values(this.state.tree).flat()];
			this.regions.modal.innerHTML = renderMoveDialog(item, folders);
		} catch (error) {
			this.toast(error.message, "error");
		}
	}

	async confirmMove(item) {
		const destination = this.regions.modal.querySelector('[data-role="destination"]').value;
		await this.perform(() => this.api.moveItem(item, destination), "Item moved.", true);
	}

	confirmTrash(item) {
		if (!hasCapability(item, "delete")) return;
		this.regions.modal.innerHTML = renderDeleteDialog(item);
	}

	async trash(item) {
		await this.perform(() => this.api.trashItem(item), "Moved to Trash.", true);
	}

	async restore(item) {
		await this.perform(() => this.api.restoreItem(item), "Item restored.", true);
	}

	async star(item) {
		await this.perform(
			() => this.api.setStarred(item, !item.is_starred),
			item.is_starred ? "Removed from Starred." : "Added to Starred.",
			false
		);
	}

	async share(item) {
		if (!hasCapability(item, "manage_permissions")) return;
		try {
			const overview = await this.api.getPermissionOverview(item);
			this.permissionDialog = {
				item,
				overview,
				principalType: "User",
				query: "",
				results: [],
				selectedPrincipal: null,
				newLevel: "view",
				searching: false,
				confirmRemove: null,
				levels: {},
			};
			this.renderPermissionManager();
		} catch (error) {
			this.toast(error.message, "error");
		}
	}

	changePrincipalType(principalType) {
		if (!this.permissionDialog) return;
		this.permissionDialog.principalType = principalType;
		this.permissionDialog.query = "";
		this.permissionDialog.results = [];
		this.permissionDialog.selectedPrincipal = null;
		this.renderPermissionManager();
		this.focusPrincipalSearch();
	}

	async searchPrincipals(query) {
		if (!this.permissionDialog || query.trim().length < 2) {
			if (this.permissionDialog) {
				this.permissionDialog.results = [];
				this.renderPermissionManager();
			}
			return;
		}
		const expectedQuery = query.trim();
		const expectedPrincipalType = this.permissionDialog.principalType;
		this.permissionDialog.searching = true;
		this.renderPermissionManager();
		try {
			const results = await this.api.searchPrincipals(
				this.permissionDialog.item,
				expectedQuery,
				expectedPrincipalType
			);
			if (
				!this.permissionDialog
				|| this.permissionDialog.query.trim() !== expectedQuery
				|| this.permissionDialog.principalType !== expectedPrincipalType
			) return;
			this.permissionDialog.results = results;
		} catch (error) {
			this.toast(error.message, "error");
			this.permissionDialog.results = [];
		} finally {
			if (this.permissionDialog) {
				this.permissionDialog.searching = false;
				this.renderPermissionManager();
				this.focusPrincipalSearch();
			}
		}
	}

	selectPrincipal(target) {
		if (!this.permissionDialog) return;
		this.permissionDialog.selectedPrincipal = {
			value: target.dataset.value,
			label: target.dataset.label,
			principal_type: target.dataset.type,
		};
		this.permissionDialog.results = [];
		this.renderPermissionManager();
	}

	clearPrincipal() {
		if (!this.permissionDialog) return;
		this.permissionDialog.selectedPrincipal = null;
		this.permissionDialog.query = "";
		this.permissionDialog.results = [];
		this.renderPermissionManager();
		this.focusPrincipalSearch();
	}

	async addPermission() {
		const state = this.permissionDialog;
		if (!state?.selectedPrincipal) return this.toast("Select a user or role.", "warning");
		const grant = {
			principal: state.selectedPrincipal.value,
			principal_type: state.principalType,
			capabilities: capabilitiesForLevel(state.newLevel, state.item.type === "folder"),
		};
		try {
			await this.api.addPermission(state.item, grant);
			state.query = "";
			state.results = [];
			state.selectedPrincipal = null;
			state.newLevel = "view";
			await this.finishPermissionMutation("Direct access added.");
		} catch (error) {
			this.toast(error.message, "error");
		}
	}

	async updatePermissionLevel(grantName, level) {
		const state = this.permissionDialog;
		if (!state) return;
		state.levels[grantName] = level;
		try {
			await this.api.updatePermission(
				grantName,
				capabilitiesForLevel(level, state.item.type === "folder")
			);
			delete state.levels[grantName];
			await this.finishPermissionMutation("Permission updated.");
		} catch (error) {
			delete state.levels[grantName];
			this.renderPermissionManager();
			this.toast(error.message, "error");
		}
	}

	askRemovePermission(grantName) {
		if (!this.permissionDialog) return;
		this.permissionDialog.confirmRemove = grantName;
		this.renderPermissionManager();
	}

	async removePermission(grantName) {
		if (!this.permissionDialog) return;
		try {
			await this.api.removePermission(grantName);
			if (this.permissionDialog) this.permissionDialog.confirmRemove = null;
			await this.finishPermissionMutation("Direct access removed.");
		} catch (error) {
			this.toast(error.message, "error");
		}
	}

	async finishPermissionMutation(message) {
		try {
			await this.reloadPermissionOverview();
			this.renderPermissionManager();
			this.toast(message, "success");
		} catch (error) {
			this.closeModal();
			await this.refresh();
			this.toast(`${message} Reopen access management to view current permissions.`, "success");
		}
	}

	async reloadPermissionOverview() {
		if (!this.permissionDialog) return;
		this.permissionDialog.overview = await this.api.getPermissionOverview(this.permissionDialog.item);
	}

	renderPermissionManager() {
		if (!this.permissionDialog) return;
		this.regions.modal.innerHTML = renderPermissionDialog(
			this.permissionDialog.item,
			this.permissionDialog.overview,
			this.permissionDialog
		);
	}

	focusPrincipalSearch() {
		window.setTimeout(() => {
			const input = this.regions.modal.querySelector('[data-role="principal-search"]');
			if (!input) return;
			input.focus();
			input.setSelectionRange(input.value.length, input.value.length);
		}, 0);
	}

	async preview(item) {
		if (!item) return;
		this.disposePreviewContent();
		const token = Symbol("preview");
		const navigation = this.previewNavigation(item);
		this.previewDialog = {
			item,
			kind: "unsupported",
			status: "loading",
			error: "",
			url: "",
			text: "",
			textTruncated: false,
			canDownload: hasCapability(item, "download"),
			showDetails: false,
			previous: navigation.previous,
			next: navigation.next,
			token,
			dispose: null,
		};
		this.renderPreviewManager();
		try {
			const info = await this.api.getPreviewInfo(item);
			if (!this.isCurrentPreview(token)) return;
			this.previewDialog.item = info.item;
			this.previewDialog.kind = info.preview_kind;
			this.previewDialog.canDownload = info.download_available;
			this.previewDialog.textTruncated = info.text_truncated;
			if (info.preview_kind === "unsupported") {
				this.previewDialog.status = "fallback";
				this.renderPreviewManager();
				return;
			}
			if (!info.content_available) {
				this.previewDialog.status = "denied";
				this.previewDialog.error = "You do not have permission to view this file content.";
				this.renderPreviewManager();
				return;
			}
			const content = await this.api.loadPreviewContent(info.item, info.preview_kind);
			if (!this.isCurrentPreview(token)) {
				if (content.dispose) content.dispose();
				return;
			}
			this.previewDialog.url = content.url || "";
			this.previewDialog.text = content.text || "";
			this.previewDialog.dispose = content.dispose || null;
			this.previewDialog.status = "ready";
			this.renderPreviewManager();
		} catch (error) {
			if (!this.isCurrentPreview(token)) return;
			const denied = /access|denied|permission|permitted/i.test(error.message || "");
			this.previewDialog.status = denied ? "denied" : "error";
			this.previewDialog.error = error.message || "The preview request failed.";
			if (denied) this.previewDialog.canDownload = false;
			this.renderPreviewManager();
		}
	}

	togglePreviewDetails() {
		if (!this.previewDialog) return;
		this.previewDialog.showDetails = !this.previewDialog.showDetails;
		this.renderPreviewManager();
	}

	downloadPreviewItem() {
		if (!this.previewDialog?.canDownload) return;
		this.api.download(this.previewDialog.item);
	}

	navigatePreview(direction) {
		const item = this.previewDialog?.[direction];
		if (item) this.preview(item);
	}

	retryPreview() {
		if (this.previewDialog) this.preview(this.previewDialog.item);
	}

	previewNavigation(item) {
		const files = this.state.items.filter((row) => row.type === "file" && hasCapability(row, "view"));
		const index = files.findIndex((row) => row.name === item.name);
		return {
			previous: index > 0 ? files[index - 1] : null,
			next: index >= 0 && index < files.length - 1 ? files[index + 1] : null,
		};
	}

	renderPreviewManager() {
		if (!this.previewDialog) return;
		this.regions.modal.innerHTML = renderPreviewDialog(this.previewDialog);
	}

	isCurrentPreview(token) {
		return Boolean(this.previewDialog && this.previewDialog.token === token);
	}

	disposePreviewContent() {
		if (this.previewDialog?.dispose) this.previewDialog.dispose();
	}

	async upload(files) {
		if (!this.canUpload()) return;
		this.toast(`Uploading ${files.length} file${files.length === 1 ? "" : "s"}...`, "info");
		await this.perform(
			() => this.api.uploadFiles(this.state.currentFolder.name, files),
			"Upload completed.",
			true
		);
	}

	async perform(operation, successMessage, closeModal) {
		try {
			await operation();
			if (closeModal) this.closeModal();
			this.toast(successMessage, "success");
			await this.refresh();
		} catch (error) {
			this.toast(error.message || "Operation failed.", "error");
		}
	}

	startLoading() {
		this.state.loading = true;
		this.state.error = null;
		this.render();
	}

	finishLoading() {
		this.state.loading = false;
		this.state.error = null;
		this.render();
	}

	fail(error) {
		this.state.loading = false;
		this.state.error = error.message || "Unable to load VaultDesk.";
		this.render();
	}

	render() {
		this.renderContent();
		this.regions.breadcrumbs.innerHTML = renderBreadcrumbs(
			this.state.breadcrumbs,
			SECTION_LABELS[this.state.section]
		);
		this.regions.tree.innerHTML = renderTree(this.state.root, this.state.tree, this.state.currentFolder?.name);
		this.regions.details.innerHTML = renderDetails(this.state.selected);
		this.regions.details.classList.toggle("is-open", Boolean(this.state.selected));
		this.updateActions();
		this.syncViewControls();
	}

	renderContent() {
		if (this.state.loading) {
			this.regions.items.innerHTML = renderLoading(this.state.view);
			return;
		}
		if (this.state.error) {
			this.regions.items.innerHTML = renderError(this.state.error);
			return;
		}
		this.regions.items.innerHTML = renderItems(this.state.items, {
			section: this.state.section,
			view: this.state.view,
			selected: this.state.selected?.name,
			canUpload: this.canUpload(),
		});
	}

	updateActions() {
		const disabled = !this.canUpload();
		this.element.querySelector('[data-action="choose-upload"]').disabled = disabled;
		this.element.querySelector('[data-action="new-folder"]').disabled = disabled;
	}

	syncViewControls() {
		this.element.querySelectorAll('[data-action="view"]').forEach((button) => {
			button.classList.toggle("is-active", button.dataset.view === this.state.view);
		});
		this.element.querySelectorAll('[data-action="section"]').forEach((button) => {
			button.classList.toggle("is-active", button.dataset.section === this.state.section);
		});
	}

	activateSection(section) {
		this.state.section = section;
		if (section !== "search") this.state.originSection = section;
	}

	toggleMenu(itemName) {
		this.element.querySelectorAll(".data-menu").forEach((menu) => {
			if (menu.dataset.menu !== itemName) menu.hidden = true;
		});
		const menu = this.element.querySelector(`[data-menu="${CSS.escape(itemName)}"]`);
		if (menu) menu.hidden = !menu.hidden;
	}

	closeModal() {
		this.disposePreviewContent();
		this.regions.modal.innerHTML = "";
		this.state.dialogItem = null;
		this.permissionDialog = null;
		this.previewDialog = null;
	}

	focusDialogInput() {
		window.setTimeout(() => this.regions.modal.querySelector("input")?.focus(), 0);
	}

	dialogValue() {
		return this.regions.modal.querySelector('[data-role="dialog-value"]').value.trim();
	}

	findItem(itemName) {
		if (!itemName) return null;
		if (this.state.root?.name === itemName) return this.state.root;
		return this.state.items.find((item) => item.name === itemName)
			|| Object.values(this.state.tree).flat().find((item) => item.name === itemName)
			|| (this.state.selected?.name === itemName ? this.state.selected : null);
	}

	canUpload() {
		return this.state.section === "my" && hasCapability(this.state.currentFolder, "upload");
	}

	sortOptions() {
		return { sortBy: this.state.sortBy, sortOrder: this.state.sortOrder };
	}

	toast(message, type = "info") {
		const toast = document.createElement("div");
		toast.className = `data-toast is-${type}`;
		toast.innerHTML = `${icon(type === "error" ? "warning" : "info")}<span></span>`;
		toast.querySelector("span").textContent = message;
		this.regions.toasts.appendChild(toast);
		window.setTimeout(() => toast.remove(), 3400);
	}
}
