// Issue registry (module 0, for module e): lib/issues.ts computeIssues lists,
// after Filum's own, the issues of the checks the modules register. They show
// in the Issues panel and on the canvas like Filum's; their texts come from the
// registering module's catalogs. A check that fails is logged and left out.

import type { PlanData, StitchDocument } from "../../types";
import type { Issue } from "../../lib/issues";

export interface IssueCheckEntry {
  /** "<module>.<name>" */
  id: string;
  module: string;
  /** Pure: the document and its stitch plan (null while it is being made). Issue ids: "<module>.<kind>:<object id>". */
  check(doc: StitchDocument, plan: PlanData | null): Issue[];
}

const checks = new Map<string, IssueCheckEntry>();
let version = 0;
/** Changes when a check comes or goes (computeIssues' cache reads it). */
export const issueChecksVersion = () => version;

export function registerIssueCheck(e: IssueCheckEntry): () => void {
  if (checks.has(e.id)) throw new Error(`Issue check "${e.id}" from module "${e.module}" is already registered`);
  checks.set(e.id, e);
  version++;
  return () => {
    if (checks.get(e.id) === e) {
      checks.delete(e.id);
      version++;
    }
  };
}

/** The registered checks' issues, in registration order. */
export function moduleIssues(doc: StitchDocument, plan: PlanData | null): Issue[] {
  const out: Issue[] = [];
  for (const e of checks.values()) {
    try {
      out.push(...e.check(doc, plan));
    } catch (err) {
      console.error(`nova: issue check "${e.id}" failed`, err);
    }
  }
  return out;
}
