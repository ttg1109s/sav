/**
 * wakelock.js — Quản lý Wake Lock (giữ màn hình sáng) qua API gốc hoặc NoSleep.js fallback.
 *
 * Tách khỏi file này (đã chuyển sang):
 *   - lifecycle listener (beforeunload) → event/tab.js
 *   - executeAppCleanup() → core/app-cleanup.js
 *
 * Giữ lại ở đây:
 *   - requestWakeLock() / releaseWakeLock() — API wake lock thuần
 *   - 2 bootstrap listener (touchstart/click {once:true}) — xin wake lock lần đầu
 *     người dùng tương tác, gắn chặt context của chính module này
 *
 * PHẢI nạp SAU: core/config.js (vizConfig), core/dom-refs.js (audioPlayer).
 */
        async function requestWakeLock() {
            if (typeof appState !== 'undefined' && appConfigViz.getAll().keepScreenOn === false) { releaseWakeLock(); return; }
            try {
                if ('wakeLock' in navigator) { appState.set('nativeWakeLock', await navigator.wakeLock.request('screen')); appState.get('nativeWakeLock').addEventListener('release', () => {}); }
                else { try { if (!noSleep.isEnabled) noSleep.enable(); } catch(e) {} }
            } catch (err) { try { if (!noSleep.isEnabled) noSleep.enable(); } catch (e) {} }
        }

        function releaseWakeLock() {
            try {
                if (appState.get('nativeWakeLock') !== null) { appState.get('nativeWakeLock').release().then(() => { appState.set('nativeWakeLock', null); }).catch(()=>{}); }
                if (noSleep.isEnabled) noSleep.disable();
            } catch (e) {}
        }

        // Bootstrap: xin wake lock lần đầu người dùng tương tác (nếu nhạc đang phát).
        // {once:true} — tự gỡ sau 1 lần, không cần quản lý lifecycle.
        document.body.addEventListener('touchstart', () => { if(!audioPlayer.paused) requestWakeLock(); }, { once: true });
        document.body.addEventListener('click',      () => { if(!audioPlayer.paused) requestWakeLock(); }, { once: true });
