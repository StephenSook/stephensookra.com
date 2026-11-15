import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import marker from "../../../../../public/marker/manifest.json";

export const metadata: Metadata = {
  title: "The marker card",
  description: "A card to print for the marker AR page: the lit letter case, the name and the address.",
  alternates: { canonical: "/ar/marker/card" },
};

const ALT = "A card with the name Stephen Sookra, a picture of the lit letter case and the address stephensookra.com/ar/marker.";

export default function MarkerCardPage() {
  return (
    <section className="frame page-head marker-card-page">
      <h1>The marker card</h1>
      {/* DRAFT copy, awaiting Stephen's sign-off. */}
      <p className="prose muted">
        Print it on any paper, or show it on another screen. Then open <Link href="/ar/marker">the marker page</Link> on
        a phone and point the camera at it.
      </p>
      <p className="marker-card__downloads">
        <a href={marker.pdf} download="stephen-sookra-marker-card.pdf">
          Download the card (PDF)
        </a>
        <a href={marker.card} download="stephen-sookra-marker-card.png">
          Download the picture (PNG)
        </a>
      </p>
      <Image
        className="marker-card__image"
        src={marker.card}
        alt={ALT}
        width={marker.width}
        height={marker.height}
        sizes="(min-width: 76rem) 72rem, 100vw"
        priority
      />
    </section>
  );
}
