<!-- app/components/mobile/MobileEditorToolbar.vue -->
<script setup lang="ts">
/**
 * 移动端精简格式工具栏。
 * 横向滚动，提供常用 Markdown 格式按钮。
 */
const emit = defineEmits<{
    (e: "format", kind: "bold" | "italic" | "h1" | "h2" | "h3" | "bullet" | "ordered" | "link" | "comment"): void;
}>();

const tools = [
    { kind: "bold" as const, icon: "i-lucide-bold" },
    { kind: "italic" as const, icon: "i-lucide-italic" },
    { kind: "h1" as const, icon: "i-lucide-heading-1" },
    { kind: "h2" as const, icon: "i-lucide-heading-2" },
    { kind: "h3" as const, icon: "i-lucide-heading-3" },
    { kind: "bullet" as const, icon: "i-lucide-list" },
    { kind: "ordered" as const, icon: "i-lucide-list-ordered" },
    { kind: "link" as const, icon: "i-lucide-link" },
    { kind: "comment" as const, icon: "i-lucide-message-square" },
];
</script>

<template>
    <!-- 移动端格式工具栏 — 横向滚动 -->
    <div class="mobile-editor-toolbar flex shrink-0 items-center gap-1 overflow-x-auto border-b border-[var(--border-color)] bg-[var(--bg-panel)] px-2 py-1.5">
        <button
            v-for="tool in tools"
            :key="tool.kind"
            type="button"
            class="flex h-7 min-w-[28px] shrink-0 items-center justify-center rounded px-1.5 text-[12px] text-[var(--text-secondary)] transition-colors active:bg-[var(--bg-hover)] active:text-[var(--text-main)]"
            @click="emit('format', tool.kind)"
        >
            <span :class="tool.icon" class="h-3.5 w-3.5"></span>
        </button>
    </div>
</template>
