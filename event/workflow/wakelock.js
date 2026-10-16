/**
 * event/workflow/wakelock.js — Workflow "wakeLock": xin / nhả giữ màn hình sáng. Gọi từ mọi Workflow phát/dừng media
 * (`request()` / `release()`) và từ router 'wakeLock' (lần chạm đầu tiên của người dùng).
 *
 * Mỗi `navigator.wakeLock.request()` ra 1 sentinel riêng và màn hình sáng chừng nào còn 1 sentinel chưa nhả, nên đang giữ
 * hoặc đang chờ request trước thì bỏ qua (chuyển bài gọi request() 2 lần liền). Sentinel giữ ở appState `nativeWakeLock`.
 *
 * NẠP SAU: core/wakelock.js, core/dom-refs.js (audioPlayer), core/config.js (appConfigViz).
 */
const WAKE_LOCK_REQUEST_BY_ACTION = {
    release: () => workflowWakeLock.release(),
    skip: () => {},
    noSleep: () => enableNoSleepFallback(), // core/wakelock.js
    native: () => workflowWakeLock._acquireNative(),
};

const workflowWakeLock = {
    _pending: false, // đang chờ navigator.wakeLock.request() trả về

    /** Xin giữ màn hình sáng (tắt "Keep screen on" -> nhả). */
    request() {
        const action = resolveWakeLockRequestAction({ // core/wakelock.js
            keepScreenOn: appConfigViz.getAll().keepScreenOn,
            visibilityState: document.visibilityState,
            hasNativeApi: 'wakeLock' in navigator,
            sentinel: appState.get('nativeWakeLock'),
            isPending: this._pending,
        });
        WAKE_LOCK_REQUEST_BY_ACTION[action]();
    },

    /** 'wakeLock.firstInteraction' — lần chạm/bấm đầu tiên vào trang: Song đang phát thì xin (trình duyệt cần cử chỉ). */
    requestIfSongPlaying() {
        if (audioPlayer.paused) return; // guard
        this.request();
    },

    async _acquireNative() {
        this._pending = true;
        try {
            const sentinel = await requestNativeWakeLock(); // core/wakelock.js
            appState.set('nativeWakeLock', sentinel);
            console.log(`writer: "workflowWakeLock._acquireNative", page: "nativeWakeLock", content: "sentinel mới"`);
        } catch (err) { // bị từ chối (vd tiết kiệm pin) — không thử NoSleep
        } finally {
            this._pending = false;
        }
    },

    /** Nhả mọi thứ đang giữ màn hình sáng (sentinel gốc + NoSleep). */
    async release() {
        disableNoSleepFallback(); // core/wakelock.js
        const sentinel = appState.get('nativeWakeLock');
        if (!sentinel) return; // guard
        const released = await releaseNativeWakeLock(sentinel); // core/wakelock.js
        if (!released) return; // guard
        appState.set('nativeWakeLock', null);
        console.log(`writer: "workflowWakeLock.release", page: "nativeWakeLock", content: "null"`);
    },
};
