import * as semver from "semver";
import { RscSecurityConfig } from "../config/load-config";

type Input = {
  nextVersion: string | null;
  reactVersion: string | null;
};

export type AnalysisResult = {
  rscCapable: boolean;
  vulnerable: boolean;
  reason: string;
  recommendedNext?: string;
};

export function analyzeRepo(
  input: Input,
  config: RscSecurityConfig
): AnalysisResult {
  const { nextVersion, reactVersion } = input;

  if (!nextVersion) {
    return { rscCapable: false, vulnerable: false, reason: "No Next.js" };
  }

  const nextCoerced = semver.coerce(nextVersion);
  if (!nextCoerced || nextCoerced.major < 13) {
    return {
      rscCapable: false,
      vulnerable: false,
      reason: "Next.js version does not support RSC",
    };
  }

  if (!reactVersion || reactVersion.startsWith("npm:")) {
    return {
      rscCapable: true,
      vulnerable: false,
      reason: "React not used or replaced (preact/compat)",
    };
  }

  const reactCoerced = semver.coerce(reactVersion);
  if (!reactCoerced) {
    return {
      rscCapable: true,
      vulnerable: false,
      reason: "Unparseable React version",
    };
  }

  if (!config.react.vulnerableMajors.includes(reactCoerced.major)) {
    return {
      rscCapable: true,
      vulnerable: false,
      reason: "React major not in vulnerable range",
    };
  }

  const minorKey = `${nextCoerced.major}.${nextCoerced.minor}`;
  const patched = config.next.patchedMinVersionByMinor[minorKey];

  if (!patched) {
    return {
      rscCapable: true,
      vulnerable: false,
      reason: "No known patch info for this Next.js minor",
    };
  }

  if (semver.lt(nextCoerced, patched)) {
    return {
      rscCapable: true,
      vulnerable: true,
      reason: `Next.js ${nextVersion} < patched ${patched}`,
      recommendedNext: patched,
    };
  }

  return {
    rscCapable: true,
    vulnerable: false,
    reason: "Already patched",
  };
}
