import { checkMobileUA } from "nbook/app/composables/useMobileDetect";

/**
 * PWA 客户端插件。
 *
 * 仅在移动设备上注册 Service Worker，使 PWA 可安装。
 * 包含 Service Worker 更新检测：新版本就绪时通知客户端。
 */
export default defineNuxtPlugin({
    name: "pwa",
    async setup(): Promise<void> {
        if (!import.meta.client) return;
        if (!("serviceWorker" in navigator)) return;

        // 仅移动设备注册（桌面端无需 PWA）
        if (!checkMobileUA(navigator.userAgent)) return;

        try {
            const registration = await navigator.serviceWorker.register("/sw.js", {
                scope: "/",
            });

            // Service Worker 更新检测
            // updatefound: 检测到新的 SW 版本正在安装
            registration.addEventListener("updatefound", () => {
                const installing = registration.installing;
                if (!installing) return;

                installing.addEventListener("statechange", () => {
                    // 新 SW 安装完成但尚未激活（等待旧 SW 释放页面）
                    if (installing.state === "installed" && navigator.serviceWorker.controller) {
                        console.log(
                            "[PWA] 新版本已就绪。刷新页面以应用更新。",
                        );
                        // TODO: 未来可接入 useNotification() 通知用户刷新
                    }
                });
            });

            // 兜底：监听 SW 接管事件（旧页面被新 SW 接管时触发）
            navigator.serviceWorker.addEventListener("controllerchange", () => {
                console.log("[PWA] Service Worker 已更新，当前页面由新版本接管。");
            });
        } catch (err) {
            console.warn("[PWA] Service Worker registration failed:", err);
        }
    },
});
