/**
 * core/edit-history.js — Core THUẦN. Undo/Redo PHỔ QUÁT — không biết gì về nghiệp vụ cụ thể, chỉ
 * quản lý mảng `entries` (snapshot kiểu bất kỳ, do nơi gọi tự định nghĩa) + con trỏ `index`.
 * Workflow tự định nghĩa "snapshot" là gì và tự áp lại khi Undo/Redo.
 *
 * Mọi hàm TRẢ VỀ session mới, KHÔNG mutate tham số đầu vào (khuôn core/crop-selector.js).
 */

/** @param {*} initialSnapshot @returns {{entries: Array<*>, index: number}} */
function initHistorySession(initialSnapshot) {
    return { entries: [initialSnapshot], index: 0 };
}

/** Đẩy snapshot mới — cắt bỏ mọi entry sau `index` hiện tại trước khi đẩy (nhánh Redo cũ mất, đúng
 * hành vi Ctrl+Z/Ctrl+Y chuẩn). @param {{entries: Array<*>, index: number}} session @param {*} snapshot
 * @returns {{entries: Array<*>, index: number}} */
function pushHistoryEntry(session, snapshot) {
    const kept = session.entries.slice(0, session.index + 1);
    kept.push(snapshot);
    return { entries: kept, index: kept.length - 1 };
}

/** Lùi 1 bước — nơi gọi tự đọc `getCurrentHistorySnapshot()` ngay sau rồi tự áp vào state nghiệp
 * vụ của mình. @param {{entries: Array<*>, index: number}} session @returns {{entries: Array<*>, index: number}} */
function undoHistory(session) {
    return { entries: session.entries, index: Math.max(0, session.index - 1) };
}

/** Tiến 1 bước, cùng lý do `undoHistory()`. @param {{entries: Array<*>, index: number}} session
 * @returns {{entries: Array<*>, index: number}} */
function redoHistory(session) {
    return { entries: session.entries, index: Math.min(session.entries.length - 1, session.index + 1) };
}

/** @param {{entries: Array<*>, index: number}} session @returns {*} snapshot tại con trỏ hiện tại. */
function getCurrentHistorySnapshot(session) {
    return session.entries[session.index];
}

/** @param {{entries: Array<*>, index: number}} session @returns {boolean} */
function canUndoHistory(session) {
    return session.index > 0;
}

/** @param {{entries: Array<*>, index: number}} session @returns {boolean} */
function canRedoHistory(session) {
    return session.index < session.entries.length - 1;
}
