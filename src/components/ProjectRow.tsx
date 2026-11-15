import type { Project } from "@/content";
import type { RepoStatus } from "@/lib/github";
import { ProjectCard } from "./ProjectCard";

type Props = {
  id: "xr" | "software";
  /** Row letter used in slot labels, A for the top row. */
  letter: string;
  heading: string;
  projects: Project[];
  statuses?: Record<string, RepoStatus>;
  priorityPosters?: boolean;
};

/** One row of the case. data-row lets the first-screen links light the whole row. */
export function ProjectRow({ id, letter, heading, projects, statuses = {}, priorityPosters = false }: Props) {
  return (
    <section id={id} className="case-row" data-row={id} aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className="case-row__heading">
        {heading}
      </h2>
      <div className="case-row__slots">
        {projects.map((project, i) => (
          <ProjectCard
            key={project.slug}
            project={project}
            slotLabel={`${letter}${i + 1}`}
            status={project.repo ? statuses[project.repo] : undefined}
            priority={priorityPosters}
          />
        ))}
        {/* An empty pigeonhole keeps the two-column phone grid square when the row is odd. */}
        {projects.length % 2 === 1 ? <div className="slot-empty" aria-hidden="true" /> : null}
      </div>
    </section>
  );
}
