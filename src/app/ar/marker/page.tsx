import type { Metadata } from "next";
import Link from "next/link";
import { MarkerAr } from "@/components/MarkerAr";
import { testedNote, xrTests } from "@/content/measurements/xr";

export const metadata: Metadata = {
  title: "The case on a card",
  description: "Point a phone at the printed card and the lit letter case appears on it in 3D.",
  alternates: { canonical: "/ar/marker" },
};

export default function MarkerPage() {
  return (
    <section className="frame page-head marker-page">
      <h1>The case on a card</h1>
      {/* DRAFT copy, awaiting Stephen's sign-off. */}
      <p className="prose muted">
        Point your phone at the printed card and the case appears on it in 3D, over its own picture. Tilt the card
        to look into the slots.
      </p>
      <MarkerAr note={testedNote(xrTests, ["markerIphone", "markerAndroid"], "on a phone")} />
      <p className="case-more">
        <Link href="/case/ar">See the case in your room instead</Link>
      </p>
    </section>
  );
}
