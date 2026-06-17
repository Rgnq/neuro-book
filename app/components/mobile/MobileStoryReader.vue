<!-- app/components/mobile/MobileStoryReader.vue -->
<script setup lang="ts">
import MobileStoryTimeline from "nbook/app/components/mobile/MobileStoryTimeline.vue";
import MobileStoryComposer from "nbook/app/components/mobile/MobileStoryComposer.vue";
import { useStoryReader } from "nbook/app/composables/useStoryReader";
import { useMobileUiStore } from "nbook/app/stores/mobile-ui";

const props = defineProps<{
    novelId: string | null;
    /** 回调：获取当前 Agent 会话 ID */
    getSessionId: () => number | null;
    /** 回调：获取 Agent 是否正在运行 */
    isRunning: () => boolean;
}>();

const mobileUi = useMobileUiStore();
/**
 * reactive() 包裹是必需的：useStoryReader 返回的 ref 嵌套在普通对象中，
 * 模板的 v-if / :disabled 等指令不会自动解包嵌套 ref，导致 Ref 对象永远 truthy。
 * reactive() deep-unwrap 使 story.totalTicks 在模板中表现为原始值类型。
 */
const story = reactive(useStoryReader());

// 切到剧情页时、novelId 变化时自动加载 tick 列表；
// watchEffect 自动追踪 activeTab / novelId，合并了原来的 watch + onMounted
watchEffect(async () => {
    if (mobileUi.activeTab === "story" && props.novelId) {
        await story.init(mobileUi.currentTickId ?? undefined);
    }
});

/** 从侧栏选择 tick */
function handleSelectTick(tickId: string): void {
    void story.loadTick(tickId);
    mobileUi.setTimelineVisible(false);
}
</script>

<template>
    <div class="flex h-full flex-col bg-[var(--bg-main)]">
        <!-- 顶部导航栏 -->
        <div class="flex shrink-0 items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-panel)] px-3 py-2">
            <!-- 左侧：目录按钮 -->
            <button
                type="button"
                class="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors active:bg-[var(--bg-hover)]"
                @click="mobileUi.toggleTimeline()"
            >
                <span class="i-lucide-list h-4 w-4" />
            </button>

            <!-- 中间：进度 -->
            <span
                v-if="story.totalTicks > 0"
                class="text-[11px] text-[var(--text-muted)]"
            >
                {{ story.currentIndex + 1 }} / {{ story.totalTicks }}
            </span>
            <span v-else class="text-[11px] text-[var(--text-muted)]">暂无章节</span>

            <!-- 右侧：翻页箭头 -->
            <div class="flex items-center gap-1">
                <button
                    type="button"
                    class="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors active:bg-[var(--bg-hover)] disabled:pointer-events-none disabled:opacity-25"
                    :disabled="!story.hasPrev || story.loading"
                    @click="story.goPrev()"
                >
                    <span class="i-lucide-chevron-left h-4 w-4" />
                </button>
                <button
                    type="button"
                    class="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors active:bg-[var(--bg-hover)] disabled:pointer-events-none disabled:opacity-25"
                    :disabled="!story.hasNext || story.loading"
                    @click="story.goNext()"
                >
                    <span class="i-lucide-chevron-right h-4 w-4" />
                </button>
            </div>
        </div>

        <!-- 时间线侧栏 -->
        <MobileStoryTimeline
            :ticks="story.ticks"
            :current-tick-id="mobileUi.currentTickId"
            :visible="mobileUi.timelineVisible"
            @select="handleSelectTick"
            @close="mobileUi.setTimelineVisible(false)"
        />

        <!-- prose 阅读区 -->
        <div class="flex-1 overflow-y-auto">
            <!-- 加载错误（优先于空状态显示） -->
            <div
                v-if="story.error"
                class="flex h-full items-center justify-center px-6 text-center text-[13px] text-[var(--text-muted)]"
            >
                {{ story.error }}
            </div>

            <!-- 空状态：无 tick -->
            <div
                v-else-if="story.totalTicks === 0 && !story.loading"
                class="flex h-full items-center justify-center px-6 text-center text-[13px] text-[var(--text-muted)]"
            >
                暂无剧情内容<br>开始世界模拟后将在此显示
            </div>

            <!-- 加载中 -->
            <div
                v-else-if="story.loading"
                class="flex h-full items-center justify-center"
            >
                <span class="i-lucide-loader-2 h-5 w-5 animate-spin text-[var(--text-muted)]" />
            </div>

            <!-- prose 内容 -->
            <article
                v-else
                class="prose-reader mx-auto max-w-prose px-6 py-8"
            >
                <!-- 章节标题 -->
                <h2
                    v-if="story.title"
                    class="mb-6 text-center text-[22px] font-normal leading-relaxed text-[var(--accent-main)]"
                    style="font-family: Georgia, 'Noto Serif SC', serif;"
                >
                    {{ story.title }}
                </h2>

                <!-- 正文（注入 HTML） -->
                <div
                    class="prose-body text-[var(--text-main)]"
                    v-html="story.proseHtml"
                />

                <!-- 章节分隔符 -->
                <div class="mt-10 text-center text-[var(--text-muted)] opacity-40">
                    &#8274;
                </div>
            </article>
        </div>

        <!-- 底部剧情对话框（通过回调读取聊天页 Agent 会话） -->
        <div class="shrink-0 border-t border-[var(--border-color)] bg-[var(--bg-panel)]">
            <MobileStoryComposer :get-session-id="props.getSessionId" :is-running="props.isRunning" />
        </div>
    </div>
</template>

<style scoped>
/*
 * prose 正文排版
 * 只作用于 Markdown 生成的元素，内联 HTML <div> 不受影响
 */
/* 排版仅作用于 Markdown 文本元素，内联 HTML <div>/<span> 不受影响 */
.prose-body :deep(:where(h1, h2, h3, h4, h5, h6, p, li, blockquote, th, td, pre, ul, ol)) {
    font-family: Georgia, 'Noto Serif SC', serif;
}
.prose-body :deep(:where(p, li, blockquote, th, td, ul, ol)) {
    font-size: 15px;
    line-height: 1.9;
}

/* 标题层级 */
.prose-body :deep(h1) { font-size: 1.6em; font-weight: 700; margin: 1.2em 0 0.6em; line-height: 1.4; }
.prose-body :deep(h2) { font-size: 1.35em; font-weight: 600; margin: 1em 0 0.5em; line-height: 1.4; }
.prose-body :deep(h3) { font-size: 1.15em; font-weight: 600; margin: 0.8em 0 0.4em; line-height: 1.4; }

/* 段落 */
.prose-body :deep(p) { margin: 0 0 1em; }
.prose-body :deep(p:last-child) { margin-bottom: 0; }

/* 内联语义 */
.prose-body :deep(em) { font-style: italic; }
.prose-body :deep(strong) { font-weight: 700; }
.prose-body :deep(code) {
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 0.88em;
    background: rgba(127,127,127,0.1);
    padding: 0.1em 0.35em;
    border-radius: 3px;
}
.prose-body :deep(pre) {
    margin: 1em 0;
    padding: 1em;
    border-radius: 8px;
    background: rgba(0,0,0,0.08);
    overflow-x: auto;
    font-size: 0.85em;
    line-height: 1.5;
}
.prose-body :deep(pre code) {
    background: none;
    padding: 0;
    font-size: inherit;
}

/* 列表 */
.prose-body :deep(ul), .prose-body :deep(ol) { margin: 0.5em 0 1em; padding-left: 1.5em; }
.prose-body :deep(li) { margin-bottom: 0.3em; }

/* 引用 */
.prose-body :deep(blockquote) {
    margin: 1em 0;
    padding: 0.5em 1em;
    border-left: 3px solid var(--border-color);
    color: var(--text-secondary);
}

/* 表格 */
.prose-body :deep(table) { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 0.9em; }
.prose-body :deep(th), .prose-body :deep(td) {
    border: 1px solid var(--border-color);
    padding: 0.4em 0.8em;
    text-align: left;
}
.prose-body :deep(th) { background: rgba(127,127,127,0.06); font-weight: 600; }

/* 分割线 */
.prose-body :deep(hr) {
    margin: 2em 0;
    border: none;
    text-align: center;
}
.prose-body :deep(hr::after) {
    content: '⁂';
    color: var(--text-muted);
    opacity: 0.4;
}

/* 图片 */
.prose-body :deep(img) { max-width: 100%; border-radius: 6px; margin: 0.5em 0; }

/* 链接 */
.prose-body :deep(a) { color: var(--accent-main); text-decoration: underline; }
</style>
