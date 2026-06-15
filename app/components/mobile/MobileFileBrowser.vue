<!-- app/components/mobile/MobileFileBrowser.vue -->
<script setup lang="ts">
import { useNovelIdeStore, type WorkspaceFileNode } from "nbook/app/stores/novel-ide";
import { storeToRefs } from "pinia";

const emit = defineEmits<{
    (e: "open-editor", path: string): void;
}>();

const novelIdeStore = useNovelIdeStore();
const { workspaceTree, workspaceReady } = storeToRefs(novelIdeStore);

/** 当前展开预览的文件路径 */
const previewPath = ref<string | null>(null);

/** 展开的目录集合 */
const expandedDirs = ref<Set<string>>(new Set());

/** 切换目录展开/折叠 */
function toggleDir(path: string): void {
    if (expandedDirs.value.has(path)) {
        expandedDirs.value.delete(path);
    } else {
        expandedDirs.value.add(path);
    }
    // 触发响应式更新
    expandedDirs.value = new Set(expandedDirs.value);
}

/** 点击文件 — 展开预览 */
function selectFile(node: WorkspaceFileNode): void {
    if (node.isDirectory) {
        toggleDir(node.path);
        return;
    }
    previewPath.value = previewPath.value === node.path ? null : node.path;
}

/** 在编辑器中打开文件 */
function openInEditor(path: string): void {
    emit("open-editor", path);
}
</script>

<template>
    <!-- 移动端文件浏览器 -->
    <div class="mobile-file-browser flex h-full flex-col overflow-hidden bg-[var(--bg-panel)]">
        <!-- 文件列表 -->
        <div class="flex-1 overflow-y-auto">
            <div v-if="!workspaceReady" class="flex items-center justify-center h-20 text-[12px] text-[var(--text-muted)]">
                加载中...
            </div>
            <div v-else-if="workspaceTree.length === 0" class="flex items-center justify-center h-20 text-[12px] text-[var(--text-muted)]">
                暂无文件
            </div>
            <template v-else>
                <div
                    v-for="node in workspaceTree"
                    :key="node.path"
                    class="flex items-center gap-2 border-b border-[var(--border-color)]/50 px-3 py-2.5 text-[13px] transition-colors active:bg-[var(--bg-hover)]"
                    @click="selectFile(node)"
                >
                    <span
                        :class="node.isDirectory ? (expandedDirs.has(node.path) ? 'i-lucide-folder-open' : 'i-lucide-folder') : 'i-lucide-file-text'"
                        class="h-4 w-4 shrink-0 text-[var(--text-muted)]"
                    ></span>
                    <span class="min-w-0 flex-1 truncate">{{ node.title || node.path.split('/').pop() }}</span>
                    <span v-if="!node.isDirectory && node.words" class="shrink-0 text-[10px] text-[var(--text-muted)]">
                        {{ node.words }} 字
                    </span>
                    <span v-if="!node.isDirectory" class="i-lucide-chevron-right h-3 w-3 shrink-0 text-[var(--text-muted)]"></span>
                </div>
            </template>
        </div>

        <!-- 只读预览面板 -->
        <div
            v-if="previewPath"
            class="shrink-0 border-t-2 border-[var(--accent-main)]/30 bg-[var(--editor-canvas-bg)]"
        >
            <div class="flex items-center justify-between px-3 py-2 border-b border-[var(--border-color)]/50">
                <span class="text-[10px] text-[var(--text-muted)] truncate">
                    📖 预览 {{ previewPath.split('/').pop() }}
                </span>
                <button
                    type="button"
                    class="shrink-0 rounded px-2 py-0.5 text-[10px] text-[var(--accent-main)] active:bg-[var(--bg-hover)]"
                    @click="openInEditor(previewPath)"
                >
                    在编辑器中打开
                </button>
            </div>
            <div class="max-h-[200px] overflow-y-auto px-3 py-2 text-[12px] leading-relaxed text-[var(--text-secondary)]">
                <!-- MVP: 仅显示文件路径文本；后续迭代接入 Markdown 渲染 -->
                <div class="whitespace-pre-wrap font-mono text-[11px]">
                    {{ previewPath }}
                </div>
            </div>
        </div>
    </div>
</template>
