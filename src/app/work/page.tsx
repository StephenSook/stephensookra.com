import type { Metadata } from "next";
import Link from "next/link";
import { BenchList } from "@/components/BenchList";
import { ProjectRow } from "@/components/ProjectRow";
import { ResultLine } from "@/components/ResultLine";
import { archive, bench, featured } from "@/content";
import { getRepoStatuses } from "@/lib/github";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Work",
  description: "XR work, software work, and everything else Stephen Sookra has built and shipped.",
  alternates: { canonical: "/work" },
};

export default async function WorkPage() {
  const xr = featured.filter((p) => p.group === "xr");
  const software = featured.filter((p) => p.group === "software");
  const statuses = await getRepoStatuses(featured.flatMap((p) => (p.repo ? [p.repo] : [])));

  return (
    <>
      <section className="frame page-head">
        <h1>Work</h1>
        <p className="prose muted">
          {featured.length} projects with their own pages, then {bench.length} more builds and {archive.length}{" "}
          older ones.
        </p>
      </section>

      <div className="frame">
        <div className="case">
          <ProjectRow id="xr" letter="A" heading="XR work" projects={xr} statuses={statuses} />
          <ProjectRow id="software" letter="B" heading="Software work" projects={software} statuses={statuses} />
        </div>
      </div>

      <section className="frame section" aria-labelledby="also-heading">
        <h2 id="also-heading">Also built</h2>
        <BenchList projects={bench} />
      </section>

      <section className="frame section" aria-labelledby="archive-heading">
        <h2 id="archive-heading">Older work</h2>
        <ul className="archive-list">
          {archive.map((p) => (
            <li key={p.slug}>
              <Link href={`/work/${p.slug}`}>{p.title}</Link>
              <span className="muted"> {p.line}</span>
              <ResultLine result={p.result} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
