import type { Person, WithContext } from "schema-dts";
import { SITE_URL } from "@/lib/site";
import { profile } from "./profile";

/** schema.org Person for the site. Public facts only: no phone, address or birth date. */
export function buildPersonJsonLd(): WithContext<Person> {
  const { links } = profile;
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: profile.name,
    url: SITE_URL,
    jobTitle: profile.jobTitle,
    email: `mailto:${profile.email}`,
    knowsAbout: [...profile.knowsAbout],
    address: {
      "@type": "PostalAddress",
      addressLocality: profile.location.city,
      addressRegion: profile.location.region,
      addressCountry: "US",
    },
    worksFor: { "@type": "Organization", name: profile.currentRole.org },
    affiliation: { "@type": "CollegeOrUniversity", name: profile.education.school },
    sameAs: [links.github, links.linkedin, links.x, links.devpost],
  };
}
