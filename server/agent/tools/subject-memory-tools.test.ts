import {mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {Type} from "typebox";
import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {fauxAssistantMessage, fauxToolCall, registerFauxProvider} from "@earendil-works/pi-ai";
import type {FauxProviderRegistration} from "@earendil-works/pi-ai";
import {NeuroAgentHarness} from "nbook/server/agent/harness/neuro-agent-harness";
import {AgentProfileCatalog} from "nbook/server/agent/profiles/catalog";
import {defineAgentProfile} from "nbook/server/agent/profiles/define-agent-profile";
import {JsonlSessionRepository} from "nbook/server/agent/session/session-repo";
import type {ToolExecutionContext} from "nbook/server/agent/tools/types";
import memoryCuratorProfile from "../../../assets/workspace/.nbook/agent/profiles/builtin/memory.curator.profile";
import {
    applySubjectMemoryPatch,
    parseSubjectEventsJsonl,
    parseSubjectMemoriesJsonl,
} from "nbook/server/agent/tools/subject-memory";

describe("subject memory tools", () => {
    let root: string;
    let workspaceRoot: string;
    let harness: NeuroAgentHarness;
    let context: ToolExecutionContext;
    let faux: FauxProviderRegistration;

    beforeEach(async () => {
        root = await mkdtemp(join(tmpdir(), "nbook-subject-memory-tools-test-"));
        workspaceRoot = join(root, "workspace");
        await mkdir(workspaceRoot, {recursive: true});
        faux = registerFauxProvider({
            models: [{
                id: "subject-memory-faux",
                contextWindow: 128_000,
                maxTokens: 8_000,
            }],
        });
        const profiles = new AgentProfileCatalog(
            join(root, "missing-system-profiles"),
            join(root, "missing-user-profiles"),
        );
        harness = new NeuroAgentHarness({
            repo: new JsonlSessionRepository(root),
            profiles,
            modelResolver: () => faux.getModel(),
            enableSessionSummarizer: false,
        });
        harness.profiles.register(memoryCuratorProfile, false);
        harness.profiles.register(defineAgentProfile({
            manifest: {
                key: "test.subject-memory-tools",
                name: "Subject Memory Tools Test",
            },
            inputSchema: Type.Object({}),
            allowedToolKeys: [],
            prepare() {
                return {};
            },
        }), false);
        const session = await harness.createAgent({
            profileKey: "test.subject-memory-tools",
            input: {},
            workspaceRoot,
        });
        context = {
            harness,
            sessionId: session.sessionId,
            profileKey: "test.subject-memory-tools",
            workspaceRoot,
            workspaceKey: "global",
        };
    });

    afterEach(async () => {
        await harness.drainBackgroundTasks();
        faux.unregister();
        await rm(root, {recursive: true, force: true});
    });

    it("解析 events.jsonl 并拒绝空 text", () => {
        expect(parseSubjectEventsJsonl([
            "{\"tick\":\"000001\",\"time\":\"早晨\",\"text\":\"我被粉色头发的女孩子帮了一把。\"}",
            "{\"text\":\"我还不知道她叫什么。\"}",
        ].join("\n"))).toEqual([
            {tick: "000001", time: "早晨", text: "我被粉色头发的女孩子帮了一把。"},
            {text: "我还不知道她叫什么。"},
        ]);

        expect(() => parseSubjectEventsJsonl("{\"text\":\"\"}")).toThrow("text 不能为空");
    });

    it("解析 memory.jsonl，支持长 view 并拒绝重复 topic", () => {
        const longView = "艾琳娜是我的同班同学。".repeat(120);

        expect(parseSubjectMemoriesJsonl(JSON.stringify({
            topic: "艾琳娜",
            aliases: ["粉色头发的女孩子"],
            view: longView,
        }))).toEqual([{
            topic: "艾琳娜",
            aliases: ["粉色头发的女孩子"],
            view: longView,
        }]);

        expect(() => parseSubjectMemoriesJsonl([
            "{\"topic\":\"艾琳娜\",\"view\":\"同学。\"}",
            "{\"topic\":\"艾琳娜\",\"view\":\"朋友。\"}",
        ].join("\n"))).toThrow("重复 topic");
    });

    it("应用 JSON Patch 后仍校验 memory 结构", () => {
        const updated = applySubjectMemoryPatch([
            {topic: "粉色头发的女孩子", aliases: ["早上帮过我的女孩"], view: "她早上帮过我。"},
            {topic: "艾琳娜", view: "她是同班同学。"},
        ], [
            {op: "replace", path: "/1", value: {
                topic: "艾琳娜",
                aliases: ["粉色头发的女孩子", "早上帮过我的女孩"],
                view: "我已经意识到艾琳娜就是早上帮过我的粉色头发女孩。",
            }},
            {op: "remove", path: "/0"},
        ]);

        expect(updated).toEqual([{
            topic: "艾琳娜",
            aliases: ["粉色头发的女孩子", "早上帮过我的女孩"],
            view: "我已经意识到艾琳娜就是早上帮过我的粉色头发女孩。",
        }]);
    });

    it("subject_event_append 追加 JSONL 并标记 RAG dirty", async () => {
        const subjectRoot = join(workspaceRoot, "demo", "simulation", "subjects", "heroine");
        await mkdir(subjectRoot, {recursive: true});
        await writeFile(join(subjectRoot, "events.jsonl"), "{\"text\":\"旧事件。\"}\n", "utf-8");
        const tool = mustTool("subject_event_append", harness);

        await tool.executeWithContext?.(context, "append-events", {
            subjectPath: "demo/simulation/subjects/heroine",
            events: [
                {tick: "000002", text: "我确认艾琳娜就是早上帮过我的女孩。"},
            ],
        });

        await expect(readFile(join(subjectRoot, "events.jsonl"), "utf-8")).resolves.toBe([
            "{\"text\":\"旧事件。\"}",
            "{\"text\":\"我确认艾琳娜就是早上帮过我的女孩。\",\"tick\":\"000002\"}",
            "",
        ].join("\n"));
        await expect(readFile(join(workspaceRoot, "demo", ".nbook", "subject-rag-dirty.json"), "utf-8")).resolves.toContain("\"events\"");
    });

    it("subject_event_append 硬切 JSONL，不导入旧 events.md", async () => {
        const subjectRoot = join(workspaceRoot, "demo", "simulation", "subjects", "heroine");
        await mkdir(subjectRoot, {recursive: true});
        await writeFile(join(subjectRoot, "events.md"), "## 旧经历\n\n她曾经在雨夜帮我带路。", "utf-8");
        const tool = mustTool("subject_event_append", harness);

        await tool.executeWithContext?.(context, "append-events-hard-cut", {
            subjectPath: "demo/simulation/subjects/heroine",
            events: [
                {text: "我今天再次想起那次雨夜带路。"},
            ],
        });

        const events = parseSubjectEventsJsonl(await readFile(join(subjectRoot, "events.jsonl"), "utf-8"));
        expect(events).toEqual([
            {text: "我今天再次想起那次雨夜带路。"},
        ]);
        await expect(readFile(join(workspaceRoot, "demo", ".nbook", "subject-rag-dirty.json"), "utf-8")).resolves.toContain("\"events\"");
    });

    it("subject_rag_search 未配置 embedding 时明确失败且不做关键词 fallback", async () => {
        const subjectRoot = join(workspaceRoot, "demo", "simulation", "subjects", "heroine");
        await mkdir(subjectRoot, {recursive: true});
        await writeFile(join(subjectRoot, "events.jsonl"), "{\"text\":\"艾琳娜帮过我。\"}\n", "utf-8");
        await writeFile(join(subjectRoot, "memory.jsonl"), "{\"topic\":\"艾琳娜\",\"view\":\"她帮过我。\"}\n", "utf-8");
        const tool = mustTool("subject_rag_search", harness);

        await expect(tool.executeWithContext?.(context, "rag-search", {
            subjectPath: "demo/simulation/subjects/heroine",
            query: "艾琳娜",
        })).rejects.toThrow("不会执行关键词 fallback");
    });

    it("memory_bio 调用真实 memory.curator profile，应用 JSON Patch 并标记 dirty", async () => {
        const subjectRoot = join(workspaceRoot, "demo", "simulation", "subjects", "heroine");
        await mkdir(subjectRoot, {recursive: true});
        await writeFile(join(subjectRoot, "memory.jsonl"), [
            "{\"topic\":\"粉色头发的女孩子\",\"aliases\":[\"早上帮过我的女孩\"],\"view\":\"她早上帮过我。\"}",
            "{\"topic\":\"艾琳娜\",\"view\":\"她是同班同学。\"}",
            "",
        ].join("\n"), "utf-8");
        faux.setResponses([
            fauxAssistantMessage([
                fauxToolCall("report_result", {
                    result: "patch ready",
                    data: {
                        reason: "角色确认二者是同一个人。",
                        patch: [
                            {
                                op: "replace",
                                path: "/1",
                                value: {
                                    topic: "艾琳娜",
                                    aliases: ["粉色头发的女孩子", "早上帮过我的女孩"],
                                    view: "我已经意识到艾琳娜就是早上帮过我的粉色头发女孩。",
                                },
                            },
                            {op: "remove", path: "/0"},
                        ],
                        summary: "合并艾琳娜与粉色头发女孩。",
                    },
                }, {id: "curator-report"}),
            ], {stopReason: "toolUse"}),
        ]);
        const tool = mustTool("memory_bio", harness);

        const result = await tool.executeWithContext?.(context, "memory-bio", {
            subjectPath: "demo/simulation/subjects/heroine",
            facts: "我确认艾琳娜就是早上帮过我的粉色头发女孩。",
        });

        expect(result?.details).toEqual(expect.objectContaining({
            status: "updated",
            summary: "合并艾琳娜与粉色头发女孩。",
            dirty: true,
        }));
        expect(parseSubjectMemoriesJsonl(await readFile(join(subjectRoot, "memory.jsonl"), "utf-8"))).toEqual([{
            topic: "艾琳娜",
            aliases: ["粉色头发的女孩子", "早上帮过我的女孩"],
            view: "我已经意识到艾琳娜就是早上帮过我的粉色头发女孩。",
        }]);
        await expect(readFile(join(workspaceRoot, "demo", ".nbook", "subject-rag-dirty.json"), "utf-8")).resolves.toContain("\"memory\"");
    });

    it("memory_bio 硬切 JSONL，不导入旧 knowledge.md", async () => {
        const subjectRoot = join(workspaceRoot, "demo", "simulation", "subjects", "heroine");
        await mkdir(subjectRoot, {recursive: true});
        await writeFile(join(subjectRoot, "knowledge.md"), "## 艾琳娜\n\n我知道艾琳娜曾经帮过我。", "utf-8");
        faux.setResponses([
            fauxAssistantMessage([
                fauxToolCall("report_result", {
                    result: "patch ready",
                    data: {
                        reason: "只根据本轮 facts 新增记忆，不读取旧 knowledge.md。",
                        patch: [{
                            op: "add",
                            path: "/-",
                            value: {
                                topic: "艾琳娜",
                                view: "我今天确认自己仍然记得艾琳娜帮过我。",
                            },
                        }],
                        summary: "新增艾琳娜记忆。",
                    },
                }, {id: "curator-hard-cut-report"}),
            ], {stopReason: "toolUse"}),
        ]);
        const tool = mustTool("memory_bio", harness);

        const result = await tool.executeWithContext?.(context, "memory-bio-hard-cut", {
            subjectPath: "demo/simulation/subjects/heroine",
            facts: "我今天确认自己仍然记得艾琳娜帮过我。",
        });

        expect(result?.details).toEqual(expect.objectContaining({
            status: "updated",
            summary: "新增艾琳娜记忆。",
        }));
        expect(parseSubjectMemoriesJsonl(await readFile(join(subjectRoot, "memory.jsonl"), "utf-8"))).toEqual([{
            topic: "艾琳娜",
            view: "我今天确认自己仍然记得艾琳娜帮过我。",
        }]);
        await expect(readFile(join(workspaceRoot, "demo", ".nbook", "subject-rag-dirty.json"), "utf-8")).resolves.toContain("\"memory\"");
    });

    it("memory_bio patch 校验失败会重试一次，仍失败则 needs_review 且不写文件", async () => {
        const subjectRoot = join(workspaceRoot, "demo", "simulation", "subjects", "heroine");
        await mkdir(subjectRoot, {recursive: true});
        const original = "{\"topic\":\"艾琳娜\",\"view\":\"她是同班同学。\"}\n";
        await writeFile(join(subjectRoot, "memory.jsonl"), original, "utf-8");
        faux.setResponses([
            fauxAssistantMessage([
                fauxToolCall("report_result", {
                    result: "bad patch",
                    data: {
                        reason: "错误 patch。",
                        patch: [{op: "replace", path: "/0/view", value: ""}],
                        summary: "bad",
                    },
                }, {id: "curator-bad-1"}),
            ], {stopReason: "toolUse"}),
            fauxAssistantMessage([
                fauxToolCall("report_result", {
                    result: "bad patch again",
                    data: {
                        reason: "仍然错误。",
                        patch: [{op: "add", path: "/-", value: {topic: "", view: "x"}}],
                        summary: "bad again",
                    },
                }, {id: "curator-bad-2"}),
            ], {stopReason: "toolUse"}),
        ]);
        const tool = mustTool("memory_bio", harness);

        const result = await tool.executeWithContext?.(context, "memory-bio-bad", {
            subjectPath: "demo/simulation/subjects/heroine",
            facts: "事实需要更新，但 curator patch 不合法。",
        });

        expect(result?.details).toEqual(expect.objectContaining({
            status: "needs_review",
            attempts: 2,
        }));
        await expect(readFile(join(subjectRoot, "memory.jsonl"), "utf-8")).resolves.toBe(original);
    });
});

function mustTool(key: string, harness: NeuroAgentHarness) {
    const tool = harness.tools.get(key);
    if (!tool?.executeWithContext) {
        throw new Error(`missing tool ${key}`);
    }
    return tool;
}
