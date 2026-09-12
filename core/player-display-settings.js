/**
 * core/player-display-settings.js — Core THUẦN (Rule 1-5) cho "Player" (Settings > Visualizer
 * Screen > Player) — Resolution + Motion của Video/Photo lúc PHÁT CHÍNH (KHÁC Visual Background,
 * là nền trang trí đứng sau Visualizer lúc Song phát).
 *
 * GIAI ĐOẠN 1 (Giang yêu cầu "code backend đăng ký + hiển thị list, CHƯA code cơ chế hoạt động") —
 * file này CHỈ giữ 2 hằng số tra cứu (PLAYER_RESOLUTION_MODES/PLAYER_MOTION_SLOTS) dùng để dựng UI
 * (component + core/app-settings-ui.js) và đặt tên field (event/workflow/player-display-settings.js)
 * — KHÔNG có hàm nào đọc `appConfigPlayerDisplay` rồi thực sự áp Resolution/Motion lên
 * #bg-video/#visual-bg-image hay Motion Engine — đó là "cơ chế hoạt động" của giai đoạn 2, CHƯA làm.
 *
 * Dữ liệu SỐNG ở domain 'playerDisplay' (core/config.js::DEFAULT_PLAYER_DISPLAY_CONFIG) — xem
 * docstring tại đó cho ý nghĩa từng field. Danh sách preset khả dụng cho 8 dropdown Motion (4 vai
 * trò x Video/Photo) dùng CHUNG 1 consumer 'player' (core/motion-presets.js::MOTION_APPLY_CONSUMERS
 * + getPresetsSubscribedToConsumer()).
 *
 * NẠP SAU: (không phụ thuộc file nào khác — hằng số thuần).
 * NẠP TRƯỚC: core/app-settings-ui.js, components/settings/player-display-settings.js,
 * event/workflow/player-display-settings.js, event/workflow/app-settings.js.
 */

/** 3 mode Resolution — áp dụng riêng cho Video và Photo (2 field độc lập `videoResolutionMode`/
 * `photoResolutionMode`, xem core/config.js). 'fit' — giữ tỉ lệ, căn giữa, có thể dư viền (object-fit:
 * contain). 'stretch' — kéo giãn lấp đầy khung, KHÔNG giữ tỉ lệ (object-fit: fill). 'trueMax' — giữ
 * NGUYÊN kích thước gốc, CHỈ co lại (KHÔNG phóng to) nếu vượt khung — khác 'fit' ở chỗ ảnh/video NHỎ
 * hơn khung thì đứng nguyên kích thước gốc, không bị kéo lớn lên. */
const PLAYER_RESOLUTION_MODES = [
    { value: 'fit', labelKey: 'playerDisplaySettings.resolution.fit' },
    { value: 'stretch', labelKey: 'playerDisplaySettings.resolution.stretch' },
    { value: 'trueMax', labelKey: 'playerDisplaySettings.resolution.trueMax' },
];

/** 4 "vai trò" Motion ĐỘC LẬP của Player (Giang chốt tách rời hoàn toàn — KHÔNG gộp Next+Prev hay
 * Point Move+React Beat làm 1 lựa chọn) — mỗi vai trò 1 dropdown RIÊNG cho Video VÀ 1 dropdown
 * RIÊNG cho Photo, nhưng cùng chọn trong 1 danh sách preset đã đăng ký cho consumer 'player'
 * (core/motion-presets.js).
 *
 * `kinds` — Photo KHÔNG có vai trò `reactBeat` (Giang chỉ ra: Photo Player mode phát HOÀN TOÀN im
 * lặng — không có audio nào đang chạy song song để "react" theo, xem docstring core/photo-player.js
 * — khác VBG Photo, nơi Song vẫn đang phát nền lúc slideshow chạy) — dùng getPlayerMotionSlotsForKind()
 * ngay dưới để lọc đúng danh sách slot hợp lệ của TỪNG kind thay vì lặp `PLAYER_MOTION_SLOTS` thô.
 *
 * `fieldSuffix` ghép với `kind` ('video'|'photo') ra ĐÚNG tên field trong domain 'playerDisplay'
 * (vd kind='video' + fieldSuffix='TransitionNextPresetId' -> 'videoTransitionNextPresetId'). Photo
 * vì vậy KHÔNG có field `photoReactBeatPresetId` trong schema (core/config.js) — đã bỏ hẳn, không
 * giữ lại làm field chết.
 * `slot` dùng làm phần id DOM (`#setting-player-{kind}-motion-{slot}`, xem components/settings/
 * player-display-settings.js + core/app-settings-ui.js::wireAppSettingsPlayerDetail()).
 *
 * Ý nghĩa từng vai trò lúc CÓ cơ chế hoạt động thật (giai đoạn 2, CHƯA làm) — chỉ đọc ĐÚNG 1 nhóm
 * field của preset được gắn, bỏ qua phần còn lại:
 *   transitionNext/transitionPrev — CHỈ đọc nhóm field `transition*` (transitionType/
 *     transitionDurationMs/...) của preset, áp lúc chuyển sang bài kế/trước tương ứng.
 *   pointMove   — CHỈ đọc `pointMoves`/`pointMoveEnabled`/`pointMoveRunMode`/... của preset.
 *   reactBeat   — CHỈ đọc `reactBeatAudio` của preset. CHỈ Video có vai trò này.
 */
const PLAYER_MOTION_SLOTS = [
    { slot: 'transitionNext', fieldSuffix: 'TransitionNextPresetId', labelKey: 'playerDisplaySettings.motion.transitionNext.label', kinds: ['video', 'photo'] },
    { slot: 'transitionPrev', fieldSuffix: 'TransitionPrevPresetId', labelKey: 'playerDisplaySettings.motion.transitionPrev.label', kinds: ['video', 'photo'] },
    { slot: 'pointMove', fieldSuffix: 'PointMovePresetId', labelKey: 'playerDisplaySettings.motion.pointMove.label', kinds: ['video', 'photo'] },
    { slot: 'reactBeat', fieldSuffix: 'ReactBeatPresetId', labelKey: 'playerDisplaySettings.motion.reactBeat.label', kinds: ['video'] },
];

/** Core thuần — danh sách slot Motion hợp lệ của 1 kind (Photo lọc bỏ `reactBeat`, xem docstring
 * PLAYER_MOTION_SLOTS ngay trên). Dùng bởi component render + wireAppSettingsPlayerDetail() thay
 * vì lặp trực tiếp `PLAYER_MOTION_SLOTS` (tránh Photo render/wire nhầm 1 select không có field).
 * @param {'video'|'photo'} kind @returns {typeof PLAYER_MOTION_SLOTS} */
function getPlayerMotionSlotsForKind(kind) {
    return PLAYER_MOTION_SLOTS.filter((s) => s.kinds.includes(kind));
}

/** Core thuần — tên field domain 'playerDisplay' ứng với 1 vai trò Motion của 1 kind. Trả `null`
 * nếu `slot` không tồn tại HOẶC không áp dụng cho `kind` đó (vd slot='reactBeat', kind='photo') —
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
