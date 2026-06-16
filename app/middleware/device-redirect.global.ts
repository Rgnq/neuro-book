// app/middleware/device-redirect.global.ts
import { checkMobileUA, checkMobileViewport } from "nbook/app/composables/useMobileDetect";

/**
 * 全局设备重定向中间件。
 *
 * - 移动设备访问 / → 重定向到 /mobile
 * - 桌面设备访问 /mobile → 重定向回 /
 * - 仅在客户端执行（SSR 禁用，无需额外判断）
 */
export default defineNuxtRouteMiddleware((to) => {
    if (typeof window === "undefined") return;

    const isMobile = checkMobileUA(navigator.userAgent) && checkMobileViewport(window.innerWidth);

    if (isMobile && to.path === "/") {
        return navigateTo("/mobile", { redirectCode: 302 });
    }

    if (!isMobile && to.path === "/mobile") {
        return navigateTo("/", { redirectCode: 302 });
    }
});
