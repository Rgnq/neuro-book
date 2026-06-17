<!-- app/components/mobile/MobileEditorToolbar.vue -->
<script setup lang="ts">
import type { MarkdownFormatCommand } from "nbook/app/composables/useMarkdownStudioController";
import type { EditorViewMode } from "nbook/app/stores/mobile-ui";

defineProps<{
    viewMode: EditorViewMode;
}>();

const emit = defineEmits<{
    (e: "format", command: MarkdownFormatCommand): void;
    (e: "toggle-view"): void;
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
    <!-- 移动端格式工具栏 -->
    <div class="mobile-editor-toolbar flex shrink-0 items-center border-b border-[var(--border-color)] bg-[var(--bg-panel)]">
        <!-- 左侧：格式按钮（横向滚动） -->
        <div class="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-2 py-1.5">
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
        <!-- 右侧：Markdown / 源码 切换 -->
        <button
            type="button"
            class="flex shrink-0 items-center gap-1 border-l border-[var(--border-color)] px-3 py-1.5 text-[11px] font-medium text-[var(--text-secondary)] transition-colors active:bg-[var(--bg-hover)]"
            @click="emit('toggle-view')"
        >
            <span v-if="viewMode === 'rich'" class="i-lucide-code-2 h-3.5 w-3.5" />
            <span v-else class="i-lucide-eye h-3.5 w-3.5" />
            <span>{{ viewMode === "rich" ? "源码" : "预览" }}</span>
        </button>
    </div>
</template>
