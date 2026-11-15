/**
 * The resume as HTML, transcribed from the LaTeX source at ~/dev/resume, commit
 * 4ac027c (2026-10-27). The PDF served at /resume/Stephen_Sookra_Resume.pdf is
 * the same build; tests check the hash and that every bullet below appears in it.
 * Edit the resume in its own repo first, then copy the PDF and update this file.
 */
export const resume = {
  pdf: {
    path: "/resume/Stephen_Sookra_Resume.pdf",
    sha256: "b49c1feac4c6214b0f52362b90b01878de423f36b06c721236bdd0471e67d2a8",
    commit: "4ac027c",
    builtOn: "2026-10-27",
  },
  education: {
    school: "Kennesaw State University",
    place: "Kennesaw, GA",
    degree: "B.S. in Computer Science, Minor in Financial Technologies",
    dates: "Expected May 2028",
    detail: "GPA 3.51 of 4.0, Dean's List three times",
  },
  skills: [
    { label: "Languages", items: ["Python", "Java", "JavaScript", "TypeScript", "SQL", "C++", "C#", "Swift"] },
    {
      label: "Frameworks",
      items: ["React", "React Native", "Next.js", "FastAPI", "LangChain", "TensorFlow", "scikit-learn", "Pandas", "NumPy", "Unity"],
    },
    {
      label: "Infrastructure",
      items: ["Git", "GitHub Actions", "Docker", "CI/CD", "PostgreSQL", "ChromaDB", "FAISS", "Supabase", "Vercel", "Render", "AWS"],
    },
    {
      label: "Concepts",
      items: [
        "Machine Learning",
        "LLMs & RAG",
        "Vector Search",
        "NLP",
        "Computer Vision",
        "Data Structures & Algorithms",
        "WCAG",
      ],
    },
  ],
  experience: [
    {
      title: "Software Engineer Intern",
      org: "XR Dojo",
      place: "Atlanta, GA",
      dates: "March 2026 to now",
      bullets: [
        "Shipped gameplay features for ATL Quest, an AR mobile game in Unity (C#) targeting XR headsets and mobile.",
        "Ported a Unity mini-game to React Three Fiber with Rapier physics to evaluate a browser-based cross-platform path.",
        "Built the Next.js app shell, a marker-based phone AR mode, and a camera-free preview for demos without the physical site.",
      ],
    },
    {
      title: "Founder and Project Lead",
      org: "Nest (Non-Profit Initiative)",
      place: "Atlanta, GA",
      dates: "January 2026 to now",
      bullets: [
        "Founded and led a 3-person team building a retrieval-augmented navigator that turns Georgia's 250-page DFCS transition manual into personalized 90-day plans for youth aging out of foster care.",
        "Built the React/Vite front end and owned the Render deploy; the FastAPI service retrieves passages from a ChromaDB vector store via LangChain, reranks them against the youth's profile, then generates with Llama 3.3 on Groq.",
        "Answered a reviewer's challenge with a fail-closed path: no retrieved passages means no model call, only a 211 referral.",
      ],
    },
    {
      title: "Data Analyst, HBCU Data for Good",
      org: "JPMorganChase",
      place: "Plano, TX",
      dates: "April 2026",
      bullets: [
        "Earned one of 110 seats from 800+ applicants for JPMorganChase's Data for Good, HBCU Student Edition.",
        "Ranked all 357 Tarrant County census tracts for the Fort Worth Community Land Trust using a weighted 8-metric model in pandas, normalizing each metric with scikit-learn MinMaxScaler across 6 HUD datasets.",
        "Mapped OpenStreetMap amenities over Census tracts; a flood-corridor overlay cut recommended targets from 47 tracts to 34.",
      ],
    },
    {
      title: "Teaching Assistant",
      org: "SMASH Academy",
      place: "Atlanta, GA",
      dates: "Summer 2026",
      bullets: [
        "Taught Python, JavaScript, and web/game development to underrepresented high-school scholars at Morehouse and Spelman.",
      ],
    },
  ],
  projects: [
    {
      name: "Eleven",
      stack: "TypeScript, SpacetimeDB, Claude, Cartesia, Apify, Next.js, EEG headset",
      dates: "October 2026",
      url: "https://github.com/StephenSook/say-when",
      bullets: [
        "Co-built (team of 3) an assistant for people who cannot speak or use their hands: they hear Claude's replies in an earpiece, pick one with an imagined hand squeeze (EEG) or a jaw clench, and send forms or calls only after a fresh confirm.",
        "Built the SpacetimeDB backend, agent pipeline, and Apify Actor. Won 2nd of 148, $1,000, Apify track, Cal Hacks 13.0.",
      ],
    },
    {
      name: "Lullabuy",
      stack: "Next.js, TypeScript, Visa Acceptance, CLIP, transformers.js, Gemini, Expo",
      dates: "September 2026",
      url: "https://github.com/StephenSook/secondhand-safe",
      bullets: [
        "Co-built (team of 2) a resale checkout that holds a Visa payment until a label photo clears 1,207 CPSC/NHTSA recalls.",
        "Trained an in-browser CLIP classifier for banned products (held-out macro-F1 0.72 vs. 0.56 zero-shot) and built the web and Expo mobile clients. Won the $5,000 Visa track, HackGT 13.",
      ],
    },
    {
      name: "Aloud",
      stack: "Next.js, TypeScript, OpenAI Realtime, YouCam Skin Analysis API, MediaPipe, Capacitor",
      dates: "August 2026",
      url: "https://github.com/StephenSook/aloud",
      bullets: [
        "Built a voice-first skincare assistant blind shoppers use screen-off: barcode ingredient reads and MediaPipe audio-guided selfies.",
        "Grounded every spoken skin read in YouCam analysis scores, gated CI with a linter that blocks medical claims, and shipped web, iOS, and Android from one codebase. Won 1st of 238 and $5,000, YouCam API Hackathon.",
      ],
    },
    {
      name: "VARSITY",
      stack: "Next.js, TypeScript, Python, FastAPI, IBM watsonx Granite, FAISS",
      dates: "June 2026",
      url: "https://github.com/StephenSook/varsity",
      bullets: [
        "Built a screen-reader-native explainer narrating VAR and offside margins for blind fans from StatsBomb tracking data.",
        "Parsed the IFAB Laws with Docling into a FAISS index (Hit@5 = 1.00); watsonx Granite drafts the prose and a deterministic gate rejects any answer that fails to cite the governing Law, so the model is never the last word.",
        "Built solo in 159 CI-gated PRs. Won IBM's $5,000 Grand Prize and Most Innovative of 98 teams.",
      ],
    },
  ],
  certifications: [
    "CodePath, Web Development",
    "AT&T Technology Academy 2025",
    "Udacity, AWS AI Practitioner Challenge",
    "Anthropic Academy 2026: AI Fluency, Claude 101, Claude Code 101, Claude API, MCP, Agent Skills",
  ],
  /** From the resume's awards line; the award and event counts are derived from the awards list. */
  enteredNote: "30+ entered",
} as const;
