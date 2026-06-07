#!/usr/bin/env bun
import {existsSync} from "node:fs";
import {readFile} from "node:fs/promises";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";

import {run, runCapture} from "../utils/process.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DEFAULT_REPO = "notnotype/neuro-book";
const RELEASE_WORKFLOW = "release-container.yml";

const options = parseArgs(process.argv.slice(2));

async function main() {
    process.chdir(REPO_ROOT);

    const packageVersion = await readPackageVersion();
    const branch = await currentBranch();
    const head = (await runCapture("git", ["rev-parse", "HEAD"], {cwd: REPO_ROOT})).trim();
    const shortHead = (await runCapture("git", ["rev-parse", "--short", "HEAD"], {cwd: REPO_ROOT})).trim();
    const tag = options.tag ?? await defaultCanaryTag(packageVersion, shortHead);
    const target = options.target ?? head;

    await assertGhAvailable();
    await assertReleaseDoesNotExist(tag);
    await assertGitTagDoesNotExist(tag);
    if (!options.allowDirty) {
        await assertCleanTrackedWorktree();
    }
    if (options.push) {
        await pushCurrentHead(branch);
    } else if (!options.target && !options.dryRun) {
        await assertCurrentHeadPushed(branch, head);
    }

    const notes = await releaseNotes({
        tag,
        target,
        packageVersion,
        shortHead,
    });
    const ghArgs = [
        "release",
        "create",
        tag,
        "--repo",
        options.repo,
        "--target",
        target,
        "--title",
        `NeuroBook ${tag}`,
        "--notes",
        notes,
        "--prerelease",
    ];
    if (options.draft) {
        ghArgs.push("--draft");
    }

    if (options.dryRun) {
        console.log(`tag: ${tag}`);
        console.log(`target: ${target}`);
        console.log(`repo: ${options.repo}`);
        if (!options.target) {
            console.log("note: dry-run 未检查 HEAD 是否已推送；真实 release 会检查，或可加 --push。");
        }
        console.log(`command: gh ${ghArgs.map(shellQuote).join(" ")}`);
        return;
    }

    if (!options.yes) {
        throw new Error("即将创建远端 canary prerelease。确认执行请加 --yes；预览请加 --dry-run。");
    }

    await run("gh", ghArgs, {cwd: REPO_ROOT});
    console.log(`Created canary release: ${tag}`);

    if (options.watch && !options.draft) {
        await watchReleaseWorkflow({head, tag});
    }
}

function parseArgs(args) {
    const parsed = {
        allowDirty: false,
        draft: false,
        dryRun: false,
        push: false,
        repo: process.env.GITHUB_REPOSITORY || DEFAULT_REPO,
        tag: null,
        target: null,
        watch: true,
        yes: false,
    };

    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === "--allow-dirty") {
            parsed.allowDirty = true;
            continue;
        }
        if (arg === "--draft") {
            parsed.draft = true;
            continue;
        }
        if (arg === "--dry-run") {
            parsed.dryRun = true;
            continue;
        }
        if (arg === "--push") {
            parsed.push = true;
            continue;
        }
        if (arg === "--no-watch") {
            parsed.watch = false;
            continue;
        }
        if (arg === "--watch") {
            parsed.watch = true;
            continue;
        }
        if (arg === "--yes" || arg === "-y") {
            parsed.yes = true;
            continue;
        }
        if (arg === "--repo") {
            parsed.repo = requireValue(args, index, arg);
            index += 1;
            continue;
        }
        if (arg === "--tag") {
            parsed.tag = requireValue(args, index, arg);
            index += 1;
            continue;
        }
        if (arg === "--target") {
            parsed.target = requireValue(args, index, arg);
            index += 1;
            continue;
        }
        throw new Error(`未知参数：${arg}`);
    }

    return parsed;
}

function requireValue(args, index, arg) {
    const value = args[index + 1];
    if (!value) {
        throw new Error(`${arg} 需要参数值`);
    }
    return value;
}

async function readPackageVersion() {
    const packageJson = JSON.parse(await readFile(resolve(REPO_ROOT, "package.json"), "utf8"));
    return String(packageJson.version);
}

async function defaultCanaryTag(packageVersion, shortHead) {
    const nextPatch = nextPatchVersion(packageVersion);
    const stamp = new Date()
        .toISOString()
        .replace(/[-:]/gu, "")
        .replace(/\.\d{3}Z$/u, "Z")
        .replace("T", ".");
    return `v${nextPatch}-canary.${stamp}.${shortHead}`;
}

function nextPatchVersion(version) {
    const match = /^(\d+)\.(\d+)\.(\d+)(?:-.+)?$/u.exec(version);
    if (!match) {
        throw new Error(`package.json version 不是 semver patch 形式：${version}`);
    }
    const major = Number(match[1]);
    const minor = Number(match[2]);
    const patch = Number(match[3]);
    return `${major}.${minor}.${patch + 1}`;
}

async function currentBranch() {
    const branch = (await runCapture("git", ["branch", "--show-current"], {cwd: REPO_ROOT})).trim();
    if (!branch) {
        throw new Error("当前不是命名分支。请切到 release 分支，或用 --target 指定已推送 commit。");
    }
    return branch;
}

async function assertGhAvailable() {
    await runCapture("gh", ["--version"], {cwd: REPO_ROOT});
    await runCapture("gh", ["auth", "status"], {cwd: REPO_ROOT});
}

async function assertReleaseDoesNotExist(tag) {
    try {
        await runCapture("gh", ["release", "view", tag, "--repo", options.repo], {cwd: REPO_ROOT});
    } catch {
        return;
    }
    throw new Error(`GitHub release 已存在：${tag}`);
}

async function assertGitTagDoesNotExist(tag) {
    const localTag = await runCapture("git", ["tag", "--list", tag], {cwd: REPO_ROOT});
    if (localTag.trim()) {
        throw new Error(`本地 tag 已存在：${tag}`);
    }
    const remoteTag = await runCapture("git", ["ls-remote", "--tags", "origin", tag], {cwd: REPO_ROOT});
    if (remoteTag.trim()) {
        throw new Error(`远端 tag 已存在：${tag}`);
    }
}

async function assertCleanTrackedWorktree() {
    const status = await runCapture("git", ["status", "--porcelain", "--untracked-files=no"], {cwd: REPO_ROOT});
    if (status.trim()) {
        throw new Error(`tracked worktree 不干净，停止 release：\n${status.trim()}\n先提交或 stash，或仅本地预览时使用 --allow-dirty --dry-run。`);
    }
}

async function pushCurrentHead(branch) {
    await run("git", ["push", "origin", `HEAD:${branch}`], {cwd: REPO_ROOT});
}

async function assertCurrentHeadPushed(branch, head) {
    await run("git", ["fetch", "origin", branch], {cwd: REPO_ROOT});
    const remoteRef = `origin/${branch}`;
    const remoteExists = await runCapture("git", ["rev-parse", "--verify", remoteRef], {cwd: REPO_ROOT})
        .then(() => true)
        .catch(() => false);
    if (!remoteExists) {
        throw new Error(`远端分支不存在：${remoteRef}。请先 push，或运行 release 脚本时加 --push。`);
    }
    const containsHead = await runCapture("git", ["merge-base", "--is-ancestor", head, remoteRef], {cwd: REPO_ROOT})
        .then(() => true)
        .catch(() => false);
    if (!containsHead) {
        throw new Error(`当前 HEAD 尚未包含在 ${remoteRef}。请先 push，或运行 release 脚本时加 --push。`);
    }
}

async function releaseNotes(input) {
    const previousTag = await runCapture("git", ["describe", "--tags", "--abbrev=0", `${input.target}^`], {cwd: REPO_ROOT})
        .then((value) => value.trim())
        .catch(() => "");
    const compareLine = previousTag
        ? `Compare: https://github.com/${options.repo}/compare/${previousTag}...${input.tag}`
        : "";
    return [
        "Canary build for early validation.",
        "",
        `- Tag: ${input.tag}`,
        `- Commit: ${input.target}`,
        `- Package version: ${input.packageVersion}`,
        compareLine ? `- ${compareLine}` : "",
        "",
        "Windows portable and container images are produced by the release workflow.",
    ].filter(Boolean).join("\n");
}

async function watchReleaseWorkflow({head, tag}) {
    const runId = await findWorkflowRun({head, tag});
    if (!runId) {
        throw new Error(`未找到 ${RELEASE_WORKFLOW} 的 release run。可稍后手动查看 GitHub Actions。`);
    }
    await run("gh", ["run", "watch", runId, "--repo", options.repo, "--exit-status"], {cwd: REPO_ROOT});
}

async function findWorkflowRun({head, tag}) {
    for (let attempt = 0; attempt < 18; attempt += 1) {
        const output = await runCapture("gh", [
            "run",
            "list",
            "--repo",
            options.repo,
            "--workflow",
            RELEASE_WORKFLOW,
            "--event",
            "release",
            "--limit",
            "10",
            "--json",
            "databaseId,headSha,displayTitle,status,createdAt",
        ], {cwd: REPO_ROOT});
        const runs = JSON.parse(output);
        const match = runs.find((item) => item.headSha === head || item.displayTitle?.includes(tag));
        if (match?.databaseId) {
            return String(match.databaseId);
        }
        await sleep(10_000);
    }
    return null;
}

function sleep(ms) {
    return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function shellQuote(value) {
    return /^[a-zA-Z0-9_./:=@-]+$/u.test(value)
        ? value
        : JSON.stringify(value);
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
