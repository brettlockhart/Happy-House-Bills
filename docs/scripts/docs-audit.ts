/**
 * Docs Audit — comprehensive documentation quality audit.
 *
 * Run occasionally (not on every commit) to find quality issues that
 * doc-lint.ts doesn't catch (doc-lint handles structural checks: cross-refs,
 * stale forward refs, status table, duplicate IDs, gap counts, open-questions
 * sync, frontmatter lifecycle, review queue). The audit focuses on quality:
 * path resolution, dates, spelling, orphans, and filename conventions.
 *
 * Usage:
 *   npx tsx docs/scripts/docs-audit.ts           # full audit
 *   npx tsx docs/scripts/docs-audit.ts --quiet    # errors only
 *
 * Checks:
 *   1. Backtick path resolution — every `path.md` in backticks resolves (case-insensitive)
 *   2. Date format and freshness — not in future, matches dd-MonthName-yyyy
 *   3. British English — American spellings in prose (excludes code blocks and AGENTS.md)
 *   4. Orphaned docs — tech-specs not referenced from anywhere (info)
 *   5. Filename conventions — all lowercase per AGENTS.md (excludes README.md, AGENTS.md)
 *   6. Spec section completeness — every tech-spec has the required template sections
 *   7. Empty sections — no heading with no content beneath it
 *   8. Stale §1 entries — spec-gaps.md §1 entries for completed docs are marked
 *   9. Cross-reference reciprocity — tech-spec cross-refs are reciprocal (info)
 *  10. AI: frontmatter completeness — every tech-spec has AI-consumable frontmatter fields
 *  11. AI: vague cross-references — references use explicit paths, not vague prose
 *  12. AI: decision tables — every tech-spec has at least one Decision + Rationale table
 *   13. AI: code blocks — every tech-spec has at least one code example
 *   14. Cross-project contamination — no Tailswind, @postml, WASM/Rust, Supabase, etc.
 *      from unrelated projects (Pipes, PostML)
 */

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve, dirname, basename } from "node:path";

const DOCS_DIR = resolve(process.cwd(), "docs");
const TECH_SPECS_DIR = join(DOCS_DIR, "3-reference", "tech-specs");
const SPEC_GAPS_REL = join("3-reference", "spec-gaps.md");
const CONVENTIONAL_UPPERCASE = new Set(["README.md", "AGENTS.md", "CLAUDE.md", "CONTEXT.md"]);

const QUIET = process.argv.includes("--quiet");

type Severity = "error" | "warn" | "info";

interface Finding {
  check: string;
  file: string;
  line?: number;
  message: string;
  severity: Severity;
}

interface CheckResult {
  check: string;
  description: string;
  findings: Finding[];
}

let allFilesCache: string[] | null = null;
let lowerFileIndex: Map<string, string> | null = null;

function getAllMarkdownFiles(dir: string, base: string = dir): string[] {
  if (allFilesCache && dir === DOCS_DIR) return allFilesCache;
  const files: string[] = [];
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (["node_modules", ".git", ".nuxt", "dist", ".output"].includes(entry)) continue;
      files.push(...getAllMarkdownFiles(full, base));
    } else if (entry.endsWith(".md")) {
      files.push(relative(base, full));
    }
  }
  if (dir === DOCS_DIR) allFilesCache = files;
  return files;
}

function getLowerFileIndex(): Map<string, string> {
  if (lowerFileIndex) return lowerFileIndex;
  const index = new Map<string, string>();
  const files = getAllMarkdownFiles(DOCS_DIR);
  for (const f of files) {
    index.set(f.toLowerCase().replaceAll("\\", "/"), f);
    index.set(basename(f).toLowerCase(), f);
  }
  lowerFileIndex = index;
  return index;
}

function readFile(rel: string): string {
  return readFileSync(join(DOCS_DIR, rel), "utf-8");
}

function fileExists(rel: string): boolean {
  return existsSync(join(DOCS_DIR, rel));
}

function isTechSpec(rel: string): boolean {
  return rel.includes("tech-specs") && !rel.endsWith("README.md");
}

function getLineNum(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

// --- Path resolution (split to reduce cognitive complexity) ---

function tryResolveMd(fromRel: string, cleanPath: string): string | null {
  const fromDir = dirname(fromRel);
  const index = getLowerFileIndex();
  const variations = [cleanPath, cleanPath.replaceAll("_", "-")];
  for (const variant of variations) {
    const candidates = [
      join(fromDir, variant),
      variant,
      join("3-reference", variant),
      join("3-reference", "tech-specs", variant),
      join("3-reference", "domains", variant),
    ];
    for (const candidate of candidates) {
      if (fileExists(candidate)) return candidate;
      const lowerCandidate = candidate.toLowerCase().replaceAll("\\", "/");
      if (index.has(lowerCandidate)) return index.get(lowerCandidate)!;
    }
  }
  const lastSegment = basename(cleanPath).toLowerCase();
  const dashSegment = lastSegment.replaceAll("_", "-");
  return index.get(lastSegment) ?? index.get(dashSegment) ?? null;
}

function tryResolveOther(fromRel: string, cleanPath: string): string | null {
  const fromDir = dirname(fromRel);
  const candidates = [join(fromDir, cleanPath), cleanPath];
  for (const candidate of candidates) {
    if (fileExists(candidate)) return candidate;
  }
  return null;
}

function resolveBacktickPath(fromRel: string, refPath: string): string | null {
  const cleanPath = refPath.replaceAll("`", "").trim();
  if (!cleanPath.endsWith(".md") && !cleanPath.endsWith(".json") && !cleanPath.endsWith(".ts") && !cleanPath.endsWith(".yml")) {
    return null;
  }
  return cleanPath.endsWith(".md")
    ? tryResolveMd(fromRel, cleanPath)
    : tryResolveOther(fromRel, cleanPath);
}

// --- Code block detection ---

function isInsideCodeBlock(lines: string[], lineIndex: number): boolean {
  let inBlock = false;
  for (let i = 0; i <= lineIndex; i++) {
    if (lines[i].trim().startsWith("```")) {
      inBlock = !inBlock;
    }
  }
  return inBlock;
}

// --- Check 1: Backtick path resolution ---

function checkBacktickInFile(rel: string, content: string, findings: Finding[]): void {
  const backtickPathRe = /`([^`]+\.md)`/g;
  const lines = content.split("\n");
  let match: RegExpExecArray | null;
  backtickPathRe.lastIndex = 0;
  while ((match = backtickPathRe.exec(content)) !== null) {
    const refPath = match[1];
    const lineNum = getLineNum(content, match.index);
    if (isInsideCodeBlock(lines, lineNum - 1)) continue;
    if (refPath.startsWith("http") || refPath.includes("node_modules")) continue;
    if (refPath.includes("**")) continue;
    if (refPath.startsWith(".") && !refPath.startsWith("./")) continue;
    const resolved = resolveBacktickPath(rel, refPath);
    if (!resolved) {
      const relNorm = rel.replaceAll("\\", "/");
      const isDomainSpec = refPath.includes("domains/") || refPath.includes("supporting-docs/") || relNorm.includes("domains/") || relNorm.includes("3-reference/");
      findings.push({
        check: "1-backtick-paths",
        file: rel,
        line: lineNum,
        message: `Backtick path does not resolve: \`${refPath}\`${isDomainSpec ? " (spec not yet written)" : ""}`,
        severity: isDomainSpec ? "info" : "warn",
      });
    }
  }
}

function check1BacktickPathResolution(files: string[]): CheckResult {
  const findings: Finding[] = [];
  for (const rel of files) {
    checkBacktickInFile(rel, readFile(rel), findings);
  }
  return { check: "1-backtick-paths", description: "Every backtick-enclosed path reference resolves to an existing file (case-insensitive)", findings };
}

// --- Check 2: Date format ---

function validateDate(rel: string, dateStr: string, lineNum: number, today: Date, todayStr: string, pastLimit: Date, findings: Finding[]): void {
  const validDateFormat = /^\d{2}-[A-Z][a-z]+-\d{4}$/;
  if (!validDateFormat.test(dateStr)) {
    findings.push({ check: "2-date-format", file: rel, line: lineNum, message: `Date "${dateStr}" does not match expected format dd-MonthName-yyyy (e.g. "01-September-2026")`, severity: "warn" });
    return;
  }
  const datePartsRe = /(\d{2})-([A-Za-z]+)-(\d{4})/;
  const parts = datePartsRe.exec(dateStr);
  if (!parts) return;
  const day = Number.parseInt(parts[1], 10);
  const monthName = parts[2];
  const year = Number.parseInt(parts[3], 10);
  const monthIndex = new Date(`${monthName} 1, ${year}`).getMonth();
  if (Number.isNaN(monthIndex)) {
    findings.push({ check: "2-date-format", file: rel, line: lineNum, message: `Date "${dateStr}" has an unrecognised month name "${monthName}"`, severity: "warn" });
    return;
  }
  const specDate = new Date(year, monthIndex, day);
  if (specDate > today) {
    findings.push({ check: "2-date-format", file: rel, line: lineNum, message: `Date "${dateStr}" is in the future (today is ${todayStr})`, severity: "error" });
  } else if (specDate < pastLimit) {
    findings.push({ check: "2-date-format", file: rel, line: lineNum, message: `Date "${dateStr}" is more than a year old — consider updating if the content has changed`, severity: "info" });
  }
}

function check2DateFormat(files: string[]): CheckResult {
  const findings: Finding[] = [];
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayStr = `${now.getDate().toString().padStart(2, "0")}-${now.toLocaleString("en-GB", { month: "long" })}-${now.getFullYear()}`;
  const pastLimit = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const dateRe = /\*\*Date:\*\*\s*(.+)/;

  for (const rel of files) {
    if (!rel.includes("tech-specs")) continue;
    const content = readFile(rel);
    const match = dateRe.exec(content);
    if (!match) continue;
    validateDate(rel, match[1].trim(), getLineNum(content, match.index), today, todayStr, pastLimit, findings);
  }

  return { check: "2-date-format", description: "Date headers match dd-MonthName-yyyy format and are not in the future", findings };
}

// --- Check 3: British English ---

const AMERICAN_WORDS: Record<string, string> = {
  "color": "colour", "colors": "colours", "behavior": "behaviour",
  "optimize": "optimise", "optimization": "optimisation",
  "analyze": "analyse", "analyzing": "analysing",
  "realize": "realise", "realized": "realised",
  "standardize": "standardise", "standardized": "standardised",
  "organization": "organisation", "organize": "organise",
  "center": "centre", "gray": "grey",
};

const SKIP_FILES = new Set(["AGENTS.md", "lexicon.md"]);

function isIdentifierContext(line: string, matchIndex: number, matchLen: number): boolean {
  const before = line.slice(Math.max(0, matchIndex - 5), matchIndex);
  const after = line.slice(matchIndex + matchLen, matchIndex + matchLen + 5);
  if (before.endsWith("-") || after.startsWith("-")) return true;
  if (before.endsWith(".") || after.startsWith(".")) return true;
  if (before.endsWith("_") || after.startsWith("_")) return true;
  if (line.slice(matchIndex - 1, matchIndex + matchLen + 1).includes("`")) return true;
  if (line.slice(matchIndex - 5, matchIndex).includes("--")) return true;
  return false;
}

function checkLineForAmericanWords(line: string, rel: string, lineNum: number, findings: Finding[]): void {
  for (const [american, british] of Object.entries(AMERICAN_WORDS)) {
    const wordRe = new RegExp(String.raw`\b${american}\b`, "gi");
    let m: RegExpExecArray | null;
    wordRe.lastIndex = 0;
    while ((m = wordRe.exec(line)) !== null) {
      if (isIdentifierContext(line, m.index, m[0].length)) continue;
      if (line.slice(m.index - 1, m.index + m[0].length + 1).includes(`"${m[0]}"`)) continue;
      if (line.includes(`not ${american}`)) continue;
      const context = line.trim().slice(0, 80);
      findings.push({ check: "3-british-english", file: rel, line: lineNum, message: `Possible American spelling "${m[0]}" (use "${british}") — context: ${context}`, severity: "warn" });
      break;
    }
  }
}

function check3BritishEnglish(files: string[]): CheckResult {
  const findings: Finding[] = [];
  for (const rel of files) {
    if (rel.includes("ui-ux-design")) continue;
    if (SKIP_FILES.has(basename(rel))) continue;
    const content = readFile(rel);
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (isInsideCodeBlock(lines, i)) continue;
      checkLineForAmericanWords(lines[i], rel, i + 1, findings);
    }
  }
  return { check: "3-british-english", description: "No American spellings in prose (excludes code blocks, identifiers, AGENTS.md)", findings };
}

// --- Check 4: Orphaned docs ---

function check4OrphanedDocs(files: string[]): CheckResult {
  const findings: Finding[] = [];
  if (!existsSync(TECH_SPECS_DIR)) return { check: "4-orphaned", description: "Tech-specs are referenced from at least one other doc", findings: [] };

  const techSpecFiles = getAllMarkdownFiles(TECH_SPECS_DIR).filter((f) => !f.endsWith("README.md"));
  const allContents = new Map<string, string>();
  for (const rel of files) allContents.set(rel, readFile(rel));

  for (const specFile of techSpecFiles) {
    const basenameNoExt = basename(specFile, ".md").toLowerCase();
    let referenced = false;
    for (const [otherRel, otherContent] of allContents) {
      if (otherRel === `3-reference/tech-specs/${specFile}`) continue;
      if (otherContent.toLowerCase().includes(basenameNoExt)) { referenced = true; break; }
    }
    if (!referenced) {
      findings.push({ check: "4-orphaned", file: `3-reference/tech-specs/${specFile}`, message: `Tech spec not referenced from any other doc (orphaned)`, severity: "info" });
    }
  }
  return { check: "4-orphaned", description: "Tech-specs are referenced from at least one other doc (info)", findings };
}

// --- Check 5: Filenames ---

function check5Filenames(files: string[]): CheckResult {
  const findings: Finding[] = [];
  for (const rel of files) {
    const filename = basename(rel);
    if (CONVENTIONAL_UPPERCASE.has(filename)) continue;
    if (filename !== filename.toLowerCase()) {
      findings.push({ check: "5-filenames", file: rel, message: `Filename "${filename}" contains uppercase letters — AGENTS.md requires all-lowercase filenames`, severity: "warn" });
    }
  }
  return { check: "5-filenames", description: "All documentation file names are lowercase per AGENTS.md (excludes README.md, AGENTS.md)", findings };
}

// --- Check 6: Spec section completeness ---

const REQUIRED_TECH_SPEC_SECTIONS = [
  { pattern: /^##\s+1\.\s+Purpose/im, name: "Purpose" },
  { pattern: /^##\s+2\.\s+Scope/im, name: "Scope" },
  { pattern: /^##\s+\d+\.\s+(?:Key\s+)?Decisions/im, name: "Key Decisions" },
  { pattern: /^##\s+\d+\.\s+Open\s+Questions/im, name: "Open Questions" },
  { pattern: /^##\s+\d+\.\s+Cross-?References/im, name: "Cross-References" },
  { pattern: /^##\s+\d+\.\s+Implementation\s+Dependencies/im, name: "Implementation Dependencies" },
];

function check6SpecSectionCompleteness(files: string[]): CheckResult {
  const findings: Finding[] = [];
  for (const rel of files) {
    if (!isTechSpec(rel)) continue;
    const content = readFile(rel);
    for (const section of REQUIRED_TECH_SPEC_SECTIONS) {
      if (!section.pattern.test(content)) {
        findings.push({ check: "6-spec-sections", file: rel, message: `Missing required section: "${section.name}" (per tech-spec template in README.md §6)`, severity: "warn" });
      }
    }
  }
  return { check: "6-spec-sections", description: "Every tech-spec has the required template sections", findings };
}

// --- Check 7: Empty sections ---

function isSectionEmpty(lines: string[], headingIndex: number): boolean {
  for (let j = headingIndex + 1; j < lines.length; j++) {
    if (/^#{2,3}\s/.test(lines[j])) return false;
    if (lines[j].trim().length > 0) return false;
  }
  return true;
}

function check7EmptySections(files: string[]): CheckResult {
  const findings: Finding[] = [];
  for (const rel of files) {
    if (!isTechSpec(rel)) continue;
    const content = readFile(rel);
    const lines = content.split("\n");
    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i];
      const headingMatch = /^(#{2,3})\s+(\S.*)$/.exec(line);
      if (!headingMatch) continue;
      if (isSectionEmpty(lines, i)) {
        findings.push({ check: "7-empty-sections", file: rel, line: i + 1, message: `Section "${headingMatch[2].trim()}" has no content beneath it`, severity: "info" });
      }
    }
  }
  return { check: "7-empty-sections", description: "No empty sections in tech-specs (heading with no content beneath)", findings };
}

// --- Check 8: Stale §1 entries ---

function check8StaleSpecGapsEntries(_files: string[]): CheckResult {
  const findings: Finding[] = [];
  if (!fileExists(SPEC_GAPS_REL)) return { check: "8-stale-gaps-entries", description: "§1 entries for completed docs are marked", findings: [] };

  const content = readFile(SPEC_GAPS_REL);
  const section1Re = /## 1\.\s*Missing Referenced Documents([\s\S]*?)(?=\n### \d|\n## )/;
  const section1Match = section1Re.exec(content);
  if (!section1Match) return { check: "8-stale-gaps-entries", description: "§1 entries for completed docs are marked", findings: [] };

  const tableContent = section1Match[1];
  const rowRe = /^\|\s*`([^`]+\.md)`\s*\|/gm;
  const checkedFiles = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = rowRe.exec(tableContent)) !== null) {
    const filename = match[1];
    if (checkedFiles.has(filename)) continue;
    checkedFiles.add(filename);
    const resolved = resolveBacktickPath(SPEC_GAPS_REL, filename);
    if (!resolved) continue;
    const lineNum = getLineNum(content, match.index);
    const lineContent = content.split("\n")[lineNum - 1];
    if (!lineContent.includes("~~")) {
      findings.push({ check: "8-stale-gaps-entries", file: SPEC_GAPS_REL, line: lineNum, message: `§1 entry \`${filename}\` is listed as missing but the file exists at ${resolved} — strike through the row or move it to a "Completed" section`, severity: "info" });
    }
  }
  return { check: "8-stale-gaps-entries", description: "§1 entries for completed docs are marked (struck through or moved)", findings };
}

// --- Check 9: Cross-reference reciprocity ---

function findCrossRefs(rel: string, content: string): Set<string> {
  const refs = new Set<string>();
  const backtickRe = /`([^`]+\.md)`/g;
  let m: RegExpExecArray | null;
  while ((m = backtickRe.exec(content)) !== null) {
    const resolved = resolveBacktickPath(rel, m[1]);
    if (resolved?.includes("tech-specs")) {
      refs.add(resolved);
    }
  }
  return refs;
}

function check9CrossRefReciprocity(_files: string[]): CheckResult {
  const findings: Finding[] = [];
  if (!existsSync(TECH_SPECS_DIR)) return { check: "9-reciprocity", description: "Tech-spec cross-references are reciprocal", findings: [] };

  const techSpecFiles = getAllMarkdownFiles(TECH_SPECS_DIR).filter((f) => !f.endsWith("README.md"));
  const refMap = new Map<string, Set<string>>();
  for (const specFile of techSpecFiles) {
    const rel = `3-reference/tech-specs/${specFile}`;
    refMap.set(rel, findCrossRefs(rel, readFile(rel)));
  }

  for (const [specA, refsA] of refMap) {
    const basenameA = basename(specA, ".md").toLowerCase();
    for (const refTarget of refsA) {
      const refsTarget = refMap.get(refTarget);
      if (!refsTarget) continue;
      const reciprocated = [...refsTarget].some((r) => basename(r, ".md").toLowerCase() === basenameA);
      if (!reciprocated) {
        findings.push({ check: "9-reciprocity", file: specA, message: `Cross-references \`${basename(refTarget, ".md")}\` but is not cross-referenced back (one-directional link)`, severity: "info" });
      }
    }
  }
  return { check: "9-reciprocity", description: "Tech-spec cross-references are reciprocal (info — one-directional links are not always wrong)", findings };
}

// --- Check 10: AI frontmatter completeness ---

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;
const REQUIRED_FRONTMATTER_FIELDS = ["status", "package", "priority", "created", "updated", "tags"];

function parseFrontmatter(content: string): Record<string, string> {
  const match = FRONTMATTER_RE.exec(content);
  if (!match) return {};
  const fm: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();
    if (value && value !== "[]") fm[key] = value;
  }
  return fm;
}

function check10FrontmatterCompleteness(files: string[]): CheckResult {
  const findings: Finding[] = [];
  for (const rel of files) {
    if (!isTechSpec(rel)) continue;
    const content = readFile(rel);
    const fm = parseFrontmatter(content);
    if (Object.keys(fm).length === 0) {
      findings.push({ check: "10-ai-frontmatter", file: rel, message: `No frontmatter found — AI agents use frontmatter fields (status, package, priority, tags) to filter and prioritise docs`, severity: "warn" });
      continue;
    }
    for (const field of REQUIRED_FRONTMATTER_FIELDS) {
      if (!fm[field]) {
        findings.push({ check: "10-ai-frontmatter", file: rel, message: `Missing frontmatter field "${field}" — agents use this to filter and prioritise docs`, severity: "warn" });
      }
    }
  }
  return { check: "10-ai-frontmatter", description: "Every tech-spec has AI-consumable frontmatter (status, package, priority, created, updated, tags)", findings };
}

// --- Check 11: Vague cross-references ---

const VAGUE_RE = /\b(?:see|cf\.?)\s+(?:the\s+)?([A-Za-z].*?)(?:[.,;)]|\n)/gi;
const SKIP_VAGUE_WORDS = new Set(["above", "below", "previous", "next", "following", "preceding"]);

function checkLineForVagueRef(line: string, rel: string, lineNum: number, findings: Finding[]): void {
  if (line.includes("`")) return;
  VAGUE_RE.lastIndex = 0;
  const match = VAGUE_RE.exec(line);
  if (!match) return;
  const refText = match[1].trim().toLowerCase();
  if (SKIP_VAGUE_WORDS.has(refText)) return;
  findings.push({ check: "11-ai-vague-refs", file: rel, line: lineNum, message: `Vague cross-reference "see ${match[1].trim()}" — use an explicit backtick path like \`${refText.replaceAll(/\s+/g, "-")}.md\` so AI agents can resolve it`, severity: "info" });
}

function check11VagueCrossReferences(files: string[]): CheckResult {
  const findings: Finding[] = [];
  for (const rel of files) {
    if (!isTechSpec(rel)) continue;
    const lines = readFile(rel).split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (isInsideCodeBlock(lines, i)) continue;
      checkLineForVagueRef(lines[i], rel, i + 1, findings);
    }
  }
  return { check: "11-ai-vague-refs", description: "Cross-references use explicit paths, not vague prose references (AI agents need resolvable paths)", findings };
}

// --- Check 12: Decision tables ---

function hasDecisionTable(content: string): boolean {
  const lines = content.split("\n");
  for (let i = 0; i < lines.length - 1; i++) {
    if (!lines[i].startsWith("|")) continue;
    const headerCells = new Set(lines[i].split("|").map((c) => c.trim().toLowerCase()).filter(Boolean));
    if (headerCells.has("decision") && (headerCells.has("rationale") || headerCells.has("reason") || headerCells.has("why"))) {
      return true;
    }
  }
  return false;
}

function check12DecisionTables(files: string[]): CheckResult {
  const findings: Finding[] = [];
  for (const rel of files) {
    if (!isTechSpec(rel)) continue;
    if (!hasDecisionTable(readFile(rel))) {
      findings.push({ check: "12-ai-decision-tables", file: rel, message: `No decision table found (table with "Decision" + "Rationale" columns) — decision tables are the densest format for AI agents to extract and apply reasoning`, severity: "info" });
    }
  }
  return { check: "12-ai-decision-tables", description: "Every tech-spec has at least one decision table (Decision + Rationale columns)", findings };
}

// --- Check 13: Code blocks ---

function check13CodeBlocks(files: string[]): CheckResult {
  const findings: Finding[] = [];
  for (const rel of files) {
    if (!isTechSpec(rel)) continue;
    const content = readFile(rel);
    const codeBlockCount = (content.match(/```/g) || []).length / 2;
    if (codeBlockCount === 0) {
      findings.push({ check: "13-ai-code-blocks", file: rel, message: `No code blocks found — AI agents generate code from examples, not prose; add at least one concrete code example`, severity: "info" });
    }
  }
  return { check: "13-ai-code-blocks", description: "Every tech-spec has at least one code example (agents need concrete examples to generate code)", findings };
}

// --- Check 14: Cross-project contamination ---

const ARCHIVE_DIRS = ["4-archive", "2-development", "1-governance"];

const CONTAMINATION_PATTERNS: { pattern: RegExp; message: string }[] = [
  { pattern: /@postml[\\/]/g, message: "References @postml package (UIBuilder/Pipes contamination — Happy House Bills uses bare internal package names)" },
  { pattern: /import\s+.*\s+from\s+["']@postml\//g, message: "Import from @postml/ scope (UIBuilder/Pipes contamination)" },
  { pattern: /@\S*postml\/shared\b/g, message: "Imports from @postml/shared (UIBuilder contamination — use inline types or local type packages)" },
  { pattern: /\b@uibuilder\b/g, message: "References @uibuilder scope (UIBuilder contamination — Happy House Bills uses bare package names)" },
  { pattern: /\btailwind\b/gi, message: "Mentions Tailwind (UIBuilder contamination — Happy House Bills uses plain CSS)" },
  { pattern: /\btailwindcss\b/gi, message: "References tailwindcss dependency (UIBuilder contamination — Happy House Bills uses plain CSS)" },
  { pattern: /\bunocss\b/gi, message: "Mentions UnoCSS (UIBuilder contamination — Happy House Bills does not use utility frameworks)" },
  { pattern: /\bPostgreSQL\b|\bPostgres\b/g, message: "References PostgreSQL/Postgres (not in the Happy House Bills stack — uses Convex)" },
  { pattern: /\bRedis\b/g, message: "References Redis (not in the Happy House Bills stack — uses Convex)" },
  { pattern: /\bSupabase\b/g, message: "References Supabase (not in the Happy House Bills stack — uses Convex)" },
  { pattern: /\bFirebase\b/g, message: "References Firebase (not in the Happy House Bills stack — uses Convex)" },
  { pattern: /\bSocket\.IO\b/g, message: "References Socket.IO (not in the Happy House Bills stack — uses Convex real-time subscriptions)" },
  { pattern: /\bRust\b/gi, message: "References Rust (UIBuilder/Pipes contamination — Happy House Bills uses TypeScript)" },
  { pattern: /\bWASM\b|WebAssembly\b/g, message: "References WASM (UIBuilder/Pipes contamination — Happy House Bills uses TypeScript)" },
];

function isNegatedContext(text: string, matchIndex: number): boolean {
  const stripped = text.replace(/\*\*|\*|~~|_/g, "").toLowerCase();
  const matchText = text.slice(0, matchIndex).replace(/\*\*|\*|~~|_/g, "").toLowerCase();
  const before = matchText.slice(Math.max(0, matchText.length - 100));
  const after = stripped.slice(matchIndex).slice(0, 100).toLowerCase();
  const fullContext = (before + after);
  const negationWords = ["no ", "not ", "doesn't ", "dont ", "doesn\u2019t ", "never ", "without ", "rather than ", "instead of ", "vs ", "versus", "comparison", "competition", "competitor", "alternat", "belong to ", "belongs to ", "that of ", "separate projects", "does not", "no rust", "no wasm", "resistance", "risk ", "market position", "market note", "market ", "design inspiration", "reference", "design system"];
  return negationWords.some((word) => fullContext.includes(word));
}

function isListingContext(line: string): boolean {
  const stripped = line.replace(/\*\*|\*|~~|_/g, "").trim();
  return stripped.startsWith("- ") || stripped.startsWith("| ");
}

function check14CrossProjectContamination(files: string[]): CheckResult {
  const findings: Finding[] = [];
  const specFiles = files.filter((rel) => {
    const relNormalized = rel.replaceAll("\\", "/");
    return relNormalized.startsWith("3-reference/") && !ARCHIVE_DIRS.some((dir) => relNormalized.startsWith(dir + "/"));
  });
  for (const rel of specFiles) {
    const content = readFile(rel);
    const lines = content.split("\n");
    for (const { pattern, message } of CONTAMINATION_PATTERNS) {
      for (let i = 0; i < lines.length; i++) {
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(lines[i])) !== null) {
          if (isListingContext(lines[i])) continue;
          if (isNegatedContext(lines[i], match.index)) continue;
          const matchStart = match.index;
          const matchEnd = matchStart + match[0].length;
          const snippet = lines[i].slice(Math.max(0, matchStart - 20), matchEnd + 20).trim();
          findings.push({ check: "14-cross-project-contamination", file: rel, line: i + 1, message: `${message}: "${snippet}"`, severity: "error" });
        }
      }
    }
  }
  return { check: "14-cross-project-contamination", description: "No cross-project contamination (Tailwind, @postml, WASM/Rust, Supabase, etc.) from unrelated projects (Pipes, PostML) in reference docs", findings };
}

// --- Report printing ---

function getSeverityIcon(severity: Severity): string {
  if (severity === "error") return "\u2717";
  if (severity === "warn") return "\u26a0";
  return "\u2139";
}

function printCheckResult(result: CheckResult): void {
  const visible = QUIET ? result.findings.filter((f) => f.severity === "error") : result.findings;
  if (visible.length === 0) {
    console.log(`  \u2713 ${result.check}: ${result.description} \u2014 OK`);
    return;
  }
  console.log(`  \u2717 ${result.check}: ${result.description} (${visible.length} finding${visible.length > 1 ? "s" : ""})`);
  const shown = visible.slice(0, 20);
  for (const f of shown) {
    const lineStr = f.line ? `:${f.line}` : "";
    console.log(`    ${getSeverityIcon(f.severity)} ${f.file}${lineStr}: ${f.message}`);
  }
  if (visible.length > 20) console.log(`    ... and ${visible.length - 20} more`);
}

function printReport(results: CheckResult[]): void {
  const allFindings = results.flatMap((r) => r.findings);
  const errors = allFindings.filter((f) => f.severity === "error");
  const warnings = allFindings.filter((f) => f.severity === "warn");
  const infos = allFindings.filter((f) => f.severity === "info");

  console.log("\n" + "=".repeat(72));
  console.log("  DOCS AUDIT REPORT");
  console.log("=".repeat(72));
  console.log(`  Date: ${new Date().toISOString()}`);
  console.log(`  Files scanned: ${getAllMarkdownFiles(DOCS_DIR).length}`);
  console.log(`  Checks run: ${results.length}`);
  console.log("=".repeat(72) + "\n");

  for (const result of results) {
    printCheckResult(result);
    console.log();
  }

  console.log("=".repeat(72));
  console.log(`  Summary: ${errors.length} error(s), ${warnings.length} warning(s), ${infos.length} info(s)`);
  if (errors.length > 0) {
    console.log("  \u2717 Audit failed \u2014 fix the errors above.");
  } else if (warnings.length > 0) {
    console.log("  \u26a0 Audit passed with warnings \u2014 review the warnings above.");
  } else {
    console.log("  \u2713 Audit passed \u2014 no issues found.");
  }
  console.log("=".repeat(72) + "\n");

  if (errors.length > 0) process.exit(1);
}

function main(): void {
  if (!statSync(DOCS_DIR).isDirectory()) {
    console.error(`Docs directory not found: ${DOCS_DIR}`);
    process.exit(1);
  }

  const files = getAllMarkdownFiles(DOCS_DIR);

  const results: CheckResult[] = [
    check1BacktickPathResolution(files),
    check2DateFormat(files),
    check3BritishEnglish(files),
    check4OrphanedDocs(files),
    check5Filenames(files),
    check6SpecSectionCompleteness(files),
    check7EmptySections(files),
    check8StaleSpecGapsEntries(files),
    check9CrossRefReciprocity(files),
    check10FrontmatterCompleteness(files),
    check11VagueCrossReferences(files),
    check12DecisionTables(files),
    check13CodeBlocks(files),
    check14CrossProjectContamination(files),
  ];

  printReport(results);
}

main();
