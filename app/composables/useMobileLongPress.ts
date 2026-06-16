/**
 * 移动端长按手势检测 composable。
 *
 * 用法：将返回的 handlers 绑定到目标元素上（v-bind），
 * 长按 >= delay 毫秒且手指移动不超过 threshold 像素时触发 callback。
 *
 * @example
 * ```vue
 * <div v-for="item in items" v-bind="longPress(() => handleItem(item))">
 * ```
 */
import { onBeforeUnmount } from "vue";

interface LongPressOptions {
    /** 长按触发时间（毫秒），默认 500 */
    delay?: number;
    /** 最大移动容差（像素），超过则取消，默认 10 */
    threshold?: number;
}

export function useMobileLongPress(
    callback: () => void,
    options: LongPressOptions = {},
): {
    onTouchstart: (event: TouchEvent) => void;
    onTouchmove: (event: TouchEvent) => void;
    onTouchend: (event: TouchEvent) => void;
    onTouchcancel: (event: TouchEvent) => void;
    /** 取消当前计时器 */
    cancel: () => void;
} {
    const { delay = 500, threshold = 10 } = options;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let startX = 0;
    let startY = 0;
    let triggered = false;

    function clear(): void {
        if (timer !== null) {
            clearTimeout(timer);
            timer = null;
        }
    }

    function onTouchstart(event: TouchEvent): void {
        if (event.touches.length !== 1) return; // 多指触摸忽略
        const touch = event.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        triggered = false;

        clear();
        timer = setTimeout(() => {
            triggered = true;
            callback();
        }, delay);
    }

    function onTouchmove(event: TouchEvent): void {
        if (timer === null) return;
        const touch = event.touches[0];
        const dx = Math.abs(touch.clientX - startX);
        const dy = Math.abs(touch.clientY - startY);
        if (dx > threshold || dy > threshold) {
            clear();
        }
    }

    function onTouchend(_event: TouchEvent): void {
        clear();
        // 阻止长按后的 click 冒泡（避免触发 selectNode）
        if (triggered && _event.cancelable) {
            _event.preventDefault();
        }
    }

    function onTouchcancel(_event: TouchEvent): void {
        clear();
    }

    onBeforeUnmount(() => clear());

    return {
        onTouchstart,
        onTouchmove,
        onTouchend,
        onTouchcancel,
        cancel: clear,
    };
}
