/**
 * core/player-zoom.js — Core (Rule 1-5) cho "Zoom mode" của Player Video/Photo (MỚI 29/09/2026, Giang yêu cầu):
 * icon kính lúp trong Control Center bật/tắt 1 chế độ vô hiệu hoá toàn bộ cử chỉ của app
 * (#visualizer-gesture-surface bị #player-zoom-surface che) để dùng cử chỉ zoom/pan trên chính Video/Photo.
 *
 * Giang chốt: CHỈ zoom in — mức nhỏ nhất = 1 (đúng kích thước theo Resolution của Player, không thu nhỏ hơn);
 * ở mức 1 khoá giữa (KHÔNG pan), chỉ pan khi đã zoom > 1, pan không lộ ra ngoài khung Player; Next/Prev/ảnh tự
 * chuyển GIỮ NGUYÊN mức zoom (zoom nằm trên lớp riêng `#player-zoom-layer`, bọc NGOÀI `#visual-motion-react`
 * — Motion [React Beat/Point Move/Transition] không biết gì về lớp này, đúng nguyên tắc tua vít).
 *
 * SỬA (29/09/2026, Giang: "tắt zoom thì zoom vẫn lưu trong state, kể cả boot lại; zoom video riêng, photo riêng") —
 * mức zoom/pan KHÔNG còn về 1 khi tắt kính lúp: lưu bền trong domain 'playerDisplay' (`videoZoom`/`photoZoom`,
 * core/config.js), áp lại mỗi lần vào đúng mode. LƯU DẠNG TỈ LỆ (x, y = phần của bề rộng/cao khung, KHÔNG phải px) —
 * xoay máy/đổi kích thước màn hình vẫn đúng; DOM áp bằng `translate(%)` (phần trăm của CHÍNH khung zoom). Cử chỉ
 * tính bằng px rồi đổi qua lại bằng `convertPlayerZoomToPixels()`/`convertPlayerZoomToFractions()`.
 *
 * Mô hình toạ độ: `transform-origin: 0 0` (assets/css/base.css), transform = translate(x,y) scale(s).
 * Điểm màn hình p = t + s·c (c = toạ độ nội dung). Giới hạn: s ∈ [min,max]; x ∈ [W·(1−s), 0]; y ∈ [H·(1−s), 0]
 * -> s = 1 thì x = y = 0 (khoá giữa), s > 1 thì mép nội dung không bao giờ lọt vào trong khung.
 *
 * 2 nhóm hàm: THUẦN (tính toán, không DOM) + Core-DOM (Rule 2 — nhận giá trị qua tham số, CHỈ đọc/ghi biến DOM
 * tĩnh từ core/dom-refs.js). Không hàm nào gọi hàm core khác; Workflow (event/workflow/player-zoom.js) nối.
 *
 * NẠP SAU: core/dom-refs.js (playerZoomLayer/playerZoomSurface/btnPlayerZoom/btnOpenControlCenter).
 * NẠP TRƯỚC: event/workflow/player-zoom.js.
 */

const PLAYER_ZOOM_MIN_SCALE = 1; // = kích thước theo Resolution của Player — Giang: không cho thu nhỏ hơn
const PLAYER_ZOOM_MAX_SCALE = 5;
/** Mức gốc (không zoom, không pan) — cũng là giá trị reset nhanh ở Settings > Player. */
const PLAYER_ZOOM_DEFAULT = Object.freeze({ scale: 1, x: 0, y: 0 });

// ===================== THUẦN =====================

/** Khoảng cách + trung điểm của 2 điểm chạm (pinch). @param {Array<{x:number,y:number}>} points - đúng 2 điểm
 * @returns {{distance:number, mid:{x:number,y:number}}} */
function resolvePlayerZoomPointerPair(points) {
    const a = points[0], b = points[1];
    return {
        distance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)), // >= 1 — tránh chia 0 lúc 2 ngón trùng điểm
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    };
}

/** Pan 1 ngón — CHƯA kẹp giới hạn (Workflow tự đưa qua clampPlayerZoomState()).
 * @param {{scale:number,x:number,y:number}} base - trạng thái lúc bắt đầu cử chỉ
 * @param {{x:number,y:number}} startPoint @param {{x:number,y:number}} currentPoint
 * @returns {{scale:number,x:number,y:number}} */
function computePlayerZoomPan(base, startPoint, currentPoint) {
    return { scale: base.scale, x: base.x + (currentPoint.x - startPoint.x), y: base.y + (currentPoint.y - startPoint.y) };
}

/** Pinch 2 ngón — điểm nội dung nằm dưới trung điểm lúc bắt đầu luôn đi theo trung điểm hiện tại. CHƯA kẹp.
 * @param {{scale:number,x:number,y:number}} base @param {number} startDistance @param {{x:number,y:number}} startMid
 * @param {number} currentDistance @param {{x:number,y:number}} currentMid @returns {{scale:number,x:number,y:number}} */
function computePlayerZoomPinch(base, startDistance, startMid, currentDistance, currentMid) {
    const scale = base.scale * (currentDistance / startDistance);
    const contentX = (startMid.x - base.x) / base.scale;
    const contentY = (startMid.y - base.y) / base.scale;
    return { scale, x: currentMid.x - scale * contentX, y: currentMid.y - scale * contentY };
}

/** Kẹp scale vào [minScale, maxScale], rồi kẹp translate để nội dung (khung W×H) luôn phủ kín khung — s = 1 thì
 * x = y = 0 (khoá giữa, Giang chốt).
 * @param {{scale:number,x:number,y:number}} state @param {number} viewWidth @param {number} viewHeight
 * @param {number} minScale @param {number} maxScale @returns {{scale:number,x:number,y:number}} */
function clampPlayerZoomState(state, viewWidth, viewHeight, minScale, maxScale) {
    const scale = Math.min(maxScale, Math.max(minScale, state.scale));
    const minX = viewWidth * (1 - scale), minY = viewHeight * (1 - scale);
    return {
        scale,
        x: Math.min(0, Math.max(minX, state.x)),
        y: Math.min(0, Math.max(minY, state.y)),
    };
}

/** Tỉ lệ (x, y = phần của khung) -> px. @param {{scale:number,x:number,y:number}} zoom
 * @param {number} viewWidth @param {number} viewHeight @returns {{scale:number,x:number,y:number}} */
function convertPlayerZoomToPixels(zoom, viewWidth, viewHeight) {
    return { scale: zoom.scale, x: zoom.x * viewWidth, y: zoom.y * viewHeight };
}

/** px -> tỉ lệ (x, y = phần của khung). @param {{scale:number,x:number,y:number}} zoomPx
 * @param {number} viewWidth @param {number} viewHeight @returns {{scale:number,x:number,y:number}} */
function convertPlayerZoomToFractions(zoomPx, viewWidth, viewHeight) {
    return { scale: zoomPx.scale, x: zoomPx.x / (viewWidth || 1), y: zoomPx.y / (viewHeight || 1) };
}

/** Chuẩn hoá 1 giá trị zoom đọc từ config/DB (thiếu/sai kiểu/ngoài giới hạn -> kẹp hoặc về PLAYER_ZOOM_DEFAULT).
 * Làm việc ở hệ TỈ LỆ (khung 1×1) — cùng công thức kẹp của clampPlayerZoomState(), viết lại tại chỗ vì core không
 * gọi core. @param {*} value @returns {{scale:number,x:number,y:number}} */
function sanitizePlayerZoom(value) {
    const isValid = !!value && Number.isFinite(value.scale) && Number.isFinite(value.x) && Number.isFinite(value.y);
    if (!isValid) return { ...PLAYER_ZOOM_DEFAULT };
    const scale = Math.min(PLAYER_ZOOM_MAX_SCALE, Math.max(PLAYER_ZOOM_MIN_SCALE, value.scale));
    return {
        scale,
        x: Math.min(0, Math.max(1 - scale, value.x)),
        y: Math.min(0, Math.max(1 - scale, value.y)),
    };
}

/** Số hiển thị ở Settings > Player > Zoom — pan tính "so với gốc": tâm khung đang nhìn lệch bao nhiêu % so với tâm
 * video/ảnh (0 = đúng giữa; X dương = đang nhìn lệch sang phải, Y dương = lệch xuống dưới; ±50% = sát mép).
 * @param {{scale:number,x:number,y:number}} zoom - hệ tỉ lệ @returns {{scale:number, panXPercent:number, panYPercent:number}} */
function describePlayerZoomForSettings(zoom) {
    return {
        scale: zoom.scale,
        panXPercent: ((0.5 - zoom.x) / zoom.scale - 0.5) * 100,
        panYPercent: ((0.5 - zoom.y) / zoom.scale - 0.5) * 100,
    };
}

// ===================== Core-DOM =====================

/** Kích thước khung zoom (= khung Player, toàn màn hình); đang ẩn (0) -> viewport. @returns {{width:number,height:number}} */
function readPlayerZoomViewportSize() {
    return {
        width: (playerZoomLayer && playerZoomLayer.clientWidth) || window.innerWidth, // core/dom-refs.js
        height: (playerZoomLayer && playerZoomLayer.clientHeight) || window.innerHeight,
    };
}

/** Ghi transform zoom/pan lên `#player-zoom-layer`. scale = 1 -> gỡ hẳn transform (chuỗi rỗng). SỬA 29/09/2026 —
 * nhận hệ TỈ LỆ, translate bằng % (phần trăm kích thước CHÍNH khung zoom) -> đúng cả khi xoay máy/đổi cỡ màn hình.
 * @param {{scale:number,x:number,y:number}} zoom - hệ tỉ lệ */
function applyPlayerZoomTransformToDOM(zoom) {
    if (!playerZoomLayer) return;
    playerZoomLayer.style.transform = zoom.scale === 1 ? '' : `translate(${zoom.x * 100}%, ${zoom.y * 100}%) scale(${zoom.scale})`;
}

/** Hiện/ẩn lớp bắt cử chỉ zoom (che #visualizer-gesture-surface -> cử chỉ app tắt hết). @param {boolean} visible */
function setPlayerZoomSurfaceVisible(visible) {
    if (playerZoomSurface) playerZoomSurface.classList.toggle('hidden', !visible);
}

/** Hiện/ẩn icon kính lúp trong Control Center (chỉ có ở Video/Photo Player mode). @param {boolean} visible */
function setPlayerZoomButtonVisible(visible) {
    if (btnPlayerZoom) btnPlayerZoom.classList.toggle('hidden', !visible);
}

/** Trạng thái sáng của icon kính lúp (đang ở Zoom mode) — cùng class `!text-sky-400` của Shuffle. @param {boolean} active */
function setPlayerZoomButtonActive(active) {
    if (btnPlayerZoom) btnPlayerZoom.classList.toggle('!text-sky-400', active);
}

/** Ép hiện nút mở Control Center trong lúc Zoom mode (vuốt rìa trên đã bị tắt cùng mọi cử chỉ — đây là lối DUY
 * NHẤT để mở Control Center rồi tắt kính lúp, kể cả khi người dùng đã ẩn nút này trong Settings). Class riêng,
 * KHÔNG đụng `force-hidden` của setting (core/visualizer-ui-visibility.js). @param {boolean} forced */
function setControlCenterButtonForcedVisible(forced) {
    if (btnOpenControlCenter) btnOpenControlCenter.classList.toggle('player-zoom-force-visible', forced);
}
