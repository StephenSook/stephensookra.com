import type { Award, Source } from "./schema";

/**
 * Every award, in the resume's own wording (resume commit 4ac027c, 2026-10-27:
 * "22 awards across 20 events"). Extra details beyond that wording (field sizes,
 * amounts, full event names) appear only when Stephen's records hold organizer
 * evidence (V-REC) or a live public source confirms them (V-LIVE).
 *
 * Provenance labels in the comments:
 *   resume = on the resume only (self-reported, signed off by Stephen)
 *   V-REC  = organizer evidence recorded (winner email, badge, announcement)
 *   V-LIVE = checked against a public source on 2026-11-15
 */
const RESUME: Source = { label: "Resume, commit 4ac027c (2026-10-27)" };

export const awards: Award[] = [
  // resume: "2nd of 148, $1,000, Apify track, Cal Hacks 13.0"
  { project: "Eleven", event: "Cal Hacks 13.0", prize: "2nd of 148, $1,000, Apify track", source: RESUME },
  // resume + V-REC (projector slide, team page, prize form)
  { project: "Hey Sync", event: "HackATL 2026", prize: "2nd, $4,000", source: RESUME },
  // resume + V-REC (official project page and winner badges)
  { project: "Instanter", event: "AWS Agents for Humans", prize: "Silver Agent, $3,000", source: RESUME },
  // resume + V-REC: "891 projects" from the winner email, project badge and gallery ribbon
  {
    project: "HOLD",
    event: "Agentic Cinema",
    prize: "3rd, $3,000, IBM track, 891 projects",
    source: { label: "Resume, commit 4ac027c; field size from the organizer winner email" },
  },
  // resume: "Best Use of Solana, Hacklanta"
  { project: "LOKA Pay", event: "Hacklanta", prize: "Best Use of Solana", source: RESUME },
  // resume + V-REC (closing ceremony, organizer prize card)
  { project: "Lullabuy", event: "HackGT 13", prize: "$5,000 Visa track", source: RESUME },
  // resume; event name V-LIVE from the public repo description "BIT Atlanta Code for Change 2026"
  { project: "Upstander", event: "BIT Atlanta Code for Change", prize: "1st, $2,000", source: RESUME },
  // resume ("IBM AI Builders: Best Use of Technology, $750"); month from Stephen's records
  {
    project: "Manifest",
    event: "IBM AI Builders Challenge (August)",
    prize: "Best Use of Technology, $750",
    source: RESUME,
  },
  // resume + V-REC (winner email and prize-claim clause)
  { project: "Aloud", event: "YouCam API Hackathon", prize: "1st of 238, $5,000", source: RESUME },
  // resume: "2nd, Rote Playoffs" (no project named)
  { event: "Rote Playoffs", prize: "2nd", source: RESUME },
  // resume: "1st, ToC Chaos Challenge"
  { project: "Parliament", event: "ToC Chaos Challenge", prize: "1st", source: RESUME },
  // resume + V-REC (MLH confirmation email, 2026-08-20)
  { project: "Throughline", event: "Hack RenderATL", prize: "Best Use of Gemma 4", source: RESUME },
  // resume + V-REC: "327 entries" from the payout W-9 and recorded judges' feedback;
  // month V-LIVE from the public repo description "IBM AI Builders Challenge July 2026"
  {
    project: "AccessGate",
    event: "IBM AI Builders Challenge (July)",
    prize: "Most Innovative, $750, 327 entries",
    source: { label: "Resume, commit 4ac027c; field size from the organizer payout records" },
  },
  // resume: "IBM's $5,000 Grand Prize and Most Innovative of 98 teams";
  // V-REC: the $750 from the organizer public announcement (2026-07-17);
  // V-LIVE: event name from the public repo README ("IBM SkillsBuild AI Builders Challenge (June 2026)")
  {
    project: "VARSITY",
    event: "IBM SkillsBuild AI Builders Challenge (June)",
    prize: "Grand Prize, $5,000, of 98 teams",
    source: RESUME,
  },
  {
    project: "VARSITY",
    event: "IBM SkillsBuild AI Builders Challenge (June)",
    prize: "Most Innovative, $750, of 98 teams",
    source: { label: "Resume, commit 4ac027c; amount from the organizer announcement" },
  },
  // resume: "1st of 22, Actian"
  { project: "Trace", event: "Actian", prize: "1st of 22", source: RESUME },
  // resume; event name V-LIVE from the public repo description "First place, HMI Hackathon 2026"
  { project: "StepSafe", event: "HMI Hackathon 2026", prize: "1st", source: RESUME },
  // resume: "2nd + 3rd, KSU Social Good" (two awards at one event)
  { project: "PyroLens", event: "KSU Social Good", prize: "2nd", source: RESUME },
  { project: "PyroLens", event: "KSU Social Good", prize: "3rd", source: RESUME },
  // resume: "3rd, Vibra ATL"
  { project: "Saber", event: "Vibra ATL", prize: "3rd", source: RESUME },
  // resume: "3rd, KSU FinTech"
  { project: "EchoPay", event: "KSU FinTech", prize: "3rd", source: RESUME },
  // resume: "2nd of 4,700+, Wells Fargo x GCA"
  { project: "SafeHaven", event: "Wells Fargo x GCA", prize: "2nd of 4,700+", source: RESUME },
];
