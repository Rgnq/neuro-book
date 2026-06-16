<!-- app/components/mobile/MobileFileBrowser.vue -->
<script setup lang="ts">
import { useNovelIdeStore, type WorkspaceFileNode } from "nbook/app/stores/novel-ide";
import { storeToRefs } from "pinia";
import {
    buildWorkspaceFileTree,
    isWorkspaceContentDirectoryNode,
    resolveWorkspaceNodeRepresentedPath,
    type WorkspaceTreeNode,
} from "nbook/app/components/novel-ide/workspace/workspace-file-tree";

const emit = defineEmits<{
    (e: "open-editor", path: string): void;
}>();

const novelIdeStore = useNovelIdeStore();
const { workspaceTree, workspaceReady } = storeToRefs(novelIdeStore);

/** 构建文件树（目录带 children） */
const fileTree = computed(() => buildWorkspaceFileTree(workspaceTree.value));

/** 展开的目录集合 */
const expandedDirs = ref<Set<string>>(new Set());

/** 当前展开预览的文件路径 */
const previewPath = ref<string | null>(null);

/**
 * 根据展开状态计算可见的树节点列表。
 * 展开的目录会显示其子节点，并带缩进深度。
 */
const visibleNodes = computed<{ node: WorkspaceTreeNode; depth: number }[]>(() => {
    const result: { node: WorkspaceTreeNode; depth: number }[] = [];

    function walk(nodes: WorkspaceTreeNode[], depth: number): void {
        for (const node of nodes) {
            result.push({ node, depth });
            // 展开子节点的条件：目录有子节点 且 (用户手动展开 或 是内容目录自动展开)
            const shouldExpand = node.isDirectory && node.children.length > 0
                && (expandedDirs.value.has(node.path) || isWorkspaceContentDirectoryNode(node));
            if (shouldExpand) {
                walk(node.children, depth + 1);
            }
        }
    }

    walk(fileTree.value, 0);
    return result;
});

/** 切换目录展开/折叠 */
function toggleDir(path: string): void {
    const next = new Set(expandedDirs.value);
    if (next.has(path)) {
        next.delete(path);
    } else {
        next.add(path);
    }
    expandedDirs.value = next;
}

/**
 * 判断节点是否可打开编辑/预览。
 * 内容目录（如 lorebook 条目）虽有 isDirectory 但实际由 index.md 承载内容，应视为文件。
 */
function isContentNode(node: WorkspaceFileNode): boolean {
    return !node.isDirectory || isWorkspaceContentDirectoryNode(node);
}

/** 点击节点：普通目录展开/折叠，文件/内容目录展开预览 */
function selectNode(node: WorkspaceFileNode): void {
    if (node.isDirectory && !isWorkspaceContentDirectoryNode(node)) {
        toggleDir(node.path);
        return;
    }
    const representedPath = resolveWorkspaceNodeRepresentedPath(node);
    previewPath.value = previewPath.value === representedPath ? null : representedPath;
}

/** 在编辑器中打开文件 */
function openInEditor(path: string): void {
    emit("open-editor", path);
}

/** 节点图标 */
function nodeIcon(node: WorkspaceTreeNode): string {
    if (isWorkspaceContentDirectoryNode(node)) {
        return "i-lucide-file-text";
    }
    if (node.isDirectory) {
        return expandedDirs.value.has(node.path) ? "i-lucide-folder-open" : "i-lucide-folder";
    }
    if (node.path.toLowerCase().endsWith(".md")) {
        return "i-lucide-file-text";
    }
    return "i-lucide-file";
}

/** 节点显示名称 */
function nodeLabel(node: WorkspaceTreeNode): string {
    return node.title || node.path.split("/").pop() || node.path;
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
            <div v-else-if="visibleNodes.length === 0" class="flex items-center justify-center h-20 text-[12px] text-[var(--text-muted)]">
                暂无文件
            </div>
            <template v-else>
                <div
                    v-for="{ node, depth } in visibleNodes"
                    :key="node.path"
                    class="flex items-center gap-2 border-b border-[var(--border-color)]/50 text-[13px] transition-colors active:bg-[var(--bg-hover)]"
                    :class="previewPath === node.path ? 'bg-[var(--accent-bg)]' : ''"
                    :style="{ paddingLeft: `${8 + depth * 16}px` }"
                    @click="selectNode(node)"
                >
                    <!-- 展开/折叠指示器 + 图标 -->
                    <span
                        :class="nodeIcon(node)"
                        class="h-4 w-4 shrink-0 text-[var(--text-muted)]"
                    ></span>

                    <!-- 名称 -->
                    <span class="min-w-0 flex-1 truncate py-2.5 pr-3">{{ nodeLabel(node) }}</span>

                    <!-- 字数（文件或内容目录） -->
                    <span v-if="isContentNode(node) && node.words" class="shrink-0 text-[10px] text-[var(--text-muted)] pr-2">
                        {{ node.words }} 字
                    </span>

                    <!-- 展开子目录指示器（独立点击，不触发行选中） -->
                    <span
                        v-if="node.isDirectory && node.children.length > 0"
                        class="i-lucide-chevron-right h-3 w-3 shrink-0 text-[var(--text-muted)] mr-2 transition-transform duration-150"
                        :class="expandedDirs.has(node.path) ? 'rotate-90' : ''"
                        @click.stop="toggleDir(node.path)"
                    ></span>
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
                    📖 {{ previewPath.split("/").pop() }}
                </span>
                <button
                    type="button"
                    class="shrink-0 rounded px-2 py-0.5 text-[10px] text-[var(--accent-main)] active:bg-[var(--bg-hover)]"
                    @click="openInEditor(previewPath)"
                >
                    在编辑器中打开
                </button>
            </div>
            <div class="max-h-[200px] overflow-y-auto px-3 py-2 text-[12px] leading-relaxed text-[var(--text-muted)]">
                <span class="text-[10px]">{{ previewPath }}</span>
            </div>
        </div>
    </div>
</template>
