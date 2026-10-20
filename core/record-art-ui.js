/**
 * core/record-art-ui.js — ảnh bìa tròn #record-art trong nút Play của Bottom Player. Bị thay mỗi lần đổi media nên không có
 * trong core/dom-refs.js; markup ở components/bottom-player.js::renderRecordArtHtml().
 * NẠP SAU: service/component-dynamic.js, core/dom-refs.js.
 */

/** Thay #record-art trong khung chứa. `src`/`alt` gán qua slot (tên file có ký tự HTML không phá markup).
 * @param {HTMLElement} containerEl - #record-container @param {string} html - renderRecordArtHtml()
 * @param {string} src @param {string} alt @returns {HTMLImageElement|null} #record-art vừa dựng — để nơi gọi gắn fallback lỗi ảnh */
function mountRecordArt(containerEl, html, src, alt) {
    containerEl.replaceChildren(instantiateComponent(html, {
        src: { selector: '#record-art', prop: 'src', value: src },
        alt: { selector: '#record-art', prop: 'alt', value: alt },
    })); // service/component-dynamic.js
    return containerEl.querySelector('#record-art');
}

/** Đổi ảnh của #record-art đang hiện (không dựng lại). @param {string} src
 * @returns {HTMLImageElement|null} phần tử vừa đổi (null nếu chưa mount) — để nơi gọi gắn lại fallback lỗi ảnh */
function setRecordArtSrc(src) {
    const recordArtEl = document.getElementById('record-art');
    if (recordArtEl) recordArtEl.src = src;
    return recordArtEl;
}
