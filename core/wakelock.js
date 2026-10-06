/**
 * wakelock.js — Quản lý Wake Lock (giữ màn hình sáng) qua API gốc hoặc NoSleep.js fallback.
 *
 * Tách khỏi file này (đã chuyển sang):
 *   - lifecycle listener (beforeunload) → event/tab.js
 *   - workflowAppCleanup.run() → event/workflow/app-cleanup.js (dời từ core/app-cleanup.js 06/10/2026)
 *
 * Giữ lại ở đây:
 *   - requestWakeLock() / releaseWakeLock() — API wake lock thuần
 *   - 2 bootstrap listener (touchstart/click {once:true}) — xin wake lock lần đầu
 *     người dùng tương tác, gắn chặt context của chính module này
 *
 * PHẢI nạp SAU: core/config.js (vizConfig), core/dom-refs.js (audioPlayer), thư viện NoSleep (CDN, index.html).
 */
        const noSleep = new NoSleep(); // fallback khi không có navigator.wakeLock (trước đây nằm lạc cuối core/subtitle/subtitle-display.js)
        /* SỬA (06/10/2026, Giang báo log "ERROR: NotAllowedError, Document is hidden" x2 mỗi lần tự chuyển bài lúc app ẩn) —
         * NGUYÊN NHÂN: Wake Lock API từ chối mọi request khi trang đang ẩn (NotAllowedError). Lỗi của request gốc bị catch
         * im lặng, nhưng nhánh catch lại rơi sang `noSleep.enable()` — NoSleep 0.12.0 khi máy CÓ navigator.wakeLock thì
         * CŨNG gọi chính navigator.wakeLock.request() lần nữa, tự `console.error(name + ', ' + message)` (đúng định dạng
         * dòng log) rồi throw — promise đó không ai bắt (try/catch quanh lời gọi đồng bộ không bắt được async). x2 vì tự
         * chuyển bài gọi requestWakeLock() 2 lần: goToNextTrack() + playMedia() (event/workflow/player-controls.js, player.js).
         * SỬA: (1) trang ẩn -> bỏ qua (không thể giữ màn hình sáng khi app không hiện); (2) NoSleep CHỈ dùng khi máy không có
         * navigator.wakeLock (fallback thật sự), không dùng làm "thử lại" sau khi API gốc từ chối; (3) bắt promise của
         * noSleep.enable() để không còn unhandled rejection. */
        /* SỬA (06/10/2026, cùng đợt) — KHÔNG xin chồng: mỗi lần request() ra 1 sentinel RIÊNG, màn hình còn sáng chừng nào CÒN
         * 1 sentinel chưa nhả, nhưng appState chỉ giữ cái cuối -> releaseWakeLock() (pause) chỉ nhả được cái cuối, các cái
         * trước rò rỉ giữ màn sáng. Chuyển bài gọi requestWakeLock() 2 lần liền (goToNextTrack() + playMedia()) nên rất dễ
         * xảy ra. Giờ: đang giữ 1 sentinel chưa nhả, hoặc đang chờ request trước trả về -> bỏ qua. */
        let _wakeLockRequestPending = false;
        async function requestWakeLock() {
            if (typeof appState !== 'undefined' && appConfigViz.getAll().keepScreenOn === false) { releaseWakeLock(); return; }
            if (document.visibilityState === 'hidden') return; // guard: Wake Lock chỉ xin được khi trang đang hiện
            if (!('wakeLock' in navigator)) { _enableNoSleepFallback(); return; }
            const current = appState.get('nativeWakeLock');
            if (current && !current.released) return; // guard: đang giữ — không xin chồng
            if (_wakeLockRequestPending) return; // guard: request trước chưa trả về
            _wakeLockRequestPending = true;
            try {
                appState.set('nativeWakeLock', await navigator.wakeLock.request('screen'));
            } catch (err) { // bị từ chối (vd tiết kiệm pin) — không thử NoSleep: bản 0.12 cũng gọi lại đúng API này
            } finally {
                _wakeLockRequestPending = false;
            }
        }

        /** NoSleep (video ẩn lặp) — chỉ cho máy KHÔNG có navigator.wakeLock. enable() trả Promise -> bắt cả lỗi async. */
        function _enableNoSleepFallback() {
            if (noSleep.isEnabled) return;
            try { Promise.resolve(noSleep.enable()).catch(() => {}); } catch (e) {}
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
