/**
 * event/router/app-boot.js — MỚI (20/07/2026, plan-space-galaxy.md Phần A, mục A2/A3).
 *
 * Dời NGUYÊN VẸN đoạn `document.addEventListener('DOMContentLoaded', ...)` TRƯỚC ĐÂY nằm chung
 * file với vòng lặp render (`core/visualizer/draw-visualizer.js`, nay file đó đã RỖNG HẲN — vai
 * trò dispatch dời sang `event/workflow/visualizer-render.js`). KHÔNG đổi 1 dòng logic nào bên
 * trong — chỉ đổi VỊ TRÍ file, đúng quyết định plan A2: đoạn boot này dùng `VirtualMachineState.run()`
 * cho nhánh `savedFolderId` (rẽ nhánh theo state xảy ra ĐÚNG 1 LẦN lúc khởi động) — khác bản chất
 * hẳn với vòng lặp render liên tục 60fps, nên xứng đáng đứng RIÊNG ở 1 file Router của chính nó,
 * không sống chung với vòng lặp render nữa.
 *
 * Tên file có hậu tố "router" (không phải "workflow") vì đây đúng là nơi duy nhất trong app dùng
 * `VirtualMachineState.run()` cho 1 quyết định lúc boot — cùng vai trò "Router" như các file
 * `event/router/*.js` khác (chỉ khác là trigger bởi `DOMContentLoaded` thay vì `eventBus.send()`).
 *
 * VỊ TRÍ NẠP: đặt ở CUỐI khối `/event/` trong index.html (sau toàn bộ workflow/router/listener
 * khác) — về mặt kỹ thuật vị trí không bắt buộc (script này chỉ ĐĂNG KÝ 1 listener
 * 'DOMContentLoaded', logic bên trong chỉ THỰC SỰ chạy sau khi toàn bộ tài liệu — bao gồm mọi
 * `<script>` phía sau nó — đã parse xong, đúng ngữ nghĩa `DOMContentLoaded`), nhưng đặt cuối cùng
 * cho DỄ ĐỌC: mọi `workflowXxx`/`VirtualMachineState`/hàm core mà callback bên dưới cần tới đều đã
 * chắc chắn được định nghĩa ở phía TRÊN nó trong tài liệu.
 *
 * Điểm khởi động thực sự của toàn bộ app. loadConfig() giờ là async (đọc ảnh/video nền từ
 * IndexedDB — mục 6 PLAN_INDEXEDDB.md). initPlaylistFromDB() đọc meta.playlistOrder + tag/cover
 * từng bài (KHÔNG đọc blob) để render danh sách ban đầu — thay cho playlist luôn rỗng lúc load
 * trang như bản cũ (mục 3.2).
 *
 * FIX (ver 10 refine #3, bổ sung — modal phải hiện NGAY từ đầu, không đợi load playlist xong):
 * checkPendingResumeStateOnBoot() (resume-state-storage.js) gọi NGAY SAU loadConfig(), KHÔNG đợi
 * initPlaylistFromDB() như bản trước — modal "Tiếp tục nghe?" hiện SONG SONG với lúc playlist
 * đang load ngầm (không đợi loading xong mới thấy modal), nhưng 2 nút "Tiếp tục phát"/"Nghe lại"
 * trong modal đó bị tạm khoá (disabled) cho tới khi initPlaylistFromDB() chạy xong — playSong(key)
 * cần playlistCache/getSongRecord() sẵn sàng mới hoạt động đúng. Nút "Không" không bị ảnh hưởng,
 * luôn bấm được ngay từ đầu.
 *
 * _isPlaylistReadyForResumeModal=true (player-controls.js) + enableResumeModalButtonsWhenPlaylistReady()
 * (resume-state-storage.js) chạy SAU initPlaylistFromDB() — mở khoá 2 nút đó (nếu modal vẫn còn
 * đang mở) + sửa lại tiêu đề tạm (key) thành đúng tên bài thật.
 *
 * File này (kế thừa quy chế miễn audit của draw-visualizer.js cũ, xem readme/core-legacy-audit.md)
 * — thêm dòng mới vào đây KHÔNG phát sinh nghĩa vụ refactor cho loadConfig()/loadBackgroundAssets().
 */
document.addEventListener('DOMContentLoaded', async () => {
    await loadConfig();
    // MỚI (batch 03/07/2026, hạ tầng z-index nền Visual) — resolve `meta.visualBgImage`
    // (Blob thật, ghi bởi "Đặt làm nền Visual" — event/workflow/file-manager-photo.js) NGAY
    // SAU loadConfig(). LƯU Ý (03/07/2026, Giang chỉnh lại — bản đầu batch này còn resolve
    // CẢ `bgImage` ở đây, THỪA): "Đặt làm nền Playlist" giờ ghi thẳng vào `meta.bgImage` —
    // CÙNG Ô mà loadConfig()/loadBackgroundAssets() (code DI SẢN, KHÔNG đụng) ĐÃ TỰ resolve
    // sẵn rồi, nên KHÔNG cần thêm dòng nào cho `bgImage` ở đây nữa — chỉ còn `visualBgImage`
    // (key MỚI, di sản chưa biết tới) thật sự cần đoạn bổ sung này. File này (kế thừa từ
    // draw-visualizer.js) được MIỄN audit hoàn toàn theo readme/core-legacy-audit.md, thêm
    // đoạn dưới đây KHÔNG phát sinh nghĩa vụ refactor cho loadConfig()/loadBackgroundAssets().
    // Gọi TRỰC TIẾP, KHÔNG qua eventBus — cùng quy ước lifecycle boot (event-bus-flow.md mục 1).
    if (typeof getMeta === 'function') {
        const cfg = appState.get('vizConfig');
        if (cfg.visualBgImageEnabled) {
            const visualBgBlob = await getMeta('visualBgImage');
            if (visualBgBlob) {
                const url = URL.createObjectURL(visualBgBlob);
                appState.mutate('vizConfig', c => { c.visualBgImage = url; });
                if (typeof applyVisualBgImageToDOM === 'function') applyVisualBgImageToDOM(true, url);
                // FIX (04/07/2026, mục 6 phản hồi Giang) — THIẾU DÒNG NÀY trước đây: khối
                // resolve lúc boot này set DOM/state trực tiếp thay vì gọi qua
                // applyVisualBgImage() (hàm ĐÓ mới có dòng đồng bộ toggle.checked), nên
                // toggle luôn hiện "off" sau reload dù ảnh vẫn hiển thị đúng — bug đã báo.
                if (typeof settingVisualBgImageEnableToggle !== 'undefined' && settingVisualBgImageEnableToggle) settingVisualBgImageEnableToggle.checked = true;
            } else {
                // Bật "on" nhưng không còn Blob (hiếm — xoá tay IndexedDB, hoặc dữ liệu
                // lệch) -> tự sửa về "off ảo", cùng nguyên tắc loadBackgroundAssets() áp
                // dụng cho bgImage/videoBgUrl.
                appState.mutate('vizConfig', c => { c.visualBgImageEnabled = false; });
                if (typeof settingVisualBgImageEnableToggle !== 'undefined' && settingVisualBgImageEnableToggle) settingVisualBgImageEnableToggle.checked = false;
            }
        } else if (typeof settingVisualBgImageEnableToggle !== 'undefined' && settingVisualBgImageEnableToggle) {
            settingVisualBgImageEnableToggle.checked = false; // FIX (mục 6) — đồng bộ rõ ràng cả nhánh "off", tránh phụ thuộc checkbox HTML mặc định
        }
    }
    // MỚI (Batch 8, 03/07/2026, slideshow nền Visual) — đọc lại slideshowConfig/
    // activeBackgroundAlbum đã lưu (meta) + tự khởi động engine nếu có album active. Gọi
    // TRỰC TIẾP, KHÔNG qua eventBus — cùng quy ước lifecycle boot (event-bus-flow.md mục
    // 1), NGAY SAU khối resolve visualBgImage ở trên (cùng nhóm "khôi phục nền lúc boot").
    if (typeof workflowSlideshow !== 'undefined') await workflowSlideshow.loadPersistedSettingsOnBoot();
    updateSubToggleUI();
    if (typeof checkPendingResumeStateOnBoot === 'function') checkPendingResumeStateOnBoot();
    if (typeof loadSongStats === 'function') await loadSongStats();
    await initPlaylistFromDB();
    // MỚI (Phase 2, mục 2, CHỐT 03/07/2026) — khôi phục activePlayListFolder đã lưu bền
    // (nếu có) NGAY SAU initPlaylistFromDB() (playlistCache đã đầy đủ) — KHÔNG sửa
    // initPlaylistFromDB()/scanValidSongsFromDB() ở loader.js (code di sản, chưa qua 4
    // rule — xem plan-v12-multimedia-decisions.md, trao đổi 03/07/2026). File này (kế
    // thừa từ draw-visualizer.js) được MIỄN audit hoàn toàn theo readme/core-legacy-audit.md
    // (nhóm loại trừ hot-path) nên thêm dòng dưới đây KHÔNG phát sinh nghĩa vụ refactor.
    // Gọi TRỰC TIẾP, KHÔNG qua eventBus — cùng quy ước với chính initPlaylistFromDB()/
    // loadConfig() (lifecycle boot, đứng ngoài /event/, xem event-bus-flow.md mục 1).
    if (typeof getMeta === 'function' && typeof workflowPlaylistScope !== 'undefined') {
        const savedFolderId = await getMeta('activePlayListFolder');
        VirtualMachineState.run([
            { state: savedFolderId, operation: 'in', value: [null, undefined], callback: () => {} }, // đã đúng "Tất cả bài" sẵn từ initPlaylistFromDB(), không cần làm gì thêm
            { state: savedFolderId, operation: 'notIn', value: [null, undefined], callback: () => workflowPlaylistScope.applyFolderScope(savedFolderId) },
        ]);
    }
    if (typeof appState !== 'undefined') appState.set('_isPlaylistReadyForResumeModal', true);
    if (typeof enableResumeModalButtonsWhenPlaylistReady === 'function') enableResumeModalButtonsWhenPlaylistReady();
    // MỚI (yêu cầu Giang) — cuộn tới bài vừa sửa phụ đề xong (quay lại từ subtitle-editor.
    // html qua nút "←") — đặt Ở ĐÂY, SAU CÙNG (đã initPlaylistFromDB() + khôi phục
    // activePlayListFolder xong) để chắc chắn danh sách đang ở trạng thái CUỐI CÙNG trước
    // khi cuộn. Gọi TRỰC TIẾP, KHÔNG qua eventBus — cùng quy ước lifecycle boot ở trên.
    if (typeof scrollToSongIfPending === 'function') scrollToSongIfPending();
});
