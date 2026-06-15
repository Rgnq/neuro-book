// app/middleware/device-redirect.global.ts
import { MOBILE_BREAKPOINT } from "nbook/app/composables/useMobileDetect";

/**
 * 全局设备重定向中间件。
 *
 * - 移动设备访问 / → 重定向到 /mobile
 * - 桌面设备访问 /mobile → 重定向回 /
 * - 仅在客户端执行（SSR 禁用，无需额外判断）
 */
export default defineNuxtRouteMiddleware((to) => {
    // 仅在客户端运行
    if (typeof window === "undefined") return;

    const ua = navigator.userAgent;
    const isMobileUA = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
    const isMobileWidth = window.innerWidth <= MOBILE_BREAKPOINT;
    const isMobile = isMobileUA && isMobileWidth;

    // 移动端访问根路径 → 重定向到 /mobile
    if (isMobile && to.path === "/") {
        return navigateTo("/mobile", { redirectCode: 302 });
    }

    // 桌面端访问移动端路径 → 重定向到 /
    if (!isMobile && to.path === "/mobile") {
        return navigateTo("/", { redirectCode: 302 });
    }
});
