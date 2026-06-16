<!-- app/components/mobile/MobileStoryComposer.vue -->
<script setup lang="ts">
import { useAgentSessionApi } from "nbook/app/composables/useAgentSessionApi";
import { useNotification } from "nbook/app/composables/useNotification";

const props = defineProps<{
    /** 回调：获取当前 Agent 会话 ID（从聊天页 AgentChatSurface 读取） */
    getSessionId: () => number | null;
}>();

const agentApi = useAgentSessionApi();
const notification = useNotification();

const inputText = ref("");
const sending = ref(false);

/** 当前会话 ID（发送时实时获取） */
const sessionId = computed(() => props.getSessionId());

/** 发送消息 */
async function send(): Promise<void> {
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

/** 自动调整 textarea 高度 */
function autoResize(e: Event): void {
    const t = e.target as HTMLTextAreaElement;
    t.style.height = "auto";
    t.style.height = `${Math.min(t.scrollHeight, 100)}px`;
}
</script>

<template>
    <div class="flex items-end gap-2 px-3 py-2.5">
        <!-- 输入框 -->
        <div class="relative flex-1">
            <textarea
                v-model="inputText"
                :placeholder="sessionId !== null ? '输入消息推进剧情...' : '请先在聊天页创建 Agent 会话'"
                :disabled="sending"
                rows="1"
                class="w-full resize-none rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2.5 text-[13px] text-[var(--text-main)] placeholder:text-[var(--text-muted)] outline-none transition-colors focus:border-[var(--accent-main)] disabled:opacity-40"
                style="max-height: 100px;"
                @input="autoResize"
                @keydown.enter.exact.prevent="send()"
            />
            <!-- 发送按钮 -->
            <button
                v-if="inputText.trim() && !sending"
                type="button"
                class="absolute right-2 bottom-2.5 flex h-6 w-6 items-center justify-center rounded-md text-[var(--accent-main)] transition-colors active:bg-[var(--bg-hover)]"
                @click="send()"
            >
                <span class="i-lucide-send h-4 w-4" />
            </button>
            <span
                v-if="sending"
                class="absolute right-2 bottom-2.5 flex h-6 w-6 items-center justify-center"
            >
                <span class="i-lucide-loader-2 h-4 w-4 animate-spin text-[var(--text-muted)]" />
            </span>
        </div>
    </div>
</template>
