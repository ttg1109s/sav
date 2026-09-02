/**
 * core/gameplay/catalog.js — MỚI (02/09/2026, Giang yêu cầu "nối game mode vào game overlay").
 * Danh mục game hiển thị ở Game Panel (App Panel tab "Game", kiểu appstore — xem
 * core/gameplay/game-panel-ui.js + components/game-panel.js). Data TĨNH thuần — KHÔNG phải
 * appState/AppConfig, mỗi phần tử mô tả 1 game ĐÃ CÀI SẴN trong app (KHÔNG phải danh sách tải về
 * ngoài mạng), nên không cần domain AppConfig/AppState riêng cho bảng này.
 *
 * `id` PHẢI khớp ĐÚNG giá trị `gameplayMode` dùng xuyên suốt: service/state/gameplay-runtime.js
 * (schema `gameplayMode`), event/workflow/gameplay.js::start(mode), core/config.js
 * (`gameplayArmedGameId`), và `record.game[mode]` (service/db.js, xem event/workflow/
 * gameplay-engine.js::persistScore()) — 4 nơi này DÙNG CHUNG đúng 1 "mode id", không có tầng ánh xạ
 * riêng nào ở giữa.
 *
 * v1 chỉ có ĐÚNG 1 game (`circle`, mode "Circle" đã có sẵn từ 16/08/2026) — vẫn viết dạng MẢNG ngay
 * từ đầu (không phải object 1 key) để game sau này chỉ cần thêm 1 phần tử, không cần đổi cấu trúc
 * chỗ nào khác đang đọc `GAMEPLAY_GAMES_CATALOG`.
 *
 * `coverIconSvg`: CHỈ phần bên trong `<svg>` (path/circle/...), KHÔNG tự bọc thẻ `<svg>` — Core-ui
 * (game-panel-ui.js) bọc `<svg viewBox="0 0 24 24" ...>` DÙNG CHUNG mọi game, tránh mỗi entry tự
 * khai lặp lại thuộc tính svg. `coverGradientClass`: 2-3 màu Tailwind `from-*`/`via-*`/`to-*` cho
 * nền cover card — CHƯA có ảnh thật (`coverImageUrl` chừa sẵn field, hiện luôn `null`, xem
 * docstring game-panel-ui.js mục "cover" cho cách 2 field này phối hợp).
 */
const GAMEPLAY_GAMES_CATALOG = Object.freeze([
    Object.freeze({
        id: 'circle',
        nameKey: 'gamePanel.catalog.circle.name',
        descriptionKey: 'gamePanel.catalog.circle.description',
        coverImageUrl: null, // chừa sẵn cho sau này — chưa có ảnh thật, xem docstring trên
        coverGradientClass: 'from-sky-500 via-indigo-500 to-violet-600',
        // 2 vòng tròn đồng tâm — đúng hình ảnh cơ chế thật (wave co dần vào centerRadius, xem
        // core/gameplay/circle-mode.js/circle-mode-ui.js).
        coverIconSvg: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/>',
    }),
]);
