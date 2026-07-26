/**
 * event/workflow/app-boot.js — MỚI (25/07/2026, đợt tái cấu trúc state, mục "app-boot đi qua
 * eventBus"). Chuỗi ~15 bước boot dời NGUYÊN VẸN từ event/router/app-boot.js bản cũ (vốn dời từ
 * core/visualizer/draw-visualizer.js, 20/07/2026, plan-space-galaxy.md Phần A) — KHÔNG đổi thứ tự/
 * logic bên trong, CHỈ thêm `seedConfig()` (MỚI — seed 3 domain AppConfig, xem core/config.js)
 * NGAY ĐẦU (TRƯỚC `loadConfig()`, đúng thứ tự cũ vốn có ở service/state.js) + đổi
 * `appState.get/mutate('vizConfig', ...)` sang `appConfigViz.getAll()/.mutateAll()` (cầu nối
 * tương thích AppConfig, xem service/state.js).
 *
 * File này (kế thừa quy chế miễn audit của draw-visualizer.js/event/router/app-boot.js cũ, xem
 * readme/core-legacy-audit.md) — thêm dòng mới vào đây KHÔNG phát sinh nghĩa vụ refactor cho
 * loadConfig()/loadBackgroundAssets().
 */
const workflowAppBoot = {
    async boot() {
        seedConfig();
        await loadConfig();
        // Resolve `meta.visualBgImage` (Blob thật, ghi bởi "Đặt làm nền Visual" —
        // event/workflow/file-manager-photo.js) NGAY SAU loadConfig(). "Đặt làm nền Playlist"
        // ghi thẳng vào `meta.bgImage` — CÙNG Ô mà loadConfig()/loadBackgroundAssets() đã tự
        // resolve sẵn rồi, nên KHÔNG cần thêm dòng nào cho `bgImage` ở đây, chỉ còn `visualBgImage`.
        if (typeof getMeta === 'function') {
            const cfg = appConfigViz.getAll();
            if (cfg.visualBgImageEnabled) {
                const visualBgBlob = await getMeta('visualBgImage');
                if (visualBgBlob) {
                    const url = URL.createObjectURL(visualBgBlob);
                    appConfigViz.mutateAll(c => { c.visualBgImage = url; });
                    if (typeof applyVisualBgImageToDOM === 'function') applyVisualBgImageToDOM(true, url);
                    // Khối resolve lúc boot này set DOM/state trực tiếp thay vì gọi qua
                    // applyVisualBgImage() (hàm ĐÓ mới có dòng đồng bộ toggle.checked), nên tự
                    // đồng bộ lại toggle ở đây.
                    if (typeof settingVisualBgImageEnableToggle !== 'undefined' && settingVisualBgImageEnableToggle) settingVisualBgImageEnableToggle.checked = true;
                } else {
                    // Bật "on" nhưng không còn Blob (hiếm — xoá tay IndexedDB, hoặc dữ liệu
                    // lệch) -> tự sửa về "off ảo", cùng nguyên tắc loadBackgroundAssets() áp
                    // dụng cho bgImage/videoBgUrl.
                    appConfigViz.mutateAll(c => { c.visualBgImageEnabled = false; });
                    if (typeof settingVisualBgImageEnableToggle !== 'undefined' && settingVisualBgImageEnableToggle) settingVisualBgImageEnableToggle.checked = false;
                }
            } else if (typeof settingVisualBgImageEnableToggle !== 'undefined' && settingVisualBgImageEnableToggle) {
                settingVisualBgImageEnableToggle.checked = false; // đồng bộ rõ ràng cả nhánh "off"
            }
        }
        // Đọc lại slideshowConfig/activeBackgroundAlbum đã lưu (meta) + tự khởi động engine nếu
        // có album active — NGAY SAU khối resolve visualBgImage ở trên (cùng nhóm "khôi phục nền
        // lúc boot").
        if (typeof workflowSlideshow !== 'undefined') await workflowSlideshow.loadPersistedSettingsOnBoot();
        updateSubToggleUI();
        if (typeof checkPendingResumeStateOnBoot === 'function') checkPendingResumeStateOnBoot();
        if (typeof loadSongStats === 'function') await loadSongStats();
        await initPlaylistFromDB();
        // Khôi phục activePlayListFolder đã lưu bền (nếu có) NGAY SAU initPlaylistFromDB()
        // (playlistCache đã đầy đủ).
        if (typeof getMeta === 'function' && typeof workflowPlaylistScope !== 'undefined') {
            const savedFolderId = await getMeta('activePlayListFolder');
            VirtualMachineState.run([
                { state: savedFolderId, operation: 'in', value: [null, undefined], callback: () => {} }, // đã đúng "Tất cả bài" sẵn từ initPlaylistFromDB(), không cần làm gì thêm
                { state: savedFolderId, operation: 'notIn', value: [null, undefined], callback: () => workflowPlaylistScope.applyFolderScope(savedFolderId) },
            ]);
        }
        if (typeof appState !== 'undefined') appState.set('_isPlaylistReadyForResumeModal', true);
        if (typeof enableResumeModalButtonsWhenPlaylistReady === 'function') enableResumeModalButtonsWhenPlaylistReady();
        // Cuộn tới bài vừa sửa phụ đề xong (quay lại từ subtitle-editor.html qua nút "←") — đặt
        // SAU CÙNG (đã initPlaylistFromDB() + khôi phục activePlayListFolder xong).
        if (typeof scrollToSongIfPending === 'function') scrollToSongIfPending();
    },
};
