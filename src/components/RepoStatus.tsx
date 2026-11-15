import { formatDate } from "@/lib/dates";
import type { CiState, RepoStatus } from "@/lib/github";

const CI_TEXT: Record<CiState, string> = {
  passing: "CI passing",
  failing: "CI failing",
  running: "CI running",
  none: "No CI runs",
};

/** Live repo facts read from GitHub at build time; "not available" when the read failed. */
export function RepoStatusView({ status }: { status: RepoStatus }) {
  if (status.state === "unavailable") {
    return (
      <p className="repo-status" data-state="unavailable">
        Repo details not available
      </p>
    );
  }
  const stars = `${status.stars} ${status.stars === 1 ? "star" : "stars"}`;
  return (
    <ul className="repo-status" data-state="ok" aria-label="Live repository details">
      <li>Last commit {formatDate(status.lastCommit)}</li>
      <li data-ci={status.ci}>{CI_TEXT[status.ci]}</li>
      <li>{stars}</li>
    </ul>
  );
}
