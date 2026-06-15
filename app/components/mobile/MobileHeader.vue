<!-- app/components/mobile/MobileHeader.vue -->
<script setup lang="ts">
import type { DropdownItem } from "nbook/app/components/common/dropdown.types";
import type { AgentSessionSummaryDto } from "nbook/shared/dto/agent-session.dto";
import Dropdown from "nbook/app/components/common/Dropdown.vue";

const props = defineProps<{
    /** 小说下拉选项 */
    novelItems: DropdownItem[];
    /** 当前小说标题 */
    novelTitle: string;
    /** Session 列表 */
    sessions: AgentSessionSummaryDto[];
    /** 当前激活的 session ID */
    activeSessionId: number | null;
    /** 是否正在加载 session */
    loadingSession: boolean;
}>();

const emit = defineEmits<{
    (e: "switch-novel", value: string): void;
    (e: "select-session", sessionId: number): void;
    (e: "create-session"): void;
}>();

/** Session 下拉选项 — 由 sessions prop 转换 */
const sessionItems = computed<DropdownItem[]>(() => {
    return props.sessions.map((s) => ({
        label: s.title || `Session #${s.id}`,
        value: String(s.id),
        active: s.id === props.activeSessionId,
    }));
});
</script>

<template>
    <!-- 移动端顶栏 -->
    <header
        class="mobile-header flex h-11 shrink-0 items-center justify-between gap-2 border-b border-[var(--border-color)] bg-[var(--bg-panel)] px-3"
        style="padding-top: calc(var(--safe-area-top) + 4px); min-height: calc(44px + var(--safe-area-top))"
    >
        <!-- 左侧：小说切换器 -->
        <div class="min-w-0 flex-1">
            <Dropdown
                :items="novelItems"
                menu-class="left-0 top-full mt-2 w-48"
                compact
                @select="(v: string) => emit('switch-novel', v)"
            >
                <button
                    class="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left transition-colors active:bg-[var(--bg-hover)]"
                >
                    <span class="i-lucide-book-open h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]"></span>
                    <span class="min-w-0 truncate font-serif text-[12px] italic text-[var(--text-secondary)]">
                        {{ novelTitle || "选择小说" }}
                    </span>
                    <span class="i-lucide-chevron-down h-3 w-3 shrink-0 text-[var(--text-muted)]"></span>
                </button>
            </Dropdown>
        </div>

        <!-- 右侧：Session 切换器 -->
        <div class="min-w-0 flex-1 flex justify-end">
            <Dropdown
                :items="sessionItems"
                menu-class="right-0 top-full mt-2 w-52"
                compact
                @select="(v: string) => emit('select-session', Number(v))"
            >
                <button
                    class="flex items-center gap-1.5 rounded-md px-2 py-1 text-right transition-colors active:bg-[var(--bg-hover)]"
                    :disabled="loadingSession"
                >
                    <span class="i-lucide-message-circle h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]"></span>
                    <span class="min-w-0 truncate text-[11px] text-[var(--text-secondary)]">
                        {{ activeSessionId ? `Session #${activeSessionId}` : "新对话" }}
                    </span>
                    <span class="i-lucide-chevron-down h-3 w-3 shrink-0 text-[var(--text-muted)]"></span>
                </button>
            </Dropdown>
        </div>
    </header>
</template>
