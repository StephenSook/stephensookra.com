import { awards } from "./awards";
import { profile } from "./profile";
import { projects } from "./projects";
import type { Project } from "./schema";

export { awards, profile, projects };
export type { Award, CaseStudy, Project, ProjectLink, Result, Source } from "./schema";

const byOrder = (a: Project, b: Project) => a.order - b.order;

export const featured: Project[] = [
  ...projects.filter((p) => p.group === "xr").sort(byOrder),
  ...projects.filter((p) => p.group === "software").sort(byOrder),
];
export const bench: Project[] = projects.filter((p) => p.group === "bench").sort(byOrder);
export const archive: Project[] = projects.filter((p) => p.group === "archive").sort(byOrder);

/** Projects that have their own page at /work/[slug]. */
export const pagedProjects: Project[] = [...featured, ...archive];

export function projectBySlug(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug);
}

/** Counts derived from the awards list, never typed by hand. */
export const awardStats = {
  awards: awards.length,
  events: new Set(awards.map((a) => a.event)).size,
};

export function proofLine(): string {
  const { currentRole, education } = profile;
  return (
    `${awardStats.awards} hackathon awards across ${awardStats.events} events. ` +
    `${currentRole.title} at ${currentRole.org}. CS at ${education.schoolShort}.`
  );
}
