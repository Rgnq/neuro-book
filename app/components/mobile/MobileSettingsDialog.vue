<!-- app/components/mobile/MobileSettingsDialog.vue -->
<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useNovelIdeStore } from "nbook/app/stores/novel-ide";
import { useMobileUiStore } from "nbook/app/stores/mobile-ui";
import type { SelectOption } from "nbook/app/components/common/form/FormSelect.vue";
import Dialog from "nbook/app/components/common/Dialog.vue";
import FormSelect from "nbook/app/components/common/form/FormSelect.vue";
import NovelIdeModelSettingsPanel from "nbook/app/components/novel-ide/settings/NovelIdeModelSettingsPanel.vue";
import NovelIdeEmbeddingSettingsPanel from "nbook/app/components/novel-ide/settings/NovelIdeEmbeddingSettingsPanel.vue";
import NovelIdeCostSettingsPanel from "nbook/app/components/novel-ide/settings/NovelIdeCostSettingsPanel.vue";
import NovelIdeWebSettingsPanel from "nbook/app/components/novel-ide/settings/NovelIdeWebSettingsPanel.vue";
import NovelIdeAgentProfileDefaultSettingsPanel from "nbook/app/components/novel-ide/settings/NovelIdeAgentProfileDefaultSettingsPanel.vue";
import NovelIdeAgentProfileModelSettingsPanel from "nbook/app/components/novel-ide/settings/NovelIdeAgentProfileModelSettingsPanel.vue";

type SettingsSection = "frontend" | "editor" | "models" | "embedding" | "cost" | "web-tools" | "agent-profile-defaults" | "agent-profile-models";
type SettingsScope = "global" | "project" | "browser";

const props = defineProps<{
    modelValue: boolean;
}>();

const emit = defineEmits<{
    (e: "update:modelValue", value: boolean): void;
}>();

const novelIdeStore = useNovelIdeStore();
const mobileUi = useMobileUiStore();
const {
    theme,
    viewMode,
    promptExpanded,
    selectedReasoning,
    markdownEditorPreferences,
    monacoEditorPreferences,
} = storeToRefs(novelIdeStore);
const { showStatusPanel } = storeToRefs(mobileUi);

const activeSection = ref<SettingsSection | null>(null);
const activeScope = ref<SettingsScope>("global");

const menuItems: Array<{ value: SettingsSection; label: string; description: string; iconClass: string }> = [
    { value: "frontend", label: "前端设定", description: "本地 UI 偏好，即改即生效", iconClass: "i-lucide-monitor-cog" },
    { value: "editor", label: "编辑器", description: "Markdown 富文本显示偏好", iconClass: "i-lucide-type" },
    { value: "models", label: "模型设置", description: "管理 Provider、Model 与默认模型", iconClass: "i-lucide-cpu" },
    { value: "embedding", label: "Embedding", description: "配置 RAG 使用的嵌入服务", iconClass: "i-lucide-binary" },
    { value: "cost", label: "费用显示", description: "设置 Agent 费用展示币种和汇率", iconClass: "i-lucide-circle-dollar-sign" },
    { value: "web-tools", label: "Web 工具", description: "配置 Agent 联网搜索与抓取", iconClass: "i-lucide-search-code" },
    { value: "agent-profile-defaults", label: "默认 Profile", description: "当前 workspace 新线程默认 Profile", iconClass: "i-lucide-route" },
    { value: "agent-profile-models", label: "Agent Profile 模型", description: "各 Profile 默认模型参数", iconClass: "i-lucide-bot-message-square" },
];

const scopeOptions: Array<{ value: SettingsScope; label: string }> = [
    { value: "global", label: "全局" },
    { value: "project", label: "项目" },
    { value: "browser", label: "浏览器" },
];

const browserSections: SettingsSection[] = ["frontend", "editor"];
const configSections: SettingsSection[] = ["models", "embedding", "cost", "web-tools", "agent-profile-defaults", "agent-profile-models"];

const visibleMenuItems = computed(() => {
    if (activeScope.value === "browser") {
        return menuItems.filter((item) => browserSections.includes(item.value));
    }
    return menuItems.filter((item) => configSections.includes(item.value));
});

const targetQuery = computed(() => {
    if (activeScope.value === "project" && novelIdeStore.currentNovelId) {
        return { workspaceKind: "novel" as const, projectPath: novelIdeStore.currentNovelId };
    }
    return { workspaceKind: "user-assets" as const };
});

const targetLabel = computed(() => {
    if (activeScope.value === "project") {
        return novelIdeStore.currentNovel?.title || novelIdeStore.currentNovelId || "Project";
    }
    return "Workspace Root";
});

const settingsPanelKey = computed(() =>
    `${activeScope.value}:${targetQuery.value.workspaceKind}:${targetQuery.value.projectPath ?? "global"}`
);

function enterSection(section: SettingsSection): void {
    activeSection.value = section;
}

function backToMenu(): void {
    activeSection.value = null;
}

function close(): void {
    activeSection.value = null;
    emit("update:modelValue", false);
}

// ---- 版本信息 ----
type AppVersionKind = "release" | "tag" | "commit" | "package";
interface AppVersionDto { versionLabel: string; versionKind: AppVersionKind; githubUrl: string; }

const appVersion = ref<AppVersionDto | null>(null);
const appVersionPending = ref(false);

const versionLabel = computed(() => {
    if (appVersionPending.value && !appVersion.value) return "读取版本中";
    if (!appVersion.value) return "版本信息不可用";
    if (appVersion.value.versionKind === "commit") return `Commit ${appVersion.value.versionLabel}`;
    if (appVersion.value.versionKind === "release") return `Release ${appVersion.value.versionLabel}`;
    return `版本 ${appVersion.value.versionLabel}`;
});

async function fetchVersion(): Promise<void> {
    if (appVersion.value || appVersionPending.value) return;
    appVersionPending.value = true;
    try {
        appVersion.value = await $fetch<AppVersionDto>("/api/app/version");
    } catch {
        appVersion.value = null;
    } finally {
        appVersionPending.value = false;
    }
}

watch(() => props.modelValue, (open) => {
    if (open) fetchVersion();
});

// ---- frontend inline ----
const themeOptions: SelectOption[] = [
    { value: "sepia", label: "Sepia" },
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "catppuccin", label: "Catppuccin" },
    { value: "dracula", label: "Dracula" },
    { value: "monokai", label: "Monokai" },
    { value: "one-dark-pro", label: "One Dark Pro" },
    { value: "tokyo-night", label: "Tokyo Night" },
];

const viewModeOptions: SelectOption[] = [
    { value: "rich", label: "富文本" },
    { value: "source", label: "源码" },
];

const promptExpandedOptions: SelectOption[] = [
    { value: "expanded", label: "默认展开" },
    { value: "collapsed", label: "默认收起" },
];

const promptExpandedValue = computed({
    get: (): string => promptExpanded.value ? "expanded" : "collapsed",
    set: (value: string): void => {
        novelIdeStore.promptExpanded = value === "expanded";
    },
});

function updateTheme(value: string): void {
    novelIdeStore.theme = value as typeof novelIdeStore.theme;
}

function updateViewMode(value: string): void {
    novelIdeStore.viewMode = value as typeof novelIdeStore.viewMode;
}

/** 从 input change 事件中提取数字值，解析失败时返回 fallback */
function extractNumberFromEvent(event: Event, fallback: number): number {
    const value = (event.target as HTMLInputElement).value;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? fallback : parsed;
}

// ---- editor inline ----
const editorFontOptions: SelectOption[] = [
    { value: "\"Source Han Serif SC\", \"Noto Serif SC\", \"Songti SC\", serif", label: "中文衬线" },
    { value: "\"Microsoft YaHei\", \"Noto Sans SC\", sans-serif", label: "中文黑体" },
    { value: "\"LXGW WenKai\", \"KaiTi\", \"STKaiti\", serif", label: "中文楷体" },
    { value: "ui-sans-serif, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif", label: "系统无衬线" },
    { value: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", label: "等宽字体" },
];

const monacoFontOptions: SelectOption[] = [
    { value: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace", label: "系统等宽" },
    { value: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", label: "JetBrains Mono" },
    { value: "Cascadia Code, Consolas, ui-monospace, monospace", label: "Cascadia Code" },
    { value: "Fira Code, ui-monospace, Menlo, Monaco, Consolas, monospace", label: "Fira Code" },
];
</script>

<template>
    <Dialog
        :model-value="props.modelValue"
        width="100vw"
        height="100vh"
        max-height="100vh"
        :show-footer="false"
        :show-header="false"
        @update:model-value="close()"
    >
        <div class="flex h-full flex-col bg-[var(--bg-panel)]">
            <!-- 顶栏 -->
            <div
                class="flex shrink-0 items-center gap-2 border-b border-[var(--border-color)] px-3"
                style="padding-top: calc(var(--safe-area-top) + 4px); min-height: calc(44px + var(--safe-area-top))"
            >
                <button
                    v-if="activeSection !== null"
                    type="button"
                    class="flex items-center justify-center rounded-md p-1 shrink-0 transition-colors active:bg-[var(--bg-hover)]"
                    @click="backToMenu"
                >
                    <span class="i-lucide-arrow-left h-4 w-4 text-[var(--text-muted)]"></span>
                </button>
                <span class="text-[13px] font-semibold text-[var(--text-main)]">
                    {{ activeSection ? menuItems.find(m => m.value === activeSection)?.label : "设置" }}
                </span>
                <button
                    type="button"
                    class="flex items-center justify-center rounded-md p-1 shrink-0 ml-auto transition-colors active:bg-[var(--bg-hover)]"
                    @click="close"
                >
                    <span class="i-lucide-x h-4 w-4 text-[var(--text-muted)]"></span>
                </button>
            </div>

            <!-- Scope 切换 -->
            <div v-if="activeSection === null" class="flex shrink-0 gap-1 border-b border-[var(--border-color)] px-3 py-2">
                <button
                    v-for="scope in scopeOptions"
                    :key="scope.value"
                    type="button"
                    class="flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors"
                    :class="activeScope === scope.value
                        ? 'bg-[var(--accent-bg)] text-[var(--accent-main)]'
                        : 'text-[var(--text-muted)] active:bg-[var(--bg-hover)]'"
                    @click="activeScope = scope.value"
                >
                    {{ scope.label }}
                </button>
            </div>

            <!-- 主菜单 -->
            <div v-if="activeSection === null" class="flex-1 overflow-y-auto">
                <div class="flex flex-col">
                    <button
                        v-for="item in visibleMenuItems"
                        :key="item.value"
                        type="button"
                        class="flex items-center gap-3 border-b border-[var(--border-color)]/50 px-4 py-3.5 text-left transition-colors active:bg-[var(--bg-hover)]"
                        @click="enterSection(item.value)"
                    >
                        <span :class="item.iconClass" class="h-4.5 w-4.5 shrink-0 text-[var(--text-muted)]"></span>
                        <div class="min-w-0 flex-1">
                            <div class="text-[13px] font-medium text-[var(--text-main)]">{{ item.label }}</div>
                            <div class="mt-0.5 text-[11px] text-[var(--text-muted)]">{{ item.description }}</div>
                        </div>
                        <span class="i-lucide-chevron-right h-4 w-4 shrink-0 text-[var(--text-muted)]"></span>
                    </button>
                </div>

                <!-- 底部版本信息 -->
                <div class="mt-4 px-4 pb-4">
                    <div class="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-color)]/60 bg-[var(--bg-input)]/15 px-3.5 py-3">
                        <div class="min-w-0">
                            <div class="truncate text-[11px] font-medium text-[var(--text-secondary)]">{{ versionLabel }}</div>
                            <div class="mt-0.5 text-[10px] text-[var(--text-muted)]">Neuro Book</div>
                        </div>
                        <a
                            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-color)]/60 text-[var(--text-secondary)] active:bg-[var(--bg-hover)] active:text-[var(--text-main)]"
                            :href="appVersion?.githubUrl || 'https://github.com/notnotype/neuro-book'"
                            target="_blank"
                            rel="noreferrer"
                            title="GitHub"
                        >
                            <span class="i-lucide-github h-4 w-4"></span>
                        </a>
                    </div>
                </div>
            </div>

            <!-- 子面板 -->
            <div v-else class="flex-1 overflow-y-auto">
                <!-- frontend -->
                <div v-if="activeSection === 'frontend'" class="flex flex-col gap-2 p-3">
                    <div class="flex items-center justify-between rounded-lg border border-[var(--border-color)] px-3 py-2.5">
                        <span class="text-[12px] text-[var(--text-main)]">IDE 主题</span>
                        <FormSelect :model-value="theme" :options="themeOptions" class="w-32" @update:model-value="updateTheme" />
                    </div>
                    <div class="flex items-center justify-between rounded-lg border border-[var(--border-color)] px-3 py-2.5">
                        <span class="text-[12px] text-[var(--text-main)]">推理强度</span>
                        <FormSelect
                            :model-value="selectedReasoning"
                            :options="novelIdeStore.reasoningOptions.map((item: string) => ({ value: item, label: item }))"
                            class="w-32"
                            @update:model-value="novelIdeStore.selectedReasoning = $event"
                        />
                    </div>
                    <div class="flex items-center justify-between rounded-lg border border-[var(--border-color)] px-3 py-2.5">
                        <span class="text-[12px] text-[var(--text-main)]">默认视图</span>
                        <FormSelect :model-value="viewMode" :options="viewModeOptions" class="w-32" @update:model-value="updateViewMode" />
                    </div>
                    <div class="flex items-center justify-between rounded-lg border border-[var(--border-color)] px-3 py-2.5">
                        <span class="text-[12px] text-[var(--text-main)]">Prompt Bar</span>
                        <FormSelect :model-value="promptExpandedValue" :options="promptExpandedOptions" class="w-32" @update:model-value="promptExpandedValue = $event" />
                    </div>
                    <!-- 剧情状态栏开关 -->
                    <div class="rounded-lg border border-[var(--border-color)] px-3 py-2.5">
                        <div class="flex items-center justify-between">
                            <label class="flex min-w-0 flex-1 items-center gap-2" for="toggle-status-panel">
                                <span class="text-[12px] text-[var(--text-main)]">显示剧情状态栏</span>
                            </label>
                            <button
                                id="toggle-status-panel"
                                type="button"
                                role="switch"
                                :aria-checked="showStatusPanel"
                                class="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors"
                                :class="showStatusPanel ? 'bg-[var(--accent-main)]' : 'bg-[var(--border-color)]'"
                                @click="showStatusPanel = !showStatusPanel"
                            >
                                <span
                                    class="inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform"
                                    :class="showStatusPanel ? 'translate-x-[18px]' : 'translate-x-[3px]'"
                                />
                            </button>
                        </div>
                        <div class="mt-1.5 text-[10px] leading-relaxed text-[var(--text-muted)]">
                            模板目录：simulation/runs/status-panels/<br>
                            数据文件：simulation/runs/ticks/&#123;id&#125;-&#123;slug&#125;/status-data.json<br>
                            模板使用 <code v-pre>{{key}}</code> 占位，data 字段提供值。缺少模板或数据时静默跳过。
                        </div>
                    </div>
                </div>

                <!-- editor -->
                <div v-else-if="activeSection === 'editor'" class="flex flex-col gap-2 p-3">
                    <div class="flex items-center justify-between rounded-lg border border-[var(--border-color)] px-3 py-2.5">
                        <span class="text-[12px] text-[var(--text-main)]">正文字体</span>
                        <FormSelect :model-value="markdownEditorPreferences.fontFamily" :options="editorFontOptions" class="w-36" @update:model-value="markdownEditorPreferences.fontFamily = $event" />
                    </div>
                    <div class="flex items-center justify-between rounded-lg border border-[var(--border-color)] px-3 py-2.5">
                        <span class="text-[12px] text-[var(--text-main)]">字号</span>
                        <input type="number" :value="markdownEditorPreferences.fontSize" class="w-16 rounded border border-[var(--border-color)] bg-[var(--bg-input)] px-2 py-1 text-right text-[12px]" min="12" max="24" @change="markdownEditorPreferences.fontSize = extractNumberFromEvent($event, 16)" />
                    </div>
                    <div class="border-t border-[var(--border-color)] pt-2 mt-2">
                        <div class="text-[11px] text-[var(--text-muted)] mb-2">Monaco 源码编辑器</div>
                        <div class="flex items-center justify-between rounded-lg border border-[var(--border-color)] px-3 py-2.5">
                            <span class="text-[12px] text-[var(--text-main)]">字体</span>
                            <FormSelect :model-value="monacoEditorPreferences.fontFamily" :options="monacoFontOptions" class="w-36" @update:model-value="monacoEditorPreferences.fontFamily = $event" />
                        </div>
                        <div class="flex items-center justify-between rounded-lg border border-[var(--border-color)] px-3 py-2.5 mt-2">
                            <span class="text-[12px] text-[var(--text-main)]">字号</span>
                            <input type="number" :value="monacoEditorPreferences.fontSize" class="w-16 rounded border border-[var(--border-color)] bg-[var(--bg-input)] px-2 py-1 text-right text-[12px]" min="10" max="24" @change="monacoEditorPreferences.fontSize = extractNumberFromEvent($event, 14)" />
                        </div>
                    </div>
                </div>

                <!-- 子面板组件 -->
                <div v-else :key="settingsPanelKey" class="p-3">
                    <NovelIdeModelSettingsPanel
                        v-if="activeSection === 'models'"
                        :scope="activeScope === 'browser' ? 'global' : activeScope"
                        :target-query="targetQuery"
                        :target-label="targetLabel"
                    />
                    <NovelIdeEmbeddingSettingsPanel
                        v-else-if="activeSection === 'embedding'"
                        :scope="activeScope === 'browser' ? 'global' : activeScope"
                        :target-query="targetQuery"
                        :target-label="targetLabel"
                    />
                    <NovelIdeCostSettingsPanel
                        v-else-if="activeSection === 'cost'"
                        :target-query="targetQuery"
                    />
                    <NovelIdeWebSettingsPanel
                        v-else-if="activeSection === 'web-tools'"
                        :target-query="targetQuery"
                        :target-label="targetLabel"
                    />
                    <NovelIdeAgentProfileDefaultSettingsPanel
                        v-else-if="activeSection === 'agent-profile-defaults'"
                        :scope="activeScope === 'browser' ? 'global' : activeScope"
                        :target-query="targetQuery"
                        :target-label="targetLabel"
                    />
                    <NovelIdeAgentProfileModelSettingsPanel
                        v-else-if="activeSection === 'agent-profile-models'"
                        :scope="activeScope === 'browser' ? 'global' : activeScope"
                        :target-query="targetQuery"
                        :target-label="targetLabel"
                    />
                </div>
            </div>
        </div>
    </Dialog>
</template>
