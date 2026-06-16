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
const story = useStoryReader();

// 初始化：切到剧情页时加载 tick 列表
watch(() => mobileUi.activeTab, async (tab) => {
    if (tab === "story" && props.novelId) {
        // 首次进入或 novel 切换时重新加载
        await story.init(mobileUi.currentTickId ?? undefined);
    }
});

// 首次挂载时如果已在剧情页则初始化
onMounted(async () => {
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
                    :disabled="!story.hasPrev"
                    @click="story.goPrev()"
                >
                    <span class="i-lucide-chevron-left h-4 w-4" />
                </button>
                <button
                    type="button"
                    class="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors active:bg-[var(--bg-hover)] disabled:pointer-events-none disabled:opacity-25"
                    :disabled="!story.hasNext"
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
                    class="prose-body text-[15px] leading-relaxed text-[var(--text-main)]"
                    style="font-family: Georgia, 'Noto Serif SC', serif; line-height: 1.9;"
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
/* prose 正文排版 */
.prose-body :deep(p) {
    margin: 0 0 1em;
}
.prose-body :deep(p:last-child) {
    margin-bottom: 0;
}
.prose-body :deep(em) {
    font-style: italic;
}
.prose-body :deep(strong) {
    font-weight: 600;
}
.prose-body :deep(blockquote) {
    margin: 1em 0;
    padding: 0.5em 1em;
    border-left: 3px solid var(--border-color);
    color: var(--text-secondary);
}
.prose-body :deep(hr) {
    margin: 1.5em 0;
    border: none;
    text-align: center;
}
.prose-body :deep(hr::after) {
    content: '⁂';
    color: var(--text-muted);
    opacity: 0.4;
}
</style>
