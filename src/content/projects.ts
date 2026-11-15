import type { Project, ProjectLink, Source } from "./schema";

/**
 * Every project on the site. Facts come from the resume (commit 4ac027c), the
 * public repos and Devpost pages, and Stephen's answers (2026-11-15). Copy is a
 * draft until Stephen signs it off.
 */

const RESUME: Source = { label: "Resume, commit 4ac027c (2026-10-27)" };
const SPECS_EVENT = "Learn AR with SPECS (Devpost x Snap)";

const repo = (name: string): ProjectLink => ({
  kind: "repo",
  url: `https://github.com/StephenSook/${name}`,
  label: "Source on GitHub",
});
const film = (id: string): ProjectLink => ({
  kind: "film",
  url: `https://www.youtube.com/watch?v=${id}`,
  label: "Watch the film",
});
/** Posters are frames from Stephen's own films (their YouTube thumbnails), re-encoded to 720 px WebP. */
const poster = (slug: string, alt: string) => ({ src: `/posters/${slug}.webp`, width: 720, height: 405, alt });

const devpost = (slug: string): ProjectLink => ({
  kind: "devpost",
  url: `https://devpost.com/software/${slug}`,
  label: "Devpost page",
});
/**
 * A live demo link. It is listed only with a check: a GET past the home page whose
 * body contains `expectText` only when the core of the app works. Checks were found
 * and run on 2026-11-15; tests/links re-runs them on every push and daily.
 */
const tryIt = (url: string, checkUrl: string, expectText: string): ProjectLink => ({
  kind: "try",
  url,
  label: "Try it live",
  check: { url: checkUrl, expectText },
});

export const projects: Project[] = [
  // ---------------------------------------------------------------- XR row
  {
    slug: "case-light",
    title: "Case Light",
    line: "Snap Specs Lens that drills new mail carriers on a real-size case from memory.",
    platform: "Snap Specs Lens, Lens Studio preview",
    group: "xr",
    order: 1,
    // V-LIVE: Devpost case-light; results date from the Devpost event (Nov 19, 2026)
    result: { state: "waiting", event: SPECS_EVENT, resultsDate: "2026-11-19", source: { label: "Devpost event page" } },
    solo: true,
    repo: "StephenSook/case-light",
    poster: poster(
      "case-light",
      "Title frame of the Case Light film: a wireframe mail case in the Lens Studio preview with one slot outlined in blue.",
    ),
    links: [repo("case-light"), film("lymPgfFXAZ4"), devpost("case-light")],
    caseStudy: {
      evidence:
        "Submitted to Learn AR with SPECS (Devpost x Snap) on Nov 4, 2026, with a public repo and a film of the Lens Studio preview.",
      myPart:
        "Solo build. I wrote the brief and the done criteria, made the design calls, and directed CLAD, which built and tested the Lens through the Lens Studio MCP. After two outside reviews I made the recall pass the point of the drill.",
      howItWorks:
        "A sample mail case of 6 shelves of 40 one-inch cells goes on a real wall. In practice mode each letter's slot lights. " +
        "In recall mode the case stays dark, you place the same letters from memory, and a miss lights the right slot. " +
        "Routes use real house numbers from OpenStreetMap on two streets near KSU, not a USPS route. " +
        "Built in Lens Studio 5.23.2 with CLAD through the Lens Studio MCP: specs-interaction-recipes for grab and snap, " +
        "specs-world-query for wall placement, shader-graph for the slot glow, and LEAF for automated tests.",
      engineering:
        "Lens Studio 5.23.2, CLAD and the Lens Studio MCP (2,860 calls in all). 47 LEAF test scenarios and 124 unit tests. " +
        "CI runs a full-history secret scan and a repo check on every push.",
      measured: {
        value: "47 of 47",
        label: "LEAF test scenarios passing in the last full run (Nov 4, 2026)",
        source: { label: "Case Light README", url: "https://github.com/StephenSook/case-light#readme" },
      },
      whatBroke:
        "One pinch pressed two buttons at once, so that bug got its own test. LEAF's ray strategy did not converge at the case's distance, " +
        "so the test hand presses those buttons directly. The sound tool's engine did not start, so the tones came from a short script.",
      sources: [
        { label: "Case Light README", url: "https://github.com/StephenSook/case-light#readme" },
        { label: "Case Light on Devpost", url: "https://devpost.com/software/case-light" },
      ],
    },
  },
  {
    slug: "glare-zone",
    title: "Glare Zone",
    line: "Snap Specs Lens that shows where gallery-light glare lands for three eye heights.",
    platform: "Snap Specs Lens, Lens Studio preview",
    group: "xr",
    order: 2,
    result: { state: "waiting", event: SPECS_EVENT, resultsDate: "2026-11-19", source: { label: "Devpost event page" } },
    solo: true,
    repo: "StephenSook/glare-zone",
    disclosure: "Glare reach is computed from geometry and the manufacturer's data, not measured with a light meter.",
    poster: poster(
      "glare-zone",
      "Title frame of the Glare Zone film: two framed prints under gallery lights, with the seated glare zone shaded on the floor.",
    ),
    links: [repo("glare-zone"), film("TMuU6nUypQo"), devpost("glare-zone")],
    caseStudy: {
      evidence:
        "Submitted to Learn AR with SPECS (Devpost x Snap) on Nov 4, 2026, with a public repo and a film of the Lens Studio preview.",
      myPart:
        "Solo build, made on my Windows PC while Case Light ran on my Mac. CLAD did the building; my job was the brief, the decisions, and catching what the tests could not prove.",
      howItWorks:
        "Glare Zone draws on the floor in front of a framed print how far a gallery light's reflection in the glass reaches toward three eye heights: " +
        "160 cm standing, 109 cm seated in a wheelchair, and 104 cm for a child wheelchair user. " +
        "The lamp uses the TSLight RXT13's published photometry, and the reach comes from mirror geometry, z_hit = ze + (H - ze) x / (x + d). " +
        "Place on a wall uses World Query hit tests to put the practice wall on a real wall, and a sound cue plays when all three heights are clear.",
      engineering:
        "Lens Studio 5.23.2, CLAD and the Lens Studio MCP (42 sessions, about 2,722 tool calls). " +
        "55 unit tests for the glare math and placement run in CI with a secret scan; 28 LEAF test scenarios.",
      measured: {
        value: "28 of 28",
        label: "LEAF test scenarios passing in the last full run (Nov 4, 2026)",
        source: { label: "Glare Zone README", url: "https://github.com/StephenSook/glare-zone#readme" },
      },
      whatBroke:
        "At 2 m the view could not fit the print and the answer together, so it starts at 3 m. A light 65 cm from the wall still put the child's glare " +
        "in the viewing area, so the demo moved it to 62 cm. A Codex review caught a mistake in how I explained it: tilting a light does not move the reflection by itself.",
      sources: [
        { label: "Glare Zone README", url: "https://github.com/StephenSook/glare-zone#readme" },
        { label: "Glare Zone on Devpost", url: "https://devpost.com/software/glare-zone" },
      ],
    },
  },
  {
    slug: "xr-dojo",
    title: "XR Dojo",
    line: "AR gameplay in Unity C# and a browser port in React Three Fiber.",
    platform: "Unity (C#), React Three Fiber, phone marker AR",
    group: "xr",
    order: 3,
    result: { state: "role", role: "Software Engineer Intern", org: "XR Dojo", start: "2026-03" },
    // Company repos are private: no repo link, no Try link, no media of other people.
    links: [],
    caseStudy: {
      evidence: "Software Engineer Intern at XR Dojo, an Atlanta XR studio, since March 2026.",
      myPart:
        "I shipped gameplay features for ATL Quest, an AR mobile game in Unity (C#) for XR headsets and phones. " +
        "I ported a soccer throw mini-game I made in Unity to React Three Fiber with Rapier physics, to test a browser path. " +
        "I built the Next.js app shell, a marker-based phone AR mode, and a camera-free preview for demos away from the real site.",
      howItWorks:
        "The game runs in Unity (C#) on headsets and phones. The browser port rebuilds the soccer throw in React Three Fiber, " +
        "and Rapier runs the ball physics. A Next.js shell holds the game. The phone AR mode tracks a printed marker with MindAR. " +
        "The camera-free preview runs the same scene without a camera, so the game can be shown anywhere.",
      engineering:
        "Unity and C#; React Three Fiber, Rapier, Next.js and TypeScript; MindAR for marker tracking. " +
        "The company repositories are private, so this page links no code.",
      sources: [RESUME, { label: "Stephen's confirmation, 2026-11-15" }],
    },
  },

  // ---------------------------------------------------------- software row
  {
    slug: "varsity",
    title: "VARSITY",
    line: "Screen-reader-first explainer that narrates VAR and offside calls for blind fans.",
    // Stack from the repo itself (apps/web is React 19 + Vite 6; services is FastAPI).
    platform: "Web: React and Vite, Python FastAPI",
    group: "software",
    order: 4,
    // resume: "Won IBM's $5,000 Grand Prize and Most Innovative of 98 teams"; $750 is V-REC
    // (organizer public announcement, 2026-07-17); event name from the repo README
    result: {
      state: "placed",
      prize: "Grand Prize, $5,000, and Most Innovative, $750, of 98 teams",
      event: "IBM SkillsBuild AI Builders Challenge (June)",
      source: { label: "Resume, commit 4ac027c; amount from the organizer announcement" },
    },
    solo: true,
    repo: "StephenSook/varsity",
    poster: poster(
      "varsity",
      "Title frame of the VARSITY film: a stadium at night with the offside line drawn on the pitch.",
    ),
    links: [
      // The backend's signed-corpus check: real backend computation, no model call.
      tryIt("https://web-chi-wine-13.vercel.app", "https://varsity-api.onrender.com/corpus_integrity", '"verified":true'),
      repo("varsity"),
      film("7e88hmX8Puw"),
    ],
    caseStudy: {
      evidence:
        "Grand Prize and Most Innovative at the IBM SkillsBuild AI Builders Challenge, against 98 teams.",
      myPart: "Solo build, in 159 CI-gated pull requests.",
      howItWorks:
        "VARSITY takes a VAR or offside decision, retrieves the governing Law of the Game, computes the offside geometry from StatsBomb 360 " +
        "freeze-frames, writes a plain-language explanation, and speaks it through the fan's own screen reader. " +
        "The IFAB Laws were parsed with Docling into a FAISS index. IBM watsonx Granite drafts the prose, and a deterministic gate rejects " +
        "any answer that fails to cite the governing Law, so the model is never the last word. " +
        "FastAPI streams the result over server-sent events into an aria-live region.",
      engineering:
        "React 19, Vite 6, TypeScript and Tailwind CSS on the front end; Python and FastAPI on the back end; IBM Granite and Granite Guardian on watsonx. " +
        "CI runs lint, typecheck, tests, build and an axe accessibility check on every push.",
      measured: {
        value: "Hit@5 = 1.00",
        label: "retrieval of the governing Law on a 20-question golden set (BM25)",
        source: { label: "VARSITY README", url: "https://github.com/StephenSook/varsity#readme" },
      },
      sources: [
        { label: "VARSITY README", url: "https://github.com/StephenSook/varsity#readme" },
        RESUME,
      ],
    },
  },
  {
    slug: "instanter",
    title: "Instanter",
    line: "Agent that computes Georgia eviction answer deadlines and stops to ask a licensed attorney.",
    platform: "AWS agent stack, iOS and Android",
    group: "software",
    order: 5,
    // resume: "Silver Agent, $3,000, AWS Agents for Humans"; V-REC winner badges
    result: { state: "placed", prize: "Silver Agent, $3,000", event: "AWS Agents for Humans", source: RESUME },
    solo: true,
    repo: "StephenSook/instanter",
    disclosure: "All demo data is synthetic and labelled in the product; the statutory rules are real and public.",
    poster: poster(
      "instanter",
      "Title frame of the Instanter film: 4 of 46 Georgia eviction deadlines are ones counting seven days by hand gets wrong.",
    ),
    links: [
      // Re-runs the deadline engine on every request.
      tryIt(
        "https://d2ew2t4uldglcr.cloudfront.net",
        "https://d2ew2t4uldglcr.cloudfront.net/api/stats",
        '"deadlines_computed": 46',
      ),
      repo("instanter"),
      film("AyvxUeE9sCs"),
      devpost("instanter"),
    ],
    caseStudy: {
      evidence: "Silver Agent and $3,000 in the Professional track of AWS Agents for Humans. Built solo.",
      myPart: "Solo build: the agent graph, the deadline engine, the AWS stack, and the iOS and Android apps.",
      howItWorks:
        "Instanter watches every answer-deadline clock in an eviction-defense queue. Each deadline is computed in plain Python from the " +
        "Georgia statute (O.C.G.A. 44-7-51), not by a model. A Strands Agents graph of three nodes, analyst, writer and drafter, runs on " +
        "Amazon Bedrock AgentCore with Amazon Nova models. Before a risky step, a BeforeToolCallEvent hook calls event.interrupt(), and the " +
        "agent stops to ask a licensed attorney, with its state saved to S3. EventBridge Scheduler starts a sweep at 7 am on weekdays.",
      engineering:
        "Python with uv, pytest, ruff and mypy in CI. Strands Agents, Bedrock AgentCore, Nova, Lambda behind CloudFront, DynamoDB, " +
        "S3 Object Lock in compliance mode, and EventBridge Scheduler. React Native apps for iOS (TestFlight) and Android.",
      measured: {
        value: "4 of 46",
        label: "answer deadlines in the corpus that counting seven days by hand gets wrong",
        source: { label: "Instanter README", url: "https://github.com/StephenSook/instanter#readme" },
      },
      whatBroke:
        "Adversarial review kept finding fail-open paths. My first approval digest compared the state to itself, so it could never fail. " +
        "The account's Lambda concurrency limit was 10, not the 1,000 I assumed. React Native's SafeAreaView is a silent no-op on Android.",
      sources: [
        { label: "Instanter README", url: "https://github.com/StephenSook/instanter#readme" },
        { label: "Instanter on Devpost", url: "https://devpost.com/software/instanter" },
      ],
    },
  },
  {
    slug: "aloud",
    title: "Aloud",
    line: "Voice-first skincare assistant a blind shopper can use alone with the screen off.",
    platform: "Web, iOS and Android from one codebase",
    group: "software",
    order: 6,
    // resume: "Won 1st of 238 and $5,000, YouCam API Hackathon"; V-REC winner email
    result: { state: "placed", prize: "1st of 238, $5,000", event: "YouCam API Hackathon", source: RESUME },
    // Solo: Stephen's confirmation, 2026-11-15.
    solo: true,
    repo: "StephenSook/aloud",
    poster: poster("aloud", "Frame from the Aloud film: Stephen takes a selfie on an iPhone, framed by sound alone."),
    links: [
      // A product read: a live Open Beauty Facts lookup turned into the spoken summary.
      tryIt("https://aloudbeauty.vercel.app", "https://aloudbeauty.vercel.app/api/product/3337875597197", '"status":"found"'),
      repo("aloud"),
      film("2rPntXmDqHQ"),
      devpost("aloud-lxqr70"),
    ],
    caseStudy: {
      evidence: "1st of 238 submissions and $5,000 at the YouCam API hackathon (Perfect Corp).",
      myPart: "Solo build: the voice loop, the screen-off selfie capture, the skin analysis and the web, iOS and Android apps.",
      howItWorks:
        "Aloud talks a blind shopper through skincare with the screen off. Voice runs on OpenAI Realtime over WebRTC, with Deepgram and " +
        "ElevenLabs as the fallback. MediaPipe face detection guides a selfie by sound, then the YouCam Skin Analysis API scores it: the app " +
        "registers the image, uploads it to a presigned URL, creates a task and polls for the result. Every spoken skin read is grounded in " +
        "those scores. Barcode scans read ingredients from Open Beauty Facts and the EU CosIng list.",
      engineering:
        "Next.js App Router and TypeScript on Vercel, Capacitor shells for iOS and Android, and a Vercel AI SDK tool loop. " +
        "87 unit tests and 16 end-to-end tests; CI gates a linter that blocks medical claims.",
      measured: {
        value: "10 of 10",
        label: "screen-off selfie captures accepted by the analysis on a real iPhone, each under 30 seconds",
        source: { label: "Aloud on Devpost", url: "https://devpost.com/software/aloud-lxqr70" },
      },
      sources: [
        { label: "Aloud README", url: "https://github.com/StephenSook/aloud#readme" },
        { label: "Aloud on Devpost", url: "https://devpost.com/software/aloud-lxqr70" },
        RESUME,
        { label: "Stephen's confirmation that Aloud was a solo build, 2026-11-15" },
      ],
    },
  },

  // ------------------------------------------------------------------ bench
  {
    slug: "lullabuy",
    title: "Lullabuy",
    line: "Resale checkout that holds a Visa payment until a label photo clears 1,207 recalls.",
    platform: "Web and Expo mobile",
    group: "bench",
    order: 1,
    result: { state: "placed", prize: "$5,000 Visa track", event: "HackGT 13", source: RESUME },
    repo: "StephenSook/secondhand-safe",
    links: [
      // The recall lookup behind the held payment.
      tryIt("https://lullabuy.tech", "https://lullabuy.tech/api/check?model=BHC001&batch=202408", '"kind":"RECALL_MATCH"'),
      repo("secondhand-safe"),
      film("bLZc5eh2kqc"),
    ],
  },
  {
    slug: "hold",
    title: "HOLD",
    line: "Provably cheapest film shooting schedule, with child-performer and SAG-AFTRA legality checks.",
    platform: "Web: CP-SAT solver and Google ADK agents",
    group: "bench",
    order: 2,
    // resume + V-REC field size (winner email, project badge, gallery ribbon)
    result: {
      state: "placed",
      prize: "3rd, $3,000, IBM track, 891 projects",
      event: "Agentic Cinema",
      source: { label: "Resume, commit 4ac027c; field size from the organizer winner email" },
    },
    repo: "StephenSook/hold",
    links: [
      // Re-checks all 70 rule citations on every request (the solver itself is POST only).
      tryIt(
        "https://hold-fwmdq7fc3q-uc.a.run.app",
        "https://hold-fwmdq7fc3q-uc.a.run.app/api/rules",
        '"verification_problems":[]',
      ),
      repo("hold"),
      film("Of5Z7NGjGSI"),
    ],
  },
  {
    slug: "throughline",
    title: "Throughline",
    line: "Record-integrity layer that checks what one institution asserts against independent authorities.",
    platform: "Web: Python and FastAPI",
    group: "bench",
    order: 3,
    result: { state: "placed", prize: "Best Use of Gemma 4", event: "Hack RenderATL", source: RESUME },
    repo: "StephenSook/throughline",
    links: [
      // The backend reconciles against five live public sources.
      tryIt(
        "https://throughline-web-gkay.onrender.com",
        "https://throughline-api-yo1p.onrender.com/api/summary",
        '"sources_ok":5,"sources_total":5',
      ),
      repo("throughline"),
      film("hB_IVUN7gCo"),
    ],
  },
  {
    slug: "loka-pay",
    title: "LOKA Pay",
    line: "iPhone with zero bars pays a shop by QR; the shop settles on Solana.",
    platform: "iOS (Swift) and Solana",
    group: "bench",
    order: 4,
    result: { state: "placed", prize: "Best Use of Solana", event: "Hacklanta", source: RESUME },
    // Repo is private: no repo link.
    links: [film("S_rAXEYMkOI"), devpost("loka-pay")],
  },
  {
    slug: "accessgate",
    title: "AccessGate",
    line: "Local, explainable film accessibility pre-check for captions and audio description.",
    platform: "Web",
    group: "bench",
    order: 5,
    // resume + V-REC field size (payout W-9, recorded judges' feedback)
    result: {
      state: "placed",
      prize: "Most Innovative, $750, 327 entries",
      event: "IBM AI Builders Challenge (July)",
      source: { label: "Resume, commit 4ac027c; field size from the organizer payout records" },
    },
    repo: "StephenSook/accessgate",
    links: [repo("accessgate"), film("8PHTCRGrWxM")],
  },
  {
    slug: "eleven",
    title: "Eleven",
    line: "Screenless reply and errand assistant for people who cannot speak or use their hands.",
    platform: "Web, EEG headset and earpiece",
    group: "bench",
    order: 6,
    result: { state: "placed", prize: "2nd of 148, $1,000, Apify track", event: "Cal Hacks 13.0", source: RESUME },
    // Backend is shut down: repo and film only.
    repo: "StephenSook/say-when",
    links: [repo("say-when"), film("HHcyu21N99Y"), devpost("eleven-j84ur5")],
  },
  {
    slug: "recall-reach",
    title: "Recall Reach",
    line: "Matches new CPSC recalls to a shop's past PayPal sales.",
    platform: "Web",
    group: "bench",
    order: 7,
    // Winners are announced Dec 21, 2026 (Stephen's records)
    result: { state: "waiting", event: "PayPal AI Hackathon", resultsDate: "2026-12-21", source: { label: "Event page" } },
    repo: "StephenSook/recall-reach",
    links: [
      // Health route that queries the database and reports CPSC poll freshness.
      tryIt(
        "https://recall-reach-web-e022.onrender.com/judge",
        "https://recall-reach-web-e022.onrender.com/api/health",
        '"checks":{"database":true',
      ),
      repo("recall-reach"),
      film("SJHaOFci2Fk"),
    ],
  },
  {
    slug: "chat-vs-codex",
    title: "Chat vs Codex",
    line: "Twitch chat breaks real code and Codex races to fix it.",
    platform: "Web and Twitch",
    group: "bench",
    order: 8,
    result: { state: "waiting", event: "Codex x TwitchCon", source: { label: "Event page" } },
    repo: "StephenSook/chat-vs-codex",
    links: [repo("chat-vs-codex"), film("25q8o5AT_1w")],
  },
  {
    slug: "cast-forecast",
    title: "Cast Forecast",
    line: "Measured mineral sunscreen white cast, shown on your own selfie.",
    platform: "Web",
    group: "bench",
    order: 9,
    result: { state: "waiting", event: "YouCam API Hackathon, round two", resultsDate: "2026-11-24", source: { label: "Event page" } },
    repo: "StephenSook/cast-forecast",
    links: [repo("cast-forecast"), film("sUUfVjgdH28")],
  },

  // ---------------------------------------------------------------- archive
  {
    slug: "trace",
    title: "Trace",
    line: "Semantic bridge between family descriptions and forensic records for missing persons.",
    platform: "Web: Actian VectorAI DB",
    group: "archive",
    order: 1,
    result: { state: "placed", prize: "1st of 22", event: "Actian", source: RESUME },
    disclosure: "Built and shown on disclosed synthetic records, not real cases.",
    repo: "StephenSook/trace-forensic-search",
    links: [repo("trace-forensic-search")],
  },
  {
    slug: "stepsafe",
    title: "StepSafe",
    line: "Diabetic foot ulcer photo classification with confidence scores.",
    platform: "Web: React, FastAPI and TensorFlow",
    group: "archive",
    order: 2,
    result: { state: "placed", prize: "1st", event: "HMI Hackathon 2026", source: RESUME },
    repo: "StephenSook/StepSafe",
    links: [repo("StepSafe")],
  },
  {
    slug: "pyrolens",
    title: "PyroLens",
    line: "Prescribed-burn decision support from IoT sensors and weather data.",
    platform: "Web",
    group: "archive",
    order: 3,
    result: { state: "placed", prize: "2nd and 3rd", event: "KSU Social Good", source: RESUME },
    repo: "StephenSook/PyroLens",
    links: [repo("PyroLens"), film("Yijp3Ne8Hgo")],
  },
];
