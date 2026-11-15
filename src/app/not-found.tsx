import Link from "next/link";

export default function NotFound() {
  return (
    <section className="frame page-head">
      <h1>Page not found</h1>
      <p className="prose">
        There is no page at this address. The work is on <Link href="/work">the work page</Link>, and everything else
        starts from <Link href="/">the home page</Link>.
      </p>
    </section>
  );
}
