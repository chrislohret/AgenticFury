# Power Automate Notification Flows — Design

> **Status:** Design specification. These flows are **server-side cloud flows** that live in
> the Power Platform environment alongside the AgenticFury solution. They are **not** part of
> the Code App bundle and require no in-app Outlook/Teams connector. Build them in the maker
> portal (or import as solution components) against the live Dataverse tables.

## Why Power Automate (not in-app)

Notifications are triggered by data changes that can originate from the app **or** from any
other channel (model-driven app, bulk edit, API). Driving them from Dataverse table events
guarantees every status change and assignment is captured exactly once, server-side, without
the app needing an open session. This keeps the Code App focused on UX and avoids embedding
mail/Teams credentials in the client bundle.

## Shared facts

| Item | Value |
| --- | --- |
| Environment ID | `531d75e6-c77e-e589-9297-2e8227a6600f` |
| Org URL | `https://orgf2352485.crm.dynamics.com` |
| Idea table (logical) | `afp_idearequirement` (set `afp_idearequirements`) |
| Assigned reviewer lookup | `afp_assignedreviewer` → `systemuser` |
| Status column | `statuscode` (Status Reason) |
| Realization table | `afp_idearealization` |

### `statuscode` values (from `src/constants/ideaStatus.ts`)

| Label | Value |
| --- | --- |
| Draft | 100000000 |
| Submitted | 100000001 |
| Under Review | 100000002 |
| Approved | 100000003 |
| Rejected | 100000004 |
| On Hold | 100000005 |
| In Progress | 100000006 |
| Completed | 100000007 |

### Recipients

- **CoE team** — members of the AI CoE Team (`afp_aicoeteammembers`, lookup `afp_memberid` →
  `systemuser`). Resolve email via the related `systemuser.internalemailaddress`.
- **Submitter** — the idea's `createdby` (`systemuser`).
- **Assigned reviewer** — `afp_assignedreviewer` (`systemuser`).

Each flow should prefer a **Teams** message (adaptive card) with an **email** fallback, or send
both, depending on tenant preference. The card's primary action deep-links to the record:
`https://apps.powerapps.com/play/e/531d75e6-c77e-e589-9297-2e8227a6600f/app/8a9fdb7f-43cb-4fed-b317-40640ee76e8c?tenantId=d92190b9-98e7-46da-8b11-580e06c7d15d#/submissions/<recordId>`
(the app uses `HashRouter`, so the in-app route is after `#`).

---

## Flow 1 — New idea submitted → notify CoE team

**Trigger:** Dataverse → *When a row is added, modified or deleted*
- Change type: **Added**
- Table: `afp_idearequirement`
- Scope: Organization

**Filter / condition:**
- `statuscode` equals `100000001` (Submitted).
  - Many ideas are created as **Draft** (100000000) and submitted later, so also implement
    **Flow 1b** (below) for the Draft→Submitted modify path. Keep both behind a shared child
    flow to avoid duplicating the notification body.

**Actions:**
1. List CoE team members (`afp_aicoeteammembers`) and expand `afp_memberid` for email.
2. For each member, post an adaptive card / send email:
   - Subject: `New AI idea submitted: <afp_title>`
   - Body: submitter, department, business objectives, link to the record.

**Idempotency:** Guard against re-fires by only acting when the **submitted** state is newly
entered (see Flow 1b trigger condition).

### Flow 1b — Draft → Submitted (modify path)

Same as Flow 1 but trigger change type **Modified**, with a **trigger condition** so it only
runs when `statuscode` actually changed to Submitted:

```
@equals(triggerOutputs()?['body/statuscode'], 100000001)
```

Add a **filter column** of `statuscode eq 100000001` and enable *Trigger Conditions* to compare
the pre-image. If a pre-image is configured (`statuscode`), gate on:

```
@and(equals(triggerBody()?['statuscode'], 100000001),
     not(equals(triggerOutputs()?['body/sdkmessage'], 'Create')))
```

---

## Flow 2 — Reviewer assigned → notify the assigned reviewer

**Trigger:** Dataverse → *When a row is added, modified or deleted*
- Change type: **Modified**
- Table: `afp_idearequirement`
- Select columns (filtering attributes): `afp_assignedreviewer`
- Pre-image: include `afp_assignedreviewer` so the flow can detect a change.

**Trigger condition** (only when the reviewer lookup actually changed and is now set):

```
@and(
  not(equals(
    coalesce(triggerOutputs()?['body/_afp_assignedreviewer_value'], ''),
    coalesce(triggerOutputs()?['body/_afp_assignedreviewer_value_preimage'], '')
  )),
  not(empty(triggerOutputs()?['body/_afp_assignedreviewer_value']))
)
```

> The pre-image value path depends on how the pre-image is registered; verify the exact token in
> the trigger's dynamic content and adjust. The intent: fire only when the assignee transitions
> to a new, non-empty user.

**Actions:**
1. Get the assigned `systemuser` (`_afp_assignedreviewer_value`) → email / Teams.
2. Notify the reviewer:
   - Subject: `You've been assigned to review: <afp_title>`
   - Body: idea summary, current status, link. Mention it now appears under **My Approvals**.

---

## Flow 3 — Status changed → notify the submitter

**Trigger:** Dataverse → *When a row is added, modified or deleted*
- Change type: **Modified**
- Table: `afp_idearequirement`
- Select columns: `statuscode`
- Pre-image: include `statuscode`.

**Trigger condition** (only when status actually changed):

```
@not(equals(
  triggerOutputs()?['body/statuscode'],
  triggerOutputs()?['body/statuscode_preimage']
))
```

**Actions:**
1. Get the idea's `createdby` `systemuser` → email / Teams.
2. Compose a human-readable status label from the value map above.
3. Notify the submitter:
   - Subject: `Update on your AI idea: <afp_title> is now <Status>`
   - Body: previous → new status, the **reason** (the app writes a "Status change" note to the
     timeline; optionally read the latest `annotation` for richer context), link to the record.

> The app already records a CoE note (`annotation`) with the reason on every status change. This
> flow can either send a lightweight status-only message or fetch that note for the reason text.

---

## Flow 4 — SLA breach reminder (daily)

**Trigger:** Recurrence — once per day (e.g. 08:00 local).

**Actions:**
1. List `afp_idearequirement` where `statuscode` is in review states
   (Submitted `100000001` or Under Review `100000002`).
2. Compute age from `createdon`. The app flags reviews older than **5 days** as past SLA
   (`REVIEW_SLA_DAYS` in `src/pages/my-approvals.tsx`) — keep this threshold in sync.
3. For each overdue idea:
   - If an assigned reviewer exists, remind that reviewer.
   - Otherwise, remind the whole CoE team.
   - Subject: `Overdue review (<N> days): <afp_title>`
   - Body: age, current status, link.

**Tuning:** Batch per-recipient digests (one message listing all overdue ideas) instead of one
message per idea to avoid noise.

---

## Build & deployment notes

- Author the flows **inside the AgenticFury solution** so they export/import with the app.
- Use a **service account / application user** connection for Dataverse, Teams, and Office 365
  Outlook so notifications don't depend on a single maker's account.
- Register **pre-images** on the modify triggers (Flows 2 and 3) — without them the
  change-detection trigger conditions cannot compare old vs. new values and will fire on every
  unrelated edit.
- The deep link uses the app's `HashRouter`, so the record route must be appended **after `#`**.
- Keep the status value map and the 5-day SLA threshold aligned with
  [src/constants/ideaStatus.ts](../src/constants/ideaStatus.ts) and
  [src/pages/my-approvals.tsx](../src/pages/my-approvals.tsx); if the app changes them, update
  these flows.
