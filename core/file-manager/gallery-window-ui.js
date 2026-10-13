/**
 * core/file-manager/gallery-window-ui.js — ghi DOM lưới ảnh/video theo nhóm ngày (markup: components/media-gallery.js;
 * điều phối + IntersectionObserver: event/workflow/{photo,video}-gallery-window.js) và dòng "trống" của picker media.
 *
 * Lúc chạy: fjGallery (CDN, index.html).
 */

/** Chèn khung lưới vào cuối khung cuộn. @param {HTMLElement} scrollEl @param {string} html - renderGalleryWindowHtml()
 * @returns {{containerEl: HTMLElement, groupEls: HTMLElement[]}} khối nhóm theo đúng thứ tự dayKeys */
function mountGalleryWindowUi(scrollEl, html) {
    scrollEl.insertAdjacentHTML('beforeend', html);
    const containerEl = scrollEl.lastElementChild;
    return { containerEl, groupEls: Array.from(containerEl.children) };
}

/** @param {HTMLElement} containerEl */
function removeGalleryWindowUi(containerEl) {
    containerEl.remove();
}

/** Dựng nội dung thật cho 1 nhóm ngày (bỏ placeholder). @param {HTMLElement} groupEl
 * @param {string} placeholderClass @param {string} html - render{Photo,Video}DayGroupHtml() */
function fillGalleryDayGroupUi(groupEl, placeholderClass, html) {
    groupEl.style.height = ''; // nội dung thật tự quyết chiều cao
    groupEl.classList.remove(placeholderClass);
    groupEl.innerHTML = html;
}

/** Layout justified bằng fjGallery (đồng bộ) rồi đo chiều cao thật của nhóm. @param {HTMLElement} groupEl
 * @param {number} rowHeightPx @returns {number} offsetHeight sau layout */
function layoutPhotoDayGroupUi(groupEl, rowHeightPx) {
    fjGallery(groupEl.querySelector('.fj-gallery'), {
        itemSelector: '.fj-gallery-item',
        rowHeight: rowHeightPx,
        rowHeightTolerance: 0.25,
        gutter: 2,
        lastRow: 'left',
        transitionDuration: '0s', // không hiệu ứng khi dựng lại nhóm lúc cuộn nhanh
    });
    return groupEl.offsetHeight;
}

/** @param {HTMLElement} groupEl @returns {number} */
function measureGalleryDayGroupHeightUi(groupEl) {
    return groupEl.offsetHeight;
}

/** Gỡ nội dung nhóm, thay bằng placeholder cao đúng mốc đã đo (cuộn không giật).
 * @param {HTMLElement} groupEl @param {string} placeholderClass @param {number|null} heightPx
 * @returns {string[]} src các `<img>` vừa gỡ — Workflow thu hồi object URL */
function clearGalleryDayGroupUi(groupEl, placeholderClass, heightPx) {
    const urls = Array.from(groupEl.querySelectorAll('img'), (img) => img.src);
    groupEl.innerHTML = '';
    if (heightPx) groupEl.style.height = heightPx + 'px';
    groupEl.classList.add(placeholderClass);
    return urls;
}

/** Thay badge + class "đã chọn" của mọi tile trong 1 nhóm đang hiển thị (không dựng lại ảnh).
 * @param {HTMLElement} groupEl
 * @param {{tileSelector: string, keyName: string, badgeSelector: string, markedClass: string}} spec
 * @param {Map<string, {badgeHtml: string, marked: boolean}>} tileByKey */
function setGalleryTileBadgesUi(groupEl, spec, tileByKey) {
    groupEl.querySelectorAll(spec.tileSelector).forEach((tileEl) => {
        const oldBadge = tileEl.querySelector(spec.badgeSelector);
        if (oldBadge) oldBadge.remove();
        const tile = tileByKey.get(tileEl.dataset[spec.keyName]);
        tileEl.classList.toggle(spec.markedClass, !!tile && tile.marked);
        if (tile && tile.badgeHtml) tileEl.insertAdjacentHTML('beforeend', tile.badgeHtml);
    });
}

/** Ẩn/hiện dòng "trống" của picker media. @param {HTMLElement|null} emptyEl @param {boolean} isEmpty */
function setMediaPickerEmptyUi(emptyEl, isEmpty) {
    if (emptyEl) emptyEl.classList.toggle('hidden', !isEmpty);
}
