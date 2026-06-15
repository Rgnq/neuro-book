<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useNovelIdeStore } from "nbook/app/stores/novel-ide";
import { useMobileUiStore, type MobileTab } from "nbook/app/stores/mobile-ui";
import { useMobileDetect } from "nbook/app/composables/useMobileDetect";
import { useIdeTheme } from "nbook/app/composables/useIdeTheme";
import { useAuthSessionState } from "nbook/app/composables/useAuthSessionState";
import { useMarkdownStudioController } from "nbook/app/composables/useMarkdownStudioController";
import MobileHeader from "nbook/app/components/mobile/MobileHeader.vue";
import MobileTabBar from "nbook/app/components/mobile/MobileTabBar.vue";
import MobileEditorToolbar from "nbook/app/components/mobile/MobileEditorToolbar.vue";
import MobileFileBrowser from "nbook/app/components/mobile/MobileFileBrowser.vue";
import AgentChatSurface from "nbook/app/components/novel-ide/agent/AgentChatSurface.vue";
import type { DropdownItem } from "nbook/app/components/common/dropdown.types";
import type { AuthSessionDto } from "nbook/shared/dto/auth.dto";

const novelIdeStore = useNovelIdeStore();
const mobileUi = useMobileUiStore();
const { isMobile } = useMobileDetect();

const {
    currentNovelId,
    currentNovel,
    novels,
    selectedFileContent,
    selectedFilePath,
    viewMode,
    theme,
} = storeToRefs(novelIdeStore);

const { mountThemeHost } = useIdeTheme(theme);
const authSessionState = useAuthSessionState();

const themeHostRef = ref<HTMLElement | null>(null);
const agentSurfaceRef = ref<InstanceType<typeof AgentChatSurface> | null>(null);
const currentUser = ref<AuthSessionDto["user"]>(null);

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
    if (!isMobile.value) {
        await navigateTo("/");
        return;
    }

    mountThemeHost(themeHostRef.value!);
    void syncAuthSession();
    await novelIdeStore.initializeWorkspace();
    await novelIdeStore.loadWorkspaceTree();
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

// ---------- 编辑器 ----------
const studio = useMarkdownStudioController({
    markdown: selectedFileContent,
    viewMode,
});

/** 处理格式工具栏事件 — MVP 阶段为简化实现，后续迭代接入 TipTap */
function handleFormat(kind: "bold" | "italic" | "h1" | "h2" | "h3" | "bullet" | "ordered" | "link" | "comment"): void {
    // MVP: 格式操作通过 TipTapMarkdownEditor 的 editor chain 执行
    // 后续迭代完善
    void kind;
    void studio;
}

/** 文件浏览器点击"在编辑器中打开" */
function handleOpenEditor(path: string): void {
    mobileUi.openFileInEditor(path);
}
</script>

<template>
    <!-- 移动端页面根容器 -->
    <div
        v-if="isMobile"
        ref="themeHostRef"
        class="novel-ide-theme mobile-ide-page flex h-[100dvh] flex-col overflow-hidden bg-[var(--bg-main)] text-[var(--text-main)] transition-colors duration-300"
    >
        <!-- 顶栏 -->
        <MobileHeader
            :novel-items="novelItems"
            :novel-title="novelTitle"
            :sessions="[]"
            :active-session-id="null"
            :loading-session="false"
            @switch-novel="handleSwitchNovel"
        />

        <!-- Tab 内容区 — KeepAlive 保持各 Tab 状态 -->
        <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
            <KeepAlive>
                <!-- 聊天 Tab -->
                <div v-if="mobileUi.activeTab === 'chat'" key="chat" class="flex h-full flex-col">
                    <AgentChatSurface
                        ref="agentSurfaceRef"
                        :active="true"
                        layout="mobile"
                        :novel-id="currentNovelId"
                        :selected-file-path="selectedFilePath"
                    />
                </div>

                <!-- 编辑 Tab -->
                <div v-else-if="mobileUi.activeTab === 'editor'" key="editor" class="flex h-full flex-col">
                    <MobileEditorToolbar @format="handleFormat" />
                    <div class="flex-1 overflow-y-auto px-4 py-3">
                        <div v-if="!selectedFilePath" class="flex h-full items-center justify-center text-[var(--text-muted)] text-[13px]">
                            从「文件」标签页选择文件开始编辑
                        </div>
                        <div v-else class="h-full">
                            <!-- MVP: 使用 pre 纯文本显示选中文件内容 -->
                            <pre class="whitespace-pre-wrap font-mono text-[12px] leading-relaxed">{{ selectedFileContent }}</pre>
                        </div>
                    </div>
                </div>

                <!-- 文件 Tab -->
                <div v-else-if="mobileUi.activeTab === 'files'" key="files" class="flex h-full flex-col">
                    <MobileFileBrowser @open-editor="handleOpenEditor" />
                </div>
            </KeepAlive>
        </div>

        <!-- 底部标签栏 -->
        <MobileTabBar
            :active-tab="mobileUi.activeTab"
            @select="mobileUi.setActiveTab"
        />
    </div>

    <!-- 非移动端占位 -->
    <div v-else class="flex h-screen items-center justify-center bg-[var(--bg-main)] text-[var(--text-muted)] text-[14px]">
        请在移动设备上访问此页面
    </div>
</template>
