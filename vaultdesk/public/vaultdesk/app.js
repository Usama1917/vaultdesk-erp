import { LiveVaultDeskApi } from "./api.js";
import { createI18n, detectInitialLanguage } from "./i18n.js";
import { MockVaultDeskApi } from "./mock_api.js";
import {
	renderBreadcrumbs,
	renderContextMenu,
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
import {
	renderVersionDeleteDialog,
	renderVersionDialog,
	renderVersionRestoreDialog,
} from "./components/versions.js";
import { debounce, hasCapability, icon } from "./utils.js";

export function mountVaultDesk(element, options = {}) {
	const app = new VaultDeskApp(element, options);
	app.initialize();
	return app;
}

class VaultDeskApp {
	constructor(element, options) {
		this.element = element;
		const mode = options.apiMode === "live" ? "live" : "mock";
		this.i18n = createI18n(options.language || detectInitialLanguage(mode));
		this.api = options.api || (mode === "live"
			? new LiveVaultDeskApi(this.i18n)
			: new MockVaultDeskApi(this.i18n));
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
		this.contentMotion = "is-entering";
		this.searchLater = debounce((value) => this.search(value), 260);
		this.principalSearchLater = debounce((value) => this.searchPrincipals(value), 240);
	}

	async initialize() {
		this.element.innerHTML = renderShell(this.api.mode, this.i18n);
		if (this.api.mode === "mock") {
			document.title = this.i18n.t("app.local_preview_title");
			document.documentElement.lang = this.i18n.language;
			document.documentElement.dir = this.i18n.dir;
		}
		this.regions = {
			items: this.element.querySelector('[data-region="items"]'),
			breadcrumbs: this.element.querySelector('[data-region="breadcrumbs"]'),
			tree: this.element.querySelector('[data-region="tree"]'),
			details: this.element.querySelector('[data-region="details"]'),
			modal: this.element.querySelector('[data-region="modal"]'),
			contextMenu: this.element.querySelector('[data-region="context-menu"]'),
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
			if (!target) {
				this.closeContextMenu();
				return;
			}
			if (target.classList.contains("data-modal-backdrop") && event.target !== target) return;
			event.preventDefault();
			this.handleAction(target.dataset.action, target);
			this.closeContextMenu();
		});

		this.element.addEventListener("contextmenu", (event) => {
			if (event.target.closest(".data-modal, .data-menu, .data-context-menu")) return;
			const itemTarget = event.target.closest("[data-context-item]");
			if (itemTarget) {
				event.preventDefault();
				this.openItemContextMenu(this.findItem(itemTarget.dataset.contextItem), event);
				return;
			}
			if (event.target.closest('[data-region="drop-surface"], [data-region="items"]')) {
				event.preventDefault();
				this.openWorkspaceContextMenu(event);
			}
		});

		document.addEventListener("keydown", (event) => {
			if (event.key === "Escape") this.closeContextMenu();
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
			if (event.target.dataset.role === "language") {
				this.changeLanguage(event.target.value);
				return;
			}
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

		this.element.querySelector('[data-role="version-file-input"]').addEventListener("change", (event) => {
			const file = Array.from(event.target.files || [])[0];
			event.target.value = "";
			if (file && this.versionUploadItem) this.uploadVersion(this.versionUploadItem, file);
			this.versionUploadItem = null;
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
			if (!this.canUpload()) return this.toast(this.i18n.t("toast.no_upload"), "warning");
			const files = Array.from(event.dataTransfer.files || []);
			if (files.length) this.upload(files);
		});
	}

	async loadRoot() {
		this.startLoading();
		try {
			const spaces = await this.api.getSpaces();
			if (!spaces.length) throw new Error(this.i18n.t("error.no_space"));
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
			refresh: () => this.refresh(),
			"set-sort": () => this.setSort(target.dataset.sort),
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
			copy: () => this.copyItem(item),
			trash: () => this.confirmTrash(item),
			restore: () => this.restore(item),
			star: () => this.star(item),
			share: () => this.share(item),
			versions: () => this.openVersions(item),
			"choose-version-upload": () => this.chooseVersionUpload(item || this.versionDialog?.item),
			"restore-version": () => this.askRestoreVersion(target.dataset.version),
			"confirm-restore-version": () => this.restoreVersion(target.dataset.version),
			"delete-version": () => this.askDeleteVersion(target.dataset.version),
			"confirm-delete-version": () => this.deleteVersion(target.dataset.version),
			"toggle-version-protection": () => this.toggleVersionProtection(
				target.dataset.version,
				target.dataset.protected === "1"
			),
			"back-versions": () => this.renderVersions(true),
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
		const nextView = view === "list" ? "list" : "grid";
		if (nextView === this.state.view) return;
		this.state.view = nextView;
		window.localStorage.setItem("vaultdesk-view", this.state.view);
		this.syncViewControls();
		this.contentMotion = "is-switching-view";
		this.renderContent();
	}

	setSort(value) {
		const select = this.element.querySelector('[data-role="sort"]');
		if (!select || !value) return;
		select.value = value;
		const [sortBy, sortOrder] = value.split(":");
		this.state.sortBy = sortBy;
		this.state.sortOrder = sortOrder;
		this.refresh();
	}

	changeLanguage(language) {
		if (this.api.mode !== "mock") return;
		window.localStorage.setItem("vaultdesk-language", language);
		const url = new URL(window.location.href);
		url.searchParams.set("lang", language);
		window.location.assign(url.toString());
	}

	select(item) {
		this.state.selected = item;
		this.renderContent();
		this.regions.details.innerHTML = renderDetails(item, {
			supportsVersions: this.supportsVersions(),
			i18n: this.i18n,
		});
		this.regions.details.classList.toggle("is-open", Boolean(item));
		if (item) this.restartMotion(this.regions.details, "is-updating");
	}

	chooseUpload() {
		if (!this.canUpload()) {
			return this.toast(this.i18n.t("toast.no_upload"), "warning");
		}
		this.element.querySelector('[data-role="file-input"]').click();
	}

	newFolder() {
		if (!this.canUpload()) {
			return this.toast(this.i18n.t("toast.no_create_folder"), "warning");
		}
		this.setModalContent(renderFormDialog(
			this.i18n.t("dialog.new_folder"),
			this.i18n.t("dialog.folder_name"),
			"",
			"confirm-folder",
			this.i18n.t("action.create"),
			this.i18n
		), true);
		this.focusDialogInput();
	}

	async confirmNewFolder() {
		const name = this.dialogValue();
		if (!name) return this.toast(this.i18n.t("toast.enter_folder"), "warning");
		await this.perform(
			() => this.api.createFolder(this.state.currentFolder.name, name),
			this.i18n.t("toast.folder_created"),
			true
		);
	}

	rename(item) {
		if (!hasCapability(item, "edit")) return;
		this.state.dialogItem = item;
		this.setModalContent(renderFormDialog(
			this.i18n.t(item.type === "folder" ? "dialog.rename_folder" : "dialog.rename_file"),
			this.i18n.t("dialog.new_name"),
			item.display_name,
			"confirm-rename",
			this.i18n.t("action.rename"),
			this.i18n
		), true);
		this.focusDialogInput();
	}

	async confirmRename() {
		const name = this.dialogValue();
		if (!name) return this.toast(this.i18n.t("toast.enter_name"), "warning");
		await this.perform(() => this.api.renameItem(this.state.dialogItem, name), this.i18n.t("toast.item_renamed"), true);
	}

	async move(item) {
		if (!hasCapability(item, "move")) return;
		this.state.dialogItem = item;
		try {
			const folders = this.api.getAllFolders
				? await this.api.getAllFolders()
				: [this.state.root, ...Object.values(this.state.tree).flat()];
			this.setModalContent(renderMoveDialog(item, folders, this.i18n), true);
		} catch (error) {
			this.toast(error.message, "error");
		}
	}

	async confirmMove(item) {
		const destination = this.regions.modal.querySelector('[data-role="destination"]').value;
		await this.perform(() => this.api.moveItem(item, destination), this.i18n.t("toast.item_moved"), true);
	}

	async copyItem(item) {
		if (!item || !this.canCopy(item)) return;
		await this.perform(
			() => this.api.copyItem(item, this.state.currentFolder.name),
			this.i18n.t("toast.copy_created"),
			false
		);
	}

	confirmTrash(item) {
		if (!hasCapability(item, "delete")) return;
		this.setModalContent(renderDeleteDialog(item, this.i18n), true);
	}

	async trash(item) {
		await this.perform(() => this.api.trashItem(item), this.i18n.t("toast.moved_trash"), true);
	}

	async restore(item) {
		await this.perform(() => this.api.restoreItem(item), this.i18n.t("toast.item_restored"), true);
	}

	async star(item) {
		await this.perform(
			() => this.api.setStarred(item, !item.is_starred),
			this.i18n.t(item.is_starred ? "toast.removed_starred" : "toast.added_starred"),
			false
		);
	}

	async openVersions(item) {
		if (!item || item.type !== "file" || !this.supportsVersions() || !hasCapability(item, "view")) return;
		try {
			this.versionDialog = {
				item,
				versions: await this.api.getVersions(item),
				uploading: false,
				highlightVersion: null,
			};
			this.renderVersions(true);
		} catch (error) {
			this.toast(error.message || this.i18n.t("toast.version_load_failed"), "error");
		}
	}

	renderVersions(animate = false) {
		if (!this.versionDialog) return;
		const item = this.versionDialog.item;
		this.setModalContent(renderVersionDialog(item, this.versionDialog.versions, {
			canEdit: hasCapability(item, "edit"),
			canDelete: hasCapability(item, "delete"),
			canProtect: hasCapability(item, "manage_permissions"),
			uploading: this.versionDialog.uploading,
			highlightVersion: this.versionDialog.highlightVersion,
		}, this.i18n), animate);
	}

	chooseVersionUpload(item) {
		if (!item || !this.supportsVersions() || !hasCapability(item, "edit")) return;
		this.versionUploadItem = item;
		this.element.querySelector('[data-role="version-file-input"]').click();
	}

	async uploadVersion(item, file) {
		if (this.versionDialog) {
			this.versionDialog.uploading = true;
			this.renderVersions();
		}
		try {
			const version = await this.api.uploadNewVersion(item, file);
			await this.refreshVersionDialog(item.name, this.i18n.t("toast.version_uploaded"), version.name);
		} catch (error) {
			if (this.versionDialog) {
				this.versionDialog.uploading = false;
				this.renderVersions();
			}
			this.toast(error.message || this.i18n.t("toast.version_upload_failed"), "error");
		}
	}

	askRestoreVersion(versionName) {
		if (!this.versionDialog) return;
		const version = this.versionDialog.versions.find((entry) => entry.name === versionName);
		if (!version || version.is_current) return;
		this.setModalContent(renderVersionRestoreDialog(this.versionDialog.item, version, this.i18n), true);
	}

	async restoreVersion(versionName) {
		if (!this.versionDialog) return;
		try {
			const version = await this.api.restoreVersion(this.versionDialog.item, versionName);
			await this.refreshVersionDialog(
				this.versionDialog.item.name,
				this.i18n.t("toast.version_restored"),
				version.name
			);
		} catch (error) {
			this.toast(error.message || this.i18n.t("toast.version_restore_failed"), "error");
		}
	}

	askDeleteVersion(versionName) {
		if (!this.versionDialog) return;
		const version = this.versionDialog.versions.find((entry) => entry.name === versionName);
		if (!version || version.is_current || version.is_protected) return;
		this.setModalContent(renderVersionDeleteDialog(this.versionDialog.item, version, this.i18n), true);
	}

	async deleteVersion(versionName) {
		if (!this.versionDialog) return;
		try {
			await this.api.deleteVersion(this.versionDialog.item, versionName);
			await this.refreshVersionDialog(this.versionDialog.item.name, this.i18n.t("toast.version_deleted"));
		} catch (error) {
			this.toast(error.message || this.i18n.t("toast.version_delete_failed"), "error");
			this.renderVersions();
		}
	}

	async toggleVersionProtection(versionName, isProtected) {
		if (!this.versionDialog) return;
		try {
			await this.api.setVersionProtected(this.versionDialog.item, versionName, isProtected);
			await this.refreshVersionDialog(
				this.versionDialog.item.name,
				this.i18n.t(isProtected ? "toast.version_protected" : "toast.version_unlocked")
			);
		} catch (error) {
			this.toast(error.message || this.i18n.t("toast.version_protection_failed"), "error");
		}
	}

	async refreshVersionDialog(itemName, message, highlightVersion = null) {
		await this.refresh();
		const item = this.api.clone ? this.api.clone(itemName) : this.findItem(itemName);
		if (!item) {
			this.closeModal();
			this.toast(message, "success");
			return;
		}
		this.versionDialog = {
			item,
			versions: await this.api.getVersions(item),
			uploading: false,
			highlightVersion,
		};
		this.renderVersions();
		if (highlightVersion) {
			window.setTimeout(() => {
				if (this.versionDialog?.highlightVersion === highlightVersion) {
					this.versionDialog.highlightVersion = null;
				}
			}, 700);
		}
		this.toast(message, "success");
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
			this.renderPermissionManager(true);
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
		if (!state?.selectedPrincipal) return this.toast(this.i18n.t("toast.select_principal"), "warning");
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
			await this.finishPermissionMutation(this.i18n.t("toast.access_added"));
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
			await this.finishPermissionMutation(this.i18n.t("toast.permission_updated"));
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
			await this.finishPermissionMutation(this.i18n.t("toast.access_removed"));
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
			this.toast(this.i18n.t("toast.reopen_access", { message }), "success");
		}
	}

	async reloadPermissionOverview() {
		if (!this.permissionDialog) return;
		this.permissionDialog.overview = await this.api.getPermissionOverview(this.permissionDialog.item);
	}

	renderPermissionManager(animate = false) {
		if (!this.permissionDialog) return;
		this.setModalContent(renderPermissionDialog(
			this.permissionDialog.item,
			this.permissionDialog.overview,
			this.permissionDialog,
			this.i18n
		), animate);
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
		const animateOpen = !this.previewDialog;
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
		this.renderPreviewManager(animateOpen);
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
				this.previewDialog.error = this.i18n.t("toast.content_denied");
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
			this.previewDialog.error = error.message || this.i18n.t("toast.preview_failed");
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

	renderPreviewManager(animate = false) {
		if (!this.previewDialog) return;
		this.setModalContent(renderPreviewDialog(this.previewDialog, this.i18n), animate);
	}

	isCurrentPreview(token) {
		return Boolean(this.previewDialog && this.previewDialog.token === token);
	}

	disposePreviewContent() {
		if (this.previewDialog?.dispose) this.previewDialog.dispose();
	}

	async upload(files) {
		if (!this.canUpload()) return;
		this.toast(this.i18n.t(files.length === 1 ? "toast.uploading_one" : "toast.uploading_many", {
			count: files.length,
		}), "info");
		await this.perform(
			() => this.api.uploadFiles(this.state.currentFolder.name, files),
			this.i18n.t("toast.upload_completed"),
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
			this.toast(error.message || this.i18n.t("toast.operation_failed"), "error");
		}
	}

	startLoading() {
		this.state.loading = true;
		this.state.error = null;
		this.contentMotion = "is-loading";
		this.render();
	}

	finishLoading() {
		this.state.loading = false;
		this.state.error = null;
		this.contentMotion = "is-entering";
		this.render();
	}

	fail(error) {
		this.state.loading = false;
		this.state.error = error.message || this.i18n.t("toast.load_failed");
		this.contentMotion = "is-entering";
		this.render();
	}

	render() {
		this.renderContent();
		this.regions.breadcrumbs.innerHTML = renderBreadcrumbs(
			this.state.breadcrumbs,
			this.i18n.t(`section.${this.state.section}`)
		);
		this.regions.tree.innerHTML = renderTree(this.state.root, this.state.tree, this.state.currentFolder?.name, this.i18n);
		this.regions.details.innerHTML = renderDetails(this.state.selected, {
			supportsVersions: this.supportsVersions(),
			i18n: this.i18n,
		});
		this.regions.details.classList.toggle("is-open", Boolean(this.state.selected));
		this.updateActions();
		this.syncViewControls();
	}

	renderContent() {
		const motionClass = this.contentMotion;
		this.contentMotion = "";
		if (this.state.loading) {
			this.regions.items.innerHTML = renderLoading(this.state.view, this.i18n, motionClass);
			return;
		}
		if (this.state.error) {
			this.regions.items.innerHTML = renderError(this.state.error, this.i18n, motionClass);
			return;
		}
		this.regions.items.innerHTML = renderItems(this.state.items, {
			section: this.state.section,
			view: this.state.view,
			selected: this.state.selected?.name,
			canUpload: this.canUpload(),
			supportsVersions: this.supportsVersions(),
		}, this.i18n, motionClass);
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

	openWorkspaceContextMenu(event) {
		const t = this.i18n.t;
		const entries = [
			this.contextEntry("new-folder", t("action.new_folder"), "plus", null, !this.canUpload()),
			this.contextEntry("choose-upload", t("action.upload_file"), "upload", null, !this.canUpload()),
			{ separator: true },
			this.contextEntry("refresh", t("action.refresh"), "refresh"),
			this.contextEntry("set-sort", t("sort.menu_name"), "list", { sort: "name:asc" }),
			this.contextEntry("set-sort", t("sort.menu_modified"), "recent", { sort: "modified:desc" }),
			{ separator: true },
			this.contextEntry("view", t("view.grid"), "grid", { view: "grid" }),
			this.contextEntry("view", t("view.list"), "list", { view: "list" }),
		];
		this.markContextTarget(this.regions.drop);
		this.showContextMenu(entries, event.clientX, event.clientY);
	}

	openItemContextMenu(item, event) {
		if (!item) return;
		this.markContextTarget(event.target.closest("[data-context-item]"));
		const t = this.i18n.t;
		const entries = [];
		if (item.type === "folder") {
			entries.push(this.contextEntry("open-folder", t("action.open"), "folder", { id: item.name }));
		} else {
			entries.push(this.contextEntry("preview", t("action.preview"), "info", { id: item.name }, !hasCapability(item, "view")));
			entries.push(this.contextEntry("download", t("action.download"), "download", { id: item.name }, !hasCapability(item, "download")));
		}
		entries.push({ separator: true });
		entries.push(this.contextEntry("rename", t("action.rename"), "edit", { id: item.name }, !this.canChangeItem(item, "edit")));
		entries.push(this.contextEntry("move", t("action.move"), "move", { id: item.name }, !this.canChangeItem(item, "move")));
		entries.push(this.contextEntry("copy", t("action.copy"), "copy", { id: item.name }, !this.canCopy(item)));
		entries.push(this.contextEntry("trash", t("action.delete"), "trash", { id: item.name }, !this.canChangeItem(item, "delete")));
		if (item.type === "file" && this.supportsVersions()) {
			entries.push({ separator: true });
			entries.push(this.contextEntry("versions", t("action.manage_versions"), "history", { id: item.name }, !hasCapability(item, "view")));
			entries.push(this.contextEntry(
				"choose-version-upload",
				t("action.upload_new_version"),
				"upload",
				{ id: item.name },
				!hasCapability(item, "edit")
			));
		}
		entries.push({ separator: true });
		entries.push(this.contextEntry("share", t("action.share_manage_access"), "share", { id: item.name }, !hasCapability(item, "manage_permissions")));
		entries.push(this.contextEntry("details", t("action.details"), "info", { id: item.name }));
		this.showContextMenu(entries, event.clientX, event.clientY);
	}

	contextEntry(action, label, iconName, values = {}, disabled = false) {
		return { action, label, icon: iconName, disabled, ...(values || {}) };
	}

	showContextMenu(entries, left, top) {
		this.regions.contextMenu.innerHTML = renderContextMenu(entries, this.i18n);
		const menu = this.regions.contextMenu.firstElementChild;
		if (!menu) return;
		const maxLeft = window.innerWidth - 248;
		const maxTop = window.innerHeight - Math.min(menu.offsetHeight || 430, 430) - 8;
		menu.style.left = `${Math.max(8, Math.min(left, maxLeft))}px`;
		menu.style.top = `${Math.max(8, Math.min(top, maxTop))}px`;
	}

	markContextTarget(target) {
		this.element.querySelectorAll(".is-context-target").forEach((node) => node.classList.remove("is-context-target"));
		if (target) this.restartMotion(target, "is-context-target");
	}

	closeContextMenu() {
		if (this.regions?.contextMenu) this.regions.contextMenu.innerHTML = "";
		this.element.querySelectorAll(".is-context-target").forEach((node) => node.classList.remove("is-context-target"));
	}

	toggleMenu(itemName) {
		this.element.querySelectorAll(".data-menu").forEach((menu) => {
			if (menu.dataset.menu !== itemName) menu.hidden = true;
		});
		const menu = this.element.querySelector(`[data-menu="${CSS.escape(itemName)}"]`);
		if (menu) menu.hidden = !menu.hidden;
	}

	setModalContent(content, animate = false) {
		this.regions.modal.classList.remove("is-opening", "is-closing");
		this.regions.modal.innerHTML = content;
		if (animate) this.restartMotion(this.regions.modal, "is-opening");
	}

	closeModal() {
		if (!this.regions.modal.firstElementChild) return;
		if (this.prefersReducedMotion()) {
			this.clearModal();
			return;
		}
		const closingNode = this.regions.modal.firstElementChild;
		this.regions.modal.classList.remove("is-opening");
		this.regions.modal.classList.add("is-closing");
		window.setTimeout(() => {
			if (this.regions.modal.firstElementChild === closingNode) this.clearModal();
		}, 180);
	}

	clearModal() {
		this.disposePreviewContent();
		this.regions.modal.classList.remove("is-opening", "is-closing");
		this.regions.modal.innerHTML = "";
		this.state.dialogItem = null;
		this.permissionDialog = null;
		this.previewDialog = null;
		this.versionDialog = null;
	}

	restartMotion(element, className) {
		if (!element) return;
		element.classList.remove(className);
		void element.offsetWidth;
		element.classList.add(className);
	}

	prefersReducedMotion() {
		return Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
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
			|| this.state.breadcrumbs.find((item) => item.name === itemName)
			|| (this.state.currentFolder?.name === itemName ? this.state.currentFolder : null)
			|| (this.state.selected?.name === itemName ? this.state.selected : null);
	}

	canUpload() {
		return this.state.section === "my" && hasCapability(this.state.currentFolder, "upload");
	}

	canCopy(item) {
		return Boolean(
			item
			&& item.name !== "root"
			&& item.name !== this.state.currentFolder?.name
			&& this.state.section === "my"
			&& this.canUpload()
			&& typeof this.api.copyItem === "function"
		);
	}

	canChangeItem(item, capability) {
		return Boolean(item && item.name !== "root" && hasCapability(item, capability));
	}

	supportsVersions() {
		return this.api.mode === "mock" && typeof this.api.getVersions === "function";
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
		window.setTimeout(() => {
			if (this.prefersReducedMotion()) {
				toast.remove();
				return;
			}
			toast.classList.add("is-leaving");
			window.setTimeout(() => toast.remove(), 180);
		}, 3220);
	}
}
