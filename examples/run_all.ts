/**
 * Run all TypeScript gateway examples and report results.
 *
 * Usage:
 *   cd sdk/typescript/examples/
 *   npx ts-node run_all.ts [--fail-fast] [--only 1,3] [--skip 10]
 *
 * Options:
 *   --fail-fast      Stop after the first failure
 *   --only N[,N]     Run only these example numbers (e.g. --only 1,3)
 *   --skip N[,N]     Skip these example numbers (ignored when --only is set)
 */

import * as fs from "fs";
import * as path from "path";
import * as childProcess from "child_process";

// ---------------------------------------------------------------------------
// ANSI color helpers — disabled when stdout is not a tty
// ---------------------------------------------------------------------------

const isTTY = process.stdout.isTTY === true;

function color(text: string, ...codes: string[]): string {
    if (!isTTY) return text;
    return codes.join("") + text + "\x1b[0m";
}

const BOLD   = "\x1b[1m";
const DIM    = "\x1b[2m";
const GREEN  = "\x1b[32m";
const RED    = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN   = "\x1b[36m";

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

function findExamples(dir: string): Array<{ num: number; file: string; stem: string }> {
    return fs.readdirSync(dir)
        .filter(f => /^\d{2}_.*\.ts$/.test(f))
        .sort()
        .map(f => ({
            num: parseInt(f.slice(0, 2), 10),
            file: path.join(dir, f),
            stem: f.replace(/\.ts$/, ""),
        }));
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseNums(val: string, flag: string): Set<number> {
    const result = new Set<number>();
    for (const part of val.split(",")) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const n = parseInt(trimmed, 10);
        if (isNaN(n)) {
            console.error(`Invalid ${flag} value: ${JSON.stringify(trimmed)}`);
            process.exit(1);
        }
        result.add(n);
    }
    return result;
}

function parseArgs(argv: string[]): { failFast: boolean; only: Set<number>; skip: Set<number> } {
    let failFast = false;
    let onlyStr = "";
    let skipStr = "";
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === "--fail-fast") {
            failFast = true;
        } else if (argv[i] === "--only" && i + 1 < argv.length) {
            onlyStr = argv[++i];
        } else if (argv[i] === "--skip" && i + 1 < argv.length) {
            skipStr = argv[++i];
        } else if (argv[i]?.startsWith("--only=")) {
            onlyStr = argv[i].slice(7);
        } else if (argv[i]?.startsWith("--skip=")) {
            skipStr = argv[i].slice(7);
        }
    }
    return {
        failFast,
        only: parseNums(onlyStr, "--only"),
        skip: parseNums(skipStr, "--skip"),
    };
}

// ---------------------------------------------------------------------------
// Example runner
// ---------------------------------------------------------------------------

interface RunResult {
    num: number;
    stem: string;
    status: "pass" | "fail" | "skip";
    elapsed: number;
    output: string;
}

function runExample(file: string): { passed: boolean; elapsed: number; output: string } {
    const start = Date.now();
    // Find ts-node: try npx ts-node, then ts-node directly.
    const result = childProcess.spawnSync(
        "npx",
        ["ts-node", file],
        {
            cwd: path.dirname(file),
            env: process.env,
            encoding: "utf8",
            timeout: 120_000,
        },
    );
    const elapsed = (Date.now() - start) / 1000;
    const output = [result.stdout, result.stderr].filter(Boolean).join("");
    return { passed: result.status === 0, elapsed, output };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
    const args = parseArgs(process.argv.slice(2));
    const dir = __dirname;
    const examples = findExamples(dir);

    if (examples.length === 0) {
        console.error("No example scripts found.");
        process.exit(1);
    }

    const results: RunResult[] = [];

    const runCount = args.only.size > 0
        ? args.only.size
        : examples.length - args.skip.size;

    console.log(color(`\nRunning ${runCount}/${examples.length} examples\n`, BOLD));

    for (const ex of examples) {
        // Determine whether to skip.
        let skipReason: string | null = null;
        if (args.only.size > 0) {
            if (!args.only.has(ex.num)) skipReason = "not in --only list";
        } else if (args.skip.has(ex.num)) {
            skipReason = "skipped via --skip";
        }

        if (skipReason !== null) {
            console.log(`${color("  SKIP  ", YELLOW)}${color(ex.stem, BOLD)}  (${skipReason})`);
            results.push({ num: ex.num, stem: ex.stem, status: "skip", elapsed: 0, output: "" });
            continue;
        }

        process.stdout.write(`${color("  RUN   ", CYAN)}${color(ex.stem, BOLD)} ...`);
        const { passed, elapsed, output } = runExample(ex.file);
        const elapsedStr = color(`(${elapsed.toFixed(1)}s)`, DIM);

        if (passed) {
            process.stdout.write(`\r${color("  PASS  ", GREEN)}${color(ex.stem, BOLD)}  ${elapsedStr}\n`);
        } else {
            process.stdout.write(`\r${color("  FAIL  ", RED)}${color(ex.stem, BOLD)}  ${elapsedStr}\n`);
        }

        results.push({ num: ex.num, stem: ex.stem, status: passed ? "pass" : "fail", elapsed, output });

        if (!passed) {
            console.log(color("  --- output ---", DIM));
            for (const line of output.trimEnd().split("\n")) {
                console.log(`    ${line}`);
            }
            console.log(color("  --- end ---", DIM));

            if (args.failFast) {
                console.log(color("\nStopping (--fail-fast)", YELLOW));
                break;
            }
        }
    }

    // Summary
    const passCount    = results.filter(r => r.status === "pass").length;
    const failCount    = results.filter(r => r.status === "fail").length;
    const skipCount    = results.filter(r => r.status === "skip").length;
    const totalRun     = passCount + failCount;
    const totalTime    = results.reduce((acc, r) => acc + r.elapsed, 0);

    console.log();
    console.log(color("Results", BOLD));
    console.log(`  Passed:  ${passCount}/${totalRun}`);
    if (skipCount > 0) console.log(`  Skipped: ${skipCount}`);
    if (failCount > 0) {
        console.log(color(`  Failed:  ${failCount}`, RED));
        console.log();
        console.log(color("Failed examples:", RED + BOLD));
        for (const r of results.filter(r => r.status === "fail")) {
            console.log(`  - ${r.stem}`);
        }
    }
    console.log(`  Time:    ${totalTime.toFixed(1)}s`);
    console.log();

    process.exit(failCount === 0 ? 0 : 1);
}

main();
