// Seeds 100 realistic health-system AI/agentic use cases into the Idea table
// (afp_idearequirements). Only the seven "Submitted Idea" fields are populated:
//   afp_title, afp_businessobjectives, afp_intendeduserroles, afp_datasources,
//   afp_expectedoutcomes, afp_riskfactors, afp_phirequired
// Everything else is left at Dataverse defaults. Idempotent: queries existing
// titles first and skips any already present. Auth: pure-HTTP OAuth2
// device-code flow (pwsh-safe, no MSAL), identical to the other scripts here.
//
// Usage: node scripts/seed-idea-submissions.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TENANT = 'd92190b9-98e7-46da-8b11-580e06c7d15d';
const ORG = 'https://orgf2352485.crm.dynamics.com';
const CLIENT_ID = '51f81489-12ee-4a9e-aaae-a2591f45987d'; // PAC public client
const SOLUTION = 'AgenticFury';

const API = `${ORG}/api/data/v9.2`;
const TOKEN_CACHE = path.join(os.tmpdir(), 'afp_scorecard_token.json');

// 100 distinct health-system AI use cases. Fields:
//   t=title, o=business objectives, u=intended users/roles, d=data sources,
//   e=expected outcomes, r=risk factors/regulatory impact, phi=PHI required
const USE_CASES = [
  // --- Clinical documentation & ambient ---
  { t: 'Ambient clinical documentation for outpatient visits', o: 'Reduce clinician documentation burden and after-hours charting by auto-drafting visit notes from the patient encounter.', u: 'Primary care physicians, APPs, medical scribes', d: 'Ambient encounter audio, EHR encounter context, problem list', e: 'Cut documentation time per visit by 50% and reduce pajama-time charting.', r: 'PHI in audio capture; patient consent for recording; HIPAA; state two-party consent laws.', phi: true },
  { t: 'Emergency department physician note drafting', o: 'Speed ED throughput by drafting provider notes from triage data and clinician dictation.', u: 'ED physicians, ED APPs', d: 'EHR triage notes, vitals, chief complaint, dictation', e: 'Reduce note completion time and improve note completeness for billing.', r: 'High-acuity PHI; documentation accuracy affects liability; CMS E/M coding rules.', phi: true },
  { t: 'Inpatient progress note summarization', o: 'Generate daily progress notes by summarizing overnight events, labs, and nursing notes.', u: 'Hospitalists, residents', d: 'EHR flowsheets, lab results, nursing notes, med administration', e: 'Faster rounding and more consistent progress documentation.', r: 'Summarization errors could omit clinical detail; PHI; medical record integrity rules.', phi: true },
  { t: 'Discharge summary generation', o: 'Auto-assemble discharge summaries from the hospital stay to speed discharge and reduce delays.', u: 'Hospitalists, case managers', d: 'EHR encounter, procedures, medications, follow-up orders', e: 'Reduce discharge summary turnaround from days to hours.', r: 'Inaccurate med reconciliation risk; PHI; CMS discharge documentation requirements.', phi: true },
  { t: 'Operative note drafting assistant', o: 'Draft operative notes from surgeon dictation and structured OR data.', u: 'Surgeons, surgical residents', d: 'OR dictation, procedure scheduling, implant logs', e: 'Reduce dictation backlog and improve op-note timeliness.', r: 'Surgical detail accuracy; PHI; Joint Commission documentation timeliness standards.', phi: true },
  { t: 'Radiology report drafting from imaging context', o: 'Pre-draft structured radiology reports to accelerate radiologist read time.', u: 'Radiologists', d: 'RIS/PACS metadata, prior reports, order indications', e: 'Increase reads per hour and improve report consistency.', r: 'FDA considerations for diagnostic support; PHI; radiologist remains accountable.', phi: true },
  { t: 'Pathology report structuring', o: 'Convert free-text pathology findings into structured synoptic reports.', u: 'Pathologists', d: 'LIS pathology reports, specimen data', e: 'Improve synoptic reporting compliance and cancer registry capture.', r: 'Diagnostic accuracy; PHI; CAP synoptic reporting standards.', phi: true },
  { t: 'Nursing handoff SBAR summarization', o: 'Generate SBAR handoff summaries at shift change to reduce omissions.', u: 'Inpatient nurses, charge nurses', d: 'EHR nursing notes, vitals, active orders, care plan', e: 'More complete handoffs and fewer communication-related safety events.', r: 'Omission of critical info; PHI; nursing scope-of-practice considerations.', phi: true },
  { t: 'After-visit summary in plain language', o: 'Translate clinical visit notes into patient-friendly after-visit summaries.', u: 'Care teams, patient experience', d: 'EHR visit notes, medication changes, instructions', e: 'Improve patient comprehension and reduce follow-up calls.', r: 'Health-literacy accuracy; PHI; plain-language and accessibility requirements.', phi: true },
  { t: 'Specialist referral letter drafting', o: 'Draft referral letters summarizing relevant history for the receiving specialist.', u: 'Referring physicians, referral coordinators', d: 'EHR problem list, recent results, reason for referral', e: 'Faster referrals and better information transfer to specialists.', r: 'Inappropriate disclosure risk; PHI; minimum-necessary HIPAA standard.', phi: true },

  // --- Triage & decision support ---
  { t: 'Emergency department triage acuity support', o: 'Support triage nurses in assigning acuity levels from presenting complaint and vitals.', u: 'Triage nurses', d: 'EHR triage intake, vitals, chief complaint, history', e: 'More consistent ESI assignment and reduced under-triage.', r: 'Clinical decision support liability; PHI; nurse retains final decision.', phi: true },
  { t: 'Sepsis early warning and bundle prompting', o: 'Detect early sepsis signals and prompt timely bundle interventions.', u: 'Inpatient nurses, rapid response, hospitalists', d: 'EHR vitals, labs, med administration, nursing assessments', e: 'Earlier sepsis recognition and improved bundle compliance.', r: 'Alert fatigue; false positives; PHI; CMS SEP-1 measure alignment.', phi: true },
  { t: 'Inpatient clinical deterioration prediction', o: 'Predict deterioration to trigger rapid response before codes occur.', u: 'Rapid response teams, floor nurses', d: 'EHR vitals trends, labs, telemetry', e: 'Reduce unplanned ICU transfers and code-blue events.', r: 'Model drift; alert fatigue; PHI; clinical validation requirements.', phi: true },
  { t: 'Stroke pathway activation support', o: 'Accelerate stroke recognition and pathway activation in the ED.', u: 'ED physicians, stroke coordinators', d: 'EHR triage data, last-known-well, imaging orders', e: 'Reduce door-to-needle time for eligible patients.', r: 'Time-critical accuracy; PHI; Joint Commission stroke certification standards.', phi: true },
  { t: 'Antibiotic stewardship recommendations', o: 'Recommend appropriate antibiotic selection and de-escalation.', u: 'Pharmacists, infectious disease physicians', d: 'EHR cultures, sensitivities, renal function, formulary', e: 'Improve appropriate antibiotic use and reduce resistance.', r: 'Recommendation accuracy; PHI; antimicrobial stewardship regulatory expectations.', phi: true },
  { t: 'Drug-drug interaction alert summarization', o: 'Summarize and prioritize interaction alerts to reduce override fatigue.', u: 'Pharmacists, prescribers', d: 'EHR active medications, allergy list, interaction database', e: 'Reduce alert fatigue while preserving safety catches.', r: 'Suppressing true alerts; PHI; pharmacy safety regulations.', phi: true },
  { t: 'Differential diagnosis assistant', o: 'Provide a ranked differential to support clinician reasoning for complex cases.', u: 'Physicians, APPs', d: 'EHR history, symptoms, results', e: 'Broaden diagnostic consideration and reduce diagnostic delays.', r: 'Anchoring/over-reliance; PHI; clinical-decision-support oversight.', phi: true },
  { t: 'Imaging appropriateness guidance', o: 'Guide ordering providers toward appropriate imaging per criteria.', u: 'Ordering physicians', d: 'EHR order context, ACR appropriateness criteria', e: 'Reduce low-value imaging and improve appropriate use.', r: 'CMS appropriate-use criteria mandates; PHI; clinical accountability.', phi: true },
  { t: 'Inpatient fall risk prediction', o: 'Identify patients at high fall risk to target prevention interventions.', u: 'Nurses, patient safety', d: 'EHR mobility assessments, medications, history', e: 'Reduce inpatient falls and fall-related injuries.', r: 'False reassurance; PHI; patient safety reporting requirements.', phi: true },
  { t: 'Pressure injury risk prediction', o: 'Predict pressure injury risk to drive proactive skin care.', u: 'Nurses, wound care team', d: 'EHR Braden scores, mobility, nutrition', e: 'Lower hospital-acquired pressure injury rates.', r: 'HAC reporting; PHI; CMS hospital-acquired condition penalties.', phi: true },

  // --- Revenue cycle & admin ---
  { t: 'Prior authorization automation', o: 'Automate prior authorization request assembly and submission to payers.', u: 'Prior auth specialists, revenue cycle', d: 'EHR orders, clinical documentation, payer rules', e: 'Reduce prior auth turnaround time and denial-for-no-auth.', r: 'Payer rule accuracy; PHI; payer data exchange compliance.', phi: true },
  { t: 'Claims denial appeal letter drafting', o: 'Draft payer appeal letters citing relevant clinical evidence.', u: 'Denials management, revenue cycle', d: 'EHR documentation, denial reason codes, payer policies', e: 'Increase appeal overturn rate and recover revenue.', r: 'Disclosure accuracy; PHI; payer appeal regulations.', phi: true },
  { t: 'Medical coding CPT/ICD suggestion', o: 'Suggest accurate CPT/ICD codes from clinical documentation.', u: 'Medical coders, CDI specialists', d: 'EHR notes, procedure documentation, code sets', e: 'Improve coding accuracy and reduce coding backlog.', r: 'Upcoding/compliance risk; PHI; CMS coding and False Claims Act exposure.', phi: true },
  { t: 'Charge capture audit', o: 'Detect missed or inconsistent charges across encounters.', u: 'Revenue integrity analysts', d: 'EHR charges, documentation, charge master', e: 'Recover missed revenue and reduce charge leakage.', r: 'Compliance with billing rules; PHI; OIG audit exposure.', phi: true },
  { t: 'Insurance eligibility verification assistant', o: 'Summarize eligibility and benefits to speed registration.', u: 'Patient access, registration', d: 'Payer eligibility responses, coverage data', e: 'Reduce eligibility-related denials and registration time.', r: 'Coverage accuracy; PHI; payer data agreements.', phi: true },
  { t: 'Patient cost estimate generation', o: 'Generate good-faith cost estimates for scheduled services.', u: 'Financial counselors, patient access', d: 'Charge master, payer contracts, benefits', e: 'Improve price transparency and point-of-service collections.', r: 'No Surprises Act compliance; PHI; estimate accuracy disclosures.', phi: true },
  { t: 'Underpayment detection', o: 'Identify payer underpayments versus contracted rates.', u: 'Revenue cycle analysts', d: 'Remittance data, contract terms', e: 'Recover underpaid claims and strengthen payer accountability.', r: 'Contract interpretation; limited PHI; payer dispute processes.', phi: false },
  { t: 'Payer contract modeling assistant', o: 'Model financial impact of proposed payer contract terms.', u: 'Managed care, finance', d: 'Historical claims, fee schedules, contract proposals', e: 'Better-informed contract negotiations.', r: 'De-identified analytics; minimal PHI; contract confidentiality.', phi: false },
  { t: 'Denials root-cause analysis', o: 'Cluster and explain denial drivers to prioritize fixes.', u: 'Revenue cycle leadership', d: 'Denial codes, claim metadata, workflow logs', e: 'Reduce preventable denials at the source.', r: 'Aggregate data; limited PHI; billing compliance.', phi: false },
  { t: 'Self-pay propensity scoring', o: 'Estimate likelihood of patient payment to tailor financial counseling.', u: 'Patient financial services', d: 'Account history, demographics, prior payments', e: 'Improve collections while routing patients to assistance.', r: 'Fair-lending/ECOA fairness; PHI; FDCPA collections rules.', phi: true },
  { t: 'Charity care eligibility screening', o: 'Screen patients for financial assistance program eligibility.', u: 'Financial counselors', d: 'Income data, household size, account balances', e: 'Connect eligible patients to assistance and reduce bad debt.', r: '501(r) compliance for nonprofits; PHI; equitable application.', phi: true },

  // --- Patient access & engagement ---
  { t: 'Patient in-basket message triage and routing', o: 'Triage and route patient portal messages to the right team with draft replies.', u: 'Nurses, MAs, physicians', d: 'EHR in-basket messages, patient context', e: 'Reduce in-basket burden and speed patient response.', r: 'Clinical advice in drafts; PHI; provider review required before send.', phi: true },
  { t: 'Patient portal Q&A copilot', o: 'Answer common patient questions about visits, results, and instructions.', u: 'Patients, patient experience', d: 'Patient EHR data, FAQ knowledge base', e: 'Improve self-service and deflect non-clinical calls.', r: 'Incorrect guidance risk; PHI; scope limits on medical advice.', phi: true },
  { t: 'Appointment scheduling assistant', o: 'Help patients find and book appropriate appointments conversationally.', u: 'Patients, scheduling staff', d: 'Scheduling templates, provider availability, visit types', e: 'Increase booking conversion and reduce call volume.', r: 'Correct visit-type routing; limited PHI; ADA accessibility.', phi: true },
  { t: 'Symptom checker chatbot', o: 'Guide patients to appropriate care levels based on symptoms.', u: 'Patients, nurse triage line', d: 'Symptom knowledge base, triage protocols', e: 'Direct patients to appropriate care and reduce unnecessary ED visits.', r: 'Triage safety/liability; PHI; FDA software-as-medical-device considerations.', phi: true },
  { t: 'Pre-visit questionnaire summarization', o: 'Summarize patient-reported intake questionnaires for the care team.', u: 'Physicians, MAs', d: 'Patient-reported intake forms, history', e: 'Save visit time and surface key concerns up front.', r: 'Self-report accuracy; PHI; data minimization.', phi: true },
  { t: 'Medication refill request handling', o: 'Process routine refill requests against protocol and draft responses.', u: 'Pharmacy techs, nurses', d: 'EHR medication history, refill protocols', e: 'Faster refill turnaround and reduced staff workload.', r: 'Inappropriate refills; PHI; controlled-substance regulations.', phi: true },
  { t: 'No-show prediction and outreach', o: 'Predict likely no-shows and trigger tailored reminders/overbooking.', u: 'Scheduling, clinic operations', d: 'Appointment history, demographics, distance', e: 'Reduce no-show rate and improve schedule utilization.', r: 'Equity in overbooking; PHI; nondiscrimination considerations.', phi: true },
  { t: 'Care gap outreach personalization', o: 'Personalize outreach to close preventive and chronic care gaps.', u: 'Population health, outreach teams', d: 'Registry data, claims, EHR care gaps', e: 'Improve quality measure performance and patient engagement.', r: 'Targeting fairness; PHI; TCPA outreach consent rules.', phi: true },
  { t: 'Multilingual patient communication translation', o: 'Translate patient communications while preserving clinical meaning.', u: 'Care teams, interpreter services', d: 'Patient communications, language preferences', e: 'Improve access for limited-English-proficiency patients.', r: 'Translation accuracy; PHI; Section 1557 language access requirements.', phi: true },
  { t: 'Patient education content generation', o: 'Generate tailored, literacy-appropriate education materials.', u: 'Patient education, nursing', d: 'Condition libraries, patient context', e: 'Improve adherence and self-management.', r: 'Clinical accuracy; PHI when tailored; accessibility standards.', phi: true },

  // --- Care management / population health ---
  { t: 'Diabetes chronic care management', o: 'Identify and manage diabetic patients needing intervention.', u: 'Care managers, endocrinology', d: 'EHR labs (A1c), medications, registry', e: 'Improve glycemic control and reduce complications.', r: 'Model fairness across populations; PHI; quality reporting.', phi: true },
  { t: 'Heart failure readmission risk and intervention', o: 'Predict CHF readmission risk and trigger transitional care.', u: 'Care management, cardiology', d: 'EHR diagnoses, meds, prior admissions', e: 'Reduce 30-day CHF readmissions.', r: 'CMS readmission penalties; PHI; equitable intervention.', phi: true },
  { t: 'COPD exacerbation outreach', o: 'Detect rising COPD risk and prompt proactive outreach.', u: 'Care managers, pulmonology', d: 'EHR history, medication fills, prior exacerbations', e: 'Reduce COPD exacerbations and admissions.', r: 'Outreach consent; PHI; chronic care management billing rules.', phi: true },
  { t: 'Social determinants of health screening summarization', o: 'Summarize SDOH screening responses and recommend resources.', u: 'Social workers, care coordinators', d: 'SDOH screening data, community resource directory', e: 'Connect patients to needed social resources.', r: 'Sensitive SDOH data; PHI; consent and confidentiality.', phi: true },
  { t: 'Care plan generation', o: 'Draft individualized care plans from assessments and guidelines.', u: 'Care managers, nurses', d: 'EHR assessments, problem list, guidelines', e: 'Standardize care planning and save documentation time.', r: 'Plan accuracy; PHI; care management documentation standards.', phi: true },
  { t: 'Palliative and hospice eligibility identification', o: 'Identify patients who may benefit from palliative or hospice care.', u: 'Palliative care teams', d: 'EHR diagnoses, utilization, functional status', e: 'Earlier goals-of-care conversations and appropriate referrals.', r: 'Sensitive end-of-life context; PHI; hospice eligibility regulations.', phi: true },
  { t: 'Transitions of care follow-up', o: 'Coordinate post-discharge follow-up calls and tasks.', u: 'Transition coaches, care management', d: 'EHR discharge data, follow-up orders', e: 'Reduce post-discharge gaps and readmissions.', r: 'Timeliness; PHI; TCM billing documentation.', phi: true },
  { t: 'High-risk patient cohort identification', o: 'Identify rising-risk patients for proactive care management enrollment.', u: 'Population health analysts', d: 'Claims, EHR, utilization data', e: 'Target care management to highest-impact patients.', r: 'Algorithmic equity; PHI; value-based contract reporting.', phi: true },
  { t: 'Immunization gap detection', o: 'Detect overdue immunizations and trigger reminders.', u: 'Population health, primary care', d: 'EHR immunization records, state registry', e: 'Improve immunization rates and measure performance.', r: 'IIS data-sharing rules; PHI; outreach consent.', phi: true },
  { t: 'Cancer screening reminders', o: 'Identify patients overdue for cancer screenings and personalize reminders.', u: 'Primary care, population health', d: 'EHR screening history, guidelines, registry', e: 'Increase screening completion rates.', r: 'Outreach consent; PHI; quality measure alignment.', phi: true },

  // --- Nursing & operations ---
  { t: 'Nurse staffing and shift scheduling optimization', o: 'Optimize nurse schedules to match acuity and reduce overtime.', u: 'Nurse managers, staffing office', d: 'Census, acuity, staff availability, skill mix', e: 'Reduce overtime and improve staffing-to-acuity match.', r: 'Labor/union agreements; minimal PHI; safe-staffing regulations.', phi: false },
  { t: 'Bed management and patient flow', o: 'Forecast bed demand and optimize patient placement.', u: 'Bed managers, nursing supervisors', d: 'ADT feeds, census, anticipated discharges', e: 'Reduce ED boarding and improve throughput.', r: 'Operational accuracy; limited PHI; patient placement appropriateness.', phi: true },
  { t: 'Operating room scheduling optimization', o: 'Optimize OR block utilization and reduce turnover gaps.', u: 'OR schedulers, perioperative leadership', d: 'OR schedule, case durations, surgeon preferences', e: 'Increase OR utilization and on-time starts.', r: 'Scheduling fairness; limited PHI; surgical scheduling policies.', phi: false },
  { t: 'Hospital census and capacity forecasting', o: 'Forecast census to support staffing and surge planning.', u: 'Operations, nursing administration', d: 'Historical census, admissions, seasonality', e: 'Proactive capacity planning and reduced diversion.', r: 'Forecast reliability; aggregate data; minimal PHI.', phi: false },
  { t: 'Patient transport dispatch optimization', o: 'Optimize transport dispatch to reduce delays.', u: 'Transport dispatchers', d: 'Transport requests, location data, staff availability', e: 'Reduce transport wait times and delays to procedures.', r: 'Operational only; minimal PHI; equipment safety.', phi: false },
  { t: 'Supply chain demand forecasting', o: 'Forecast clinical supply demand to prevent stockouts.', u: 'Supply chain, materials management', d: 'Usage history, case volumes, vendor lead times', e: 'Reduce stockouts and excess inventory cost.', r: 'No PHI; vendor contract terms; recall traceability.', phi: false },
  { t: 'Biomedical equipment maintenance prediction', o: 'Predict equipment failures to schedule preventive maintenance.', u: 'Clinical engineering', d: 'Device telemetry, maintenance logs', e: 'Reduce unplanned device downtime.', r: 'Device safety; minimal PHI; FDA device maintenance records.', phi: false },
  { t: 'Environmental services dispatch optimization', o: 'Prioritize room turnover cleaning to speed bed availability.', u: 'EVS supervisors, bed management', d: 'Discharge events, room status, EVS staffing', e: 'Reduce bed turnaround time.', r: 'Operational only; minimal PHI; infection control protocols.', phi: false },
  { t: 'Float pool allocation', o: 'Allocate float staff to units with greatest need.', u: 'Staffing office, nurse managers', d: 'Unit census, acuity, float availability', e: 'Improve coverage and reduce agency reliance.', r: 'Labor agreements; minimal PHI; competency matching.', phi: false },
  { t: 'Nurse call light summarization', o: 'Summarize and prioritize call-light requests to speed response.', u: 'Floor nurses, unit clerks', d: 'Nurse call system logs, patient context', e: 'Reduce call-light response time.', r: 'Operational accuracy; PHI in patient context; safety.', phi: true },

  // --- Pharmacy ---
  { t: 'Medication reconciliation assistant', o: 'Reconcile medication lists across transitions to prevent errors.', u: 'Pharmacists, nurses', d: 'EHR med lists, pharmacy fill data, admission meds', e: 'Reduce medication discrepancies at transitions.', r: 'Reconciliation accuracy; PHI; Joint Commission med-rec standards.', phi: true },
  { t: 'Pharmacy prior authorization support', o: 'Assemble clinical justification for medication prior auths.', u: 'Pharmacy prior auth team', d: 'EHR diagnoses, prior therapies, payer criteria', e: 'Faster medication prior auth approvals.', r: 'Payer rule accuracy; PHI; pharmacy benefit compliance.', phi: true },
  { t: 'Formulary alternative suggestions', o: 'Suggest formulary-compliant therapeutic alternatives.', u: 'Pharmacists, prescribers', d: 'Formulary, EHR medications, clinical context', e: 'Improve formulary adherence and lower drug cost.', r: 'Clinical appropriateness; PHI; P&T policy alignment.', phi: true },
  { t: 'IV-to-PO conversion candidate identification', o: 'Identify patients eligible to switch from IV to oral medications.', u: 'Pharmacists', d: 'EHR medications, diet status, labs', e: 'Reduce IV costs and line-related risks.', r: 'Clinical eligibility accuracy; PHI; stewardship protocols.', phi: true },
  { t: 'Anticoagulation dosing support', o: 'Support anticoagulation dosing and monitoring decisions.', u: 'Anticoagulation pharmacists', d: 'EHR labs (INR), weight, renal function', e: 'Improve time-in-therapeutic-range and reduce adverse events.', r: 'High-risk medication; PHI; clinical decision support oversight.', phi: true },
  { t: 'Opioid risk monitoring', o: 'Monitor opioid prescribing patterns for safety signals.', u: 'Pharmacists, pain management', d: 'EHR prescriptions, PDMP data, risk factors', e: 'Reduce high-risk opioid exposure.', r: 'PDMP data-use rules; PHI; controlled-substance regulations.', phi: true },
  { t: 'Specialty pharmacy intake automation', o: 'Automate specialty medication intake and benefits investigation.', u: 'Specialty pharmacy staff', d: 'Referrals, EHR clinicals, payer benefits', e: 'Reduce time-to-fill for specialty medications.', r: 'PHI; manufacturer hub data sharing; payer compliance.', phi: true },
  { t: 'Sterile compounding documentation', o: 'Generate and verify compounding documentation for compliance.', u: 'Compounding pharmacists, techs', d: 'Compounding records, USP standards', e: 'Improve USP 797/800 documentation compliance.', r: 'Patient safety; minimal PHI; USP and board of pharmacy rules.', phi: false },
  { t: 'Drug shortage substitution guidance', o: 'Recommend substitutions during drug shortages.', u: 'Pharmacists, P&T committee', d: 'Inventory, shortage feeds, formulary alternatives', e: 'Maintain therapy continuity during shortages.', r: 'Clinical equivalence; minimal PHI; FDA shortage guidance.', phi: false },
  { t: 'Adverse drug event detection', o: 'Detect potential adverse drug events from clinical signals.', u: 'Pharmacists, patient safety', d: 'EHR labs, medications, trigger tools', e: 'Earlier ADE detection and intervention.', r: 'False positives; PHI; medication safety reporting.', phi: true },

  // --- Quality, safety, compliance ---
  { t: 'Incident report summarization and classification', o: 'Summarize and classify safety event reports for trending.', u: 'Patient safety, risk management', d: 'Incident reporting system narratives', e: 'Faster event review and better trend detection.', r: 'Confidential safety data; PHI; PSO protections.', phi: true },
  { t: 'Patient safety event trend analysis', o: 'Surface emerging safety trends across event data.', u: 'Quality and safety leadership', d: 'Event reports, harm scores, locations', e: 'Proactive identification of safety risks.', r: 'Peer-review confidentiality; limited PHI; PSQIA.', phi: false },
  { t: 'Sepsis bundle compliance monitoring', o: 'Monitor SEP-1 bundle element completion in real time.', u: 'Quality, clinical teams', d: 'EHR orders, timestamps, results', e: 'Improve SEP-1 compliance and outcomes.', r: 'CMS SEP-1 measure; PHI; abstraction accuracy.', phi: true },
  { t: 'Hospital-acquired condition surveillance', o: 'Surveil for HACs (CLABSI, CAUTI, etc.) from clinical data.', u: 'Infection prevention, quality', d: 'EHR cultures, device days, diagnoses', e: 'Earlier HAC detection and reduced rates.', r: 'NHSN reporting; PHI; CMS HAC penalties.', phi: true },
  { t: 'Mortality review abstraction', o: 'Abstract key facts for mortality and morbidity review.', u: 'Quality, physician reviewers', d: 'EHR encounter, events, documentation', e: 'Streamline M&M review and learning.', r: 'Peer-review protection; PHI; confidentiality.', phi: true },
  { t: 'Regulatory survey readiness assistant', o: 'Assess readiness for regulatory surveys against standards.', u: 'Accreditation, quality', d: 'Policies, audit results, standards', e: 'Improve survey preparedness and reduce findings.', r: 'Accuracy of self-assessment; minimal PHI; Joint Commission/CMS standards.', phi: false },
  { t: 'Policy and procedure Q&A copilot', o: 'Answer staff questions grounded in approved policies.', u: 'All staff', d: 'Policy and procedure repository', e: 'Faster policy lookups and consistent practice.', r: 'Grounding accuracy; no PHI; document control.', phi: false },
  { t: 'Consent form completeness check', o: 'Verify consent forms are complete and appropriate.', u: 'Perioperative, compliance', d: 'EHR consent documents, procedure orders', e: 'Reduce consent-related delays and compliance gaps.', r: 'Legal consent validity; PHI; informed consent regulations.', phi: true },
  { t: 'Clinical guideline adherence audit', o: 'Audit care against evidence-based guidelines.', u: 'Quality, clinical leadership', d: 'EHR orders, results, guidelines', e: 'Improve guideline-concordant care.', r: 'Audit accuracy; PHI; quality reporting.', phi: true },
  { t: 'Root cause analysis facilitation', o: 'Facilitate RCA by organizing event timelines and contributing factors.', u: 'Patient safety, RCA teams', d: 'Event reports, EHR timeline, interviews', e: 'More thorough, faster RCAs.', r: 'Peer-review protections; PHI; PSO confidentiality.', phi: true },

  // --- HR / workforce / IT ---
  { t: 'Clinician onboarding and credentialing assistant', o: 'Streamline provider onboarding and credentialing tasks.', u: 'Medical staff office, HR', d: 'Credentialing applications, primary source data', e: 'Reduce time-to-credential and onboarding delays.', r: 'Credentialing accuracy; sensitive personnel data; NCQA standards.', phi: false },
  { t: 'Employee HR policy Q&A copilot', o: 'Answer employee questions about HR policies and benefits.', u: 'All employees, HR service center', d: 'HR policy and benefits documents', e: 'Reduce HR ticket volume and improve self-service.', r: 'Personnel data privacy; no PHI; employment law.', phi: false },
  { t: 'IT service desk copilot for clinicians', o: 'Resolve common clinical IT issues with guided support.', u: 'Clinical staff, IT service desk', d: 'IT knowledge base, ticket history', e: 'Faster issue resolution and less downtime.', r: 'Access control; minimal PHI in tickets; IT security.', phi: false },
  { t: 'EHR training and support chatbot', o: 'Provide just-in-time EHR workflow guidance.', u: 'Clinicians, EHR trainers', d: 'EHR training materials, workflow guides', e: 'Reduce EHR support burden and improve proficiency.', r: 'Guidance accuracy; no PHI; training governance.', phi: false },
  { t: 'Provider directory maintenance', o: 'Keep provider directory data accurate and current.', u: 'Network management, operations', d: 'Provider records, credentialing, claims activity', e: 'Improve directory accuracy and compliance.', r: 'No Surprises Act directory accuracy; minimal PHI; CMS rules.', phi: false },
  { t: 'Time-and-attendance anomaly detection', o: 'Detect timekeeping anomalies for payroll integrity.', u: 'HR, payroll', d: 'Timekeeping records, scheduling', e: 'Reduce payroll errors and time fraud.', r: 'Employee monitoring fairness; no PHI; labor law.', phi: false },
  { t: 'Clinical recruiting candidate screening', o: 'Screen applicants for clinical roles against requirements.', u: 'Talent acquisition', d: 'Applications, resumes, license data', e: 'Faster screening and better-matched candidates.', r: 'EEOC/AI hiring fairness; no PHI; bias auditing.', phi: false },
  { t: 'Clinician burnout signal monitoring', o: 'Identify burnout signals from workload indicators (de-identified).', u: 'Wellness, clinical leadership', d: 'EHR usage metrics, workload data (aggregate)', e: 'Target wellbeing interventions.', r: 'Employee privacy; de-identified; surveillance concerns.', phi: false },
  { t: 'Continuing education and license tracking', o: 'Track CE credits and license/cert expirations.', u: 'Medical staff office, HR', d: 'License data, CE records', e: 'Reduce lapsed credentials and compliance risk.', r: 'Personnel data; no PHI; licensure regulations.', phi: false },
  { t: 'Badge access audit summarization', o: 'Summarize physical access logs for security review.', u: 'Security, compliance', d: 'Badge access logs', e: 'Faster access reviews and anomaly detection.', r: 'Employee privacy; no PHI; facility security policy.', phi: false },

  // --- Research / specialty / imaging ---
  { t: 'Clinical trial eligibility matching', o: 'Match patients to clinical trials from eligibility criteria.', u: 'Research coordinators, investigators', d: 'EHR diagnoses, labs, trial criteria', e: 'Increase trial enrollment and reduce screening effort.', r: 'Research consent; PHI; IRB and 21 CFR Part 11.', phi: true },
  { t: 'Tumor board literature summarization', o: 'Summarize relevant literature for tumor board cases.', u: 'Oncologists, tumor board', d: 'Published literature, case context', e: 'More informed treatment discussions.', r: 'Evidence accuracy; PHI in case context; citation integrity.', phi: true },
  { t: 'Genomic report interpretation support', o: 'Support interpretation of genomic test results.', u: 'Geneticists, oncologists', d: 'Genomic reports, knowledge bases', e: 'Faster, more consistent variant interpretation.', r: 'Genetic data sensitivity; PHI; GINA protections.', phi: true },
  { t: 'Research cohort discovery', o: 'Discover patient cohorts for research feasibility.', u: 'Researchers, data scientists', d: 'De-identified EHR/data warehouse', e: 'Faster feasibility assessment for studies.', r: 'De-identification standards; IRB; HIPAA research provisions.', phi: false },
  { t: 'Imaging worklist prioritization', o: 'Prioritize imaging worklists by likely acuity.', u: 'Radiologists, imaging operations', d: 'Order indications, modality, priors', e: 'Faster turnaround for critical findings.', r: 'Triage accuracy; PHI; radiologist accountability.', phi: true },
  { t: 'Mammography callback support', o: 'Support callback decisions and patient communication for screening.', u: 'Breast imaging, navigators', d: 'Imaging results, BI-RADS, history', e: 'Timely callbacks and reduced patient anxiety.', r: 'Diagnostic accuracy; PHI; MQSA reporting requirements.', phi: true },
  { t: 'Echocardiogram measurement extraction', o: 'Extract structured measurements from echo reports.', u: 'Cardiologists, sonographers', d: 'Echo reports, measurement data', e: 'Improve structured cardiac data capture.', r: 'Measurement accuracy; PHI; cardiology reporting standards.', phi: true },
  { t: 'Dermatology image triage', o: 'Triage dermatology images to prioritize concerning lesions.', u: 'Dermatologists, teledermatology', d: 'Dermatology images, history', e: 'Faster triage of suspicious lesions.', r: 'FDA SaMD considerations; PHI; clinician confirmation required.', phi: true },
  { t: 'Diabetic retinopathy screening support', o: 'Support diabetic retinopathy screening from retinal images.', u: 'Ophthalmology, primary care', d: 'Retinal images, diabetic status', e: 'Expand screening access and early detection.', r: 'FDA-cleared algorithm requirements; PHI; clinical oversight.', phi: true },
  { t: 'Remote patient monitoring alert summarization', o: 'Summarize and prioritize RPM device alerts for clinicians.', u: 'RPM nurses, care management', d: 'RPM device data, thresholds, patient context', e: 'Reduce alert noise and speed response to real issues.', r: 'Device data reliability; PHI; RPM billing and FDA device rules.', phi: true },
];

async function getToken() {
  try {
    const cached = JSON.parse(fs.readFileSync(TOKEN_CACHE, 'utf8'));
    if (cached.expiresAt && cached.expiresAt - Date.now() > 120000 && cached.accessToken) {
      console.log('Using cached access token.');
      return cached.accessToken;
    }
  } catch {
    /* no usable cache */
  }

  const dcRes = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/devicecode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, scope: `${ORG}/.default offline_access` }),
  });
  const dc = await dcRes.json();
  if (!dc.device_code) throw new Error(`devicecode failed: ${JSON.stringify(dc)}`);
  console.log('\n=== SIGN IN REQUIRED ===');
  console.log(dc.message);
  console.log('========================\n');
  const interval = (dc.interval ?? 5) * 1000;
  const deadline = Date.now() + (dc.expires_in ?? 900) * 1000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, interval));
    const tokRes = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        client_id: CLIENT_ID,
        device_code: dc.device_code,
      }),
    });
    const tok = await tokRes.json();
    if (tok.access_token) {
      try {
        fs.writeFileSync(
          TOKEN_CACHE,
          JSON.stringify({ accessToken: tok.access_token, expiresAt: Date.now() + (tok.expires_in ?? 3600) * 1000 }),
          { mode: 0o600 },
        );
      } catch {
        /* cache best-effort */
      }
      return tok.access_token;
    }
    if (tok.error === 'authorization_pending' || tok.error === 'slow_down') continue;
    throw new Error(`token failed: ${JSON.stringify(tok)}`);
  }
  throw new Error('device code expired before authorization');
}

async function getJson(token, endpoint) {
  const res = await fetch(`${API}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
    },
  });
  if (!res.ok) throw new Error(`GET ${endpoint} failed (${res.status}): ${await res.text()}`);
  return res.json();
}

async function post(token, endpoint, body) {
  const res = await fetch(`${API}${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json; charset=utf-8',
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
      'MSCRM.SolutionUniqueName': SOLUTION,
    },
    body: JSON.stringify(body),
  });
  if (res.status === 204 || res.ok) return;
  throw new Error(`POST ${endpoint} failed (${res.status}): ${await res.text()}`);
}

async function loadExistingTitles(token) {
  const titles = new Set();
  let url = '/afp_idearequirements?$select=afp_title';
  while (url) {
    const page = await getJson(token, url);
    for (const rec of page.value ?? []) {
      if (rec.afp_title) titles.add(rec.afp_title.trim().toLowerCase());
    }
    const next = page['@odata.nextLink'];
    url = next ? next.substring(next.indexOf('/api/data/v9.2') + '/api/data/v9.2'.length) : null;
  }
  return titles;
}

async function main() {
  const token = await getToken();
  const existing = await loadExistingTitles(token);
  console.log(`Found ${existing.size} existing idea(s).`);

  let created = 0;
  let skipped = 0;
  for (const uc of USE_CASES) {
    if (existing.has(uc.t.trim().toLowerCase())) {
      skipped += 1;
      continue;
    }
    await post(token, '/afp_idearequirements', {
      afp_title: uc.t,
      afp_businessobjectives: uc.o,
      afp_intendeduserroles: uc.u,
      afp_datasources: uc.d,
      afp_expectedoutcomes: uc.e,
      afp_riskfactors: uc.r,
      afp_phirequired: uc.phi,
    });
    created += 1;
    console.log(`  + ${uc.t}`);
  }

  console.log(`\nDone. Created ${created}, skipped ${skipped} (already existed).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
