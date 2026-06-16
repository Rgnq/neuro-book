<!-- app/components/mobile/MobileHeader.vue -->
<script setup lang="ts">
defineProps<{
    /** 当前小说标题 */
    novelTitle: string;
    /** 是否有活跃 session */
    hasActiveSession: boolean;
}>();

const emit = defineEmits<{
    (e: "open-novels"): void;
    (e: "open-sessions"): void;
}>();
</script>

<template>
    <!-- 移动端顶栏 -->
    <header
        class="mobile-header flex h-11 shrink-0 items-center justify-between gap-2 border-b border-[var(--border-color)] bg-[var(--bg-panel)] px-3"
        style="padding-top: calc(var(--safe-area-top) + 4px); min-height: calc(44px + var(--safe-area-top))"
    >
        <!-- 左侧：小说按钮 -->
        <button
            class="flex items-center gap-1.5 rounded-md px-2 py-1 min-w-0 transition-colors active:bg-[var(--bg-hover)]"
            @click="emit('open-novels')"
        >
            <span class="i-lucide-book-open h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]"></span>
            <span class="min-w-0 truncate font-serif text-[12px] italic text-[var(--text-secondary)]">
                {{ novelTitle || "小说" }}
            </span>
            <span class="i-lucide-chevron-down h-3 w-3 shrink-0 text-[var(--text-muted)]"></span>
        </button>

        <!-- 右侧：会话按钮 -->
        <button
            class="flex items-center gap-1.5 rounded-md px-2 py-1 min-w-0 transition-colors active:bg-[var(--bg-hover)]"
            @click="emit('open-sessions')"
        >
            <span class="i-lucide-message-circle h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]"></span>
            <span class="min-w-0 truncate text-[11px] text-[var(--text-secondary)]">
                {{ hasActiveSession ? "会话" : "新对话" }}
            </span>
            <span class="i-lucide-chevron-down h-3 w-3 shrink-0 text-[var(--text-muted)]"></span>
        </button>
    </header>
</template>
