# Survexia Multi-Study Platform Architecture Blueprint

## Executive summary

Survexia is now strong enough to evolve from a **single-project fieldwork application** into a **multi-study research operations platform**. The current product already contains the operational building blocks required for that transition: authentication, users, templates, questions, survey responses, pedestrian counts, statistics, exports, shifts and closures. The architectural limitation is not the absence of fieldwork capabilities, but the fact that these capabilities still operate as if the installation represented **one active investigation at a time**.

The correct next step is therefore **not a rewrite**, but a controlled platformization process. A new top-level entity called **Study** should be introduced and then used to scope almost every operational object in the system. Once that boundary exists, Survexia can support a **platform supervisor**, **project administrators assigned per study**, and **interviewers assigned only to the studies and tasks they must execute**.

This document defines the target platform model, the data architecture, the permission structure, the navigation model, the migration approach and the recommended implementation order.

## 1. Current-state architecture diagnosis

The current system behaves as a well-developed project-specific application. Several core elements still assume one shared operational space.

| Current area | Present behavior | Architectural implication |
|---|---|---|
| **Users** | Users have a single global role such as `admin`, `encuestador`, `revisor` or `user` | Access is global rather than scoped per study |
| **Templates** | Survey templates are stored globally with no project boundary | Templates cannot belong to separate investigations |
| **Questions** | Questions belong to templates, but templates themselves are global | Question libraries are not reusable or isolated by study |
| **Survey responses** | Responses link directly to template and interviewer, with no study identifier | Reporting, exports and permissions cannot be separated per project |
| **Settings** | A single app settings store contains one project name, one quota model and one export identity | The installation behaves as one project environment |
| **Counting points** | Counting structure is handled as a shared project resource | Different studies cannot have independent counting taxonomies |
| **Shifts and closures** | Operational fieldwork objects are shared globally | Interviewer work cannot be partitioned cleanly by study |

The current database schema confirms this single-project bias. The following tables and structures would need study scoping in the platform model.

| Existing object | Current issue | Required evolution |
|---|---|---|
| `users` | One global role field | Keep users global, move operational authority to assignment tables |
| `survey_templates` | No `studyId` | Scope templates to one study |
| `questions` | Scoped only through template | Keep relation to template, optionally denormalize study for faster validation |
| `survey_responses` | No `studyId`; includes study-like metadata directly | Add explicit study ownership |
| `field_metrics` | Global operational metrics | Scope by study |
| `pedestrian_sessions`, `pedestrian_intervals`, `pedestrian_directions`, `pedestrian_passes` | Global counting activity | Scope by study |
| `counting_sessions` | Global timed counting | Scope by study |
| `survey_rejections` | Global rejection logging | Scope by study |
| `shifts` | Shared assignment space | Scope by study |
| `shift_closures` | Shared field closure data | Scope by study |
| `appSettingsStore` | One app-level project configuration | Replace with study-level settings |

The same conclusion appears in the current configuration layer. The application settings store currently defines one `projectName`, one `exportProjectName`, one quota model, one enabled-chart set and one API-key field for the whole installation. That is appropriate for a single investigation but not for a platform managing multiple parallel studies.

## 2. Platform design principles

The target platform should be governed by four principles.

First, **all operational data must belong to a study**. There should be no ambiguity about which investigation owns a response, template, shift, count or export.

Second, **identity must remain global while permissions become contextual**. A person signs into Survexia once, but their authority depends on the study they are working inside.

Third, **the current administrator and interviewer experiences should be preserved as study workspaces**. The product already has useful workflows; they should be wrapped inside a study boundary rather than replaced.

Fourth, **migration must preserve data portability**. Historical data should be exportable and directly queryable at database level, and the conversion from the current installation to the new model should not require manual re-entry.

## 3. Target domain model

The platform should revolve around a new top-level entity called **Study**.

> A **Study** is a complete research project with its own configuration, users, templates, fieldwork, analytics and exports.

The recommended domain model is the following.

| Entity | Purpose | Scope |
|---|---|---|
| **Platform user** | Human identity that can sign into the platform | Global |
| **Study** | Research project / investigation container | Global registry |
| **Study user assignment** | Links a user to a study | Per study |
| **Study role** | Defines what a user can do in that study | Per study |
| **Study settings** | Project-specific configuration and branding | Per study |
| **Study template** | Survey instrument used in one project | Per study |
| **Study question** | Question definition inside a template | Per study through template |
| **Study response** | Collected field interview | Per study |
| **Study counting structure** | Points, subpoints, directions and map configuration | Per study |
| **Study shifts** | Fieldwork assignments | Per study |
| **Study closures** | Daily or shift closure records | Per study |
| **Study exports** | Export schemas and generated files | Per study |

The most important distinction is that **users remain global** while almost all other operational objects become **study-scoped**.

## 4. Roles and permission model

The platform should separate **platform authority** from **study authority**. The current single global role field is too restrictive for the future model.

### 4.1 Recommended role split

| Role level | Role | Purpose |
|---|---|---|
| **Platform** | **Supervisor** | Creates studies, archives studies, assigns project administrators, oversees the full portfolio |
| **Study** | **Administrator** | Full administration of one study, including templates, users, quotas, counts, exports and settings |
| **Study** | **Interviewer** | Executes fieldwork inside assigned studies only |
| **Study** | **Reviewer** *(optional)* | Quality control, read-only analytics and controlled exports |

This model enables the real-world scenarios you described. A person may be a supervisor globally, an administrator in one project and an interviewer in another, or an interviewer across several studies with different task assignments.

### 4.2 Permission matrix

| Capability | Supervisor | Study administrator | Interviewer | Reviewer |
|---|---|---|---|---|
| Create new study | Yes | No | No | No |
| Archive / reopen study | Yes | No | No | No |
| Assign study admins | Yes | No | No | No |
| Enter study admin workspace | Yes | Yes | No | Read-only if allowed |
| Manage templates and questions | Yes | Yes | No | No |
| Manage study users | Yes | Yes | No | No |
| Create shifts / assignments | Yes | Yes | No | No |
| Conduct surveys and counts | Optional | Optional if allowed | Yes | No |
| View statistics | Yes | Yes | Limited or task-focused | Yes |
| Export study data | Yes | Yes | Usually no | Controlled |

### 4.3 Recommended data model for permissions

The current `users.role` field can be kept temporarily for compatibility, but the target architecture should introduce the following structures.

| New structure | Purpose |
|---|---|
| `platform_role` on `users` | Distinguishes supervisors from standard authenticated users |
| `study_users` | Assignment table between user and study |
| `study_role` in `study_users` | Role inside each study |
| `study_permissions` *(optional later)* | Fine-grained feature flags if enterprise control is needed |

A recommended `study_users` design would include: `id`, `studyId`, `userId`, `studyRole`, `isActive`, `assignmentNotes`, `createdAt`, `updatedAt`.

## 5. Study-centric data architecture

### 5.1 Core new tables

The platform should introduce at least the following top-level structures.

| Table | Description |
|---|---|
| `studies` | Registry of research projects |
| `study_users` | Membership and role assignment per study |
| `study_settings` | Project-specific configuration |
| `study_modules` *(optional)* | Explicit feature enablement by study |
| `study_assets` *(optional later)* | Logos, documents, briefing material and downloadable assets |

### 5.2 Proposed `studies` table

| Field | Purpose |
|---|---|
| `id` | Primary key |
| `code` | Short stable project code, e.g. `MNE-2026-001` |
| `name` | Public project name |
| `description` | Internal description |
| `status` | `draft`, `active`, `paused`, `archived` |
| `clientName` | Optional client or sponsoring institution |
| `startDate` / `endDate` | Study timeline |
| `defaultLanguage` | Primary operating language |
| `createdBy` | Supervisor who created it |
| `createdAt` / `updatedAt` | Audit fields |

### 5.3 Proposed `study_settings` table

This table should absorb the current global configuration that now lives in `appSettingsStore`.

| Field | Derived from current app | Purpose |
|---|---|---|
| `studyId` | New | Foreign key to study |
| `projectName` | `projectName` | Human-readable project identity |
| `exportProjectName` | `exportProjectName` | Export file prefix |
| `mapPrimaryPointCode` | Existing | Map focal point |
| `surveyTargetTotal` | Existing | Total survey objective |
| `surveyTargetResidents` | Existing | Resident target |
| `surveyTargetVisitors` | Existing | Visitor target |
| `surveyWeeklyTargetTotal` | Existing | Weekly total target |
| `surveyWeeklyTargetResidents` | Existing | Weekly resident target |
| `surveyWeeklyTargetVisitors` | Existing | Weekly visitor target |
| `quotasEnabled` | Existing | Quota activation |
| `residentQuotaTotal` | Existing | Resident quota |
| `visitorQuotaTotal` | Existing | Visitor quota |
| `enabledCharts` | Existing | Study-specific statistics visibility |
| `openAiApiKey` | Existing, but should be reviewed | Per-study or platform-managed AI integration |
| `brandLogoLight` / `brandLogoDark` | New | Project branding assets |
| `versionLabel` | New optional display metadata | Helpful for deployment traceability |

### 5.4 Existing tables that should receive `studyId`

The minimum safe rule is this: if the object is operational, analytical or exportable, it should be study-scoped.

| Table | Add `studyId`? | Notes |
|---|---|---|
| `survey_templates` | Yes | Mandatory |
| `questions` | Optional direct field, but recommended | Validation and exports become simpler |
| `survey_responses` | Yes | Mandatory |
| `photos` | Recommended | Can also inherit from response, but denormalization helps |
| `field_metrics` | Yes | Mandatory |
| `pedestrian_sessions` | Yes | Mandatory |
| `pedestrian_intervals` | Inherit through session | Direct field optional |
| `pedestrian_directions` | Yes | Mandatory |
| `pedestrian_passes` | Yes | Mandatory |
| `counting_sessions` | Yes | Mandatory |
| `survey_rejections` | Yes | Mandatory |
| `shifts` | Yes | Mandatory |
| `shift_closures` | Yes | Mandatory |
| derived export tables | Yes | Mandatory |

## 6. Navigation and workspace model

The platform should expose different entry experiences depending on identity and study assignment.

### 6.1 Login outcome logic

| User type after authentication | Recommended behavior |
|---|---|
| Supervisor | Land on platform portfolio dashboard |
| Study admin in one study only | Land directly in that study admin workspace |
| Study admin in multiple studies | Show study selector first |
| Interviewer in one study only | Land directly in interviewer workspace for that study |
| Interviewer in multiple studies | Show a simplified study selector with assigned tasks |

### 6.2 Workspace separation

| Workspace | Purpose | Based on current product? |
|---|---|---|
| **Supervisor workspace** | Create and manage studies, assign admins, monitor portfolio health | New |
| **Study admin workspace** | Full project administration for one study | Mostly current admin interface |
| **Interviewer workspace** | Conduct surveys, counts, closures and assigned field tasks | Mostly current interviewer interface |

The current administrator menu should become the **study administration console**. The current interviewer menu should become the **study fieldwork console**. This preserves the product experience while adding one new organizational layer above it.

### 6.3 Supervisor menu proposal

| Section | Purpose |
|---|---|
| Portfolio overview | View all studies and their status |
| Create study | Launch new investigation wizard |
| User directory | Global platform user management |
| Assignments | Manage who belongs to which study |
| Templates library *(optional later)* | Reusable templates that can be cloned into studies |
| Activity / audit log | Trace admin actions across the platform |

### 6.4 Study admin menu proposal

This should remain very close to the current menu.

| Current concept | Future meaning |
|---|---|
| Home | Study dashboard |
| Statistics | Statistics for the selected study only |
| Field Map / Counting Map | Map modules for the selected study |
| Results | Survey responses for the selected study |
| Pedestrian Counts / Counting Directions | Counting operations for the selected study |
| Quotas | Study-specific quotas |
| Export | Study-specific exports |
| Users | Study memberships and assignments |
| Settings | Study settings and branding |

### 6.5 Interviewer menu proposal

The interviewer should see only what is relevant to their assigned study and tasks.

| Section | Behavior |
|---|---|
| Assigned tasks / shifts | Primary launcher |
| Start residents survey | Available only if assigned |
| Start visitors survey | Available only if assigned |
| Pedestrian count | Available only if assigned |
| Rejections | Available if survey work is enabled |
| Shift closure | Available during or after assigned fieldwork |

## 7. Assignment model for interviewers

Your description implies that interviewer access should be more constrained than the current generic role model. The platform should therefore support **study membership** and **task assignment** as separate concepts.

> Membership answers **where** a user can work. Assignment answers **what** that user should do in that study.

A useful design would be:

| Layer | Recommended object |
|---|---|
| Study membership | `study_users` |
| Field assignment | Existing `shifts`, extended with `studyId`, survey mode, point, timeframe and notes |
| Optional task packs | A future abstraction for study-specific operational bundles |

This means an interviewer may belong to one study but still only see one task type, such as residents surveys, visitors surveys or pedestrian counting.

## 8. Counting and mapping architecture in the multi-study model

The counting subsystem is especially important because you have already generalized it away from the old Seville-specific assumptions.

In the platform model, each study must own its own counting structure.

| Counting object | New rule |
|---|---|
| Counting points | Stored per study |
| Subpoints | Stored per study |
| Flow directions | Stored per study |
| Primary map focus | Stored in study settings |
| Counting sessions and passes | Linked to study |
| Statistics legends and labels | Built only from the active study’s counting configuration |

The current `countingPointsStore` should therefore evolve into a **study-scoped counting configuration repository**, ideally moved from a shared file store into database-backed tables.

## 9. Template and questionnaire architecture

Each study should own its own questionnaire set. However, the platform should also leave room for future reuse.

The recommended medium-term approach is two-layered.

| Layer | Purpose |
|---|---|
| **Study templates** | Operational forms used directly in one study |
| **Template library** *(optional later)* | Reusable master templates that can be cloned into studies |

This keeps the first implementation simple. Templates are study-owned immediately, and only later, if needed, a reusable library layer can be added for standardized recurring research programs.

## 10. Reporting, exports and analytics boundaries

All dashboards, exports and derived analytics tables must become study-specific. This is essential not only for clean UX, but also for data governance.

| Area | Platform rule |
|---|---|
| Statistics | Filter by active study as a hard boundary |
| Exports | Only include data from the selected study |
| Derived flat tables | Regenerated per study |
| Project name in exports | Taken from `study_settings.exportProjectName` |
| Chart visibility | Controlled per study |
| Quotas and targets | Controlled per study |

A future supervisor portfolio dashboard can aggregate across studies, but those aggregates should be built from study-bounded data rather than from one mixed operational dataset.

## 11. Migration strategy from the current system

The migration should be evolutionary and low risk.

### 11.1 Main migration principle

> The current production installation should be converted into **the first study automatically**.

This means the existing templates, questions, responses, settings, counting structures and field records are not discarded. They are simply attached to one newly created study.

### 11.2 Migration sequence

| Step | Action |
|---|---|
| **1** | Create the `studies` table |
| **2** | Create the `study_users` and `study_settings` tables |
| **3** | Insert a first study using the current configured project identity |
| **4** | Attach current global settings to that study |
| **5** | Add nullable `studyId` columns to operational tables |
| **6** | Backfill all historical rows with the first study ID |
| **7** | Make `studyId` non-null where required |
| **8** | Update queries, mutations and permissions to require active study context |
| **9** | Introduce new supervisor and study selector UX |

### 11.3 Suggested initial seeded study

| Field | Seed value recommendation |
|---|---|
| Study code | Use a generated code such as `STUDY-001` or a client-specific code |
| Study name | Reuse current `projectName` |
| Export prefix | Reuse current `exportProjectName` |
| Status | `active` |
| Created by | First supervisor or bootstrap admin |

## 12. Recommended implementation backlog

The platform should be built in controlled phases rather than as one disruptive branch.

### Phase A. Foundation

| Objective | Deliverable |
|---|---|
| Create study layer | `studies`, `study_users`, `study_settings` |
| Preserve current product | Existing UI still works using auto-selected first study |
| Prepare migration | All historical records backfilled with `studyId` |

### Phase B. Authorization and context

| Objective | Deliverable |
|---|---|
| Separate platform and study roles | Supervisor and study role model |
| Add active study context | Session or route-level study selection |
| Lock queries by study | All main API queries require study context |

### Phase C. Admin workspace scoping

| Objective | Deliverable |
|---|---|
| Convert current admin app into study admin app | Templates, users, settings, quotas, exports, maps and statistics become study-scoped |
| Move settings out of shared file assumptions | Database-backed study settings |
| Move counting configuration into study model | Study-specific points and directions |

### Phase D. Interviewer workspace scoping

| Objective | Deliverable |
|---|---|
| Show only assigned study | Clean interviewer entry experience |
| Scope shifts, closures and tasks | Fieldwork objects linked to study |
| Simplify task launchers | Interviewers see only assigned modules |

### Phase E. Supervisor workspace

| Objective | Deliverable |
|---|---|
| Add portfolio dashboard | Supervisor can view all studies |
| Add create-study wizard | New investigations created quickly |
| Add assignment management | Admins and interviewers assigned per study |

### Phase F. Reusability and maturity

| Objective | Deliverable |
|---|---|
| Optional template library | Reusable base instruments |
| Cross-study reporting | Portfolio KPIs for supervisor |
| Audit and compliance features | Fine-grained logs and governance |

## 13. Technical recommendations for implementation

### 13.1 Prefer database-backed study configuration

The current file-based `appSettingsStore` was a good step for project generalization, but the multi-study platform should move study configuration into the database. File-based settings are difficult to scope, audit and manage concurrently once multiple studies exist.

### 13.2 Keep direct exportability

Because portability is important, the schema should remain relational and export-friendly. That means avoiding opaque project blobs where possible and keeping data accessible through direct SQL, CSV and Excel export paths.

### 13.3 Preserve responsive behavior

The new study selector, supervisor dashboard and role-based menus should be designed for mobile and tablet usage from the beginning, especially for interviewer flows and field operations.

### 13.4 Keep version visibility

Study-level and platform-level settings screens should continue to expose build version and deployment timestamp so operations teams can validate what version is currently running.

## 14. Key decisions to make before implementation begins

There are a few strategic choices that should be confirmed early because they affect schema and UX.

| Decision | Recommended answer |
|---|---|
| Can one interviewer belong to multiple studies? | **Yes** |
| Can one user have different roles in different studies? | **Yes** |
| Should studies have their own branding? | **Yes** |
| Should templates be reusable across studies later? | **Yes, but not required in phase one** |
| Should statistics aggregate across studies for supervisors? | **Yes, later** |
| Should study configuration remain file-based? | **No, move to DB-backed settings** |

## 15. Final recommendation

Survexia should evolve into a **three-layer platform**.

| Layer | Purpose |
|---|---|
| **Platform layer** | Global identity, supervisor controls, study creation and assignments |
| **Study administration layer** | Project-scoped administration, almost identical to the current admin experience |
| **Fieldwork layer** | Interviewer execution space, study-scoped and assignment-driven |

This is the correct product direction because it keeps what already works while making the platform commercially and operationally scalable. Instead of delivering one-off fieldwork applications, Survexia would become a reusable environment for launching, running and comparing multiple investigations over time.

The best immediate next step is to implement the **study foundation layer** first: `studies`, `study_users`, `study_settings`, and `studyId` backfilling across all operational tables. Once that backbone is in place, the existing administrator and interviewer experiences can be progressively re-scoped with relatively low interface disruption.
