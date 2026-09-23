# BUKLOD BSOC — Closed-Loop Self-Heal R1

Canonical flow:

**DETECT → DIAGNOSE → HEAL → VERIFY → ESCALATE ONLY IF UNRESOLVED**

This source set corresponds to production migrations:

- `20260922152203_bsoc_closed_loop_self_heal_foundation_r12.sql`
- `20260922152536_bsoc_closed_loop_self_heal_engine_r13.sql`
- `20260922152723_bsoc_closed_loop_self_heal_correlation_readmodels_r14.sql`

## Safety contract

- App-level local self-heal runs first.
- BSOC remote self-heal is restricted to named, versioned, LOW-risk playbooks.
- New remote playbooks remain **SHADOW** by default.
- A playbook cannot execute unless it is enabled, QA-verified, executor-ready, and not kill-switched.
- Financial, payout, role, security, account-delete, ownership, break-glass, destructive, or irreversible mutations never auto-run.
- `AUTO_HEALED` is impossible without a successful verification record.
- Known/system-wide incidents suppress per-user recovery storms.
- User health data is operational metadata only; private app content is not part of the health contract.
- Main/other client apps must keep working if BSOC is unavailable.

## Production Phase A verification

The R12–R14 production foundation was tested using a single transaction with a full rollback. The following passed:

1. **Stale session** — safe recovery command path reached verification and only then became `AUTO_HEALED`.
2. **50-user same-signature event storm** — one correlated incident cluster, all affected events linked, no individual recovery storm, no ticket explosion.
3. **Financial mutation signature** — automatic recovery denied; human-controlled path only.
4. **Security/account lock** — automatic recovery denied.
5. **Private content boundary** — unsafe/private text could not be accepted as route metadata and the health table contains no private-content payload fields.
6. **Failed verification** — recovery state became `RECOVERY_FAILED`, never `AUTO_HEALED`.

The QA transaction was rolled back; it made no persistent synthetic incidents, cases, playbook-mode changes, or health events.

## Release rule

Do not enable remote playbooks merely because the database engine exists.

Required before any production playbook is changed from SHADOW:

1. client executor implementation;
2. client account/user isolation test;
3. offline / weak-network test;
4. exact verification-evidence test;
5. repeated-command/cooldown test;
6. privacy inspection;
7. native E2E;
8. kill-switch verification.

Risky actions always remain human-controlled.
