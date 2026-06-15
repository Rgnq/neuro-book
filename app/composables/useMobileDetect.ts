import { ref, computed, onMounted, onUnmounted } from 'vue';

/** 移动端最大宽度断点（与 UnoCSS md 断点一致） */
export const MOBILE_BREAKPOINT = 768;

/**
 * 设备检测 composable。
 * 使用 UA 嗅探 + matchMedia + resize 事件，提供响应式的 isMobile 状态。
 */
export function useMobileDetect() {
    /** 是否为移动设备（UA 初判） */
    const isMobileUA = ref(false);

    /** 是否为移动视口宽度（matchMedia 实时检测） */
    const isMobileViewport = ref(false);

    /** 综合判断结果：UA 匹配 且 视口宽度 ≤ 768px */
    const isMobile = computed(() => isMobileUA.value && isMobileViewport.value);

    let mediaQuery: MediaQueryList | null = null;

    /** UA 嗅探：检测移动设备标识 */
    function detectUA(): boolean {
        if (typeof navigator === "undefined") return false;
        return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    }

    /** matchMedia change 事件处理函数（保存引用以便移除） */
    function onMediaChange(e: MediaQueryListEvent): void {
        isMobileViewport.value = e.matches;
    }

    /** 更新 matchMedia 状态 */
    function updateViewport(): void {
        isMobileViewport.value = window.innerWidth <= MOBILE_BREAKPOINT;
    }

    onMounted(() => {
        isMobileUA.value = detectUA();
        mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
        isMobileViewport.value = mediaQuery.matches;
        mediaQuery.addEventListener("change", onMediaChange);
        window.addEventListener("resize", updateViewport);
    });

    onUnmounted(() => {
        mediaQuery?.removeEventListener("change", onMediaChange);
        window.removeEventListener("resize", updateViewport);
    });

    return {
        isMobile,
        isMobileUA,
        isMobileViewport,
        MOBILE_BREAKPOINT,
    };
}
