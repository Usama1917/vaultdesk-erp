app_name = "vaultdesk"
app_title = "VaultDesk"
app_publisher = "VaultDesk Contributors"
app_description = "Secure internal document management module for ERPNext"
app_email = "developer@example.com"
app_license = "MIT"
app_version = "0.1.0"

required_apps = ["frappe"]

after_install = "vaultdesk.install.after_install"

# Hooks protect direct document reads in addition to explicit API checks.
permission_query_conditions = {
    "VaultDesk Item": "vaultdesk.services.security.get_permission_query_conditions",
}

has_permission = {
    "VaultDesk Item": "vaultdesk.services.security.has_doctype_permission",
}
