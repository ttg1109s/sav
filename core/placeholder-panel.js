/**
 * core/placeholder-panel.js — Core NGHIỆP VỤ hiện/ẩn DÙNG CHUNG cho các panel placeholder
 * (Game/Statis, MỚI — chưa có nghiệp vụ riêng, cùng hình dạng hệt nhau). Nhận `panelEl` qua tham
 * số (Rule 1 — đây là truyền GIÁ TRỊ chọn ĐÍCH tác động, KHÔNG phải rẽ nhánh chọn TIẾN TRÌNH khác
 * nhau: "hiện panel X" luôn là ĐÚNG 1 tiến trình dù X là Game hay Statis).
 *
 * Photo KHÔNG dùng chung file này — `core/photo-panel.js` riêng vì Photo có `settings-stack-body`
 * lồng bên trong (Album List sub-panel), Game/Statis thì không, giữ tách để không tạo phụ thuộc
 * thừa giữa panel có nghiệp vụ và panel placeholder thuần.
 *
 * NẠP SAU: core/dom-refs.js (gamePanel, statisPanel).
 */

function showPlaceholderPanel(panelEl) {
    panelEl.classList.remove('hidden');
}

function hidePlaceholderPanel(panelEl) {
    panelEl.classList.add('hidden');
}
