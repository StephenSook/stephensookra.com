import { formatDate } from "@/lib/dates";
import type { CiState, RepoStatus } from "@/lib/github";

const CI_TEXT: Record<CiState, string> = {
  passing: "CI passing",
  failing: "CI failing",
  running: "CI running",
  none: "No CI runs",
};

/** A star count this small says nothing about the work, so it is left out. */
const MIN_STARS_SHOWN = 10;

/** Live repo facts read from GitHub at build time; "not available" when the read failed. */
export function RepoStatusView({ status }: { status: RepoStatus }) {
  if (status.state === "unavailable") {
    return (
      <p className="repo-status" data-state="unavailable">
        Repo details not available
      </p>
    );
  }
  const license = status.license && status.license !== "NOASSERTION" ? status.license : null;
  return (
    <ul className="repo-status" data-state="ok" aria-label="Live repository details">
      <li>Last commit {formatDate(status.lastCommit)}</li>
      <li data-ci={status.ci}>{CI_TEXT[status.ci]}</li>
      {license ? <li>{license} licence</li> : null}
      {status.stars >= MIN_STARS_SHOWN ? <li>{status.stars} stars</li> : null}
    </ul>
  );
}
