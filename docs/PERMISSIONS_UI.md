# VaultDesk Permissions Management UI

## UX Description

The `Manage access` action opens a focused modal for a selected file or
folder. The dialog is intended for ERP sharing administration rather than
casual public-link sharing.

The modal is organized in four areas:

1. Owner header: displays the item's `business_owner` and makes clear that
   ownership is distinct from individual share rows.
2. Add access: switches between ERP `Users` and `Roles`, searches server-side,
   selects a principal and applies a business-readable permission level.
3. Direct access: lists grants created on this exact file/folder. Authorized
   managers may change a level or remove these grants.
4. Inherited access: lists rows flowing from parent folders, labelled with
   their source folder. They are visible context but controls are disabled.

Permission removal uses an inline confirmation step. Inherited grants are not
editable from a child dialog: the administrator must manage the source folder
or establish an intentional inheritance boundary.

## Permission Levels

The UI submits capability bundles to the backend:

| UI Level | Capabilities Sent | Notes |
| --- | --- | --- |
| `View only` | `view`, `download` | Allows preview/download of file content. |
| `Upload` | `view`, `download`, `upload` | Available for folders only. |
| `Edit` | `view`, `download`, `edit`, `move` | Rename and move, no trash. |
| `Delete` | `view`, `download`, `edit`, `move`, `delete` | Includes trash actions. |
| `Manage permissions` | All applicable capabilities | Folder grants also include upload. |

If a direct or inherited grant originated outside these presets, it is shown
as `Custom access` until a manager deliberately changes it to a preset.

## Component Structure

```text
public/vaultdesk/
  app.js
    Permission-dialog state and calls to API adapter
  api.js
    Live Frappe RPC mapping for overview/search/mutations
  mock_api.js
    Test users, roles, direct grants and inherited grants
  components/
    content.js
      Shared modal shell
    permissions.js
      Permission presets and Manage Access dialog renderer
  vaultdesk.css
    Modal layout, direct/inherited rows and responsive rules
```

## API Calls

| Interaction | Whitelisted Method | Security Requirement |
| --- | --- | --- |
| Open dialog | `vaultdesk.api.permissions.get_permission_overview(item)` | Owner, administrator or effective `manage_permissions` |
| Search user/role | `vaultdesk.api.permissions.search_principals(item, query, principal_type)` | Same management check before directory search |
| Add user | `add_user_permission(item, user, capabilities)` | Server verifies delegation rights |
| Add role | `add_role_permission(item, role, capabilities)` | Server verifies delegation rights |
| Change direct level | `update_permission(grant, capabilities)` | Server checks permission on grant's own item |
| Remove direct access | `remove_permission(grant)` | Server checks permission on grant's own item |

`get_permission_overview` returns:

```json
{
  "item": {
    "name": "data-item-id",
    "display_name": "Projects",
    "type": "folder",
    "business_owner": "owner@example.com",
    "break_inheritance": false
  },
  "can_manage_permissions": true,
  "direct_grants": [],
  "inherited_grants": [
    {
      "scope": "inherited",
      "editable": false,
      "source_item": { "name": "root-id", "display_name": "My Vault" }
    }
  ]
}
```

## Backend Validation Notes

- The UI never writes grants directly through DocType REST CRUD.
- Permission overview and user/role search require server-side management
  authorization; they are not public directory endpoints.
- Direct updates use the supplied grant ID only as a lookup key. The server
  reloads the grant and authorizes against its owning `VaultDesk Item`, preventing
  an editable child dialog from changing an inherited parent grant.
- The backend still restricts `upload` grants to folders.
- Non-administrators cannot grant capabilities they do not already possess.
- Inheritance boundaries must retain an explicit permission manager.
- By requested policy, `business_owner` is permitted to manage access. To
  revoke that authority completely, ownership must be transferred too.

## Isolated Demo

Serve `vaultdesk/public/vaultdesk/` over HTTP and open
`?permissions=1` to review the permissions dialog immediately using
mock users, roles, direct grants and inherited grants. Without the query
parameter the standalone VaultDesk page opens normally.
