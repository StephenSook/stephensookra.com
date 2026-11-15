import type { Metadata } from "next";
import Link from "next/link";
import { profile } from "@/content";
import { resume } from "@/content/resume";

export const metadata: Metadata = {
  title: "About",
  description: `About ${profile.name}: story, experience and education.`,
  alternates: { canonical: "/about" },
};

const { education } = profile;

export default function AboutPage() {
  return (
    <article className="frame about">
      <header className="page-head">
        <h1>About</h1>
        <p className="about-line prose">{profile.aboutLine}</p>
      </header>

      <section className="section prose" aria-labelledby="story-heading">
        <h2 id="story-heading">Why a lit case</h2>
        {/* DRAFT copy, awaiting Stephen's sign-off. Source: Case Light film and Devpost page. */}
        <p>
          My mom worked at the post office for more than 30 years. Carriers learn their case, a wall of slots, by heart.
          My Snap Specs Lens <Link href="/work/case-light">Case Light</Link> teaches that case by lighting the right
          slot, and the same idea runs through this site: point at a project and its slot lights up.
        </p>
        <p>
          I am a software engineer in {profile.location.city}, focused on XR. I build AR for Snap Specs, 3D for the
          web, and full-stack apps, and I test what I build.
        </p>
      </section>

      <section className="section" aria-labelledby="experience-heading">
        <h2 id="experience-heading">Experience</h2>
        <ul className="about__roles">
          {resume.experience.map((job) => (
            <li key={job.org}>
              <span className="about__role">
                {job.title}, {job.org}
              </span>
              <span className="muted">
                {job.place}, {job.dates}
              </span>
            </li>
          ))}
        </ul>
        <p>
          <Link href="/resume">The full resume</Link>
        </p>
      </section>

      <section className="section" aria-labelledby="education-heading">
        <h2 id="education-heading">Education</h2>
        <p>
          {education.degree}, {education.school}, expected {education.expected}, GPA {education.gpa}
        </p>
      </section>
    </article>
  );
}
