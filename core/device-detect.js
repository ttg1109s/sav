/**
 * core/device-detect.js — nhận diện thiết bị: loại (điện thoại / máy tính bảng / máy tính…), hãng + model, hệ điều hành +
 * phiên bản, trình duyệt + phiên bản, engine, CPU. Workflow: event/workflow/device-info.js (chạy 1 lần lúc boot, lưu
 * `deviceInfo`, không hiện UI).
 *
 * Thư viện: ua-parser-js 2.0.10 (CDN, global `UAParser`, license AGPL-3.0). Chọn bản 2.x vì:
 *   - `withClientHints()` đọc `navigator.userAgentData.getHighEntropyValues()` — Chrome đã rút gọn UA thành
 *     `Android 10; K` / `Windows NT 10.0`, chỉ client hints mới ra model Android thật và Windows 11. Cần HTTPS
 *     (file:// không có), Safari/Firefox không hỗ trợ -> trả kết quả theo UA.
 *   - `withFeatureCheck()` nhận đúng iPad (iPadOS gửi UA giống Mac) qua `navigator.standalone` + `maxTouchPoints`.
 *   - Tự sửa phiên bản iOS 26+ (Safari 26 đóng băng OS trong UA ở 18_6, lấy lại từ `Version/26…`).
 * iPhone không bao giờ lộ model (chỉ "iPhone").
 *
 * NẠP SAU: CDN ua-parser-js (index.html). Không đọc appState/DB.
 */

/** Nhãn loại thiết bị cho dòng log boot (ua-parser-js `device.type`; không có = máy tính). */
const DEVICE_TYPE_LOG_LABEL = {
    mobile: 'Điện thoại',
    tablet: 'Máy tính bảng',
    desktop: 'Máy tính',
    smarttv: 'TV',
    wearable: 'Thiết bị đeo',
    xr: 'Kính XR',
    console: 'Máy chơi game',
    embedded: 'Thiết bị nhúng',
};

/**
 * Rule 3d — wrapper ua-parser-js, ĐÃ audit chính thức (Giang chỉ định 21/10/2026): cô lập thư viện để sau này đổi
 * (Bowser, bản PRO…) chỉ viết lại thân hàm này, Workflow giữ nguyên. Thư viện tự đọc thêm `navigator.userAgentData`/
 * `standalone`/`maxTouchPoints` của chính trình duyệt (client hints + feature check) — phần đó thuộc thư viện.
 * @param {string} userAgent - `navigator.userAgent` (Workflow đọc)
 * @returns {Promise<Object|null>} kết quả `getResult()` đã qua client hints + feature check
 *          ({browser, os, device, engine, cpu}); `null` = thư viện chưa nạp (CDN lỗi/offline)
 */
async function detectDeviceWithUaParser(userAgent) {
    if (typeof UAParser !== 'function') return null; // guard: CDN chưa nạp
    // Chrome: Promise (đọc high-entropy hints); trình duyệt không có client hints: trả thẳng kết quả — await nhận cả 2.
    const withHints = await UAParser(userAgent).withClientHints();
    return withHints.withFeatureCheck();
}

/**
 * Rút kết quả thư viện về object phẳng lưu ở `deviceInfo` (field thiếu = chuỗi rỗng; `device.type` trống = 'desktop').
 * iPad gửi UA giống Mac: feature check đã sửa device thành iPad nhưng OS vẫn "macOS 10.15.7" (số đóng băng) -> đổi thành
 * iPadOS, phiên bản lấy theo Safari (`Version/x` = iPadOS x); trình duyệt khác không có số -> trống.
 * @param {{browser: Object, os: Object, device: Object, engine: Object, cpu: Object}} result - detectDeviceWithUaParser()
 * @returns {{deviceType: string, vendor: string, model: string, osName: string, osVersion: string, browserName: string,
 *            browserVersion: string, engineName: string, engineVersion: string, cpuArchitecture: string}}
 */
function summarizeDeviceInfo(result) {
    const { browser = {}, os = {}, device = {}, engine = {}, cpu = {} } = result;
    const isIpadWithMacUa = device.model === 'iPad' && os.name === 'macOS';
    const ipadOsVersion = browser.name === 'Safari' ? browser.version || '' : '';
    return {
        deviceType: device.type || 'desktop',
        vendor: device.vendor || '',
        model: device.model || '',
        // Chọn giá trị theo chính dữ liệu đầu vào (tiêu chí A/C), không đổi cách tính.
        osName: isIpadWithMacUa ? 'iPadOS' : os.name || '',
        osVersion: isIpadWithMacUa ? ipadOsVersion : os.version || '',
        browserName: browser.name || '',
        browserVersion: browser.version || '',
        engineName: engine.name || '',
        engineVersion: engine.version || '',
        cpuArchitecture: cpu.architecture || '',
    };
}

/**
 * 1 dòng mô tả thiết bị cho log boot, vd "Điện thoại · Apple iPhone · iOS 26.0 · Mobile Safari 26.0 · WebKit 605.1.15".
 * Phần trống bị bỏ. @param {ReturnType<typeof summarizeDeviceInfo>} info @returns {string}
 */
function formatDeviceInfoLog(info) {
    return [
        DEVICE_TYPE_LOG_LABEL[info.deviceType] || info.deviceType,
        `${info.vendor} ${info.model}`.trim(),
        `${info.osName} ${info.osVersion}`.trim(),
        `${info.browserName} ${info.browserVersion}`.trim(),
        `${info.engineName} ${info.engineVersion}`.trim(),
        info.cpuArchitecture,
    ].filter(Boolean).join(' · ');
}
