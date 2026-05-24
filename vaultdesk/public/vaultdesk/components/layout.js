import { icon } from "../utils.js";

export function renderShell(apiMode) {
	return `
		<section class="vaultdesk-shell" aria-label="VaultDesk file manager">
			<header class="data-header">
				<div class="data-title-group">
					<h1>VaultDesk</h1>
					<span class="data-mode-badge ${apiMode === "mock" ? "is-mock" : ""}">
						${apiMode === "mock" ? "Demo data" : "Live"}
					</span>
				</div>
				<label class="data-search" aria-label="Search files and folders">
					${icon("search")}
					<input type="search" data-role="search" placeholder="Search files and folders" autocomplete="off">
				</label>
				<div class="data-header-actions">
					<button class="data-btn data-btn-secondary" data-action="new-folder">
						${icon("plus")}<span>New Folder</span>
					</button>
					<button class="data-btn data-btn-primary" data-action="choose-upload">
						${icon("upload")}<span>Upload</span>
					</button>
				</div>
			</header>
			<div class="data-layout">
				<aside class="data-sidebar" aria-label="VaultDesk navigation">
					<nav class="data-navigation">
						<button class="data-nav-item is-active" data-action="section" data-section="my">
							${icon("home")}<span>My Vault</span>
						</button>
						<button class="data-nav-item" data-action="section" data-section="shared">
							${icon("shared")}<span>Shared with me</span>
						</button>
						<button class="data-nav-item" data-action="section" data-section="recent">
							${icon("recent")}<span>Recent</span>
						</button>
						<button class="data-nav-item" data-action="section" data-section="starred">
							${icon("star")}<span>Starred</span>
						</button>
						<button class="data-nav-item" data-action="section" data-section="trash">
							${icon("trash")}<span>Trash</span>
						</button>
					</nav>
					<div class="data-sidebar-heading">
						<span>Folders</span>
					</div>
					<div class="data-folder-tree" data-region="tree"></div>
				</aside>
				<main class="data-main">
					<div class="data-content-head">
						<nav class="data-breadcrumbs" data-region="breadcrumbs" aria-label="Breadcrumb"></nav>
						<div class="data-view-controls">
							<label class="data-sort">
								<span>Sort</span>
								<select data-role="sort">
									<option value="name:asc">Name</option>
									<option value="modified:desc">Last modified</option>
									<option value="size:desc">Size</option>
									<option value="type:asc">Type</option>
								</select>
							</label>
							<div class="data-view-toggle" role="group" aria-label="View mode">
								<button type="button" class="is-active" data-action="view" data-view="grid" aria-label="Grid view">
									${icon("grid")}
								</button>
								<button type="button" data-action="view" data-view="list" aria-label="List view">
									${icon("list")}
								</button>
							</div>
						</div>
					</div>
					<section class="data-drop-surface" data-region="drop-surface">
						<div class="data-drop-prompt">${icon("upload")} Drop files to upload</div>
						<div class="data-items" data-region="items"></div>
					</section>
				</main>
				<aside class="data-details" data-region="details" aria-label="File details"></aside>
			</div>
			<input data-role="file-input" type="file" multiple hidden>
			<div data-region="modal"></div>
			<div class="data-toast-stack" data-region="toasts" aria-live="polite"></div>
		</section>
	`;
}
