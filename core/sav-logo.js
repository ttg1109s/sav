/**
 * core/sav-logo.js — logo header "Audivis" <-> "Audio Visualizer": mở/thu chữ khi hover (desktop, chuột thật) hoặc tap
 * (cảm ứng). Chọn nhánh sự kiện lúc nạp trang ở event/listener/sav-logo.js (qua hasRealHoverDevice()); chuyển động nằm
 * ở CSS (assets/css/misc.css). DOM ref `savLogo`: core/dom-refs.js.
 */

/** Mở/thu chữ logo — bật/tắt class `sav-logo-expanded` trên #sav-logo. @param {boolean} expand */
function setSavLogoExpanded(expand) {
    if (!savLogo) return;
    appState.set('savLogoExpanded', expand);
    console.log(`writer: "setSavLogoExpanded", page: "savLogoExpanded", content: "${expand}"`);
    savLogo.classList.toggle('sav-logo-expanded', expand);
}

/** Thiết bị có hover thật (desktop, chuột) không — Listener dùng để chọn bộ sự kiện lúc nạp trang. */
function hasRealHoverDevice() {
    return !!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches);
}
