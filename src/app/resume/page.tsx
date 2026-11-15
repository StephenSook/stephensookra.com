import type { Metadata } from "next";
import { AwardsList } from "@/components/AwardsList";
import { awards, awardStats, profile } from "@/content";
import { resume } from "@/content/resume";
import { formatDate } from "@/lib/dates";

export const metadata: Metadata = {
  title: "Resume",
  description: `Resume of ${profile.name}: experience, projects, skills, education and awards.`,
  alternates: { canonical: "/resume" },
};

export default function ResumePage() {
  const { education } = resume;
  return (
    <article className="frame resume">
      <header className="page-head resume__head">
        <h1>Resume</h1>
        <p>
          <a href={resume.pdf.path} className="resume__pdf">
            Download the PDF
          </a>{" "}
          <span className="muted">(one page, built {formatDate(resume.pdf.builtOn)})</span>
        </p>
      </header>

      <section className="resume__section" aria-labelledby="r-experience">
        <h2 id="r-experience">Experience</h2>
        {resume.experience.map((job) => (
          <div key={job.org} className="resume__entry">
            <h3>
              {job.title}, {job.org}
            </h3>
            <p className="muted">
              {job.place}, {job.dates}
            </p>
            <ul className="resume__bullets">
              {job.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="resume__section" aria-labelledby="r-projects">
        <h2 id="r-projects">Projects</h2>
        {resume.projects.map((p) => (
          <div key={p.name} className="resume__entry">
            <h3>
              <a href={p.url}>{p.name}</a>
            </h3>
            <p className="muted">
              {p.stack}. {p.dates}
            </p>
            <ul className="resume__bullets">
              {p.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="resume__section" aria-labelledby="r-education">
        <h2 id="r-education">Education</h2>
        <div className="resume__entry">
          <h3>{education.school}</h3>
          <p>{education.degree}</p>
          <p className="muted">
            {education.place}, {education.dates}. {education.detail}.
          </p>
        </div>
      </section>

      <section className="resume__section" aria-labelledby="r-skills">
        <h2 id="r-skills">Skills</h2>
        <dl className="resume__skills">
          {resume.skills.map((s) => (
            <div key={s.label}>
              <dt>{s.label}</dt>
              <dd>{s.items.join(", ")}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="resume__section" aria-labelledby="r-certs">
        <h2 id="r-certs">Certifications</h2>
        <ul className="resume__bullets">
          {resume.certifications.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </section>

      <section className="resume__section" aria-labelledby="r-awards">
        <h2 id="r-awards">Awards</h2>
        <p className="muted">
          {awardStats.awards} awards across {awardStats.events} events ({resume.enteredNote}).
        </p>
        <AwardsList awards={awards} />
      </section>
    </article>
  );
}
