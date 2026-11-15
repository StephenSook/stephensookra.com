"use client";

import { CaseStageView } from "./CaseStageView";

/** Client boundary for the lit case: server pages pass the variant and the poster only. */
export function CaseStage(props: { variant: "hero" | "full"; children: React.ReactNode }) {
  return <CaseStageView {...props} />;
}
