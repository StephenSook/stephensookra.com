import type { Metadata } from "next";
import Link from "next/link";
import { RepoStatusView } from "@/components/RepoStatus";
import { featured, projects } from "@/content";
import { fcpMeasurement } from "@/content/measurements";
import { formatDate } from "@/lib/dates";
import { formatMs, formatSeconds } from "@/lib/format";
import { getRepoStatus, getRepoStatuses } from "@/lib/github";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Proof",
  description: "A short path through the evidence: films, live links, repos with live CI status, and a measured load time.",
  alternates: { canonical: "/proof" },
};

const SITE_REPO = "StephenSook/stephensookra.com";

export default async function ProofPage() {
  const films = featured.flatMap((p) => p.links.filter((l) => l.kind === "film").map((l) => ({ p, l })));
  const tries = projects.flatMap((p) => p.links.filter((l) => l.kind === "try").map((l) => ({ p, l })));
  const repos = featured.flatMap((p) => (p.repo ? [p.repo] : []));
  const [statuses, siteStatus] = await Promise.all([getRepoStatuses(repos), getRepoStatus(SITE_REPO)]);

  const newSite = fcpMeasurement.sites.find((s) => s.label === "new preview");
  const oldSite = fcpMeasurement.sites.find((s) => s.label === "old site");
  const { profile } = fcpMeasurement;

  return (
    <article className="frame proof">
      <header className="page-head">
        <h1>Proof</h1>
        <p className="prose muted">
          A short path through the evidence. Nothing here needs a login.
        </p>
      </header>

      <ol className="proof__steps">
        <li>
          <h2>Watch the films</h2>
          <ul className="proof__list">
            {films.map(({ p, l }) => (
              <li key={l.url}>
                <a href={l.url}>{p.title}</a> <span className="muted">{p.platform}</span>
              </li>
            ))}
          </ul>
        </li>

        <li>
          <h2>Try the live apps</h2>
          {tries.length ? (
            <>
              <p className="muted">
                Each link below is checked every day past its home page, on a route that only answers when the core of
                the app works.
              </p>
              <ul className="proof__list">
                {tries.map(({ p, l }) => (
                  <li key={l.url}>
                    <a href={l.url}>{p.title}</a>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="muted">No live app links are listed yet.</p>
          )}
        </li>

        <li>
          <h2>Read the code</h2>
          <p className="muted">Live from GitHub, refreshed daily.</p>
          <ul className="proof__list">
            {featured
              .filter((p) => p.repo)
              .map((p) => (
                <li key={p.slug}>
                  <a href={`https://github.com/${p.repo}`}>{p.title}</a>
                  <RepoStatusView status={statuses[p.repo!]} />
                </li>
              ))}
          </ul>
        </li>

        <li>
          <h2>The load time, measured</h2>
          {newSite ? (
            <p className="proof__number">
              On a throttled phone, the first text of this site (my name) paints in{" "}
              <strong>{formatSeconds(newSite.medianMs)}</strong>.
            </p>
          ) : (
            <p>The new site has not been measured yet.</p>
          )}
          <table className="proof__table">
            <caption className="muted">
              First Contentful Paint, five cold runs each. {profile.viewport.width} by {profile.viewport.height} px at
              DPR {profile.deviceScaleFactor}, Chrome DevTools &quot;{profile.network.name}&quot; network,{" "}
              {profile.cpuSlowdown}x CPU slowdown, {fcpMeasurement.browser}.
            </caption>
            <thead>
              <tr>
                <th scope="col">Site</th>
                <th scope="col">Median</th>
                <th scope="col">All runs</th>
                <th scope="col">Measured</th>
              </tr>
            </thead>
            <tbody>
              {[newSite, oldSite]
                .filter((s) => s !== undefined)
                .map((s) => (
                  <tr key={s.label}>
                    <th scope="row">
                      {s.label === "old site" ? "Previous site" : "This site (preview)"}{" "}
                      <span className="muted">{new URL(s.url).host}</span>
                    </th>
                    <td>{formatMs(s.medianMs)}</td>
                    <td>{s.runsMs.map(formatMs).join(", ")}</td>
                    <td>{formatDate(s.measuredAt)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </li>

        <li>
          <h2>Check the number yourself</h2>
          <ol className="proof__howto">
            <li>Open the home page in Chrome, then open DevTools.</li>
            <li>
              Turn on the device toolbar and set the size to {profile.viewport.width} by {profile.viewport.height} with
              a device pixel ratio of {profile.deviceScaleFactor}.
            </li>
            <li>In the Network panel, tick Disable cache and choose &quot;{profile.network.name}&quot;.</li>
            <li>In the Performance panel, set CPU to {profile.cpuSlowdown}x slowdown.</li>
            <li>Click Record and reload, then read the FCP marker in the Timings track.</li>
          </ol>
          <p className="muted">
            The script that produced the table is{" "}
            <a href={`https://github.com/${SITE_REPO}/blob/main/scripts/measure-fcp.mjs`}>scripts/measure-fcp.mjs</a>.
          </p>
        </li>

        <li>
          <h2>This site&apos;s own checks</h2>
          <p className="muted">
            Lint, type check, unit tests, build, end-to-end tests, accessibility and performance budgets run on every
            push. <a href={`https://github.com/${SITE_REPO}`}>Source</a>
          </p>
          <RepoStatusView status={siteStatus} />
        </li>
      </ol>

      <p className="muted">
        Every number on this site comes from a source file, a public repo or a committed measurement. See{" "}
        <Link href="/work">the work</Link> for each project&apos;s sources.
      </p>
    </article>
  );
}
