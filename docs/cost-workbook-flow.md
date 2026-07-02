# Cost Workbook — Power Automate Flow Definition

This flow creates a per-submission SharePoint Excel workbook by copying a template,
then writes the workbook reference back onto the idea record. It is the server-side
half of the "Cost Workbook" feature in the submission detail **Estimated Costs** pane.

Build it in the **AgenticFury** solution so it promotes with ALM.

## How the app and flow cooperate

1. In the Estimated Costs pane a CoE user clicks **Create cost workbook**.
2. The app sets `afp_costworkbookrequested = true` on the idea (`afp_idearequirement`).
3. This flow triggers, copies the template into the destination folder, and writes
   `afp_costworkbookurl` / `afp_costworkbookname` / `afp_costworkbookuniqueid` back and
   resets `afp_costworkbookrequested = false`.
4. The app polls the idea for ~90s and flips the card to **Open cost workbook**
   (opens in a new tab — SharePoint blocks inline framing).

## Environment facts (dev)

| Thing | Value |
|---|---|
| Site | `https://msftbapb2bcommercial.sharepoint.com/sites/AgenticFury` |
| Library | `Documents` (server path `/Shared Documents`) |
| Template file | `/Shared Documents/BaseTemplate.xlsx` **(confirm exact path)** |
| Destination folder | `/Shared Documents/SubmissionCosts` |

## Idea columns used

| Column | Purpose |
|---|---|
| `afp_costworkbookrequested` (Yes/No) | App sets **Yes** to request; flow resets to **No** |
| `afp_costworkbookurl` (URL) | Web URL the app opens |
| `afp_costworkbookname` (Text) | File name |
| `afp_costworkbookuniqueid` (Text) | SharePoint file UniqueId (optional) |

## Flow: "AgenticFury — Create Cost Workbook"

### Trigger — Dataverse: *When a row is added, modified or deleted*
- **Change type:** Added or Modified
- **Table:** Idea Requirements (`afp_idearequirement`)
- **Scope:** Organization
- **Select columns:** `afp_costworkbookrequested`
- **Settings → Trigger Condition:**
  ```
  @equals(triggerOutputs()?['body/afp_costworkbookrequested'], true)
  ```
  This prevents loops — the write-back sets the flag to false, which no longer matches.

### 1. Condition (safety) — only continue if no workbook exists yet
- `afp_costworkbookurl` **is equal to** *(empty)*
- Put steps 2–5 in the **If yes** branch.

### 2. SharePoint — *Get file content using path*
- **Site Address:** `https://msftbapb2bcommercial.sharepoint.com/sites/AgenticFury`
- **File Path:** `/Shared Documents/BaseTemplate.xlsx`

### 3. SharePoint — *Create file*
- **Site Address:** same
- **Folder Path:** `/Shared Documents/SubmissionCosts`
- **File Name:**
  ```
  @{coalesce(triggerOutputs()?['body/afp_submissionid'], triggerOutputs()?['body/afp_idearequirementid'])}.xlsx
  ```
- **File Content:** *File Content* from step 2

### 4. SharePoint — *Get file metadata*
- **Site Address:** same
- **File Identifier:** *Id* from step 3
- Gives `{Path}` and `{UniqueId}` for the write-back.

### 5. Dataverse — *Update a row*
- **Table:** Idea Requirements
- **Row ID:** trigger `afp_idearequirementid`
- **Cost Workbook URL** (`afp_costworkbookurl`):
  ```
  @{concat('https://msftbapb2bcommercial.sharepoint.com', outputs('Get_file_metadata')?['body/Path'])}
  ```
  *(Alternatively use the SharePoint "Get file properties" action's `Link to item`.)*
- **Cost Workbook Name** (`afp_costworkbookname`): file name from step 3
- **Cost Workbook Unique Id** (`afp_costworkbookuniqueid`): `{UniqueId}` from step 4 *(optional)*
- **Cost Workbook Requested** (`afp_costworkbookrequested`): **No**

## ALM hardening (test/prod)

Replace the hardcoded site/paths in steps 2–4 with **Dataverse environment variables**
so each environment points at its own SharePoint site:

| Environment variable | Example (dev) |
|---|---|
| `afp_CostWorkbookSiteUrl` | `https://msftbapb2bcommercial.sharepoint.com/sites/AgenticFury` |
| `afp_CostWorkbookTemplatePath` | `/Shared Documents/BaseTemplate.xlsx` |
| `afp_CostWorkbookFolderPath` | `/Shared Documents/SubmissionCosts` |

Reference them in the flow via `Environment variable` dynamic content (or
`environmentVariables('afp_CostWorkbookSiteUrl')`). Set each environment's current
value at solution import.

## Notes / gotchas

- The workbook opens in a **new tab** — SharePoint refuses to be embedded in an iframe
  inside the Power Apps host (`X-Frame-Options`), which we confirmed via a spike.
- File naming uses the submission reference (`afp_submissionid`) when present, else the
  idea GUID, to guarantee uniqueness.
- The trigger condition + the "requested" flag reset are what keep the flow from looping.
- The app times out its poll after ~90s and shows "Still preparing…", so a slow flow run
  is non-fatal — the pane picks up the workbook on the next page visit/refetch.
