/**
 * PWA 客户端插件。
 *
 * 在浏览器环境注册 Service Worker，使移动端 PWA 可安装。
 * 仅在移动端页面加载时激活。
 */
export default defineNuxtPlugin({
    name: "pwa",
    async setup(): Promise<void> {
        if (!import.meta.client) return;

        // 仅在支持 SW 的浏览器注册
        if (!("serviceWorker" in navigator)) return;

        try {
            await navigator.serviceWorker.register("/sw.js", {
                scope: "/",
            });
        } catch (err) {
            console.warn("[PWA] Service Worker registration failed:", err);
        }
    },
});
