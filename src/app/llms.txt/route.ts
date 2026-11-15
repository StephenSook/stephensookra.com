import { archive, awardStats, bench, featured, profile, proofLine } from "@/content";
import { resultText } from "@/components/ResultLine";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

/** A plain-text summary for language models (llmstxt.org format), built from the content source. */
export async function GET(): Promise<Response> {
  const line = (title: string, url: string, note: string) => `- [${title}](${url}): ${note}`;
  const workLine = (p: (typeof featured)[number]) => {
    const { lead, detail } = resultText(p.result);
    return line(p.title, `${SITE_URL}/work/${p.slug}`, `${p.line} ${lead}${detail ? `, ${detail}` : ""}.`);
  };

  const body = [
    `# ${profile.name}`,
    "",
    `> ${profile.roleLine}`,
    "",
    proofLine(),
    `${profile.education.degree}, ${profile.education.school}, expected ${profile.education.expected}.`,
    "",
    "## Featured work",
    "",
    ...featured.map(workLine),
    "",
    "## More work",
    "",
    ...[...bench, ...archive].map((p) => `- ${p.title}: ${p.line}`),
    "",
    "## Pages",
    "",
    line("Resume", `${SITE_URL}/resume`, "experience, projects, skills, education, and the PDF"),
    line("About", `${SITE_URL}/about`, "story, experience and education"),
    line("Proof", `${SITE_URL}/proof`, "films, live links, repos with live CI status, and a measured load time"),
    "",
    "## Contact",
    "",
    `- Email: ${profile.email}`,
    `- GitHub: ${profile.links.github}`,
    `- LinkedIn: ${profile.links.linkedin}`,
    "",
    `${awardStats.awards} awards across ${awardStats.events} events are listed at ${SITE_URL}/resume.`,
    "",
  ].join("\n");

  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
