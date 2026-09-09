/**
 * event/workflow/ui-theme.js — "THẰNG THỰC THI CUỐI" cho hệ UI Theme (Light/Dark/Morphin — màu app
 * THẬT: panel/card/text/nút bấm, KHÔNG liên quan `viz.themeMode`/router "theme" cũ, xem docstring
 * core/ui-theme/light.js).
 *
 * CHƯA có Router/Listener riêng (09/09/2026, Giang chưa yêu cầu 1 màn Settings để BẤM đổi theme —
 * mới chỉ cần HẠ TẦNG "chuyển đổi qua lại, tự động áp dụng"). `switchUiTheme(themeName)` gọi được
 * THẲNG từ Console (debug/test) hoặc từ 1 Router mới thêm SAU NÀY khi có UI chọn theme thật — xem
 * event/router/theme.js làm mẫu (cùng khuôn `_commitThemeMode()`) lúc cần nối router đó.
 *
 * PHẠM VI ÁP DỤNG HIỆN TẠI — `applyUiThemeToDom(document, ...)` quét TOÀN BỘ trang, nhưng CHỈ phần
 * tử có `data-uitk` mới đổi màu — hiện mới gắn ở khung Generic Drawer (components/generic-
 * drawer.js: panel/header/handle). Nội dung từng feature (Folder Browser, Settings...) CHƯA gắn
 * `data-uitk`, xem "CÒN NỢ" cuối core/ui-theme/light.js.
 *
 * NẠP SAU: core/ui-theme/registry.js (UI_THEME_REGISTRY/resolveUiThemeKeyList),
 * core/ui-theme/apply-ui.js (applyUiThemeToDom), core/config.js (appConfigUiTheme, DEFAULT_UI_THEME_CONFIG),
 * service/db.js (getMeta/setMeta).
 */
const workflowUiTheme = {

    /**
     * Đổi + CHỐT theme đang active — mutate appConfigUiTheme, ghi bền `meta.uiThemeConfig`
     * (IndexedDB, CÙNG khuôn `meta.playerConfig`/`meta.playlistConfig` — event/workflow/player-
     * controls.js/playlist.js — `setMeta()` trực tiếp mỗi lần đổi, KHÔNG debounce, tần suất đổi
     * theme rất thấp), rồi áp NGAY vào DOM toàn trang.
     *
     * SỬA (09/09/2026, Giang yêu cầu "tạm bỏ Dark/Morphin khỏi select") — `themeName` KHÔNG nằm
     * trong `UI_THEME_SELECTABLE_NAMES` (core/ui-theme/registry.js — hiện chỉ 'light') tự CHUẨN HOÁ
     * về `UI_THEME_DEFAULT_NAME` NGAY TỪ ĐẦU, TRƯỚC khi ghi vào config — đảm bảo giá trị LƯU BỀN
     * luôn khớp ĐÚNG giá trị THẬT SỰ áp dụng lên DOM (tránh lệch kiểu "config ghi 'dark' nhưng DOM
     * lại lên màu Light" nếu chỉ chặn ở bước resolveUiThemeKeyList() mà không chặn ở đây).
     * @param {'light'|'dark'|'morphin'} themeName
     */
    async switchUiTheme(themeName) {
        const safeThemeName = UI_THEME_SELECTABLE_NAMES.includes(themeName) ? themeName : UI_THEME_DEFAULT_NAME; // core/ui-theme/registry.js
        appConfigUiTheme.mutateAll((cfg) => { cfg.activeUiTheme = safeThemeName; }); // core/config.js
        console.log(`writer: "switchUiTheme", page: "uiTheme.activeUiTheme", content: "${safeThemeName}"`);
        await setMeta('uiThemeConfig', appConfigUiTheme.getAll()); // service/db.js
        const keyList = resolveUiThemeKeyList(safeThemeName); // core/ui-theme/registry.js
        setActiveUiThemeKeyList(keyList); // core/ui-theme/apply-ui.js — DÙNG CHUNG (không chỉ Generic Drawer nữa) — để lần mở/vẽ lại Drawer TIẾP THEO dùng ĐÚNG theme mới, không cần đợi user tự đóng/mở lại
        applyUiThemeToDom(document, keyList); // core/ui-theme/apply-ui.js
    },

    /** Khôi phục theme đã lưu bền LÚC BOOT + áp vào DOM — gọi từ event/workflow/app-boot.js, CÙNG
     * khuôn `loadPersistedPlayerConfigOnBoot()` (event/workflow/player-controls.js). Chưa từng lưu
     * (boot lần đầu) -> `saved` rỗng, giữ nguyên default `'light'` đã seed sẵn trong appConfigUiTheme. */
    async loadPersistedUiThemeOnBoot() {
        const saved = await getMeta('uiThemeConfig'); // service/db.js
        if (saved && typeof saved === 'object') {
            appConfigUiTheme.mutateAll((cfg) => Object.assign(cfg, saved)); // core/config.js
            console.log(`writer: "loadPersistedUiThemeOnBoot", page: "uiTheme.activeUiTheme", content: "khôi phục từ meta.uiThemeConfig"`);
        }
        const keyList = resolveUiThemeKeyList(appConfigUiTheme.getAll().activeUiTheme); // core/ui-theme/registry.js
        setActiveUiThemeKeyList(keyList); // core/ui-theme/apply-ui.js — DÙNG CHUNG (không chỉ Generic Drawer nữa)
        applyUiThemeToDom(document, keyList); // core/ui-theme/apply-ui.js
    },
};
