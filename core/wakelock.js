/**
 * core/wakelock.js — Wake Lock (giữ màn hình sáng): API gốc `navigator.wakeLock`, NoSleep.js chỉ làm fallback cho máy KHÔNG
 * có API gốc. Điều phối (đọc config/state, chống xin chồng, lúc nào xin/nhả): event/workflow/wakelock.js.
 *
 * Lưu ý đã gặp: Wake Lock API từ chối mọi request khi trang đang ẩn (NotAllowedError); NoSleep 0.12 trên máy CÓ API gốc
 * lại gọi chính API đó + tự console.error rồi throw -> không dùng NoSleep để "thử lại" sau khi API gốc từ chối.
 *
 * NẠP SAU: thư viện NoSleep (CDN, index.html).
 */
const noSleep = new NoSleep();

/** Việc cần làm khi xin giữ màn hình sáng. Thuần.
 * @param {{keepScreenOn: boolean|undefined, visibilityState: string, hasNativeApi: boolean, sentinel: WakeLockSentinel|null, isPending: boolean}} s
 * @returns {'release'|'skip'|'noSleep'|'native'} */
function resolveWakeLockRequestAction({ keepScreenOn, visibilityState, hasNativeApi, sentinel, isPending }) {
    if (keepScreenOn === false) return 'release';
    if (visibilityState === 'hidden') return 'skip';
    if (!hasNativeApi) return 'noSleep';
    if (sentinel && !sentinel.released) return 'skip'; // đang giữ — không xin chồng (mỗi request ra 1 sentinel riêng)
    if (isPending) return 'skip'; // request trước chưa trả về
    return 'native';
}

/** Xin Wake Lock gốc. @returns {Promise<WakeLockSentinel>} (reject khi bị từ chối) */
function requestNativeWakeLock() {
    return navigator.wakeLock.request('screen');
}

/** Nhả sentinel Wake Lock gốc. @param {WakeLockSentinel} sentinel @returns {Promise<boolean>} true = đã nhả */
function releaseNativeWakeLock(sentinel) {
    return sentinel.release().then(() => true, () => false);
}

/** Bật NoSleep (video ẩn lặp). enable() trả Promise -> bắt cả lỗi async. */
function enableNoSleepFallback() {
    if (noSleep.isEnabled) return;
    try { Promise.resolve(noSleep.enable()).catch(() => {}); } catch (e) {}
}

function disableNoSleepFallback() {
    if (!noSleep.isEnabled) return;
    try { noSleep.disable(); } catch (e) {}
}
