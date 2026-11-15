import type { Metadata } from "next";
import Link from "next/link";
import { CaseLightBridge } from "@/components/CaseLightBridge";
import { CasePoster } from "@/components/CasePoster";
import { CaseStage } from "@/components/CaseStage";
import { XrDoor } from "@/components/XrDoor";
import { doorNote, xrTests } from "@/content/measurements/xr";
import { ProjectRow } from "@/components/ProjectRow";
import { featured } from "@/content";

export const metadata: Metadata = {
  title: "The case",
  description: "The lit letter case: every featured project in its slot. Point at a slot to light it, click to open it.",
  alternates: { canonical: "/case" },
};

export default function CasePage() {
  const xr = featured.filter((p) => p.group === "xr");
  const software = featured.filter((p) => p.group === "software");
  return (
    <CaseLightBridge>
      <section className="frame page-head case-page__head">
        <h1>The case</h1>
        {/* DRAFT copy, awaiting Stephen's sign-off. */}
        <p className="prose muted">
          Every featured project has a slot. Point at a slot to light it, and click to open the project. The same
          projects are listed below.
        </p>
      </section>
      <div className="case-page__stage">
        <CaseStage variant="full">
          <CasePoster />
        </CaseStage>
        <XrDoor note={doorNote(xrTests)} />
      </div>
      <div className="frame section">
        <div className="case">
          <ProjectRow id="xr" letter="A" heading="XR work" projects={xr} />
          <ProjectRow id="software" letter="B" heading="Software work" projects={software} />
        </div>
        <p className="case-more">
          <Link href="/work">All work</Link>
        </p>
      </div>
    </CaseLightBridge>
  );
}
