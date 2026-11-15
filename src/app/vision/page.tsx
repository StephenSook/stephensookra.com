import type { Metadata } from "next";
import Link from "next/link";
import { VisionRoom } from "@/components/VisionRoom";
import { XrDoor } from "@/components/XrDoor";
import { doorNote, passthroughNote, testedNote, xrTests } from "@/content/measurements/xr";

export const metadata: Metadata = {
  title: "The case in a room",
  description: "On Apple Vision Pro, step into a quiet room with the lit letter case on its wall, at full size.",
  alternates: { canonical: "/vision" },
};

export default function VisionPage() {
  return (
    <section className="frame page-head vision-page">
      <h1>The case in a room</h1>
      {/* DRAFT copy, awaiting Stephen's sign-off. */}
      <p className="prose muted">
        On Apple Vision Pro, step into a quiet room with the case on its wall, at full size. Look to your left once
        you are in.
      </p>
      <VisionRoom />
      <p className="vision-page__note">{testedNote(xrTests, ["visionImmersive"], "in a headset")}</p>
      <h2 className="vision-page__vr">In VR</h2>
      <XrDoor note={doorNote(xrTests)} arNote={passthroughNote(xrTests)} />
      <p className="case-more">
        <Link href="/case">Back to the case</Link>
      </p>
    </section>
  );
}
