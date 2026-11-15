import { profile } from "@/content";

export function SiteFooter() {
  const { links } = profile;
  return (
    <footer className="site-footer">
      <div className="frame site-footer__inner">
        <ul className="site-footer__links">
          <li>
            <a href={`mailto:${profile.email}`}>Email</a>
          </li>
          <li>
            <a href={links.github}>GitHub</a>
          </li>
          <li>
            <a href={links.linkedin}>LinkedIn</a>
          </li>
          <li>
            <a href={links.devpost}>Devpost</a>
          </li>
          <li>
            <a href={links.x}>X</a>
          </li>
        </ul>
        <p className="site-footer__note">
          Built by Stephen Sookra. <a href="https://github.com/StephenSook/stephensookra.com">Source for this site</a>.
        </p>
      </div>
    </footer>
  );
}
