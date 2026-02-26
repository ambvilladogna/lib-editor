import { booksPath, configPath } from "./db";

// ── Config ────────────────────────────────────────────────────────────────────

const SITE_REPO_PATH = process.env.SITE_REPO_PATH;
if (!SITE_REPO_PATH) throw new Error("Missing env var: SITE_REPO_PATH");

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SyncStatus {
  /** Working tree has uncommitted changes to tracked data files */
  dirty: boolean;
  /** Number of local commits not yet pushed to remote */
  ahead: number;
  /** Number of remote commits not yet pulled (requires a prior fetch) */
  behind: number;
  /** Data files with uncommitted changes */
  changedFiles: string[];
}

export interface PullResult {
  success: boolean;
  /** Present when pull fails due to non-fast-forward or conflicts */
  error?: string;
}

export interface PushResult {
  success: boolean;
  /** Short SHA of the new commit, present on success */
  sha?: string;
  /** Present when pull-before-push or the push itself fails */
  error?: string;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Run a git command in the repo clone and return trimmed stdout.
 * Throws if the process exits with a non-zero code.
 */
async function git(args: string[]): Promise<string> {
  const proc = Bun.spawn(["git", ...args], {
    cwd: SITE_REPO_PATH,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (exitCode !== 0) {
    throw new GitError(args, exitCode, stdout.trim(), stderr.trim());
  }

  return stdout.trim();
}

/**
 * Like `git()` but returns { ok, stdout, stderr } instead of throwing,
 * so callers can inspect the output on failure.
 */
async function gitSafe(
  args: string[]
): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  const proc = Bun.spawn(["git", ...args], {
    cwd: SITE_REPO_PATH,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  return { ok: exitCode === 0, stdout: stdout.trim(), stderr: stderr.trim() };
}

class GitError extends Error {
  constructor(
    public readonly args: string[],
    public readonly exitCode: number,
    public readonly stdout: string,
    public readonly stderr: string
  ) {
    super(
      `git ${args.join(" ")} exited ${exitCode}: ${stderr || stdout}`
    );
    this.name = "GitError";
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the current sync state of the local repo against its remote tracking
 * branch. Does NOT fetch — call pull() or a dedicated fetch first if you need
 * an up-to-date `behind` count.
 */
export async function status(): Promise<SyncStatus> {
  const dataFiles = [booksPath(), configPath()];

  // Uncommitted changes to data files only
  // --porcelain gives "XY path" lines; we only care about the paths
  const porcelain = await git(["status", "--porcelain", ...dataFiles]);
  const changedFiles = porcelain
    .split("\n")
    .filter(Boolean)
    .map((line) => line.slice(3).trim()); // strip the "XY " prefix

  // Commits ahead / behind the remote tracking branch
  // rev-list --left-right --count HEAD...@{u} prints "ahead\tbehind"
  let ahead = 0;
  let behind = 0;
  const revResult = await gitSafe([
    "rev-list",
    "--left-right",
    "--count",
    "HEAD...@{u}",
  ]);
  if (revResult.ok) {
    const parts = revResult.stdout.split(/\s+/);
    ahead = parseInt(parts[0] ?? "0", 10);
    behind = parseInt(parts[1] ?? "0", 10);
  }
  // If the command fails (e.g. no upstream configured) we leave ahead/behind = 0

  return {
    dirty: changedFiles.length > 0,
    ahead,
    behind,
    changedFiles,
  };
}

/**
 * Fetches from remote then pulls with --ff-only.
 * A non-fast-forward situation (diverged history) is reported as an error
 * rather than attempting a merge, keeping the repo in a clean state.
 */
export async function pull(): Promise<PullResult> {
  // Step 1 — fetch so remote-tracking refs are up to date
  const fetchResult = await gitSafe(["fetch"]);
  if (!fetchResult.ok) {
    return {
      success: false,
      error: `git fetch failed: ${fetchResult.stderr || fetchResult.stdout}`,
    };
  }

  // Step 2 — fast-forward only pull
  const pullResult = await gitSafe(["pull", "--ff-only"]);
  if (!pullResult.ok) {
    return {
      success: false,
      error: `git pull --ff-only failed: ${pullResult.stderr || pullResult.stdout}`,
    };
  }

  return { success: true };
}

/**
 * Stages the catalogue data files, creates a commit, pulls (ff-only) to stay
 * current with remote, then pushes with --force-with-lease.
 *
 * The pull-before-push guards against the race condition where another client
 * pushed between our last fetch and now. --force-with-lease prevents
 * accidentally overwriting remote commits we haven't seen.
 */
export async function push(commitMessage: string): Promise<PushResult> {
  const dataFiles = [booksPath(), configPath()];

  // Stage data files
  await git(["add", ...dataFiles]);

  // Commit (skip gracefully if nothing to commit)
  const commitResult = await gitSafe(["commit", "-m", commitMessage]);
  if (!commitResult.ok) {
    if (
      !commitResult.stdout.includes("nothing to commit") &&
      !commitResult.stderr.includes("nothing to commit")
    ) {
      return {
        success: false,
        error: `git commit failed: ${commitResult.stderr || commitResult.stdout}`,
      };
    }
  }

  // Push directly — startup pull already ensures we're current,
  // and --force-with-lease will reject if the remote moved unexpectedly
  const pushResult = await gitSafe(["push", "--force-with-lease"]);
  if (!pushResult.ok) {
    return {
      success: false,
      error: `git push failed: ${pushResult.stderr || pushResult.stdout}`,
    };
  }

  const sha = await git(["rev-parse", "--short", "HEAD"]);
  return { success: true, sha };
}