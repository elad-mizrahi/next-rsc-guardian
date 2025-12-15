import fs from "fs";
import path from "path";
import { z } from "zod";

const RscSecuritySchema = z.object({
  react: z.object({
    vulnerableMajors: z.array(z.number().int()),
  }),
  next: z.object({
    patchedMinVersionByMinor: z.record(z.string(), z.string()),
  }),
});

export type RscSecurityConfig = z.infer<typeof RscSecuritySchema>;

export function loadRscSecurityConfig(): RscSecurityConfig {
  const filePath = path.resolve(process.cwd(), "src/config/rsc-security.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  return RscSecuritySchema.parse(JSON.parse(raw));
}
