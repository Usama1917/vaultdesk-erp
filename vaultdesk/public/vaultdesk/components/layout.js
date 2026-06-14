import { icon } from "../utils.js";

export function renderShell(apiMode, i18n) {
	const t = i18n.t;
	return `
		<section class="vaultdesk-shell" lang="${i18n.language}" dir="${i18n.dir}" aria-label="${t("app.aria")}">
			<header class="data-header">
				<div class="data-title-group">
					<h1>${t("app.name")}</h1>
					<span class="data-mode-badge ${apiMode === "mock" ? "is-mock" : ""}">
						${apiMode === "mock" ? t("mode.mock") : t("mode.live")}
					</span>
				</div>
				<label class="data-search" aria-label="${t("search.label")}">
					${icon("search")}
					<input type="search" data-role="search" placeholder="${t("search.placeholder")}" autocomplete="off">
				</label>
				<div class="data-header-actions">
					<button class="data-btn data-btn-secondary" data-action="new-folder">
						${icon("plus")}<span>${t("action.new_folder")}</span>
					</button>
					<button class="data-btn data-btn-primary" data-action="choose-upload">
						${icon("upload")}<span>${t("action.upload")}</span>
					</button>
					<button type="button" class="data-btn data-btn-secondary data-theme-toggle" data-action="toggle-theme" data-role="theme-toggle" aria-label="${t("theme.to_dark")}" title="${t("theme.to_dark")}">
						${icon("moon")}
					</button>
					${apiMode === "mock" ? `
						<label class="data-language" aria-label="${t("language.label")}">
							<select data-role="language">
								<option value="en" ${i18n.language === "en" ? "selected" : ""}>${t("language.english")}</option>
								<option value="ar" ${i18n.language === "ar" ? "selected" : ""}>${t("language.arabic")}</option>
							</select>
						</label>` : ""}
				</div>
			</header>
			<div class="data-layout">
				<aside class="data-sidebar" aria-label="${t("nav.aria")}">
					<nav class="data-navigation">
						<button class="data-nav-item is-active" data-action="section" data-section="my">
							${icon("home")}<span>${t("section.my")}</span>
						</button>
						<button class="data-nav-item" data-action="section" data-section="shared">
							${icon("shared")}<span>${t("section.shared")}</span>
						</button>
						<button class="data-nav-item" data-action="section" data-section="recent">
							${icon("recent")}<span>${t("section.recent")}</span>
						</button>
						<button class="data-nav-item" data-action="section" data-section="starred">
							${icon("star")}<span>${t("section.starred")}</span>
						</button>
						<button class="data-nav-item" data-action="section" data-section="trash">
							${icon("trash")}<span>${t("section.trash")}</span>
						</button>
					</nav>
					<div class="data-sidebar-heading">
						<span>${t("nav.folders")}</span>
					</div>
					<div class="data-folder-tree" data-region="tree"></div>
				</aside>
				<main class="data-main">
					<div class="data-content-head">
						<nav class="data-breadcrumbs" data-region="breadcrumbs" aria-label="${t("nav.breadcrumb")}"></nav>
						<div class="data-view-controls">
							<label class="data-sort">
								<span>${t("sort.label")}</span>
								<select data-role="sort">
									<option value="name:asc">${t("sort.name")}</option>
									<option value="modified:desc">${t("sort.modified")}</option>
									<option value="size:desc">${t("sort.size")}</option>
									<option value="type:asc">${t("sort.type")}</option>
								</select>
							</label>
							<div class="data-view-toggle" role="group" aria-label="${t("view.aria")}">
								<span class="data-view-toggle-indicator" aria-hidden="true"></span>
								<button type="button" class="is-active" data-action="view" data-view="grid" aria-label="${t("view.grid")}">
									${icon("grid")}
								</button>
								<button type="button" data-action="view" data-view="list" aria-label="${t("view.list")}">
									${icon("list")}
								</button>
								<button type="button" data-action="view" data-view="columns" aria-label="${t("view.columns")}">
									${icon("columns")}
								</button>
							</div>
						</div>
					</div>
					<section class="data-drop-surface" data-region="drop-surface">
						<div class="data-drop-prompt">${icon("upload")} ${t("drop.prompt")}</div>
						<div class="data-items" data-region="items"></div>
					</section>
				</main>
				<aside class="data-details" data-region="details" aria-label="${t("preview.file_details")}"></aside>
			</div>
			<input data-role="file-input" type="file" multiple hidden>
			<input data-role="version-file-input" type="file" hidden>
			<div data-region="modal"></div>
			<div data-region="context-menu"></div>
			<div class="data-toast-stack" data-region="toasts" aria-live="polite"></div>
		</section>
	`;
}
