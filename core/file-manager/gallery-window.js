/**
 * core/file-manager/gallery-window.js — core thuần cho lưới ảnh/video theo nhóm ngày
 * (event/workflow/{photo,video}-gallery-window.js).
 */

/** Trạng thái badge của từng tile. `selectedKeys` là Map (chọn nhiều có đánh số: key -> số thứ tự) hoặc Set.
 * @param {string[]} keys @param {'multiSelect'|null} badgeMode @param {Set<string>|Map<string, number>} selectedKeys
 * @returns {Array<{key: string, hasBadge: boolean, orderNumber: number|null, marked: boolean}>} */
function computeGalleryTileStates(keys, badgeMode, selectedKeys) {
    const isOrdered = selectedKeys instanceof Map;
    return keys.map((key) => ({
        key,
        hasBadge: !!badgeMode,
        orderNumber: isOrdered ? (selectedKeys.get(key) || null) : null,
        marked: !!badgeMode && selectedKeys.has(key),
    }));
}
