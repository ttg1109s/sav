/**
 * core/player-display-settings.js — Core THUẦN (Rule 1-5) cho "Player" (Settings > Visualizer
 * Screen > Player) — Resolution + Motion của Video/Photo lúc PHÁT CHÍNH (KHÁC Visual Background,
 * là nền trang trí đứng sau Visualizer lúc Song phát).
 *
 * GIAI ĐOẠN 1 (ĐÃ XONG — đăng ký + hiển thị/lưu list, xem core/config.js/core/motion-presets.js).
 * GIAI ĐOẠN 2 — RESOLUTION (ĐÃ XONG, Giang yêu cầu — "kích thước video&player, không liên quan
 * VBG") — file này giờ có thêm 2 hàm THUẦN tính chuỗi CSS thật (resolvePlayerObjectFitCss()/
 * resolvePlayerBackgroundSizeCss() ngay dưới), ÁP DỤNG lên #bg-video/#visual-bg-image THẬT SỰ do
 * core/player-display-apply.js (Core-DOM, nhận giá trị tính sẵn ở đây qua tham số, Rule 2) +
 * event/workflow/player-display-settings.js (điều phối, gọi lúc vào/thoát Video/Photo Player mode
 * VÀ lúc đổi Settings sống) đảm nhiệm. CHỈ áp dụng lúc CHÍNH Video/Photo đang phát làm nội dung
 * (Video/Photo Player mode) — KHÔNG đụng gì tới Visual Background (2 mode không bao giờ cùng lúc,
 * xem docstring core/photo-player.js).
 * GIAI ĐOẠN 2 — MOTION — Resolution KHÔNG liên quan mục này (xem trên). React Beat của Video ĐÃ có
 * cơ chế hoạt động (đọc từ field `videoShowingPresetId`, xem PLAYER_MOTION_SLOTS ngay dưới +
 * event/workflow/player-display-settings.js::_tickVideoBeatReact()); Transition (cả 2 kind) VÀ
 * Point Move (Photo + phần Point Move của preset gắn cho Video's `showing`) vẫn CHỈ lưu lựa chọn,
 * CHƯA có hàm nào đọc lại rồi chạy Motion Engine thật.
 *
 * Dữ liệu SỐNG ở domain 'playerDisplay' (core/config.js::DEFAULT_PLAYER_DISPLAY_CONFIG) — xem
 * docstring tại đó cho ý nghĩa từng field. Danh sách preset khả dụng cho dropdown Motion dùng CHUNG
 * 1 consumer 'player' (core/motion-presets.js::MOTION_APPLY_CONSUMERS + getPresetsSubscribedToConsumer()).
 *
 * NẠP SAU: (không phụ thuộc file nào khác — hằng số + hàm thuần).
 * NẠP TRƯỚC: core/app-settings-ui.js, core/player-display-apply.js, components/settings/player-
 * display-settings.js, event/workflow/player-display-settings.js, event/workflow/app-settings.js.
 */

/** 4 mode Resolution — áp dụng riêng cho Video và Photo (2 field độc lập `videoResolutionMode`/
 * `photoResolutionMode`, xem core/config.js). 'cover' — kéo giãn lấp đầy khung, giữ tỉ lệ, CẮT bớt
 * phần dư (object-fit: cover) — ĐÚNG hành vi mặc định gốc trước khi có tính năng Resolution (MỚI,
 * Giang yêu cầu bổ sung lại). 'fit' — giữ tỉ lệ, căn giữa, có thể dư viền (object-fit: contain).
 * 'stretch' — kéo giãn lấp đầy khung, KHÔNG giữ tỉ lệ (object-fit: fill). 'trueMax' — giữ NGUYÊN
 * kích thước gốc, CHỈ co lại (KHÔNG phóng to) nếu vượt khung — khác 'fit' ở chỗ ảnh/video NHỎ hơn
 * khung thì đứng nguyên kích thước gốc, không bị kéo lớn lên. */
const PLAYER_RESOLUTION_MODES = [
    { value: 'cover', labelKey: 'playerDisplaySettings.resolution.cover' },
    { value: 'fit', labelKey: 'playerDisplaySettings.resolution.fit' },
    { value: 'stretch', labelKey: 'playerDisplaySettings.resolution.stretch' },
    { value: 'trueMax', labelKey: 'playerDisplaySettings.resolution.trueMax' },
];

/** 3 "vai trò" Motion ĐỘC LẬP của Player — mỗi vai trò 1 dropdown RIÊNG cho Video/Photo (tuỳ
 * `kinds`), cùng chọn trong 1 danh sách preset đã đăng ký cho consumer 'player' (core/motion-
 * presets.js).
 *
 * SỬA (Giang chốt gộp lại) — Video KHÔNG còn 2 ô Point Move/React Beat tách rời như trước — GỘP
 * thành 1 ô DUY NHẤT `showing` (đúng thuật ngữ "Motion Showing" gốc Giang dùng lúc đầu) — 1 preset
 * gắn cho ô này vừa lái Point Move VỪA lái React Beat của Video (đọc CẢ 2 nhóm field cùng lúc từ
 * CÙNG 1 preset, KHÔNG phải 2 preset riêng như trước). Photo KHÔNG gộp gì — Photo vẫn có `pointMove`
 * RIÊNG của nó (Photo không có React Beat để gộp cùng, xem `kinds` bên dưới).
 *
 * `kinds` — `pointMove` giờ CHỈ còn Photo dùng; `showing` CHỈ Video dùng — 2 slot TÁCH BIỆT hẳn
 * (KHÁC tên field, KHÁC ý nghĩa), dùng getPlayerMotionSlotsForKind() ngay dưới để lọc đúng danh
 * sách slot hợp lệ của TỪNG kind thay vì lặp `PLAYER_MOTION_SLOTS` thô.
 *
 * `fieldSuffix` ghép với `kind` ('video'|'photo') ra ĐÚNG tên field trong domain 'playerDisplay'
 * (vd kind='photo' + fieldSuffix='PointMovePresetId' -> 'photoPointMovePresetId'; kind='video' +
 * fieldSuffix='ShowingPresetId' -> 'videoShowingPresetId' — KHÔNG còn `videoPointMovePresetId`/
 * `videoReactBeatPresetId` trong schema, core/config.js).
 * `slot` dùng làm phần id DOM (`#setting-player-{kind}-motion-{slot}`, xem components/settings/
 * player-display-settings.js + core/app-settings-ui.js::wireAppSettingsPlayerDetail()).
 *
 * Ý nghĩa từng vai trò lúc CÓ cơ chế hoạt động thật — chỉ đọc ĐÚNG nhóm field tương ứng của preset
 * được gắn, bỏ qua phần còn lại:
 *   transitionNext/transitionPrev — CHỈ đọc nhóm field `transition*` (transitionType/
 *     transitionDurationMs/...) của preset, áp lúc chuyển sang bài kế/trước tương ứng. CHƯA có cơ
 *     chế hoạt động (giai đoạn sau).
 *   pointMove (CHỈ Photo)  — CHỈ đọc `pointMoves`/`pointMoveEnabled`/`pointMoveRunMode`/... của
 *     preset. CHƯA có cơ chế hoạt động (giai đoạn sau).
 *   showing (CHỈ Video)    — ĐỌC CẢ 2: `reactBeatAudio` (ĐÃ có cơ chế hoạt động, xem event/workflow/
 *     player-display-settings.js::_tickVideoBeatReact()) VÀ `pointMoves`/`pointMoveEnabled`/...
 *     (CHƯA có cơ chế hoạt động — Giang chốt rõ "chưa backend point move cho video", chỉ phần React
 *     Beat của preset gắn ở đây là THẬT SỰ chạy lúc này).
 */
const PLAYER_MOTION_SLOTS = [
    { slot: 'transitionNext', fieldSuffix: 'TransitionNextPresetId', labelKey: 'playerDisplaySettings.motion.transitionNext.label', kinds: ['video', 'photo'] },
    { slot: 'transitionPrev', fieldSuffix: 'TransitionPrevPresetId', labelKey: 'playerDisplaySettings.motion.transitionPrev.label', kinds: ['video', 'photo'] },
    { slot: 'pointMove', fieldSuffix: 'PointMovePresetId', labelKey: 'playerDisplaySettings.motion.pointMove.label', kinds: ['photo'] },
    { slot: 'showing', fieldSuffix: 'ShowingPresetId', labelKey: 'playerDisplaySettings.motion.showing.label', kinds: ['video'] },
];

/** Core thuần — danh sách slot Motion hợp lệ của 1 kind (Photo: transitionNext/transitionPrev/
 * pointMove; Video: transitionNext/transitionPrev/showing — xem docstring PLAYER_MOTION_SLOTS ngay
 * trên). Dùng bởi component render + wireAppSettingsPlayerDetail() thay vì lặp trực tiếp
 * `PLAYER_MOTION_SLOTS` (tránh render/wire nhầm 1 select không có field cho kind đó).
 * @param {'video'|'photo'} kind @returns {typeof PLAYER_MOTION_SLOTS} */
function getPlayerMotionSlotsForKind(kind) {
    return PLAYER_MOTION_SLOTS.filter((s) => s.kinds.includes(kind));
}

/** Core thuần — tên field domain 'playerDisplay' ứng với 1 vai trò Motion của 1 kind. Trả `null`
 * nếu `slot` không tồn tại HOẶC không áp dụng cho `kind` đó (vd slot='showing', kind='photo') —
 * chặn NGAY TỪ NGUỒN việc lỡ ghi vào 1 field không tồn tại trong schema.
 * @param {'video'|'photo'} kind @param {string} slot - 1 trong PLAYER_MOTION_SLOTS[].slot
 * @returns {string|null} */
function resolvePlayerMotionPresetField(kind, slot) {
    const entry = PLAYER_MOTION_SLOTS.find((s) => s.slot === slot && s.kinds.includes(kind));
    return entry ? `${kind}${entry.fieldSuffix}` : null;
}

/** Core thuần — tên field domain 'playerDisplay' giữ Resolution mode của 1 kind.
 * @param {'video'|'photo'} kind @returns {string} */
function resolvePlayerResolutionField(kind) {
    return `${kind}ResolutionMode`;
}

/** Core thuần — chuỗi CSS `object-fit` (dùng cho <video> — `bgVideoElement`, xem core/player-
 * display-apply.js) ứng với 1 giá trị PLAYER_RESOLUTION_MODES. 'trueMax' -> CSS `scale-down` CHUẨN
 * (giữ kích thước gốc, chỉ co lại — KHÔNG phóng to — nếu vượt khung) — trình duyệt tự tính lại theo
 * ĐÚNG kích thước gốc của video hiện tại, không cần JS đo tay như Photo (background-image không có
 * `object-fit`, xem resolvePlayerBackgroundSizeCss() ngay dưới).
 * @param {string} resolutionMode - 1 trong PLAYER_RESOLUTION_MODES[].value
 * @returns {string} giá trị hợp lệ cho CSS `object-fit` */
function resolvePlayerObjectFitCss(resolutionMode) {
    if (resolutionMode === 'stretch') return 'fill';
    if (resolutionMode === 'trueMax') return 'scale-down';
    if (resolutionMode === 'fit') return 'contain';
    return 'cover'; // 'cover' — cũng là fallback an toàn cho giá trị lạ/thiếu (ĐÚNG hành vi mặc định gốc)
}

/** Core thuần — chuỗi CSS `background-size` (dùng cho `#visual-bg-image`, 1 <div> nền
 * background-image, KHÔNG có `object-fit` như <img>/<video> nên phải tự tính tay thay vì có sẵn
 * 1 từ khoá CSS như Video) ứng với 1 giá trị PLAYER_RESOLUTION_MODES. 'cover'/'fit'/'stretch' map
 * thẳng 1-1 sang từ khoá CSS cùng tên (`cover`/`contain`/`100% 100%`) — không cần `naturalWidth`/
 * `naturalHeight`/kích thước khung.
 *
 * 'trueMax' tự viết lại ĐÚNG ngữ nghĩa `object-fit: scale-down`: ảnh NHỎ hơn khung ở CẢ 2 chiều ->
 * giữ nguyên kích thước gốc (`'auto'`, KHÔNG phóng to) — NGƯỢC LẠI (vượt khung ở ÍT NHẤT 1 chiều)
 * -> co giữ tỉ lệ vừa khung y hệt `'contain'`. `naturalWidth`/`naturalHeight` thiếu (ảnh cũ thêm
 * trước khi field này tồn tại trong record, xem core/file-manager/image.js::saveImage()) -> fallback
 * `'contain'` (an toàn, không tràn khung, dù có thể không đúng ý "giữ kích thước gốc" 100%).
 * @param {string} resolutionMode @param {number|null|undefined} naturalWidth
 * @param {number|null|undefined} naturalHeight @param {number} containerWidth @param {number} containerHeight
 * @returns {string} giá trị hợp lệ cho CSS `background-size` */
function resolvePlayerBackgroundSizeCss(resolutionMode, naturalWidth, naturalHeight, containerWidth, containerHeight) {
    if (resolutionMode === 'stretch') return '100% 100%';
    if (resolutionMode === 'fit') return 'contain';
    if (resolutionMode === 'trueMax') {
        if (!naturalWidth || !naturalHeight) return 'contain';
        const fitsWithoutScaling = naturalWidth <= containerWidth && naturalHeight <= containerHeight;
        return fitsWithoutScaling ? 'auto' : 'contain';
    }
    return 'cover'; // 'cover' — cũng là fallback an toàn cho giá trị lạ/thiếu (ĐÚNG hành vi mặc định gốc)
}
