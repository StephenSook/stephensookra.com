import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

// Dark tokens from the design brief; the slot light is the only accent.
const BG = "#0F1115";
const TEXT = "#ECEEF2";
const MUTED = "#9AA1AD";
const WOOD = "#6E5238";
const SLOT = "#FFB547";

/** A link-preview card: a lit slot in the case, a title, and up to three lines of text. */
export async function renderOgCard({ title, lines }: { title: string; lines: string[] }) {
  const font = await readFile(join(process.cwd(), "src/assets/fonts/FamiljenGrotesk-SemiBold.ttf"));
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: WOOD,
          padding: 18,
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            background: BG,
            borderTop: `10px solid ${SLOT}`,
            backgroundImage: `radial-gradient(120% 70% at 50% 0%, rgba(255,181,71,0.22), rgba(255,181,71,0.06) 45%, rgba(15,17,21,0) 80%)`,
            padding: "56px 64px",
            fontFamily: "Familjen Grotesk",
          }}
        >
          <div style={{ display: "flex", fontSize: 92, color: TEXT, letterSpacing: -3, lineHeight: 1 }}>{title}</div>
          {lines.map((line, i) => (
            <div
              key={line}
              style={{ display: "flex", marginTop: i === 0 ? 28 : 10, fontSize: i === 0 ? 36 : 30, color: i === 0 ? TEXT : MUTED }}
            >
              {line}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: [{ name: "Familjen Grotesk", data: font, style: "normal", weight: 600 }] },
  );
}
