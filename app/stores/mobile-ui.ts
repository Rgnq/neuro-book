// app/stores/mobile-ui.ts
import { defineStore } from "pinia";

/** 移动端底部标签页类型 */
export type MobileTab = "chat" | "story" | "editor" | "files";

/**
 * 移动端 UI 状态 store。
 * 管理底部标签栏的激活 tab、编辑器状态及剧情页状态。
 */
export const useMobileUiStore = defineStore("mobile-ui", () => {
    /** 当前激活的底部标签 */
    const activeTab = ref<MobileTab>("chat");

    /** 编辑器当前打开的文件路径 */
    const editorFilePath = ref<string | null>(null);

    /** 剧情页：当前查看的 tick ID（目录名，如 "001-arrival"） */
    const currentTickId = ref<string | null>(null);

    /** 剧情页：时间线侧栏是否可见 */
    const timelineVisible = ref(false);

    /** 切换底部标签 */
    function setActiveTab(tab: MobileTab): void {
        activeTab.value = tab;
    }

    /** 在编辑器标签中打开文件 */
    function openFileInEditor(path: string): void {
        editorFilePath.value = path;
        activeTab.value = "editor";
    }

    /** 在剧情页中打开指定 tick */
    function openTick(tickId: string): void {
        currentTickId.value = tickId;
        activeTab.value = "story";
    }

    /** 展开/折叠时间线侧栏 */
    function toggleTimeline(): void {
        timelineVisible.value = !timelineVisible.value;
    }

    /** 设置时间线侧栏可见性 */
    function setTimelineVisible(visible: boolean): void {
        timelineVisible.value = visible;
    }

    return {
        activeTab,
        editorFilePath,
        currentTickId,
        timelineVisible,
        setActiveTab,
        openFileInEditor,
        openTick,
        toggleTimeline,
        setTimelineVisible,
    };
});
