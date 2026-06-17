<!-- app/components/mobile/MobileStoryTimeline.vue -->
<script setup lang="ts">
import type { TickEntry } from "nbook/app/composables/useStoryReader";

const props = defineProps<{
    /** tick 列表（按 numericId 升序） */
    ticks: TickEntry[];
    /** 当前选中的 tick ID */
    currentTickId: string | null;
    /** 侧栏是否可见 */
    visible: boolean;
}>();

const emit = defineEmits<{
    (e: "select", tickId: string): void;
    (e: "close"): void;
}>();

/** 每页展示数量 */
const PAGE_SIZE = 20;
const displayCount = ref(PAGE_SIZE);

/** 当前展示的 ticks */
const displayedTicks = computed(() => props.ticks.slice(0, displayCount.value));

/** 是否有更多 */
const hasMore = computed(() => displayCount.value < props.ticks.length);

/** 加载更多 */
function loadMore(): void {
    displayCount.value = Math.min(displayCount.value + PAGE_SIZE, props.ticks.length);
}

/** 当 visible 重置时，重置分页 */
watch(() => props.visible, (v) => {
    if (v) displayCount.value = PAGE_SIZE;
});
</script>

<template>
    <!-- 时间线侧栏遮罩 -->
    <Transition name="fade">
        <div
            v-if="visible"
            class="fixed inset-0 z-20 bg-black/30"
            @click="emit('close')"
        />
    </Transition>

    <!-- 时间线侧栏主体 -->
    <Transition name="slide-left">
        <aside
            v-if="visible"
            class="fixed left-0 top-0 z-30 flex h-full w-56 flex-col border-r border-[var(--border-color)] bg-[var(--bg-panel)] shadow-lg"
            style="padding-top: var(--safe-area-top); padding-bottom: var(--safe-area-bottom)"
        >
            <!-- 侧栏标题 -->
            <div class="flex shrink-0 items-center justify-between border-b border-[var(--border-color)] px-4 py-3">
                <span class="text-[13px] font-semibold text-[var(--text-main)]">章节列表</span>
                <button
                    type="button"
                    class="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors active:bg-[var(--bg-hover)]"
                    @click="emit('close')"
                >
                    <span class="i-lucide-x h-4 w-4" />
                </button>
            </div>

            <!-- tick 列表 -->
            <div class="flex-1 overflow-y-auto">
                <!-- 空状态 -->
                <div
                    v-if="ticks.length === 0"
                    class="flex h-full items-center justify-center px-4 text-[12px] text-[var(--text-muted)]"
                >
                    暂无章节
                </div>

                <!-- 列表项 -->
                <button
                    v-for="tick in displayedTicks"
                    :key="tick.id"
                    type="button"
                    class="flex w-full items-center gap-2 border-l-2 px-4 py-2.5 text-left text-[12px] transition-colors"
                    :class="currentTickId === tick.id
                        ? 'border-[var(--accent-main)] bg-[var(--accent-bg)] text-[var(--accent-main)]'
                        : 'border-transparent text-[var(--text-secondary)] active:bg-[var(--bg-hover)]'"
                    @click="emit('select', tick.id)"
                >
                    <span class="truncate">{{ tick.title || tick.id }}</span>
                </button>

                <!-- 加载更多 -->
                <button
                    v-if="hasMore"
                    type="button"
                    class="flex w-full items-center justify-center py-2 text-[11px] text-[var(--text-muted)] transition-colors active:bg-[var(--bg-hover)]"
                    @click="loadMore"
                >
                    加载更多 ({{ displayCount }}/{{ ticks.length }})
                </button>
            </div>
        </aside>
    </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

.slide-left-enter-active,
.slide-left-leave-active {
    transition: transform 0.25s ease;
}
.slide-left-enter-from,
.slide-left-leave-to {
    transform: translateX(-100%);
}
</style>
