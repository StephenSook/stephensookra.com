import { profile, proofLine } from "@/content";
import { OG_SIZE, renderOgCard } from "@/lib/og";

export const alt = `${profile.name}, ${profile.title}`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  return renderOgCard({ title: profile.name, lines: [profile.title, proofLine()] });
}
