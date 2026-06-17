<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useNovelIdeStore } from "nbook/app/stores/novel-ide";
import { useMobileUiStore, type EditorViewMode, type MobileTab } from "nbook/app/stores/mobile-ui";
import { useMobileDetect } from "nbook/app/composables/useMobileDetect";
import { useIdeTheme } from "nbook/app/composables/useIdeTheme";
import { useAuthSessionState } from "nbook/app/composables/useAuthSessionState";
import MobileHeader from "nbook/app/components/mobile/MobileHeader.vue";
import MobileTabBar from "nbook/app/components/mobile/MobileTabBar.vue";
import MobileEditorToolbar from "nbook/app/components/mobile/MobileEditorToolbar.vue";
import MobileFileBrowser from "nbook/app/components/mobile/MobileFileBrowser.vue";
import MobileStoryReader from "nbook/app/components/mobile/MobileStoryReader.vue";
import AgentChatSurface from "nbook/app/components/novel-ide/agent/AgentChatSurface.vue";
import TipTapMarkdownEditor from "nbook/app/components/markdown-studio/TipTapMarkdownEditor.vue";
import type { MarkdownFormatCommand, MarkdownStudioEditorHandle } from "nbook/app/composables/useMarkdownStudioController";
import type { AuthSessionDto } from "nbook/shared/dto/auth.dto";
import MobileSettingsDialog from "nbook/app/components/mobile/MobileSettingsDialog.vue";
import NovelBookshelfDialog from "nbook/app/components/novel-ide/NovelBookshelfDialog.vue";

const novelIdeStore = useNovelIdeStore();
const mobileUi = useMobileUiStore();
const { isMobile } = useMobileDetect();

const {
    currentNovelId,
    currentNovel,
    selectedFileContent,
    selectedFilePath,
    savingFile,
    theme,
} = storeToRefs(novelIdeStore);

const { mountThemeHost } = useIdeTheme(theme);
const authSessionState = useAuthSessionState();

const themeHostRef = ref<HTMLElement | null>(null);
const agentSurfaceRef = ref<InstanceType<typeof AgentChatSurface> | null>(null);
const editorRef = ref<MarkdownStudioEditorHandle | null>(null);
const currentUser = ref<AuthSessionDto["user"]>(null);

// ---------- 弹窗状态 ----------
const novelDialogOpen = ref(false);
const settingsDialogOpen = ref(false);

// ---------- Agent Session 状态 ----------
const hasActiveSession = computed(() => agentSurfaceRef.value?.activeSessionId != null);

/** 获取当前 Agent 会话 ID（供剧情页发送时实时读取） */
function getAgentSessionId(): number | null {
    return agentSurfaceRef.value?.activeSessionId ?? null;
}

/** 获取 Agent 是否正在运行（供剧情页显示停止按钮） */
function isAgentRunning(): boolean {
    return agentSurfaceRef.value?.running ?? false;
}

// ---------- Auth ----------
/**
 * 同步当前登录用户，与 index.vue 中的 syncAuthSession 逻辑一致。
 * useAuthSessionState 通过 Nuxt useState 实现跨路由共享，
 * 如果首页已经 fetch 过则直接复用，避免重复请求 /api/auth/me。
 */
const syncAuthSession = async (): Promise<void> => {
    if (authSessionState.session.value) {
        currentUser.value = authSessionState.session.value.user;
        return;
    }
    try {
        const session = await $fetch<AuthSessionDto>("/api/auth/me");
        authSessionState.setSession(session);
        currentUser.value = session.user;
    } catch {
        authSessionState.setSession(null);
        currentUser.value = null;
    }
};

// 页面标题 & 移动端专属 head 配置（viewport/safe-area/PWA/Apple 适配）
// 这些配置从 nuxt.config.ts / theme-vars.css / NotificationViewport 迁移至此，
// 确保零侵入原仓库共用文件。
useHead({
    title: "Neuro Book",
    meta: [
        { name: "viewport", content: "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" },
        { name: "apple-mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
        { name: "theme-color", content: "#1a1a2e" },
    ],
    link: [
        { rel: "manifest", href: "/manifest.json" },
        { rel: "apple-touch-icon", sizes: "180x180", href: "/mobile/icon.svg" },
        { rel: "icon", type: "image/svg+xml", href: "/mobile/icon.svg" },
    ],
    style: [
        {
            id: "mobile-safe-area",
            children: `
@media (max-width: 768px) {
    .notification-group {
        padding-top: var(--safe-area-top);
        padding-bottom: var(--safe-area-bottom);
    }
}
`.trim(),
        },
    ],
});

// ---------- 初始化 ----------
onMounted(async () => {
    if (!import.meta.client) return;

    if (!isMobile.value) {
        await navigateTo("/");
        return;
    }

    if (themeHostRef.value) {
        mountThemeHost(themeHostRef.value);
    }
    void syncAuthSession();
    await novelIdeStore.initializeWorkspace();
});

// ---------- 小说信息 ----------
const novelTitle = computed(() => currentNovel.value?.title ?? "");

// ---------- Header 按钮 ----------
/** 打开小说选择弹窗 */
function handleOpenNovels(): void {
    novelDialogOpen.value = true;
}

/** 打开会话管理弹窗（复用 AgentChatSurface 内部的 AgentSessionDialog） */
function handleOpenSessions(): void {
    agentSurfaceRef.value?.openSessionDialog();
}

// ---------- 编辑器 ----------
/** 编辑器警告信息（HTML 检测等） */
const editorWarning = ref<string | null>(null);

/** 用户编辑后的内容先写到 store buffer，后续通过 store 保存 */
function handleEditorChange(value: string): void {
    selectedFileContent.value = value;
}

/** 格式工具栏 — 转发命令到 TipTapMarkdownEditor */
function handleFormat(command: MarkdownFormatCommand): void {
    editorRef.value?.applyMarkdownFormat?.(command);
}

/**
 * TipTap / 标准 Markdown 能无损往返的标签。
 * 此列表之外的 HTML 标签在 rich 模式下编辑并保存后会被破坏。
 */
const EDITOR_SAFE_TAGS = new Set([
    "p", "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li", "blockquote", "code", "pre",
    "em", "strong", "b", "i", "u", "s", "del",
    "a", "img", "table", "thead", "tbody", "tr", "th", "td",
    "hr", "br", "sub", "sup", "mark",
    "inline-comment",
]);

/** 检测 Markdown 文本是否包含编辑器无法安全处理的 HTML 标签 */
function hasRiskyHtml(content: string): boolean {
    const tags = content.matchAll(/<(\w[\w-]*)(?:\s[^>]*)?>/gi);
    for (const m of tags) {
        if (!EDITOR_SAFE_TAGS.has(m[1].toLowerCase())) {
            return true;
        }
    }
    return false;
}

/** 文件浏览器点击"在编辑器中打开" */
async function handleOpenEditor(path: string): Promise<void> {
    editorWarning.value = null;
    await novelIdeStore.selectWorkspacePath(path);
    mobileUi.openFileInEditor(path);

    // 检测文件是否包含编辑器无法安全处理的 HTML 标签
    if (hasRiskyHtml(selectedFileContent.value)) {
        mobileUi.setEditorViewMode("source");
        editorWarning.value = "此文件包含自定义 HTML 样式代码，已自动切换到源码模式。在 Markdown 模式下编辑会破坏这些 HTML。";
    }
}

/** 保存当前编辑的文件 */
async function handleSaveFile(): Promise<void> {
    try {
        await novelIdeStore.saveCurrentFile();
    } catch {
        // 错误由 store 内部的 write conflict 机制处理
    }
}

/** 关闭当前编辑的文件（保留缓冲区在 store 中） */
function handleCloseFile(): void {
    novelIdeStore.clearActiveFile();
    mobileUi.editorFilePath = null;
}

/** 切换编辑器视图模式（rich ↔ source） */
function handleToggleEditorView(): void {
    const next: EditorViewMode = mobileUi.editorViewMode === "rich" ? "source" : "rich";
    mobileUi.setEditorViewMode(next);
    // 切到源码模式时清除 HTML 警告
    if (next === "source") editorWarning.value = null;
}
</script>

<template>
    <!-- 移动端页面根容器 -->
    <div
        v-show="isMobile"
        ref="themeHostRef"
        class="novel-ide-theme mobile-ide-page flex h-[100dvh] flex-col overflow-hidden bg-[var(--bg-main)] text-[var(--text-main)] transition-colors duration-300"
    >
        <!-- 顶栏 -->
        <MobileHeader
            :novel-title="novelTitle"
            :has-active-session="hasActiveSession"
            @open-novels="handleOpenNovels"
            @open-sessions="handleOpenSessions"
            @open-settings="settingsDialogOpen = true"
        />

        <!-- Tab 内容区 — v-show 保持各 Tab 挂载不销毁 -->
        <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
            <!-- 聊天 Tab — 移动端容器 :deep() 隐藏抽屉头部 -->
            <div v-show="mobileUi.activeTab === 'chat'" class="flex h-full flex-col mobile-chat-surface">
                <AgentChatSurface
                    ref="agentSurfaceRef"
                    :active="true"
                    layout="drawer"
                    :novel-id="currentNovelId"
                    :selected-file-path="selectedFilePath"
                />
            </div>

            <!-- 剧情 Tab -->
            <div v-show="mobileUi.activeTab === 'story'" class="flex h-full flex-col">
                <MobileStoryReader
                    :novel-id="currentNovelId"
                    :get-session-id="getAgentSessionId"
                    :is-running="isAgentRunning"
                />
            </div>

            <!-- 编辑 Tab -->
            <div v-show="mobileUi.activeTab === 'editor'" class="flex h-full flex-col">
                <!-- 格式工具栏（仅 rich 模式显示格式按钮，两模式均可切换） -->
                <MobileEditorToolbar
                    :view-mode="mobileUi.editorViewMode"
                    @format="handleFormat"
                    @toggle-view="handleToggleEditorView"
                />
                <!-- 文件信息 + 保存/关闭 -->
                <div
                    v-if="selectedFilePath"
                    class="flex shrink-0 items-center gap-2 border-b border-[var(--border-color)] bg-[var(--bg-panel)] px-3 py-1.5"
                >
                    <span class="i-lucide-file-text h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
                    <span class="min-w-0 flex-1 truncate text-[12px] text-[var(--text-secondary)]">
                        {{ selectedFilePath.split("/").pop() }}
                    </span>
                    <button
                        type="button"
                        class="flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1 text-[12px] font-medium text-[var(--accent-main)] transition-colors active:bg-[var(--bg-hover)] disabled:opacity-40"
                        :disabled="savingFile"
                        @click="handleSaveFile"
                    >
                        <span v-if="savingFile" class="i-lucide-loader-2 h-3.5 w-3.5 animate-spin" />
                        <span v-else class="i-lucide-save h-3.5 w-3.5" />
                        <span>{{ savingFile ? "保存中" : "保存" }}</span>
                    </button>
                    <button
                        type="button"
                        class="flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1 text-[12px] font-medium text-[var(--text-muted)] transition-colors active:bg-[var(--bg-hover)]"
                        @click="handleCloseFile"
                    >
                        <span class="i-lucide-x h-3.5 w-3.5" />
                        <span>关闭</span>
                    </button>
                </div>
                <!-- HTML 风险警告 -->
                <div
                    v-if="editorWarning"
                    class="flex shrink-0 items-start gap-2 border-b border-[var(--border-color)] bg-[var(--accent-bg)] px-3 py-2 text-[12px] leading-relaxed text-[var(--accent-main)]"
                >
                    <span class="i-lucide-triangle-alert h-3.5 w-3.5 shrink-0 mt-px" />
                    <span class="flex-1">{{ editorWarning }}</span>
                    <button
                        type="button"
                        class="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[var(--text-muted)] transition-colors active:bg-[var(--bg-hover)]"
                        @click="editorWarning = null"
                    >
                        <span class="i-lucide-x h-3.5 w-3.5" />
                    </button>
                </div>
                <!-- 编辑器主区域 -->
                <div class="flex-1 overflow-hidden">
                    <div v-if="!selectedFilePath" class="flex h-full items-center justify-center text-[var(--text-muted)] text-[13px]">
                        从「文件」标签页选择文件开始编辑
                    </div>
                    <!-- Rich 模式：WYSIWYG -->
                    <div v-else-if="mobileUi.editorViewMode === 'rich'" class="h-full overflow-y-auto">
                        <TipTapMarkdownEditor
                            ref="editorRef"
                            :key="selectedFilePath + '-rich'"
                            :initial-value="selectedFileContent"
                            :visible="true"
                            :readonly="false"
                            :active-path="selectedFilePath"
                            placeholder="开始写作..."
                            @change="handleEditorChange"
                        />
                    </div>
                    <!-- Source 模式：纯文本编辑 -->
                    <textarea
                        v-else
                        :value="selectedFileContent"
                        class="h-full w-full resize-none border-0 bg-[var(--bg-main)] p-4 text-[13px] leading-relaxed text-[var(--text-main)] outline-none"
                        style="font-family: 'JetBrains Mono', 'Fira Code', monospace; tab-size: 2;"
                        spellcheck="false"
                        placeholder="开始写作..."
                        @input="handleEditorChange(($event.target as HTMLTextAreaElement).value)"
                    />
                </div>
            </div>

            <!-- 文件 Tab -->
            <div v-show="mobileUi.activeTab === 'files'" class="flex h-full flex-col">
                <MobileFileBrowser @open-editor="handleOpenEditor" />
            </div>
        </div>

        <!-- 底部标签栏 -->
        <MobileTabBar
            :active-tab="mobileUi.activeTab"
            @select="mobileUi.setActiveTab"
        />

        <!-- 书架弹窗（复用桌面端 NovelBookshelfDialog：创建/删除/切换） -->
        <NovelBookshelfDialog v-model="novelDialogOpen" />

        <!-- 设置弹窗 -->
        <MobileSettingsDialog v-model="settingsDialogOpen" />
    </div>

    <!-- 非移动端占位 -->
    <div v-show="!isMobile" class="flex h-screen items-center justify-center bg-[var(--bg-main)] text-[var(--text-muted)] text-[14px]">
        请在移动设备上访问此页面
    </div>
</template>

<style scoped>
/*
 * 移动端隐藏 AgentChatSurface 的抽屉头部（由 MobileHeader 替代）。
 * 使用 :deep() 穿透组件边界，避免修改 AgentChatSurface.vue 源码。
 *
 * 脆弱性：依赖 AgentChatSurface 模板中 <section> 的第一个 <div> 子元素是头部。
 * 若上游重构该组件模板结构，健壮回退为头部重新显示（非功能性崩溃）。
 */
.mobile-chat-surface :deep(section > div:first-child) {
    display: none;
}
</style>

<style>
/*
 * 移动端安全区 CSS 变量 & Dialog 适配。
 * 必须放在非 scoped <style> 块中走 Vite CSS 打包管线，
 * 不能依赖 useHead 动态注入——iOS Safari 在页面交互后可能丢失动态 <style> 标签。
 */
:root {
    --safe-area-top: env(safe-area-inset-top, 0px);
    --safe-area-bottom: env(safe-area-inset-bottom, 0px);
    --safe-area-left: env(safe-area-inset-left, 0px);
    --safe-area-right: env(safe-area-inset-right, 0px);
}

/* Dialog 弹窗避开 iOS 顶部安全区 */
@media (max-width: 768px) {
    .fixed.inset-0.z-\[9000\] {
        padding-top: var(--safe-area-top);
        padding-bottom: var(--safe-area-bottom);
    }
}
</style>
