import { profile, proofLine } from "@/content";

// Replaced by the full home page in the home task; this keeps the build honest meanwhile.
export default function Home() {
  return (
    <section className="frame page-head">
      <h1>{profile.name}</h1>
      <p>{profile.roleLine}</p>
      <p className="muted">{proofLine()}</p>
    </section>
  );
}
