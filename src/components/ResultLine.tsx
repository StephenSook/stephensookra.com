import type { Result } from "@/content";
import { formatMonth, formatShortDate, isPast } from "@/lib/dates";

/** The external result of a project, in one of three states (brief section 7). */
export function resultText(result: Result, now: Date = new Date()): { lead: string; detail?: string } {
  switch (result.state) {
    case "placed":
      return { lead: result.prize, detail: result.event };
    case "waiting": {
      const entered = `Entered: ${result.event}.`;
      if (!result.resultsDate) return { lead: `${entered} Results not announced yet.` };
      const day = formatShortDate(result.resultsDate);
      return isPast(result.resultsDate, now)
        ? { lead: `${entered} Results were due ${day}; this page has not been updated yet.` }
        : { lead: `${entered} Results ${day}.` };
    }
    case "role":
      return {
        lead: `${result.role}, ${formatMonth(result.start)} to ${result.end ? formatMonth(result.end) : "now"}`,
      };
  }
}

export function ResultLine({ result, now }: { result: Result; now?: Date }) {
  const { lead, detail } = resultText(result, now);
  return (
    <p className="result" data-state={result.state}>
      <span className="result__lead">{lead}</span>
      {detail ? <span className="result__detail">{detail}</span> : null}
    </p>
  );
}
