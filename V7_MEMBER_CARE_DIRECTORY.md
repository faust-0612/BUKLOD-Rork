# BUKLOD v7 — Directory, Family/Household, Member Care & Visitor Journey

## Church Directory

Members can browse people in their approved local church, subject to the directory
privacy selected by each member.

A member can choose:
- `church` — visible to local church members
- `leaders` — visible only to authorized leaders
- `private` — hidden from ordinary directory users

Optional fields:
- mobile number
- birthday month/day
- household
- ministries

The directory RPC deliberately returns only the fields allowed by those preferences.

## Household / Family Links

Households allow the local church to connect members as:
- head
- spouse
- child
- parent
- sibling
- relative
- other

This is intended for church-care context, not as a legal family registry.

## Important Dates

The database supports:
- birthday
- anniversary
- baptism
- membership date
- other important dates

Each record has its own visibility.

## Pastoral Care Profile

Pastor/local admin/system admin can open a member care profile with:
- household context
- devotional participation summary
- active learning tracks
- open pastoral follow-ups
- private pastoral care notes

Pastoral notes are intentionally restricted. They are not shown in the church directory,
member profile, community, or ordinary leader screens.

### Data-minimization rule

Pastoral notes should contain only information reasonably necessary for pastoral care.
Avoid unnecessary diagnoses, rumors, intimate details, or information unrelated to the
care purpose.

BUKLOD is a ministry tool, not a confidential psychotherapy/medical record system.

## Visitor / New Member Journey

Visitor stages:
1. New Visitor
2. Returning
3. Follow-up
4. Bible Study
5. Membership Interest
6. Onboarding
7. Member
8. Inactive

Visitor records support:
- first visit date
- mobile/email
- inviter
- consent to follow-up contact
- visit history
- assigned follow-up
- status/history foundation

Follow-up contact should only be performed when appropriate permission/consent exists.

## Privacy model

- directory privacy is member-controlled
- households are church-scoped
- pastoral care notes are pastoral-team data
- visitor data is restricted to pastoral/admin users and assigned follow-up personnel
- sensitive pastoral records are not surfaced through ordinary directory RPCs
- privileged note creation is audit logged

Before public deployment, the ministry should publish a clear privacy notice explaining:
what data BUKLOD collects, why it collects it, who can see it, retention periods, and
how members can request correction/deletion.
