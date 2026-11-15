import type { ProjectLink } from "@/content";

const ORDER: Record<ProjectLink["kind"], number> = { try: 0, film: 1, repo: 2, devpost: 3 };

/** A project's outside links: Try (only when its core-path check passes), film, repo, Devpost. */
export function ProjectLinks({ links }: { links: ProjectLink[] }) {
  if (links.length === 0) return null;
  const sorted = [...links].sort((a, b) => ORDER[a.kind] - ORDER[b.kind]);
  return (
    <ul className="project-links">
      {sorted.map((link) => (
        <li key={link.url} data-kind={link.kind}>
          <a href={link.url}>{link.label}</a>
        </li>
      ))}
    </ul>
  );
}
