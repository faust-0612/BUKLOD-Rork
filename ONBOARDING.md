# BUKLOD Registration & Onboarding Workflow

```text
CREATE ACCOUNT
   ↓
Personal Information
   ↓
Choose Local Church
   ↓
Account created as MEMBER only
   ↓
PENDING CHURCH JOIN REQUEST
   ↓
Pastor / Local Admin reviews
   ↓
Assign BUKLOD Group
   ↓
APPROVE
   ↓
Profile church_id updated
Group membership created
Member notification created
Audit log written
   ↓
FULL BUKLOD ACCESS
```

## Security decisions

1. Registration never accepts a requested application role. The database default is `member`.
2. Role promotion is done only through `set_user_role(...)`, which requires `system_admin`.
3. A new member may request a church, but cannot self-assign a BUKLOD group.
4. Approval is atomic through `approve_join_request(...)`.
5. The approval RPC verifies that the assigned group belongs to the requested church.
6. Member profile updates no longer permit direct editing of `role`, `church_id`, or `is_active`.
7. Pending members are routed to the onboarding status screen and are blocked from the main tabs.
8. A group leader can approve only a request already preassigned to that leader's exact group; pastor/local admin can approve within their own church.
