import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, relative, resolve, dirname, basename } from "node:path";

const DOCS_DIR = resolve(process.cwd(), "docs");
const TECH_SPECS_README_REL = join("3-reference", "tech-specs", "README.md");

const LIFECYCLE_FOLDERS = new Set(["01-draft", "02-in-progress", "03-ready-for-review", "04-implemented"]);

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
const LINK_RE = /\[([^]]*)\]\(([^)]+)\)/g;
const STATUS_RE = /^## Status\b/m;
const REVIEW_ACTIVE_RE = /\| .+ \| .+ \| .+ \| Awaiting review \|/g;
const OPEN_QUESTIONS_REGISTER_RE = /## Open Questions Register/i;
// Two ID conventions share the Open Questions Register: domain specs use
// `PREFIX-Q<n>` (e.g. `UR-Q1`) and implementation slices use `SQ-<slice>-<n>`
// (e.g. `SQ-12-1`). Both must match or the register-sync check silently no-ops
// for every slice question.
const QUESTION_ID_RE = /([A-Z]{2,}-Q\d+(?:[a-z]\d?)?|SQ-\d+-\d+)/;
// Anchor on a word boundary, allowing leading markdown emphasis: a plain
// substring test reads "unresolved" and "not resolved" as resolved, while a
// bare `^resolved` misses `**Resolved**`.
const RESOLVED_STATUS_RE = /^\s*[*_~`]*\s*resolved\b/i;
const STRIKETHROUGH_RE = /~~([^~]+)~~/;

interface Frontmatter {
  lifecycle?: string;
  status?: string;
  title?: string;
  [key: string]: unknown;
}

interface ValidationFinding {
  file: string;
  message: string;
  severity: "error" | "warn";
}

function parseFrontmatter(content: string): { fm: Frontmatter; body: string } {
  const match = FRONTMATTER_RE.exec(content);
  if (!match) return { fm: {}, body: content };

  const fm: Frontmatter = {};
  const lines = match[1].split("\n");
  for (const rawLine of lines) {
    const colonIndex = rawLine.indexOf(":");
    if (colonIndex === -1) continue;
    const key = rawLine.slice(0, colonIndex).trim();
    const raw = rawLine.slice(colonIndex + 1).trim();
    let value: string | boolean | number | string[] = raw;
    if (raw === "true") value = true;
    else if (raw === "false") value = false;
    else if (/^-?\d+$/.test(raw)) value = Number(raw);
    else if (raw.startsWith('"') && raw.endsWith('"')) value = raw.slice(1, -1);
    else if (raw.startsWith("[") && raw.endsWith("]")) {
      value = raw
        .slice(1, -1)
        .split(",")
        .map((s: string) => s.trim().replace(/^"|"$/g, ""));
    }
    fm[key] = value;
  }
  return { fm, body: match[2] };
}

function getAllMarkdownFiles(dir: string, base: string = dir): string[] {
  let files: string[] = [];
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files = files.concat(getAllMarkdownFiles(full, base));
    } else if (entry.endsWith(".md")) {
      files.push(relative(base, full));
    }
  }
  return files;
}

function findLifecycleFolder(relPath: string): string | null {
  const parts = relPath.split(sep);
  const docsIndex = parts.lastIndexOf("docs");
  if (docsIndex === -1 || docsIndex >= parts.length - 1) return null;
  const afterDocs = parts.slice(docsIndex + 1);
  for (const part of afterDocs) {
    if (LIFECYCLE_FOLDERS.has(part)) return part;
  }
  return null;
}

const sep = join("a", "b").includes("\\") ? "\\" : "/";

function checkFrontmatterLifecycle(files: string[], findings: ValidationFinding[]): void {
  for (const rel of files) {
    const full = join(DOCS_DIR, rel);
    const content = readFileSync(full, "utf-8");
    const { fm } = parseFrontmatter(content);

    if (fm.lifecycle) {
      const expectedFolder = findLifecycleFolder(rel);
      if (expectedFolder && fm.lifecycle !== expectedFolder) {
        findings.push({
          file: rel,
          message: `Frontmatter lifecycle "${fm.lifecycle}" does not match folder "${expectedFolder}"`,
          severity: "error",
        });
      }
    }
  }
}

function checkCrossReferences(files: string[], findings: ValidationFinding[]): void {
  const existingFiles = new Set(files);

  for (const rel of files) {
    const full = join(DOCS_DIR, rel);
    const content = readFileSync(full, "utf-8");
    let match;
    while ((match = LINK_RE.exec(content)) !== null) {
      const target = match[2];
      if (target.startsWith("http://") || target.startsWith("https://") || target.startsWith("#")) continue;
      if (!existingFiles.has(target)) {
        findings.push({
          file: rel,
          message: `Broken cross-reference: "${target}"`,
          severity: "warn",
        });
      }
    }
  }
}

function checkDuplicateStatusHeaders(files: string[], findings: ValidationFinding[]): void {
  for (const rel of files) {
    const full = join(DOCS_DIR, rel);
    const content = readFileSync(full, "utf-8");
    const statusMatches = content.match(STATUS_RE);
    if (statusMatches && statusMatches.length > 1) {
      findings.push({
        file: rel,
        message: `Duplicate "## Status" headers found (${statusMatches.length})`,
        severity: "error",
      });
    }
  }
}

function checkImplementedProposalsInRoadmap(
  files: string[],
  findings: ValidationFinding[]
): void {
  const roadmapPaths = files.filter((f) => f.includes("ROADMAP.md") || f.includes("roadmap.md"));
  if (roadmapPaths.length === 0) return;

  const implementedFiles = files.filter((f) => {
    const full = join(DOCS_DIR, f);
    const content = readFileSync(full, "utf-8");
    const { fm } = parseFrontmatter(content);
    return fm.lifecycle === "04-implemented" || fm.status === "implemented";
  });

  for (const impl of implementedFiles) {
    let referenced = false;
    for (const roadmap of roadmapPaths) {
      const full = join(DOCS_DIR, roadmap);
      // Compare with normalised separators: `relative()` yields backslashes on
      // Windows while roadmap entries are written with forward slashes, so a
      // raw substring test silently matches nothing on Windows.
      const content = readFileSync(full, "utf-8").replaceAll("\\", "/");
      const key = (impl.endsWith(".md") ? impl.slice(0, -3) : impl).replaceAll("\\", "/");
      if (content.includes(key)) {
        referenced = true;
        break;
      }
    }
    if (!referenced) {
      findings.push({
        file: impl,
        message: "Implemented proposal not referenced in any roadmap",
        severity: "warn",
      });
    }
  }
}

function checkReviewQueue(files: string[], findings: ValidationFinding[]): void {
  const reviewPath = relative(DOCS_DIR, join(DOCS_DIR, "2-development/supporting-docs/reviews/README.md"));
  const reviewFull = join(DOCS_DIR, reviewPath);
  if (!files.includes(reviewPath)) {
    findings.push({
      file: reviewPath,
      message: "Review queue file missing at expected path",
      severity: "error",
    });
    return;
  }

  const content = readFileSync(reviewFull, "utf-8");
  const activeEntries = (content.match(REVIEW_ACTIVE_RE) || []).length;

  let hasUncommittedWork: boolean;
  try {
    const gitOutput = execSync("git status --porcelain docs/", {
      cwd: resolve(process.cwd()),
      env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot },
      encoding: "utf-8",
      timeout: 5000,
    });
    hasUncommittedWork = gitOutput.trim().length > 0;
  } catch {
    hasUncommittedWork = false;
  }

  if (hasUncommittedWork && activeEntries === 0) {
    findings.push({
      file: reviewPath,
      message: "Uncommitted work exists but review queue has no active entries",
      severity: "warn",
    });
  }
}

interface QuestionEntry {
  id: string;
  resolved: boolean;
  sourceSpec?: string;
}

function parseRegisterRow(line: string): QuestionEntry | null {
  if (!line.startsWith("|")) return null;
  const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
  if (cells.length < 1) return null;
  const idMatch = QUESTION_ID_RE.exec(cells[0]);
  if (!idMatch) return null;
  const resolved = STRIKETHROUGH_RE.test(cells[0]);
  const sourceSpec = cells[2] ? cells[2].replaceAll("~~", "").replaceAll("`", "").trim() : undefined;
  return { id: idMatch[1], resolved, sourceSpec };
}

function extractRegisterEntries(registerContent: string): QuestionEntry[] {
  const entries: QuestionEntry[] = [];
  const lines = registerContent.replaceAll("\r", "").split("\n");
  let inRegister = false;
  let headerPassed = false;

  for (const line of lines) {
    if (OPEN_QUESTIONS_REGISTER_RE.test(line)) { inRegister = true; continue; }
    if (inRegister && /^##\s/.test(line)) break;
    if (!inRegister || !line.startsWith("|")) continue;
    if (/^\|[-| :]+\|$/.test(line)) { headerPassed = true; continue; }
    if (headerPassed) {
      const entry = parseRegisterRow(line);
      if (entry) entries.push(entry);
    }
  }
  return entries;
}

function parseSpecQuestionRow(line: string): QuestionEntry | null {
  const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
  if (cells.length < 3) return null;
  const idMatch = QUESTION_ID_RE.exec(cells[0]);
  if (!idMatch) return null;
  const status = cells[2]?.toLowerCase() ?? "";
  // Anchor on a word boundary: a plain substring test reads "unresolved" and
  // "not resolved" as resolved.
  const resolved = RESOLVED_STATUS_RE.test(status) || STRIKETHROUGH_RE.test(cells[0]);
  return { id: idMatch[1], resolved };
}

function extractSpecQuestions(content: string): QuestionEntry[] {
  const entries: QuestionEntry[] = [];
  const lines = content.replaceAll("\r", "").split("\n");
  let inQuestionTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith("|")) { inQuestionTable = false; continue; }
    if (/^\|[-| :]+\|$/.test(line)) {
      const headerLine = i > 0 ? lines[i - 1] : "";
      const headerCells = headerLine.split("|").map((c) => c.trim().toLowerCase()).filter(Boolean);
      inQuestionTable = headerCells.includes("status");
      continue;
    }
    if (inQuestionTable) {
      const entry = parseSpecQuestionRow(line);
      if (entry) entries.push(entry);
    }
  }
  return entries;
}

function checkMissingInRegister(specById: Map<string, { file: string; resolved: boolean }>, registerById: Map<string, QuestionEntry>, findings: ValidationFinding[]): void {
  for (const [id, specInfo] of specById) {
    if (!registerById.has(id)) {
      findings.push({ file: specInfo.file, message: `Open question "${id}" exists in spec but is missing from the Open Questions Register`, severity: "warn" });
    }
  }
}

function checkResolutionMismatch(specById: Map<string, { file: string; resolved: boolean }>, registerById: Map<string, QuestionEntry>, findings: ValidationFinding[]): void {
  for (const [id, specInfo] of specById) {
    const registerEntry = registerById.get(id);
    if (!registerEntry) continue;
    if (specInfo.resolved && !registerEntry.resolved) {
      findings.push({ file: specInfo.file, message: `Open question "${id}" is resolved in spec but still active in the Open Questions Register`, severity: "warn" });
    } else if (!specInfo.resolved && registerEntry.resolved) {
      findings.push({ file: specInfo.file, message: `Open question "${id}" is active in spec but marked resolved in the Open Questions Register`, severity: "warn" });
    }
  }
}

function checkOrphanedRegisterEntries(registerById: Map<string, QuestionEntry>, specById: Map<string, { file: string; resolved: boolean }>, specGapsFile: string, findings: ValidationFinding[]): void {
  for (const [id, registerEntry] of registerById) {
    if (registerEntry.resolved) continue;
    if (!specById.has(id)) {
      findings.push({ file: specGapsFile, message: `Open question "${id}" is in the register but not found in any spec (orphaned or spec not yet written)`, severity: "warn" });
    }
  }
}

function checkOpenQuestionsSync(files: string[], findings: ValidationFinding[]): void {
  const specGapsFile = files.find((f) => f.endsWith("spec-gaps.md"));
  if (!specGapsFile) return;

  const specGapsContent = readFileSync(join(DOCS_DIR, specGapsFile), "utf-8");
  const registerEntries = extractRegisterEntries(specGapsContent);
  if (registerEntries.length === 0) return;

  const registerById = new Map<string, QuestionEntry>();
  for (const entry of registerEntries) registerById.set(entry.id, entry);

  const specById = new Map<string, { file: string; resolved: boolean }>();
  for (const rel of files) {
    if (rel === specGapsFile) continue;
    const content = readFileSync(join(DOCS_DIR, rel), "utf-8");
    for (const q of extractSpecQuestions(content)) {
      specById.set(q.id, { file: rel, resolved: q.resolved });
    }
  }

  checkMissingInRegister(specById, registerById, findings);
  checkResolutionMismatch(specById, registerById, findings);
  checkOrphanedRegisterEntries(registerById, specById, specGapsFile, findings);
}

// --- Shared helpers for structural checks (moved from docs-audit.ts) ---

let lowerFileIndex: Map<string, string> | null = null;

function getLowerFileIndex(files: string[]): Map<string, string> {
  if (lowerFileIndex) return lowerFileIndex;
  const index = new Map<string, string>();
  for (const f of files) {
    index.set(f.toLowerCase().replaceAll("\\", "/"), f);
    index.set(basename(f).toLowerCase(), f);
  }
  lowerFileIndex = index;
  return index;
}

function fileExistsRel(rel: string): boolean {
  return existsSync(join(DOCS_DIR, rel));
}

function resolveBacktickPath(fromRel: string, refPath: string, files: string[]): string | null {
  const cleanPath = refPath.replaceAll("`", "").trim();
  if (!cleanPath.endsWith(".md")) return null;

  const fromDir = dirname(fromRel);
  const index = getLowerFileIndex(files);
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
      if (fileExistsRel(candidate)) return candidate;
      const lowerCandidate = candidate.toLowerCase().replaceAll("\\", "/");
      if (index.has(lowerCandidate)) return index.get(lowerCandidate)!;
    }
  }
  const lastSegment = basename(cleanPath).toLowerCase();
  const dashSegment = lastSegment.replaceAll("_", "-");
  if (index.has(lastSegment)) return index.get(lastSegment)!;
  if (index.has(dashSegment)) return index.get(dashSegment)!;
  return null;
}

// --- Check: Stale forward refs ---

function checkStaleForwardRefs(files: string[], findings: ValidationFinding[]): void {
  const staleRefRe = /(?:forward ref|not yet written|not yet defined|forward reference)[^)]*?`([^`]+\.md)`/gi;

  for (const rel of files) {
    const full = join(DOCS_DIR, rel);
    const content = readFileSync(full, "utf-8");
    staleRefRe.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = staleRefRe.exec(content)) !== null) {
      const refPath = match[1];
      const resolved = resolveBacktickPath(rel, refPath, files);
      if (resolved) {
        findings.push({
          file: rel,
          message: `Stale forward ref: refers to \`${refPath}\` as "not yet written" but the file exists at ${resolved}`,
          severity: "error",
        });
      }
    }
  }
}

// --- Check: Status table accuracy ---

function checkStatusTableAccuracy(files: string[], findings: ValidationFinding[]): void {
  if (!fileExistsRel(TECH_SPECS_README_REL)) return;

  const content = readFileSync(join(DOCS_DIR, TECH_SPECS_README_REL), "utf-8");
  const lines = content.split("\n");
  let currentDir = "";
  const statusRowRe = /^\|\s*`([^`]+\.md)`\s*\|\s*(Missing|Complete|Part complete|Updated)\s*\|/;

  for (const line of lines) {
    const dirMatch = /^###\s+\w+\s+\(`(?:tech-specs\/)?([^`]+\/)`\)/.exec(line);
    if (dirMatch) {
      currentDir = dirMatch[1];
      continue;
    }
    const match = statusRowRe.exec(line);
    if (!match) continue;
    const filename = match[1];
    const status = match[2];
    const lowerFilename = filename.toLowerCase().replaceAll("_", "-");
    const fullPath = join("3-reference", "tech-specs", currentDir, lowerFilename);
    const exists = fileExistsRel(fullPath);
    if (status === "Missing" && exists) {
      findings.push({
        file: TECH_SPECS_README_REL,
        message: `Status table says "${filename}" is Missing but the file exists at ${fullPath}`,
        severity: "error",
      });
    } else if (status === "Complete" && !exists) {
      findings.push({
        file: TECH_SPECS_README_REL,
        message: `Status table says "${filename}" is Complete but the file does not exist at ${fullPath}`,
        severity: "error",
      });
    }
  }
}

// --- Check: Duplicate open-question IDs ---

function checkDuplicateQuestionIds(files: string[], findings: ValidationFinding[]): void {
  const specGapsFile = files.find((f) => f.endsWith("spec-gaps.md"));
  if (!specGapsFile) return;

  const content = readFileSync(join(DOCS_DIR, specGapsFile), "utf-8");
  const seen = new Map<string, number>();
  const allIdRe = /^\|\s*([A-Z0-9]+-Q\d+)\s*\|/gm;
  let match: RegExpExecArray | null;
  while ((match = allIdRe.exec(content)) !== null) {
    const id = match[1];
    seen.set(id, (seen.get(id) ?? 0) + 1);
    if (seen.get(id) === 2) {
      findings.push({
        file: specGapsFile,
        message: `Duplicate open-question ID "${id}" — appears ${seen.get(id)} times in the register`,
        severity: "error",
      });
    }
  }
}

// --- Check: Gap count accuracy ---

function checkGapCountAccuracy(files: string[], findings: ValidationFinding[]): void {
  const specGapsFile = files.find((f) => f.endsWith("spec-gaps.md"));
  if (!specGapsFile) return;

  const content = readFileSync(join(DOCS_DIR, specGapsFile), "utf-8");
  const section1Match = content.match(/## 1\.\s*Missing Referenced Documents([\s\S]*?)(?=\n### \d|\n## )/);
  if (!section1Match) return;

  const tableContent = section1Match[1];
  const rowRe = /^\|\s*`([^`]+\.md)`\s*\|/gm;
  const checkedFiles = new Set<string>();
  let actualMissing = 0;
  let match: RegExpExecArray | null;
  while ((match = rowRe.exec(tableContent)) !== null) {
    const filename = match[1];
    if (checkedFiles.has(filename)) continue;
    checkedFiles.add(filename);
    const resolved = resolveBacktickPath(specGapsFile, filename, files);
    if (!resolved) actualMissing++;
  }

  const gapCountMatch = content.match(/\|\s*Missing referenced documents\s*\|\s*(\d+)\s*\|/);
  if (gapCountMatch) {
    const statedCount = Number.parseInt(gapCountMatch[1], 10);
    if (statedCount !== actualMissing) {
      findings.push({
        file: specGapsFile,
        message: `Gap count says "Missing referenced documents: ${statedCount}" but ${actualMissing} of the §1 table entries still don't resolve to a file`,
        severity: "warn",
      });
    }
  }
}

// --- Check: §6 Next Actions vs domain README status sync ---

function checkNextActionsSync(files: string[], findings: ValidationFinding[]): void {
  const specGapsFile = files.find((f) => f.endsWith("spec-gaps.md"));
  if (!specGapsFile) return;

  const content = readFileSync(join(DOCS_DIR, specGapsFile), "utf-8");
  const lines = content.split("\n");

  let inSection6 = false;

  for (const line of lines) {
    if (/^## 6\.\s/.test(line)) { inSection6 = true; continue; }
    if (inSection6 && /^##\s+[789]/.test(line)) break;
  }

  const section6Content = lines
    .slice(
      lines.findIndex((l) => /^## 6\.\s/.test(l)) + 1,
      lines.findIndex((l, i) => i > lines.findIndex((l2) => /^## 6\.\s/.test(l2)) && /^##\s+[789]/.test(l))
    )
    .join("\n");

  const itemRe = /(?:~~)?(\d+)\.\s+\*\*Write\s+`([^`]+\.md)`\*\*/;

  for (const line of section6Content.split("\n")) {
    const match = itemRe.exec(line);
    if (!match) continue;

    const itemNum = match[1];
    const filePath = match[2];
    const isStruckThrough = line.startsWith("~~");

    if (!filePath.startsWith("domains/")) continue;

    const pathParts = filePath.replace(/\\/g, "/").split("/");
    if (pathParts.length !== 3) continue;

    const domainDir = `${pathParts[0]}/${pathParts[1]}`;
    const filename = pathParts[2];
    const readmePath = join("3-reference", domainDir, "README.md");
    if (!fileExistsRel(readmePath)) continue;

    const readmeContent = readFileSync(join(DOCS_DIR, readmePath), "utf-8");
    const readmeLines = readmeContent.split("\n");
    let tableHeaderFound = false;
    let readmeStatus: string | null = null;

    for (const readLine of readmeLines) {
      if (readLine.includes("| Spec |") && readLine.includes("Status")) {
        tableHeaderFound = true;
        continue;
      }
      if (tableHeaderFound) {
        if (!readLine.startsWith("|")) {
          tableHeaderFound = false;
          continue;
        }
        if (readLine.includes("---")) continue;
        const rowCells = readLine.split("|").map((c) => c.trim()).filter(Boolean);
        if (rowCells.length >= 2 && rowCells[0].includes(filename)) {
          readmeStatus = rowCells[1];
          break;
        }
      }
    }

    if (readmeStatus === null) continue;

    const readmeSaysWritten = !["missing", "not started"].includes(readmeStatus.toLowerCase());

    if (isStruckThrough && !readmeSaysWritten) {
      findings.push({
        file: readmePath,
        message: `§6 item ${itemNum} (\`${filePath}\`) is struck-through (spec written) but domain README status says "${readmeStatus}" — update to "Complete" or "Part complete"`,
        severity: "warn",
      });
    } else if (!isStruckThrough && readmeSaysWritten) {
      findings.push({
        file: specGapsFile,
        message: `§6 item ${itemNum} (\`${filePath}\`) is NOT struck-through but domain README says "${readmeStatus}" — strike-through the §6 item after writing the spec, or update README to "Not started" if deferred`,
        severity: "warn",
      });
    }
  }
}

function main(): void {
  const findings: ValidationFinding[] = [];

  if (!statSync(DOCS_DIR).isDirectory()) {
    console.error(`Docs directory not found: ${DOCS_DIR}`);
    process.exit(1);
  }

  const files = getAllMarkdownFiles(DOCS_DIR);

  checkFrontmatterLifecycle(files, findings);
  checkCrossReferences(files, findings);
  checkDuplicateStatusHeaders(files, findings);
  checkImplementedProposalsInRoadmap(files, findings);
  checkReviewQueue(files, findings);
  checkOpenQuestionsSync(files, findings);
  checkStaleForwardRefs(files, findings);
  checkStatusTableAccuracy(files, findings);
  checkDuplicateQuestionIds(files, findings);
  checkGapCountAccuracy(files, findings);
  checkNextActionsSync(files, findings);

  const errors = findings.filter((f) => f.severity === "error");
  const warnings = findings.filter((f) => f.severity === "warn");

  if (findings.length === 0) {
    console.log("✅ doc-lint passed — no issues found.");
    process.exit(0);
  }

  for (const f of findings) {
    const icon = f.severity === "error" ? "❌" : "⚠️";
    console.log(`${icon} ${f.file}: ${f.message}`);
  }

  console.log(`\n${errors.length} error(s), ${warnings.length} warning(s)`);

  if (errors.length > 0) {
    process.exit(1);
  }
}

main();
