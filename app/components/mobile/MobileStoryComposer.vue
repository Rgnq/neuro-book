<!-- app/components/mobile/MobileStoryComposer.vue -->
<script setup lang="ts">
import { storeToRefs } from "pinia";
import AgentComposerInput from "nbook/app/components/novel-ide/agent/AgentComposerInput.vue";
import { useStructuredReferenceMenu } from "nbook/app/composables/useStructuredReferenceMenu";
import { useAgentSessionApi } from "nbook/app/composables/useAgentSessionApi";
import { useNovelIdeStore } from "nbook/app/stores/novel-ide";
import { useNotification } from "nbook/app/composables/useNotification";

const props = defineProps<{
    /** 回调：获取当前 Agent 会话 ID */
    getSessionId: () => number | null;
    /** 回调：获取 Agent 是否正在运行 */
    isRunning: () => boolean;
}>();

const agentApi = useAgentSessionApi();
const notification = useNotification();

const inputText = ref("");
const sending = ref(false);
const aborting = ref(false);

/** 当前会话 ID（发送/停止时实时获取） */
const sessionId = computed(() => props.getSessionId());
const running = computed(() => props.isRunning());

// ---------- @引用 / $技能 / /命令 菜单 ----------
const ideStore = useNovelIdeStore();
const {
    selectedStoryThreadId,
    selectedStorySceneId,
    workspaceTree,
} = storeToRefs(ideStore);

const novelIdRef = computed(() => ideStore.currentNovelId);
const {
    resolveMenu,
    menuRefreshKey,
    refreshSkillCatalog,
} = useStructuredReferenceMenu({
    novelId: novelIdRef as Ref<string>,
    selectedStoryThreadId,
    selectedStorySceneId,
    workspaceTree,
});

// ---------- 发送 ----------
async function handleSubmit(): Promise<void> {
    const text = inputText.value.trim();
    const id = sessionId.value;
    if (!text) return;

    if (id === null) {
        notification.info("请先在聊天页创建或选择 Agent 会话", { title: "没有可用会话" });
        return;
    }

    sending.value = true;
    inputText.value = "";

    try {
        await agentApi.invokeSession(id, {
            mode: "prompt",
            message: { text },
        });
    } catch {
        notification.error("发送失败，请重试");
    } finally {
        sending.value = false;
    }
}

// ---------- 停止 ----------
async function handleStop(): Promise<void> {
    const id = sessionId.value;
    if (id === null) return;

    aborting.value = true;
    try {
        await agentApi.abortSession(id, {});
    } catch {
        notification.error("停止失败");
    } finally {
        aborting.value = false;
    }
}

/** 切换到聊天页 */
function goToChat(): void {
    const mobileUi = useMobileUiStore();
    mobileUi.setActiveTab("chat");
}
</script>

<template>
    <div class="flex flex-col gap-1.5 px-3 py-2">
        <!-- 输入行：输入框 + 操作按钮 -->
        <div class="flex items-end gap-2">
            <!-- AgentComposerInput：支持 @引用 / $技能 / /命令 -->
            <div class="min-w-0 flex-1">
                <AgentComposerInput
                    v-model="inputText"
                    :placeholder="sessionId !== null ? '输入消息推进剧情...' : '请先在聊天页创建会话'"
                    :menu-refresh-key="menuRefreshKey"
                    :resolve-menu="resolveMenu"
                    :on-skill-trigger-start="refreshSkillCatalog"
                    borderless
                    @submit="handleSubmit()"
                />
            </div>

            <!-- 发送 / 停止按钮 -->
            <div class="flex shrink-0 items-center gap-1">
                <!-- 停止按钮（运行中时显示） -->
                <button
                    v-if="running"
                    type="button"
                    class="flex h-8 w-8 items-center justify-center rounded-md border border-red-400 text-red-400 transition-colors active:bg-red-50 dark:active:bg-red-950"
                    :disabled="aborting"
                    title="停止生成"
                    @click="handleStop()"
                >
                    <span v-if="aborting" class="i-lucide-loader-2 h-4 w-4 animate-spin" />
                    <span v-else class="i-lucide-square h-3.5 w-3.5" />
                </button>

                <!-- 发送按钮 -->
                <button
                    v-if="!running && inputText.trim()"
                    type="button"
                    class="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--accent-main)] text-white transition-colors active:opacity-80"
                    :disabled="sending"
                    @click="handleSubmit()"
                >
                    <span v-if="sending" class="i-lucide-loader-2 h-4 w-4 animate-spin" />
                    <span v-else class="i-lucide-send h-4 w-4" />
                </button>
            </div>
        </div>

        <!-- 状态栏：会话信息 + 去聊天 -->
        <div class="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
            <span v-if="sessionId !== null">
                Agent 会话 #{{ sessionId }}
                <span v-if="running" class="ml-1 text-[var(--accent-main)]">● 运行中</span>
            </span>
            <span v-else>
                无活动会话
                <button type="button" class="ml-1 underline transition-colors hover:text-[var(--accent-main)]" @click="goToChat">
                    去聊天页创建
                </button>
            </span>
            <button
                v-if="sessionId !== null"
                type="button"
                class="flex items-center gap-0.5 transition-colors hover:text-[var(--accent-main)]"
                @click="goToChat"
            >
                <span class="i-lucide-message-circle h-3 w-3" />
                聊天
            </button>
        </div>
    </div>
</template>
