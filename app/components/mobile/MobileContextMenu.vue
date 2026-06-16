<!-- app/components/mobile/MobileContextMenu.vue -->
<script setup lang="ts">
/**
 * 移动端底部操作表单（Bottom Sheet）。
 *
 * 复用桌面端 ContextMenuItem 类型，渲染为底部弹出操作列表。
 * 支持分隔线、禁用态、危险操作样式。
 * 点击遮罩层或取消按钮关闭。
 */
import { type ContextMenuItem } from "nbook/app/components/common/ContextMenu.vue";

const props = defineProps<{
    modelValue: boolean;
    /** 菜单项列表（与桌面端 ContextMenu 使用相同类型） */
    items: ContextMenuItem[];
    /** 顶部标题，可选 */
    title?: string;
}>();

const emit = defineEmits<{
    (e: "update:modelValue", value: boolean): void;
}>();

function handleItemClick(item: ContextMenuItem): void {
    if (item.disabled) return;
    item.action?.();
    emit("update:modelValue", false);
}

function close(): void {
    emit("update:modelValue", false);
}

function isSeparator(item: ContextMenuItem): boolean {
    return item.separator === true;
}
</script>

<template>
    <Teleport to="body">
        <Transition name="nb-sheet">
            <div
                v-if="props.modelValue"
                class="fixed inset-0 z-[9999] flex flex-col justify-end"
            >
                <!-- 半透明遮罩 -->
                <div
                    class="absolute inset-0 bg-black/40 transition-opacity duration-300"
                    @click="close"
                />

                <!-- 底部操作表单 -->
                <div
                    class="relative z-10 rounded-t-2xl border-t border-[var(--border-color)] bg-[var(--bg-panel)] pb-[calc(var(--safe-area-bottom)+8px)] max-h-[70vh] overflow-y-auto slide-up-panel"
                >
                    <!-- 拖拽指示条 -->
                    <div class="flex justify-center pt-2 pb-1">
                        <div class="h-1 w-10 rounded-full bg-[var(--border-color)]" />
                    </div>

                    <!-- 标题 -->
                    <div
                        v-if="props.title"
                        class="px-5 py-2 text-center text-[11px] font-medium text-[var(--text-muted)] truncate"
                    >
                        {{ props.title }}
                    </div>

                    <!-- 菜单项列表 -->
                    <div class="flex flex-col px-2 pb-1">
                        <template v-for="(item, index) in props.items" :key="index">
                            <!-- 分隔线 -->
                            <div
                                v-if="isSeparator(item)"
                                class="mx-3 my-1.5 h-px bg-[var(--border-color)]/40"
                            />

                            <!-- 普通菜单项 -->
                            <button
                                v-else
                                type="button"
                                class="flex items-center gap-3 rounded-xl px-4 py-3.5 text-left transition-colors active:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                                :disabled="item.disabled"
                                @click="handleItemClick(item)"
                            >
                                <span
                                    v-if="item.iconClass"
                                    :class="[item.iconClass, item.danger ? 'text-red-500' : 'text-[var(--text-muted)]']"
                                    class="h-4.5 w-4.5 shrink-0"
                                />
                                <span
                                    class="text-[14px] font-medium"
                                    :class="item.danger ? 'text-red-500' : 'text-[var(--text-main)]'"
                                >
                                    {{ item.label }}
                                </span>
                                <span
                                    v-if="item.shortcut"
                                    class="ml-auto shrink-0 text-[11px] text-[var(--text-muted)]"
                                >
                                    {{ item.shortcut }}
                                </span>
                            </button>
                        </template>
                    </div>

                    <!-- 取消按钮 -->
                    <div class="px-2 pt-1">
                        <button
                            type="button"
                            class="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-4 py-3 text-center text-[14px] font-semibold text-[var(--text-main)] transition-colors active:bg-[var(--bg-hover)]"
                            @click="close"
                        >
                            取消
                        </button>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
/* 底部弹出动画 */
.nb-sheet-enter-active,
.nb-sheet-leave-active {
    transition: opacity 0.25s ease;
}
.nb-sheet-enter-active .slide-up-panel,
.nb-sheet-leave-active .slide-up-panel {
    transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}
.nb-sheet-enter-from,
.nb-sheet-leave-to {
    opacity: 0;
}
.nb-sheet-enter-from .slide-up-panel {
    transform: translateY(100%);
}
.nb-sheet-leave-to .slide-up-panel {
    transform: translateY(100%);
}
</style>
