import { Marked } from "marked";
import { useNovelIdeStore } from "nbook/app/stores/novel-ide";
import { useMobileUiStore } from "nbook/app/stores/mobile-ui";

/** 专用于 prose 阅读的 Marked 实例：GFM + breaks，无聊天泡自定义扩展 */
const proseMarked = new Marked({ gfm: true, breaks: true });

/** DOMPurify 实例（惰性初始化，避免 SSR 下 window is not defined） */
let _purifier: ((html: string) => string) | null = null;
async function getPurifier(): Promise<(html: string) => string> {
    if (!_purifier) {
        const createDOMPurify = (await import("dompurify")).default;
        const purify = createDOMPurify(window);
        // 放行 NeuroBook 自定义元素 <inline-comment body="..." id="...">text</inline-comment>
        purify.addHook("uponSanitizeElement", (node, data) => {
            if (data.tagName === "inline-comment") {
                data.allowedTags["inline-comment"] = true;
                for (let i = node.attributes.length - 1; i >= 0; i--) {
                    const name = node.attributes[i].name;
                    if (name !== "body" && name !== "id") {
                        node.removeAttribute(name);
                    }
                }
            }
        });
        // 裸调用 sanitize()，不传 per-call config，走完整默认白名单
        _purifier = (html: string) => purify.sanitize(html) as string;
    }
    return _purifier;
}

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

    /** 状态栏 HTML（模板+数据组装，与 proseHtml 分离以避免 watchEffect 重入导致重复） */
    const statusHtml = ref("");

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
            // 服务器不支持 target/depth 过滤，请求完整 workspace tree 后在客户端筛选
            const tree = await $fetch<{ nodes?: Array<{ path: string; isDirectory: boolean; title?: string; mtimeMs?: number }> }>(
                "/api/workspace-files/tree",
                { query: { projectPath } }
            );

            // 筛选 simulation/runs/ticks/ 下的直接子目录
            const dirs = (tree.nodes ?? [])
                .filter(n => {
                    if (!n.isDirectory) return false;
                    // 去掉尾部 /，检查父路径是否为 simulation/runs/ticks
                    const clean = n.path.replace(/\/$/, "");
                    const parent = clean.replace(/\/[^/]+$/, "");
                    return parent === "simulation/runs/ticks";
                })
                .map(n => {
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

            const { content } = await $fetch<{ content: string }>("/api/workspace-files/read", {
                query: { projectPath, path: tick.prosePath },
            });

            const { frontmatter, body } = parseFrontmatter(content);
            // 优先使用 frontmatter.title，其次 tick 自身的 title，最后回退到 slug
            title.value = frontmatter.title || tick.title || tick.id;

            // 使用 prose 专用 Marked 实例（无聊天泡自定义扩展），
            // normalizeMultilineHtml 压缩跨行 HTML 确保正确识别，
            // 再经 DOMPurify 清洗：放行标准 HTML + inline-comment，剥离 script/onerror 等
            const trimmed = body.trim();
            if (trimmed) {
                const rawHtml = await proseMarked.parse(normalizeMultilineHtml(trimmed));
                const purifier = await getPurifier();
                proseHtml.value = purifier(rawHtml);
            } else {
                proseHtml.value = "";
            }

            // 更新 store 状态
            mobileUi.currentTickId = tickId;
            currentIndex.value = ticks.value.findIndex(t => t.id === tickId);

            // 加载状态栏（模板 + 数据组装），失败不影响正文显示。
            // 独立 ref 而非拼入 proseHtml，防止 watchEffect 重入时重复追加。
            statusHtml.value = await loadStatusPanel(projectPath, tickId);
        } catch (err) {
            console.error("[useStoryReader] loadTick error:", err);
            error.value = "加载章节内容失败";
            proseHtml.value = "";
            statusHtml.value = "";
        } finally {
            loading.value = false;
        }
    }

    /**
     * 加载状态栏 HTML。
     * 从 tick 目录读取 status-data.json → 获取模板 → 替换 {{key}} → 返回 HTML。
     * 任一环节失败返回空字符串，不阻断正文渲染。
     */
    async function loadStatusPanel(projectPath: string, tickId: string): Promise<string> {
        if (!mobileUi.showStatusPanel) return "";

        try {
            // ① 读取 status-data.json
            const statusPath = `simulation/runs/ticks/${tickId}/status-data.json`;
            const { content: rawJson } = await $fetch<{ content: string }>("/api/workspace-files/read", {
                query: { projectPath, path: statusPath },
            });
            const parsed = JSON.parse(rawJson) as { panel?: string; data?: Record<string, unknown> };
            if (!parsed.panel || !parsed.data || Object.keys(parsed.data).length === 0) return "";

            // ② 读取模板 HTML
            const templatePath = `simulation/runs/status-panels/${parsed.panel}.html`;
            const { content: template } = await $fetch<{ content: string }>("/api/workspace-files/read", {
                query: { projectPath, path: templatePath },
            });

            // ③ 替换 {{key}} → data[key]，未提供的 key 保留原文占位
            const filled = template.replace(/\{\{(\w+)\}\}/g, (_full, key: string) => {
                const val = parsed.data![key];
                return val !== undefined ? String(val) : _full;
            });

            return filled;
        } catch (err) {
            // 404 或解析失败：静默跳过，状态栏不是正文的一部分
            if (!(err instanceof TypeError)) { // TypeError 通常是网络问题，不打印
                console.warn("[useStoryReader] loadStatusPanel skipped:", (err as Error).message);
            }
            return "";
        }
    }

    /** 跳转到上一章（先刷新列表再导航，loading 中忽略点击） */
    async function goPrev(): Promise<void> {
        if (loading.value) return;
        await loadTickList();
        // 用 ID 定位当前 tick（刷新后 index 可能已变）
        const curId = mobileUi.currentTickId;
        const idx = curId ? ticks.value.findIndex(t => t.id === curId) : currentIndex.value;
        if (idx <= 0) return;
        const prev = ticks.value[idx - 1];
        if (prev) void loadTick(prev.id);
    }

    /** 跳转到下一章（先刷新列表再导航，loading 中忽略点击） */
    async function goNext(): Promise<void> {
        if (loading.value) return;
        await loadTickList();
        const curId = mobileUi.currentTickId;
        const idx = curId ? ticks.value.findIndex(t => t.id === curId) : currentIndex.value;
        if (idx < 0 || idx >= ticks.value.length - 1) return;
        const next = ticks.value[idx + 1];
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
        statusHtml,
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
 * 将跨行 HTML 标签压缩为单行，使 Marked 能正确识别。
 * 例如 `<div style="\n  color: red;\n">` → `<div style=" color: red; ">`
 */
function normalizeMultilineHtml(html: string): string {
    // 匹配 <tag ... > 形式的跨行标签（属性跨行时 Marked 无法识别）。
    // [\w-]+ 支持连字符，如 <inline-comment> 等自定义元素。
    return html.replace(/<([\w-]+)([^>]*?)>/gs, (_full, tag, attrs) => {
        // 跳过 <pre> 和 <code>：内部空白是有意义的内容
        if (tag === "pre" || tag === "code") return _full;
        const compact = attrs.replace(/\s+/g, " ").trim();
        return `<${tag}${compact ? ` ${compact}` : ""}>`;
    });
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
            let val = kv[2].trim();
            // 去除首尾成对引号（支持双引号/单引号包裹的值，如 title: "Chapter 1: Arrival"）
            if ((val.startsWith("\"") && val.endsWith("\"")) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
            }
            frontmatter[kv[1]] = val;
        }
    }
    return { frontmatter, body };
}
