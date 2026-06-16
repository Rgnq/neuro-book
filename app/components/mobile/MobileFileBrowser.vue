<!-- app/components/mobile/MobileFileBrowser.vue -->
<script setup lang="ts">
import { useNovelIdeStore, type WorkspaceFileNode } from "nbook/app/stores/novel-ide";
import { storeToRefs } from "pinia";
import {
    buildWorkspaceFileTree,
    isWorkspaceContentDirectoryNode,
    isWorkspaceContentScopePath,
    isWorkspaceLorebookEntry,
    isWorkspaceLorebookScopePath,
    resolveWorkspaceNodeRepresentedPath,
    type WorkspaceTreeNode,
} from "nbook/app/components/novel-ide/workspace/workspace-file-tree";
import { type ContextMenuItem } from "nbook/app/components/common/ContextMenu.vue";
import MobileContextMenu from "nbook/app/components/mobile/MobileContextMenu.vue";
import { useDialog } from "nbook/app/composables/useDialog";
import { useNotification } from "nbook/app/composables/useNotification";

const emit = defineEmits<{
    (e: "open-editor", path: string): void;
}>();

const novelIdeStore = useNovelIdeStore();
const { workspaceTree, workspaceReady } = storeToRefs(novelIdeStore);
const { error: notifyError } = useNotification();
const { prompt, confirm } = useDialog();

/** 构建文件树（目录带 children） */
const fileTree = computed(() => buildWorkspaceFileTree(workspaceTree.value));

/** 展开的目录集合 */
const expandedDirs = ref<Set<string>>(new Set());

/** 当前展开预览的文件路径 */
const previewPath = ref<string | null>(null);

/** 根据展开状态计算可见的树节点列表 */
const visibleNodes = computed<{ node: WorkspaceTreeNode; depth: number }[]>(() => {
    const result: { node: WorkspaceTreeNode; depth: number }[] = [];

    function walk(nodes: WorkspaceTreeNode[], depth: number, parentIsContentDir: boolean): void {
        for (const node of nodes) {
            if (parentIsContentDir && node.path.endsWith("/index.md")) continue;
            result.push({ node, depth });
            const shouldExpand = node.isDirectory && node.children.length > 0
                && expandedDirs.value.has(node.path);
            if (shouldExpand) {
                walk(node.children, depth + 1, isWorkspaceContentDirectoryNode(node));
            }
        }
    }

    walk(fileTree.value, 0, false);
    return result;
});

function toggleDir(path: string): void {
    const next = new Set(expandedDirs.value);
    next.has(path) ? next.delete(path) : next.add(path);
    expandedDirs.value = next;
}

function isContentNode(node: WorkspaceFileNode): boolean {
    return !node.isDirectory || isWorkspaceContentDirectoryNode(node);
}

function selectNode(node: WorkspaceFileNode): void {
    if (node.isDirectory) {
        if (isWorkspaceContentDirectoryNode(node)) {
            const representedPath = resolveWorkspaceNodeRepresentedPath(node);
            previewPath.value = previewPath.value === representedPath ? null : representedPath;
        } else {
            toggleDir(node.path);
        }
        return;
    }
    previewPath.value = previewPath.value === node.path ? null : node.path;
}

function openInEditor(path: string): void {
    emit("open-editor", path);
}

function nodeIcon(node: WorkspaceTreeNode): string {
    if (isWorkspaceContentDirectoryNode(node)) return "i-lucide-file-text";
    if (node.isDirectory) {
        return expandedDirs.value.has(node.path) ? "i-lucide-folder-open" : "i-lucide-folder";
    }
    if (node.path.toLowerCase().endsWith(".md")) return "i-lucide-file-text";
    return "i-lucide-file";
}

function nodeLabel(node: WorkspaceTreeNode): string {
    return node.title || node.path.split("/").pop() || node.path;
}

function basename(filePath: string): string {
    const normalizedPath = filePath.replace(/\/$/, "");
    return normalizedPath.includes("/") ? normalizedPath.slice(normalizedPath.lastIndexOf("/") + 1) : normalizedPath;
}

function resolveParentDirectory(filePath: string): string {
    const normalizedPath = filePath.replace(/\/$/, "");
    if (!normalizedPath.includes("/")) return "";
    return `${normalizedPath.slice(0, normalizedPath.lastIndexOf("/"))}/`;
}

// ---- 长按上下文菜单 ----
const contextMenuVisible = ref(false);
const contextMenuTarget = ref<WorkspaceTreeNode | null>(null);
const contextMenuItems = ref<ContextMenuItem[]>([]);
const contextMenuTitle = ref("");

let longPressTimer: ReturnType<typeof setTimeout> | null = null;
let longPressStartX = 0;
let longPressStartY = 0;
let longPressTriggered = false;

/** 判断节点是否可以转化为目录节点 */
function canCreateDirectoryIndex(node: WorkspaceFileNode): boolean {
    return node.isDirectory && !node.hasIndex && isWorkspaceContentScopePath(node.path);
}

/** 判断文件是否可以转换为目录节点 */
function canConvertFileToDirectory(node: WorkspaceFileNode): boolean {
    return !node.isDirectory && node.editable && isWorkspaceContentScopePath(node.path)
        && !node.path.toLowerCase().endsWith("/index.md");
}

// ---- 上下文菜单项构建（与桌面端 WorkspaceFilePanel.openNodeMenu 对齐） ----

/** 为节点构建完整上下文菜单 */
function buildNodeMenu(node: WorkspaceTreeNode): ContextMenuItem[] {
    const baseDir = node.isDirectory ? node.path : resolveParentDirectory(node.path);
    const siblingDir = resolveParentDirectory(node.path);
    const isContentDir = isWorkspaceContentDirectoryNode(node);

    const items: ContextMenuItem[] = [
        {
            label: isContentDir ? "打开 index.md" : "打开",
            iconClass: "i-lucide-file-text",
            action: () => void openNodeInEditor(node),
        },
        {
            label: node.isDirectory && expandedDirs.value.has(node.path) ? "收起" : "展开",
            iconClass: "i-lucide-chevron-down",
            disabled: !node.isDirectory,
            action: () => toggleDir(node.path),
        },
        { separator: true },
        { label: "新建子文件", iconClass: "i-lucide-file-plus", disabled: !node.isDirectory, action: () => void createFile(baseDir) },
        { label: "新建子目录", iconClass: "i-lucide-folder-plus", disabled: !node.isDirectory, action: () => void createDirectory(baseDir) },
        { label: "新建同级文件", iconClass: "i-lucide-file-plus-2", action: () => void createFile(siblingDir) },
        { label: "新建同级目录", iconClass: "i-lucide-folder-plus", action: () => void createDirectory(siblingDir) },
    ];

    // Lorebook 条目创建（仅在 lorebook 目录下显示）
    if (node.isDirectory && isWorkspaceLorebookScopePath(baseDir)) {
        items.push({ label: "新建子 Lorebook 条目", iconClass: "i-lucide-book-plus", action: () => void createLorebookEntry(baseDir) });
    }
    if (!node.isDirectory && isWorkspaceLorebookScopePath(siblingDir)) {
        items.push({ label: "新建同级 Lorebook 条目", iconClass: "i-lucide-book-plus", action: () => void createLorebookEntry(siblingDir) });
    }

    // 高级转换操作
    if (canCreateDirectoryIndex(node)) {
        items.push({ label: "转化为目录节点", iconClass: "i-lucide-file-symlink", action: () => void createDirectoryIndex(node) });
    }
    if (canConvertFileToDirectory(node)) {
        items.push({ label: "文件转目录节点", iconClass: "i-lucide-folder-input", action: () => void convertFileToDirectory(node) });
    }

    items.push(
        { separator: true },
        { label: "复制引用", iconClass: "i-lucide-copy", action: () => void copyReference(node) },
        { label: "重命名", iconClass: "i-lucide-pencil", action: () => void renameNode(node) },
        { label: "删除", iconClass: "i-lucide-trash-2", danger: true, action: () => void deleteNode(node) },
    );

    return items;
}

/** 根区域（空白处）菜单 */
function buildRootMenu(): ContextMenuItem[] {
    return [
        { label: "新建文件", iconClass: "i-lucide-file-plus", action: () => void createFile() },
        { label: "新建目录", iconClass: "i-lucide-folder-plus", action: () => void createDirectory() },
        { label: "新建 Lorebook 条目", iconClass: "i-lucide-book-plus", action: () => void createLorebookEntry(null) },
        { separator: true },
        { label: "刷新", iconClass: "i-lucide-refresh-cw", action: () => void refreshTree() },
    ];
}

// ---- 菜单动作实现 ----

/** 在编辑器中打开节点 */
async function openNodeInEditor(node: WorkspaceTreeNode): Promise<void> {
    const path = isWorkspaceContentDirectoryNode(node)
        ? resolveWorkspaceNodeRepresentedPath(node)
        : node.path;
    openInEditor(path);
}

/** 新建文件 */
async function createFile(baseDir = ""): Promise<void> {
    const prefix = baseDir ? `${baseDir.replace(/\/$/, "")}/` : "";
    const input = await prompt("请输入新文件路径", `${prefix}new-file.md`);
    const filePath = typeof input === "string" ? input.trim() : "";
    if (!filePath) return;
    try {
        const created = await novelIdeStore.createWorkspaceFile(filePath, "");
        await novelIdeStore.selectWorkspacePath(created.path);
    } catch (err) {
        notifyError("文件创建失败，请检查路径是否已存在。", { title: "创建文件失败" });
    }
}

/** 新建目录 */
async function createDirectory(baseDir = ""): Promise<void> {
    const prefix = baseDir ? `${baseDir.replace(/\/$/, "")}/` : "";
    const input = await prompt("请输入新目录路径", `${prefix}new-folder`);
    const dirPath = typeof input === "string" ? input.trim() : "";
    if (!dirPath) return;
    try {
        const created = await novelIdeStore.createWorkspaceDirectory(dirPath);
        const next = new Set(expandedDirs.value);
        next.add(created.path);
        expandedDirs.value = next;
        await novelIdeStore.selectWorkspacePath(created.path);
    } catch (err) {
        notifyError("目录创建失败，请检查路径是否已存在。", { title: "创建目录失败" });
    }
}

/** 新建 Lorebook 条目 */
async function createLorebookEntry(baseDir: string | null = null): Promise<void> {
    const LOREBOOK_TYPES = ["character", "location", "item", "rule", "note"] as const;
    const typeList = LOREBOOK_TYPES.map((t, i) => `${i + 1}.${t}`).join(" ");
    const defaultDir = baseDir === null ? "lorebook/" : baseDir;
    const prefix = defaultDir ? `${defaultDir.replace(/\/$/, "")}/` : "";

    const input = await prompt(`条目类型: ${typeList}\n输入路径`, `${prefix}new-entry`);
    const rawPath = typeof input === "string" ? input.trim() : "";
    if (!rawPath) return;

    // 归一化为 index.md 路径
    let indexMdPath = rawPath.replace(/\/$/, "");
    if (!indexMdPath.toLowerCase().endsWith("/index.md")) {
        indexMdPath = indexMdPath.replace(/\.md$/i, "") + "/index.md";
    }

    if (!isWorkspaceLorebookScopePath(indexMdPath)) {
        notifyError("Lorebook 条目必须创建在 lorebook/ 目录下。", { title: "创建 Lorebook 条目失败" });
        return;
    }

    // 从路径推断类型
    const parentDir = basename(resolveParentDirectory(indexMdPath));
    const entryType = LOREBOOK_TYPES.includes(parentDir as typeof LOREBOOK_TYPES[number])
        ? parentDir as typeof LOREBOOK_TYPES[number]
        : "note";

    const title = basename(resolveParentDirectory(indexMdPath)).replace(/\.md$/i, "") || "new-entry";
    const characterBlock = entryType === "character"
        ? `character:\n    logline: ""\n    profile: {}\n    story: {}\n    meta:\n        pinned: false\n        primaryContext: null\n`
        : "";
    const subtypeBlock = entryType === "character" ? "subtype: person\n" : "";
    const content = `---\ntitle: ${JSON.stringify(title)}\ntype: ${entryType}\n${subtypeBlock}status: draft\naliases: []\ntags: []\nsummary: ""\nrefs: []\nretrieval:\n    enabled: true\n    trigger: null\ngovernance:\n    source: manual\n    review: proposed\n${characterBlock}---\n\n`;

    try {
        const created = await novelIdeStore.createWorkspaceFile(indexMdPath, content);
        const parentPath = resolveParentDirectory(indexMdPath);
        if (parentPath) {
            const next = new Set(expandedDirs.value);
            next.add(parentPath);
            expandedDirs.value = next;
        }
        await novelIdeStore.selectWorkspacePath(created.path);
    } catch (err) {
        notifyError("Lorebook 条目创建失败。", { title: "创建 Lorebook 条目失败" });
    }
}

/** 转化为目录节点 */
async function createDirectoryIndex(node: WorkspaceFileNode): Promise<void> {
    try {
        const title = node.title || basename(node.path) || "index";
        const content = `---\ntitle: ${JSON.stringify(title)}\nstatus: draft\n---\n\n`;
        const indexPath = `${node.path.replace(/\/$/, "")}/index.md`;
        const indexNode = await novelIdeStore.createWorkspaceFile(indexPath, content);
        const next = new Set(expandedDirs.value);
        next.add(node.path);
        expandedDirs.value = next;
        await novelIdeStore.selectWorkspacePath(indexNode.path);
    } catch (err) {
        notifyError("转化目录节点失败。", { title: "转化失败" });
    }
}

/** 文件转目录节点 */
async function convertFileToDirectory(node: WorkspaceFileNode): Promise<void> {
    try {
        const converted = await novelIdeStore.convertWorkspaceFileToDirectory(node.path);
        const next = new Set(expandedDirs.value);
        next.add(converted.path);
        expandedDirs.value = next;
        await novelIdeStore.selectWorkspacePath(converted.path);
    } catch (err) {
        notifyError("文件转目录节点失败。", { title: "转换失败" });
    }
}

/** 复制引用 */
async function copyReference(node: WorkspaceFileNode): Promise<void> {
    if (!import.meta.client) return;
    const refPath = isWorkspaceContentDirectoryNode(node)
        ? resolveWorkspaceNodeRepresentedPath(node)
        : node.path;
    try {
        await navigator.clipboard.writeText(refPath);
    } catch {
        // 剪贴板不可用时静默失败
    }
}

/** 重命名 / 移动节点 */
async function renameNode(node: WorkspaceFileNode): Promise<void> {
    const currentPath = node.isDirectory ? node.path.replace(/\/$/, "") : node.path;
    const input = await prompt("请输入新路径", currentPath);
    const nextPath = typeof input === "string" ? input.trim() : "";
    if (!nextPath || nextPath === currentPath) return;

    try {
        const moved = await novelIdeStore.renameWorkspacePath(currentPath, nextPath);
        const parentPath = resolveParentDirectory(moved.path);
        if (parentPath) {
            const next = new Set(expandedDirs.value);
            next.add(parentPath);
            expandedDirs.value = next;
        }
        await novelIdeStore.selectWorkspacePath(moved.path);
    } catch (err) {
        notifyError("重命名失败，请检查目标路径是否已存在。", { title: "重命名失败" });
    }
}

/** 删除节点 */
async function deleteNode(node: WorkspaceFileNode): Promise<void> {
    const label = node.title || node.path;
    if (!await confirm(`确定要删除 ${label} 吗？`)) return;

    try {
        await novelIdeStore.deleteWorkspacePath(node.path, false);
    } catch {
        if (!node.isDirectory || !await confirm("目录非空。是否递归删除整个目录？")) return;
        try {
            await novelIdeStore.deleteWorkspacePath(node.path, true);
        } catch (err) {
            notifyError("删除失败。", { title: "删除失败" });
        }
    }
}

/** 刷新文件树 */
async function refreshTree(): Promise<void> {
    try {
        await novelIdeStore.loadWorkspaceTree();
    } catch {
        notifyError("刷新文件树失败。", { title: "刷新失败" });
    }
}

// ---- 长按事件处理 ----

/** 长按节点 → 弹出节点菜单 */
function showNodeMenu(node: WorkspaceTreeNode): void {
    contextMenuTarget.value = node;
    contextMenuTitle.value = node.title || basename(node.path) || node.path;
    contextMenuItems.value = buildNodeMenu(node);
    contextMenuVisible.value = true;
}

/** 长按空白区域 → 弹出根菜单 */
function showRootMenu(): void {
    contextMenuTarget.value = null;
    contextMenuTitle.value = "工作区";
    contextMenuItems.value = buildRootMenu();
    contextMenuVisible.value = true;
}

function onTouchStart(event: TouchEvent, node: WorkspaceTreeNode): void {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    longPressStartX = touch.clientX;
    longPressStartY = touch.clientY;
    contextMenuTarget.value = node;
    longPressTriggered = false;

    clearLongPressTimer();
    longPressTimer = setTimeout(() => {
        longPressTriggered = true;
        showNodeMenu(node);
    }, 500);
}

function onTouchMove(event: TouchEvent): void {
    if (!longPressTimer) return;
    const touch = event.touches[0];
    const dx = Math.abs(touch.clientX - longPressStartX);
    const dy = Math.abs(touch.clientY - longPressStartY);
    if (dx > 10 || dy > 10) clearLongPressTimer();
}

function onTouchEnd(event: TouchEvent): void {
    clearLongPressTimer();
    // 阻止长按后移动端触发的合成 click 事件，避免误触发 selectNode
    if (longPressTriggered && event.cancelable) {
        event.preventDefault();
    }
}

function clearLongPressTimer(): void {
    if (longPressTimer !== null) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
    }
}

/** 空白区域长按：根菜单 */
function onRootTouchStart(event: TouchEvent): void {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    longPressStartX = touch.clientX;
    longPressStartY = touch.clientY;
    longPressTriggered = false;

    clearLongPressTimer();
    longPressTimer = setTimeout(() => {
        longPressTriggered = true;
        showRootMenu();
    }, 500);
}

function onRootTouchMove(event: TouchEvent): void {
    if (!longPressTimer) return;
    const touch = event.touches[0];
    if (Math.abs(touch.clientX - longPressStartX) > 10 || Math.abs(touch.clientY - longPressStartY) > 10) {
        clearLongPressTimer();
    }
}

function onRootTouchEnd(event: TouchEvent): void {
    clearLongPressTimer();
    // 阻止长按后移动端触发的合成 click 事件，避免误触发 selectNode
    if (longPressTriggered && event.cancelable) {
        event.preventDefault();
    }
}

onBeforeUnmount(() => clearLongPressTimer());
</script>

<template>
    <div class="mobile-file-browser flex h-full flex-col overflow-hidden bg-[var(--bg-panel)]">
        <!-- 文件列表 -->
        <div
            class="flex-1 overflow-y-auto"
            @touchstart="onRootTouchStart"
            @touchmove="onRootTouchMove"
            @touchend="onRootTouchEnd($event)"
            @touchcancel="onRootTouchEnd($event)"
        >
            <div v-if="!workspaceReady" class="flex items-center justify-center h-20 text-[12px] text-[var(--text-muted)]">
                加载中...
            </div>
            <div v-else-if="visibleNodes.length === 0" class="flex items-center justify-center h-20 text-[12px] text-[var(--text-muted)]">
                暂无文件（长按新建）
            </div>
            <template v-else>
                <div
                    v-for="{ node, depth } in visibleNodes"
                    :key="node.path"
                    class="flex items-center gap-2 border-b border-[var(--border-color)]/50 text-[13px] transition-colors select-none"
                    :class="previewPath === resolveWorkspaceNodeRepresentedPath(node) ? 'bg-[var(--accent-bg)]' : ''"
                    :style="{ paddingLeft: `${8 + depth * 16}px` }"
                    @touchstart.stop="onTouchStart($event, node)"
                    @touchmove="onTouchMove"
                    @touchend="onTouchEnd($event)"
                    @touchcancel="onTouchEnd($event)"
                >
                    <span
                        v-if="node.isDirectory && node.children.length > 0"
                        class="flex items-center gap-0.5 shrink-0 cursor-pointer py-2.5"
                        @click.stop="toggleDir(node.path)"
                    >
                        <span :class="nodeIcon(node)" class="h-4 w-4 text-[var(--text-muted)]"></span>
                        <span
                            class="i-lucide-chevron-right h-3 w-3 text-[var(--text-muted)] transition-transform duration-150"
                            :class="expandedDirs.has(node.path) ? 'rotate-90' : ''"
                        ></span>
                    </span>
                    <span v-else :class="nodeIcon(node)" class="h-4 w-4 shrink-0 text-[var(--text-muted)] py-2.5"></span>

                    <span class="min-w-0 flex-1 truncate py-2.5 pr-3 active:bg-[var(--bg-hover)]" @click="selectNode(node)">
                        {{ nodeLabel(node) }}
                    </span>

                    <span v-if="isContentNode(node) && node.words" class="shrink-0 text-[10px] text-[var(--text-muted)] pr-2">
                        {{ node.words }} 字
                    </span>
                </div>
            </template>
        </div>

        <!-- 只读预览面板 -->
        <div
            v-if="previewPath"
            class="shrink-0 border-t-2 border-[var(--accent-main)]/30 bg-[var(--editor-canvas-bg)]"
        >
            <div class="flex items-center justify-between px-3 py-2 border-b border-[var(--border-color)]/50">
                <span class="text-[10px] text-[var(--text-muted)] truncate">📖 {{ previewPath.split("/").pop() }}</span>
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

        <!-- 长按上下文菜单 -->
        <MobileContextMenu
            v-model="contextMenuVisible"
            :items="contextMenuItems"
            :title="contextMenuTitle"
        />
    </div>
</template>
