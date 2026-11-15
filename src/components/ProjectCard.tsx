import Image from "next/image";
import Link from "next/link";
import type { Project } from "@/content";
import type { RepoStatus } from "@/lib/github";
import { RepoStatusView } from "./RepoStatus";
import { ResultLine } from "./ResultLine";

type Props = {
  project: Project;
  /** Position in the case, such as "A1": row letter and column number. */
  slotLabel: string;
  status?: RepoStatus;
  /**
   * How the poster loads. "lazy" (default) waits until it nears the viewport;
   * "eager" loads it at high priority for first-screen slots; "preload" also adds a
   * <link rel="preload"> in the head, for the one poster that is the largest paint.
   */
  posterLoad?: "lazy" | "eager" | "preload";
};

/**
 * One slot in the case. The title is the only link; its ::after stretches over
 * the whole slot, so the slot is one click target and one tab stop.
 */
export function ProjectCard({ project, slotLabel, status, posterLoad = "lazy" }: Props) {
  const loadProps =
    posterLoad === "preload"
      ? { preload: true }
      : posterLoad === "eager"
        ? ({ loading: "eager", fetchPriority: "high" } as const)
        : ({ loading: "lazy" } as const);
  return (
    <article className="slot" data-slot={slotLabel}>
      <span className="slot__label mono" aria-hidden="true">
        {slotLabel}
      </span>
      {project.poster ? (
        <Image
          className="slot__poster"
          src={project.poster.src}
          width={project.poster.width}
          height={project.poster.height}
          alt={project.poster.alt}
          sizes="(min-width: 1280px) 360px, (min-width: 768px) 30vw, 46vw"
          {...loadProps}
        />
      ) : (
        // No public media (XR Dojo's work is company property): the platform stands in for the poster.
        <p className="slot__poster slot__poster--type">{project.platform}</p>
      )}
      <div className="slot__body">
        <h3 className="slot__title">
          <Link className="slot__link" href={`/work/${project.slug}`}>
            {project.title}
          </Link>
        </h3>
        <p className="slot__line">{project.line}</p>
        {project.poster ? <p className="slot__platform">{project.platform}</p> : null}
        <ResultLine result={project.result} />
        {project.solo ? <p className="slot__solo">Solo build</p> : null}
        {status ? <RepoStatusView status={status} /> : null}
      </div>
    </article>
  );
}
