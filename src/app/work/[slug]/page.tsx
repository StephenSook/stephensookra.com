import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CaseStudyView } from "@/components/CaseStudyView";
import { ProjectLinks } from "@/components/ProjectLinks";
import { RepoStatusView } from "@/components/RepoStatus";
import { ResultLine } from "@/components/ResultLine";
import { pagedProjects, projectBySlug } from "@/content";
import { getRepoStatus } from "@/lib/github";

export const revalidate = 86400;
// Only the listed projects have pages; anything else is a real 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return pagedProjects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/work/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const project = projectBySlug(slug);
  if (!project) return {};
  return {
    title: project.title,
    description: project.line,
    alternates: { canonical: `/work/${project.slug}` },
  };
}

export default async function ProjectPage({ params }: PageProps<"/work/[slug]">) {
  const { slug } = await params;
  const project = projectBySlug(slug);
  if (!project || !pagedProjects.includes(project)) notFound();

  const status = project.repo ? await getRepoStatus(project.repo) : undefined;

  return (
    <article className="frame project">
      <header className="project__head">
        <p className="project__back">
          <Link href="/work">Work</Link>
        </p>
        <h1>{project.title}</h1>
        <p className="project__line">{project.line}</p>
        <p className="project__platform">{project.platform}</p>
        <ResultLine result={project.result} />
        {project.solo ? <p className="project__solo">Solo build</p> : null}
        {project.disclosure ? <p className="project__disclosure">{project.disclosure}</p> : null}
        <ProjectLinks links={project.links} />
        {status ? <RepoStatusView status={status} /> : null}
      </header>

      {project.poster ? (
        <Image
          className="project__poster"
          src={project.poster.src}
          width={project.poster.width}
          height={project.poster.height}
          alt={project.poster.alt}
          sizes="(min-width: 1280px) 720px, 100vw"
          priority
        />
      ) : null}

      {project.caseStudy ? (
        <CaseStudyView caseStudy={project.caseStudy} />
      ) : (
        <p className="prose muted">
          An older project, kept here so earlier links still work. The source and the result are above.
        </p>
      )}
    </article>
  );
}
