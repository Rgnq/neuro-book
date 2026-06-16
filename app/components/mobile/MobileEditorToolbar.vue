<!-- app/components/mobile/MobileEditorToolbar.vue -->
<script setup lang="ts">
import type { MarkdownFormatCommand } from "nbook/app/composables/useMarkdownStudioController";

/**
 * 移动端精简格式工具栏。
 * 横向滚动，命令与 TipTapMarkdownEditor 的 applyMarkdownFormat 对齐。
 */
const emit = defineEmits<{
    (e: "format", command: MarkdownFormatCommand): void;
}>();

const tools: { command: MarkdownFormatCommand; icon: string }[] = [
    { command: "bold", icon: "i-lucide-bold" },
    { command: "italic", icon: "i-lucide-italic" },
    { command: "heading-2", icon: "i-lucide-heading-2" },
    { command: "heading-3", icon: "i-lucide-heading-3" },
    { command: "bullet-list", icon: "i-lucide-list" },
    { command: "ordered-list", icon: "i-lucide-list-ordered" },
    { command: "blockquote", icon: "i-lucide-text-quote" },
    { command: "strike", icon: "i-lucide-strikethrough" },
    { command: "code", icon: "i-lucide-code" },
    { command: "clear-format", icon: "i-lucide-remove-formatting" },
];
</script>

<template>
    <!-- 移动端格式工具栏 — 横向滚动 -->
    <div class="mobile-editor-toolbar flex shrink-0 items-center gap-1 overflow-x-auto border-b border-[var(--border-color)] bg-[var(--bg-panel)] px-2 py-1.5">
        <button
            v-for="tool in tools"
            :key="tool.command"
            type="button"
            class="flex h-7 min-w-[28px] shrink-0 items-center justify-center rounded px-1.5 text-[12px] text-[var(--text-secondary)] transition-colors active:bg-[var(--bg-hover)] active:text-[var(--text-main)]"
            @click="emit('format', tool.command)"
        >
            <span :class="tool.icon" class="h-3.5 w-3.5"></span>
        </button>
    </div>
</template>
