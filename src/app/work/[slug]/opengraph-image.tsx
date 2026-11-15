import { resultText } from "@/components/ResultLine";
import { pagedProjects, profile, projectBySlug } from "@/content";
import { OG_SIZE, renderOgCard } from "@/lib/og";

export const alt = "Project summary card";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return pagedProjects.map((p) => ({ slug: p.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = projectBySlug(slug);
  if (!project) return renderOgCard({ title: profile.name, lines: [profile.title] });
  const { lead } = resultText(project.result);
  return renderOgCard({ title: project.title, lines: [project.line, lead] });
}
