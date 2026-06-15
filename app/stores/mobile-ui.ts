// app/stores/mobile-ui.ts
import { defineStore } from "pinia";

export type MobileTab = "chat" | "editor" | "files";

/**
 * 移动端 UI 状态 store。
 * 管理底部标签栏的激活 tab 及移动端特有 UI 状态。
 */
export const useMobileUiStore = defineStore("mobile-ui", () => {
    /** 当前激活的底部标签 */
    const activeTab = ref<MobileTab>("chat");

    /** 文件浏览器中当前展开预览的文件路径，null 表示未展开 */
    const previewFilePath = ref<string | null>(null);

    /** 编辑器当前打开的文件路径 */
    const editorFilePath = ref<string | null>(null);

    /** 切换底部标签 */
    function setActiveTab(tab: MobileTab): void {
        activeTab.value = tab;
    }

    /** 设置文件预览路径 */
    function setPreviewFilePath(path: string | null): void {
        previewFilePath.value = path;
    }

    /** 在编辑器标签中打开文件 */
    function openFileInEditor(path: string): void {
        editorFilePath.value = path;
        activeTab.value = "editor";
    }

    return {
        activeTab,
        previewFilePath,
        editorFilePath,
        setActiveTab,
        setPreviewFilePath,
        openFileInEditor,
    };
});
