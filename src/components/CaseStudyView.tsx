import type { CaseStudy } from "@/content";

function Part({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="case-study__part">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

/** The back of a card (brief section 7). Sections without a source are left out, never filled in. */
export function CaseStudyView({ caseStudy }: { caseStudy: CaseStudy }) {
  const { evidence, myPart, howItWorks, engineering, measured, whatBroke, sources } = caseStudy;
  return (
    <div className="case-study">
      <Part title="Evidence">
        <p>{evidence}</p>
      </Part>
      {myPart ? (
        <Part title="My part">
          <p>{myPart}</p>
        </Part>
      ) : null}
      <Part title="How it works">
        <p>{howItWorks}</p>
      </Part>
      <Part title="Engineering">
        <p>{engineering}</p>
      </Part>
      {measured ? (
        <Part title="Measured">
          <p className="measured">
            <span className="measured__value">{measured.value}</span>
            <span className="measured__label">
              {measured.label}.{" "}
              {measured.source.url ? (
                <a href={measured.source.url}>Source: {measured.source.label}</a>
              ) : (
                <>Source: {measured.source.label}</>
              )}
            </span>
          </p>
        </Part>
      ) : null}
      {whatBroke ? (
        <Part title="What broke">
          <p>{whatBroke}</p>
        </Part>
      ) : null}
      <Part title="Sources">
        <ul className="sources" aria-label="Sources">
          {sources.map((s) => (
            <li key={s.label}>{s.url ? <a href={s.url}>{s.label}</a> : s.label}</li>
          ))}
        </ul>
      </Part>
    </div>
  );
}
