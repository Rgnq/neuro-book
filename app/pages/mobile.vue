<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useNovelIdeStore } from "nbook/app/stores/novel-ide";
import { useMobileUiStore, type MobileTab } from "nbook/app/stores/mobile-ui";
import { useMobileDetect } from "nbook/app/composables/useMobileDetect";
import { useIdeTheme } from "nbook/app/composables/useIdeTheme";
import { useAuthSessionState } from "nbook/app/composables/useAuthSessionState";
import MobileHeader from "nbook/app/components/mobile/MobileHeader.vue";
import MobileTabBar from "nbook/app/components/mobile/MobileTabBar.vue";
import MobileEditorToolbar from "nbook/app/components/mobile/MobileEditorToolbar.vue";
import MobileFileBrowser from "nbook/app/components/mobile/MobileFileBrowser.vue";
import AgentChatSurface from "nbook/app/components/novel-ide/agent/AgentChatSurface.vue";
import TipTapMarkdownEditor from "nbook/app/components/markdown-studio/TipTapMarkdownEditor.vue";
import Dialog from "nbook/app/components/common/Dialog.vue";
import type { MarkdownFormatCommand, MarkdownStudioEditorHandle } from "nbook/app/composables/useMarkdownStudioController";
import type { DropdownItem } from "nbook/app/components/common/dropdown.types";
import type { AuthSessionDto } from "nbook/shared/dto/auth.dto";
import MobileSettingsDialog from "nbook/app/components/mobile/MobileSettingsDialog.vue";

const novelIdeStore = useNovelIdeStore();
const mobileUi = useMobileUiStore();
const { isMobile } = useMobileDetect();

const {
    currentNovelId,
    currentNovel,
    novels,
    selectedFileContent,
    selectedFilePath,
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

// ---------- 初始化 ----------
onMounted(async () => {
    if (!import.meta.client) return;

    if (!isMobile.value) {
        await navigateTo("/");
        return;
    }

    mountThemeHost(themeHostRef.value!);
    void syncAuthSession();
    await novelIdeStore.initializeWorkspace();
});

onBeforeUnmount(() => {
    // MVP 基础清理：后续迭代完善
});

// ---------- 小说切换 ----------
const novelItems = computed<DropdownItem[]>(() =>
    novels.value.map((novel) => ({
        label: novel.title,
        value: novel.id,
        active: novel.id === currentNovelId.value,
    }))
);

const novelTitle = computed(() => currentNovel.value?.title ?? "");

async function handleSwitchNovel(novelId: string): Promise<void> {
    await novelIdeStore.switchNovel(novelId);
}

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
/** 用户编辑后的内容先写到 store buffer，后续通过 store 保存 */
function handleEditorChange(value: string): void {
    selectedFileContent.value = value;
}

/** 格式工具栏 — 转发命令到 TipTapMarkdownEditor */
function handleFormat(command: MarkdownFormatCommand): void {
    editorRef.value?.applyMarkdownFormat?.(command);
}

/** 文件浏览器点击"在编辑器中打开" */
async function handleOpenEditor(path: string): Promise<void> {
    // 加载文件内容到 store
    await novelIdeStore.selectWorkspacePath(path);
    mobileUi.openFileInEditor(path);
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
            <!-- 聊天 Tab -->
            <div v-show="mobileUi.activeTab === 'chat'" class="flex h-full flex-col">
                <AgentChatSurface
                    ref="agentSurfaceRef"
                    :active="true"
                    layout="mobile"
                    :novel-id="currentNovelId"
                    :selected-file-path="selectedFilePath"
                />
            </div>

            <!-- 编辑 Tab -->
            <div v-show="mobileUi.activeTab === 'editor'" class="flex h-full flex-col">
                <MobileEditorToolbar @format="handleFormat" />
                <div class="flex-1 overflow-hidden">
                    <div v-if="!selectedFilePath" class="flex h-full items-center justify-center text-[var(--text-muted)] text-[13px]">
                        从「文件」标签页选择文件开始编辑
                    </div>
                    <div v-else class="h-full overflow-y-auto">
                        <TipTapMarkdownEditor
                            ref="editorRef"
                            :key="selectedFilePath"
                            :initial-value="selectedFileContent"
                            :visible="true"
                            :readonly="false"
                            :active-path="selectedFilePath"
                            placeholder="开始写作..."
                            @change="handleEditorChange"
                        />
                    </div>
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

        <!-- 小说选择弹窗 -->
        <Dialog
            v-model="novelDialogOpen"
            title="选择小说"
            size="mobile-fullscreen"
            :show-footer="false"
        >
            <div class="flex flex-col gap-0.5">
                <button
                    v-for="item in novelItems"
                    :key="item.value"
                    type="button"
                    class="flex items-center gap-2 rounded-md px-3 py-2.5 text-left text-[13px] transition-colors active:bg-[var(--bg-hover)]"
                    :class="item.active ? 'text-[var(--accent-main)] font-medium' : 'text-[var(--text-main)]'"
                    @click="handleSwitchNovel(item.value); novelDialogOpen = false"
                >
                    <span class="i-lucide-book-open h-4 w-4 shrink-0 text-[var(--text-muted)]"></span>
                    <span class="min-w-0 truncate font-serif italic">{{ item.label }}</span>
                    <span v-if="item.active" class="i-lucide-check h-4 w-4 shrink-0 ml-auto text-[var(--accent-main)]"></span>
                </button>
            </div>
        </Dialog>

        <!-- 设置弹窗 -->
        <MobileSettingsDialog v-model="settingsDialogOpen" />
    </div>

    <!-- 非移动端占位 -->
    <div v-show="!isMobile" class="flex h-screen items-center justify-center bg-[var(--bg-main)] text-[var(--text-muted)] text-[14px]">
        请在移动设备上访问此页面
    </div>
</template>
