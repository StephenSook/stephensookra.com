import { resultText } from "@/components/ResultLine";
import type { Project } from "@/content";

export type CardText = {
  title: string;
  line: string;
  platform: string;
  /** The same result wording as the grid card, on one line. */
  result: string;
  /** The reader's part: the case study's line, or "Solo build", or nothing. */
  part?: string;
};

/** The largest size with the video's aspect that fits in a box (no crop, no stretch). */
export function fitBox(width: number, height: number, boxW: number, boxH: number): { w: number; h: number } {
  const scale = Math.min(boxW / width, boxH / height);
  return { w: width * scale, h: height * scale };
}

/** What a pulled card says in the headset; every word comes from the content file. */
export function cardText(project: Project, now: Date = new Date()): CardText {
  const { lead, detail } = resultText(project.result, now);
  return {
    title: project.title,
    line: project.line,
    platform: project.platform,
    result: detail ? `${lead}. ${detail}` : lead,
    part: project.caseStudy?.myPart ?? (project.solo ? "Solo build" : undefined),
  };
}
