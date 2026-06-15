<!-- app/components/mobile/MobileTabBar.vue -->
<script setup lang="ts">
import type { MobileTab } from "nbook/app/stores/mobile-ui";

defineProps<{
    /** 当前激活的标签 */
    activeTab: MobileTab;
}>();

const emit = defineEmits<{
    (e: "select", tab: MobileTab): void;
}>();

const tabs: { key: MobileTab; label: string; icon: string }[] = [
    { key: "chat", label: "聊天", icon: "i-lucide-message-circle" },
    { key: "editor", label: "编辑", icon: "i-lucide-pen-line" },
    { key: "files", label: "文件", icon: "i-lucide-folder-open" },
];
</script>

<template>
    <!-- 底部标签栏 -->
    <nav
        class="mobile-tab-bar flex shrink-0 items-center justify-around border-t border-[var(--border-color)] bg-[var(--bg-panel)]"
        style="padding-bottom: var(--safe-area-bottom); height: calc(52px + var(--safe-area-bottom))"
    >
        <button
            v-for="tab in tabs"
            :key="tab.key"
            type="button"
            class="flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 h-full transition-colors"
            :class="activeTab === tab.key ? 'text-[var(--accent-main)]' : 'text-[var(--text-muted)]'"
            @click="emit('select', tab.key)"
        >
            <span :class="tab.icon" class="h-5 w-5"></span>
            <span class="text-[10px] leading-none">{{ tab.label }}</span>
        </button>
    </nav>
</template>
