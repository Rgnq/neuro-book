import { renderMarkdown } from "nbook/app/utils/markdown/render";
import { useNovelIdeStore } from "nbook/app/stores/novel-ide";
import { useMobileUiStore } from "nbook/app/stores/mobile-ui";

/** tick 条目信息 */
export interface TickEntry {
    /** 目录名，如 "001-arrival" */
    id: string;
    /** 排序用数字 ID */
    numericId: number;
    /** frontmatter 中的 title，或 undefined */
    title: string | undefined;
    /** prose.md 相对路径 */
    prosePath: string;
}

/**
 * 故事阅读 composable。
 * 负责 tick 列表发现、prose 内容加载与渲染、前后翻页。
 */
export function useStoryReader() {
    const novelIdeStore = useNovelIdeStore();
    const mobileUi = useMobileUiStore();

    /** 所有 tick 条目（按 numericId 排序） */
    const ticks = ref<TickEntry[]>([]);

    /** 当前 tick 在 ticks 数组中的索引，-1 表示未找到 */
    const currentIndex = ref(-1);

    /** 当前渲染后的 prose HTML */
    const proseHtml = ref("");

    /** 当前 prose 的标题（frontmatter.title 或 slug） */
    const title = ref("");

    /** 是否正在加载 */
    const loading = ref(false);

    /** 加载错误信息 */
    const error = ref<string | null>(null);

    /** 获取当前 tick */
    const currentTick = computed<TickEntry | null>(() => {
        if (currentIndex.value < 0 || currentIndex.value >= ticks.value.length) return null;
        return ticks.value[currentIndex.value]!;
    });

    /** tick 总数 */
    const totalTicks = computed(() => ticks.value.length);

    /** 是否有上一章 */
    const hasPrev = computed(() => currentIndex.value > 0);

    /** 是否有下一章 */
    const hasNext = computed(() => currentIndex.value < ticks.value.length - 1);

    /**
     * 从 API 扫描 simulation/runs/ticks/ 目录，构建 tick 列表。
     */
    async function loadTickList(): Promise<void> {
        const projectPath = novelIdeStore.currentNovelId;
        if (!projectPath) {
            ticks.value = [];
            return;
        }

        try {
            // 通过 workspace tree API 列出 ticks 目录
            console.log("[useStoryReader] loadTickList projectPath:", projectPath);
            const tree = await $fetch<{ nodes?: Array<{ path: string; isDirectory: boolean; title?: string }> }>(
                "/api/workspace-files/tree",
                { query: { projectPath, target: "simulation/runs/ticks", depth: 1 } }
            );
            console.log("[useStoryReader] tree response:", JSON.stringify(tree));

            const dirs = (tree.nodes ?? [])
                .filter(n => n.isDirectory)
                .map(n => {
                    // toWorkspaceDisplayPath 对目录返回尾部带 / 的路径，
                    // 需先去除再提取最后一段作为目录名
                    const cleanPath = n.path.replace(/\/$/, "");
                    const id = cleanPath.split("/").pop() ?? cleanPath;
                    const match = id.match(/^(\d+)/);
                    const numericId = match ? Number.parseInt(match[1], 10) : 0;
                    return {
                        id,
                        numericId,
                        title: n.title || undefined,
                        prosePath: `simulation/runs/ticks/${id}/prose.md`,
                    } satisfies TickEntry;
                })
                .sort((a, b) => a.numericId - b.numericId);

            console.log("[useStoryReader] parsed dirs:", JSON.stringify(dirs));
            ticks.value = dirs;
        } catch (err) {
            console.error("[useStoryReader] loadTickList error:", err);
            ticks.value = [];
            error.value = "加载章节列表失败";
        }
    }

    /**
     * 加载并渲染指定 tick 的 prose.md 内容。
     */
    async function loadTick(tickId: string): Promise<void> {
        const tick = ticks.value.find(t => t.id === tickId);
        if (!tick) return;

        loading.value = true;
        error.value = null;

        try {
            const projectPath = novelIdeStore.currentNovelId;
            if (!projectPath) { error.value = "未选择项目"; return; }

            console.log("[useStoryReader] loadTick prosePath:", tick.prosePath, "projectPath:", projectPath);
            const { content } = await $fetch<{ content: string }>("/api/workspace-files/read", {
                query: { projectPath, path: tick.prosePath },
            });
            console.log("[useStoryReader] loadTick content length:", content?.length);

            const { frontmatter, body } = parseFrontmatter(content);
            // 优先使用 frontmatter.title，其次 tick 自身的 title，最后回退到 slug
            title.value = frontmatter.title || tick.title || tick.id;

            const trimmed = body.trim();
            // 格式检测：HTML 或 Markdown
            const isHtml = /^<\s*\w+/.test(trimmed);
            const rawHtml = isHtml ? trimmed : renderMarkdown(trimmed);
            proseHtml.value = rawHtml;

            // 更新 store 状态
            mobileUi.currentTickId = tickId;
            currentIndex.value = ticks.value.findIndex(t => t.id === tickId);
        } catch (err) {
            console.error("[useStoryReader] loadTick error:", err);
            error.value = "加载章节内容失败";
            proseHtml.value = "";
        } finally {
            loading.value = false;
        }
    }

    /** 跳转到上一章 */
    function goPrev(): void {
        if (!hasPrev.value) return;
        const prev = ticks.value[currentIndex.value - 1];
        if (prev) void loadTick(prev.id);
    }

    /** 跳转到下一章 */
    function goNext(): void {
        if (!hasNext.value) return;
        const next = ticks.value[currentIndex.value + 1];
        if (next) void loadTick(next.id);
    }

    /**
     * 初始化：扫描 tick 列表并跳转到指定 tick（或最后一章）。
     * @param targetTickId — 指定 tick ID；不传则跳到最后一章
     */
    async function init(targetTickId?: string): Promise<void> {
        await loadTickList();
        if (ticks.value.length === 0) return;

        if (targetTickId) {
            await loadTick(targetTickId);
        } else {
            // 默认打开最后一章
            const last = ticks.value[ticks.value.length - 1];
            if (last) await loadTick(last.id);
        }
    }

    return {
        ticks,
        currentIndex,
        currentTick,
        totalTicks,
        proseHtml,
        title,
        loading,
        error,
        hasPrev,
        hasNext,
        loadTickList,
        loadTick,
        goPrev,
        goNext,
        init,
    };
}

/**
 * 解析 Markdown frontmatter（YAML 头部）。
 * 支持 `---\nkey: value\n---\nbody` 格式。
 */
function parseFrontmatter(raw: string): { frontmatter: Record<string, string>; body: string } {
    raw = raw.replace(/\r\n/g, "\n");
    const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
    if (!match) return { frontmatter: {}, body: raw };

    const body = raw.slice(match[0].length);
    const frontmatter: Record<string, string> = {};
    const lines = match[1].split("\n");
    for (const line of lines) {
        const kv = line.match(/^(\w[\w-]*)\s*:\s*(.+)/);
        if (kv) {
            frontmatter[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, "");
        }
    }
    return { frontmatter, body };
}
