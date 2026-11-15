/**
 * Who Stephen is, in the words the design brief fixed (section 2) and the
 * resume (commit 4ac027c). Copy is a draft until Stephen signs it off.
 */
export const profile = {
  name: "Stephen Sookra",
  title: "Software Engineer, XR",
  jobTitle: "Software Engineer",
  roleLine:
    "Software engineer in Atlanta, focused on XR. I build AR for Snap Specs, 3D for the web, and full-stack apps.",
  aboutLine: "I build tools that show people where to look.",
  location: { city: "Atlanta", region: "GA" },
  email: "stephensookra@gmail.com",
  links: {
    github: "https://github.com/StephenSook",
    linkedin: "https://www.linkedin.com/in/stephen-sookra-633682339/",
    x: "https://x.com/StephenSookra",
    devpost: "https://devpost.com/stephensookra",
  },
  currentRole: { title: "Software Engineer Intern", org: "XR Dojo", start: "2026-03" },
  education: {
    degree: "B.S. Computer Science",
    school: "Kennesaw State University",
    schoolShort: "Kennesaw State",
    expected: "May 2028",
    gpa: "3.51",
  },
  /** JSON-LD knowsAbout. WebXR joins this list only after tier 3 ships it. */
  knowsAbout: ["XR", "Lens Studio", "Unity", "React Three Fiber", "Next.js", "TypeScript", "Python"],
} as const;
