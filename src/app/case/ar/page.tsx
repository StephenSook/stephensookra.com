import type { Metadata } from "next";
import Link from "next/link";
import { PhoneAr } from "@/components/PhoneAr";
import { POSTER } from "@/components/CasePoster";
import { testedNote, xrTests } from "@/content/measurements/xr";
import arManifest from "../../../../public/ar/manifest.json";

export const metadata: Metadata = {
  title: "The case in your room",
  description: "Put the lit letter case in your room at full size, 1.6 meters wide, from a phone.",
  alternates: { canonical: "/case/ar" },
};

export default function CaseArPage() {
  return (
    <section className="frame page-head case-ar">
      <h1>The case in your room</h1>
      {/* DRAFT copy, awaiting Stephen's sign-off. */}
      <p className="prose muted">
        On a phone, put the case in your room at full size: 1.6 meters wide, as it would hang on a wall.
      </p>
      <PhoneAr
        glb={arManifest.glb}
        usdz={arManifest.usdz}
        poster={{ src: POSTER.light, dark: POSTER.dark, width: POSTER.width, height: POSTER.height }}
        note={testedNote(xrTests, ["iphoneQuickLook", "androidSceneViewer"], "on a phone")}
      />
      <p className="case-more">
        <Link href="/case">Back to the case</Link>
      </p>
    </section>
  );
}
