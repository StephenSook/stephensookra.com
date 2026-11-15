import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "The case",
  description: "The 3D lit case, coming in the next build.",
  // A placeholder until the 3D case ships: keep it out of search results.
  robots: { index: false, follow: true },
};

export default function CasePage() {
  return (
    <section className="frame page-head">
      <h1>The case</h1>
      <p className="prose">
        The 3D case, a wall of slots that light up for each project, is being built. Until then, the work is all
        here: <Link href="/work">see the work</Link>.
      </p>
    </section>
  );
}
