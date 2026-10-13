/**
 * components/media-gallery.js — markup lưới ảnh/video theo nhóm ngày (event/workflow/{photo,video}-gallery-window.js,
 * ghi DOM ở core/file-manager/gallery-window-ui.js) và khung picker media trong Generic Drawer.
 *
 * NẠP SAU: core/ui-theme/icon-svg-ui.js (iconSvg). Lúc chạy: escapeHtml() (core/modal-choice-ui.js).
 */

/** Khung cuộn của picker media (lưới chèn vào trong) + dòng "trống" ẩn sẵn.
 * @param {string} scrollId @param {string} emptyId @param {string} emptyText @param {string} emptyUitk - token màu chữ */
function renderMediaPickerBodyHtml(scrollId, emptyId, emptyText, emptyUitk) {
    return `
            <div class="flex-1 min-h-0 overflow-y-auto relative" id="${scrollId}">
                <p id="${emptyId}" class="hidden text-sm text-center py-10 px-6" data-uitk="${emptyUitk}">${emptyText}</p>
            </div>
        `;
}

/** Khung lưới: 1 khối rỗng cho mỗi nhóm ngày (nội dung dựng khi nhóm gần vùng nhìn).
 * @param {'photo'|'video'} prefix - tiền tố class CSS @param {string[]} dayKeys */
function renderGalleryWindowHtml(prefix, dayKeys) {
    return `<div class="${prefix}-gallery-window">${dayKeys.map((dayKey) => `<div class="${prefix}-day-group" data-day-key="${escapeHtml(dayKey)}"></div>`).join('')}</div>`;
}

/** Badge chọn của 1 tile: số thứ tự chọn nếu có, không thì dấu tick. Rỗng khi lưới không bật badge.
 * @param {'photo'|'video'} prefix @param {{hasBadge: boolean, orderNumber: number|null}} state */
function renderGalleryTileBadgeHtml(prefix, state) {
    if (!state.hasBadge) return '';
    const inner = state.orderNumber ? `<span class="${prefix}-tile-badge-num">${state.orderNumber}</span>` : iconSvg('check', 'h-3 w-3 text-white');
    return `<span class="${prefix}-tile-badge ${prefix}-tile-badge-select">${inner}</span>`;
}

/** Nội dung 1 nhóm ngày của lưới ảnh (fjGallery layout sau khi chèn). `width`/`height` gốc để fjGallery tính tỉ lệ
 * trước khi ảnh tải xong (record cũ không có thì bỏ attribute).
 * @param {{onLight: boolean, headerText: string, tiles: Array<{key: string, src: string, width?: number, height?: number, alt: string, marked: boolean, badgeHtml: string}>}} data */
function renderPhotoDayGroupHtml({ onLight, headerText, tiles }) {
    const tilesHtml = tiles.map((tile) => `<div class="fj-gallery-item${tile.marked ? ' photo-tile-marked' : ''}" data-image-key="${escapeHtml(tile.key)}">`
        + `<img src="${tile.src}"${tile.width > 0 ? ` width="${tile.width}"` : ''}${tile.height > 0 ? ` height="${tile.height}"` : ''} alt="${escapeHtml(tile.alt)}">`
        + `${tile.badgeHtml}</div>`).join('');
    return `<div class="photo-day-header${onLight ? ' photo-day-header--on-light' : ''}">${escapeHtml(headerText)}</div><div class="fj-gallery">${tilesHtml}</div>`;
}

/** Nội dung 1 nhóm ngày của lưới video (CSS Grid cố định cột, `.video-grid`).
 * @param {{onLight: boolean, headerText: string, tiles: Array<{key: string, src: string, alt: string, durationText: string, marked: boolean, badgeHtml: string}>}} data */
function renderVideoDayGroupHtml({ onLight, headerText, tiles }) {
    const tilesHtml = tiles.map((tile) => `<div class="video-tile${tile.marked ? ' video-tile-marked' : ''}" data-video-key="${escapeHtml(tile.key)}">`
        + `<img src="${tile.src}" alt="${escapeHtml(tile.alt)}"><span class="video-tile-duration">${escapeHtml(tile.durationText)}</span>`
        + `${tile.badgeHtml}</div>`).join('');
    return `<div class="video-day-header${onLight ? ' video-day-header--on-light' : ''}">${escapeHtml(headerText)}</div><div class="video-grid">${tilesHtml}</div>`;
}
