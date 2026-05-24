# VaultDesk Security Test Plan

Run these cases on an isolated Frappe test site before integrating a UI.

| Scenario | Expected Result |
| --- | --- |
| User without root grant calls `get_spaces` | Space is not returned |
| User guesses a VaultDesk Item ID and requests details | Permission failure; no metadata/content |
| User guesses native private file URL | Frappe denies private file access |
| Administrator attempts to configure a normal storage owner | Settings validation refuses it |
| Stored native `File` is attached manually to an ERP document | VaultDesk preview/download refuse it |
| Uploader later loses inherited folder access | Download and preview fail immediately |
| Administrator deactivates a VaultDesk Space | Direct item, preview and download APIs deny access until reactivated |
| View-only user attempts upload/rename/move/delete/share | Each mutation is denied |
| Item business owner without ordinary ACL grant manages sharing | Permission update is permitted by owner policy only |
| Non-manager calls permission overview or principal search | Request is denied; user/role directory is not disclosed |
| Child manager attempts to update an inherited parent grant ID | Parent-level authorization is rechecked and request is denied |
| Upload-only folder grant is created | Service also grants metadata view as required |
| Restricted subfolder has no explicit manager | Enabling inheritance boundary is refused |
| Restricted subfolder has explicit manager then breaks inheritance | Parent-only users cannot list/search descendants |
| Role grant removed while a user has a recent/starred record | Recent/starred API no longer returns item |
| User moves a file to a folder without upload permission | Move is denied |
| User moves a folder into itself/descendant | Move is denied |
| User restores a file into a destination without upload access | Restore is denied |
| User trashes/restores a parent containing a restricted child boundary | Operation is denied without changing descendants |
| Extension allowlist is blank | Upload is rejected until configured |
| Non-previewable MIME type is requested inline | Preview fails; authorized download remains available |
| Visible file without `download` is opened in preview | Sanitized metadata may display; byte endpoint denies content |
| HTML/JS file is previewed | Response is forced plain text and UI escapes source; no uploaded markup/script executes |
| Access is revoked after preview metadata loads | Subsequent preview byte fetch is denied; modal shows access denied |
| Direct generic write to `VaultDesk Item` or `VaultDesk Permission` | Controller rejects the write |
| Permission/add/remove, move, trash, preview, download | Appropriate activity event is written |

For high assurance, add automated integration tests inside the target bench
once the Frappe/ERPNext version and deployment authentication method are fixed.
