import Link from "next/link";
import { profile } from "@/content";

const NAV = [
  { href: "/work", label: "Work" },
  { href: "/resume", label: "Resume" },
  { href: "/about", label: "About" },
  { href: "/proof", label: "Proof" },
] as const;

export function SiteHeader() {
  return (
    <header className="site-header">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <div className="frame site-header__bar">
        <Link href="/" className="site-header__name">
          {profile.name}
        </Link>
        <nav aria-label="Main">
          <ul className="site-header__nav">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
