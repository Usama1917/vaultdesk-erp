frappe.pages["vaultdesk"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("VaultDesk"),
		single_column: true,
	});
	wrapper.vaultdeskPage = page;

	page.main.html('<div class="vaultdesk-mount"></div>');

	frappe.require("/assets/vaultdesk/vaultdesk/vaultdesk.css");
	import("/assets/vaultdesk/vaultdesk/app.js").then(({ mountVaultDesk }) => {
		const mount = page.main.get(0).querySelector(".vaultdesk-mount");
		page.vaultdeskApp = mountVaultDesk(mount, {
			apiMode: "live",
			frappePage: page,
		});
	});
};

frappe.pages["vaultdesk"].on_page_show = function (wrapper) {
	const page = wrapper.vaultdeskPage;
	if (page && page.vaultdeskApp) {
		page.vaultdeskApp.refresh();
	}
};
