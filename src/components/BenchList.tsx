import type { Project } from "@/content";
import { ProjectLinks } from "./ProjectLinks";
import { ResultLine } from "./ResultLine";

/** "Also built": a compact list with result and outside links, no case-study pages. */
export function BenchList({ projects }: { projects: Project[] }) {
  return (
    <ul className="bench">
      {projects.map((p) => (
        <li key={p.slug} className="bench__item" aria-label={p.title}>
          <h3 className="bench__title">{p.title}</h3>
          <p className="bench__line">{p.line}</p>
          <p className="bench__platform">{p.platform}</p>
          <ResultLine result={p.result} />
          <ProjectLinks links={p.links} />
        </li>
      ))}
    </ul>
  );
}
