/**
 * Neuro Book 移动端 Service Worker。
 *
 * 策略：Network-first（网络优先），API 请求透传不缓存。
 * 仅提供基本的 PWA 安装能力和离线兜底显示。
 *
 * 注意：Service Worker 是纯 JavaScript，不支持 TypeScript 类型注解。
 */

self.addEventListener("install", function () {
    self.skipWaiting();
});

self.addEventListener("activate", function (event) {
    event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", function (event) {
    // GET 静态资源：Network-first
    if (event.request.method === "GET") {
        event.respondWith(networkFirst(event.request));
    }
    // POST/PUT/DELETE 等：直接走网络，不做拦截
});

/**
 * 网络优先：尝试网络请求，失败时返回缓存的副本。
 */
async function networkFirst(request) {
    try {
        const response = await fetch(request);
        // 缓存成功的 GET 响应（仅静态资源）
        if (response.ok && isStaticAsset(request.url)) {
            const cache = await caches.open("neuro-book-v1");
            cache.put(request, response.clone());
        }
        return response;
    } catch (_err) {
        const cached = await caches.match(request);
        return cached || new Response("你当前离线", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
    }
}

/**
 * 判断请求是否为静态资源（JS/CSS/图片/字体/图标）。
 */
function isStaticAsset(url) {
    const path = new URL(url, self.location.origin).pathname;
    return /\.(?:js|mjs|cjs|css|png|jpe?g|gif|svg|webp|woff2?|ttf|otf|ico|json)$/.test(path);
}
