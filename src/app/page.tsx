import Link from "next/link";
import { AwardsList } from "@/components/AwardsList";
import { CaseLightBridge } from "@/components/CaseLightBridge";
import { CasePoster } from "@/components/CasePoster";
import { CaseStage } from "@/components/CaseStage";
import { XrDoor } from "@/components/XrDoor";
import { doorNote, passthroughNote, xrTests } from "@/content/measurements/xr";
import { ProjectRow } from "@/components/ProjectRow";
import { archive, awards, bench, featured, profile, proofLine } from "@/content";
import { getRepoStatuses } from "@/lib/github";

// Repo facts refresh once a day (matches REVALIDATE_SECONDS in lib/github).
export const revalidate = 86400;

export default async function Home() {
  const xr = featured.filter((p) => p.group === "xr");
  const software = featured.filter((p) => p.group === "software");
  const statuses = await getRepoStatuses(featured.flatMap((p) => (p.repo ? [p.repo] : [])));

  return (
    <CaseLightBridge>
      <section className="frame hero" aria-labelledby="name">
        <h1 id="name" className="hero__name">
          {profile.name}
        </h1>
        <p className="hero__role">{profile.roleLine}</p>
        <p className="hero__proof">{proofLine()}</p>
        <ul className="hero__links" aria-label="Quick links">
          <li>
            <Link href="/resume">Resume</Link>
          </li>
          <li>
            <a href={profile.links.github}>GitHub</a>
          </li>
          <li>
            <a href={profile.links.linkedin}>LinkedIn</a>
          </li>
          <li>
            <a href={`mailto:${profile.email}`}>Email</a>
          </li>
          <li>
            <a href="#xr" data-light="xr">
              XR work
            </a>
          </li>
          <li>
            <a href="#software" data-light="software">
              Software work
            </a>
          </li>
        </ul>
      </section>

      {/* The 3D case on wide screens (after first paint), its poster everywhere else. */}
      <div className="frame">
        <CaseStage variant="hero">
          <CasePoster />
        </CaseStage>
        <XrDoor note={doorNote(xrTests)} arNote={passthroughNote(xrTests)} />
      </div>

      <div className="frame">
        <div className="case">
          <ProjectRow id="xr" letter="A" heading="XR work" projects={xr} statuses={statuses} />
          <ProjectRow id="software" letter="B" heading="Software work" projects={software} statuses={statuses} />
        </div>
        <p className="case-more">
          <Link href="/work">All work, including {bench.length + archive.length} more builds</Link>
        </p>
      </div>

      <section className="frame section" aria-labelledby="awards-heading">
        <h2 id="awards-heading">Awards</h2>
        <AwardsList awards={awards} />
      </section>

      <section className="frame section" aria-labelledby="about-heading">
        <h2 id="about-heading">About</h2>
        <p className="prose about-line">{profile.aboutLine}</p>
        <p>
          <Link href="/about">More about me, my experience and education</Link>
        </p>
      </section>

      <section className="frame section" aria-labelledby="contact-heading">
        <h2 id="contact-heading">Contact</h2>
        <p>
          Email <a href={`mailto:${profile.email}`}>{profile.email}</a>, or find me on{" "}
          <a href={profile.links.linkedin}>LinkedIn</a>.
        </p>
      </section>
    </CaseLightBridge>
  );
}
