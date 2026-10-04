import fs from "fs";
import path from "path";
import { CATEGORIES, ENGLISH_LEVELS, GENDERS, TEACHER_TYPES, TEACHING_LANGUAGES } from "../src/constants/teacher-options";

const clientFile = fs.readFileSync(path.resolve(__dirname, "../../client/src/lib/constants/teacher-options.ts"), "utf8");
const values = (name: string): string[] => {
  const block = clientFile.match(new RegExp(`export const ${name}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s+as const;`))?.[1] ?? "";
  return [...block.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
};

const checks: Array<[string, readonly string[], string]> = [
  ["CATEGORIES", CATEGORIES, "CATEGORIES"],
  ["ENGLISH_LEVELS", ENGLISH_LEVELS, "ENGLISH_LEVELS"],
  ["GENDERS", GENDERS, "GENDERS"],
  ["TEACHER_TYPES", TEACHER_TYPES, "TEACHER_TYPES"],
  ["TEACHING_LANGUAGES", TEACHING_LANGUAGES, "TEACHING_LANGUAGES"],
];

for (const [label, serverValues, clientName] of checks) {
  const clientValues = values(clientName);
  if (JSON.stringify([...serverValues]) !== JSON.stringify(clientValues)) {
    throw new Error(`${label} drift detected: server=${JSON.stringify(serverValues)} client=${JSON.stringify(clientValues)}`);
  }
}
