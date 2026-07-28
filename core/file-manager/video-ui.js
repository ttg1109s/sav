/**
 * core/file-manager/video-ui.js — MỚI (21/07/2026), File Manager -> Video. Hàm dựng UI (Rule 5:
 * "hàm dựng UI VẪN là hàm nghiệp vụ" — chịu ĐỦ Rule 1-4, KHÔNG được miễn trừ; Rule 5a/5c thêm nữa:
 * addEventListener gom cuối hàm + callback CHỈ gọi tham số/bắn eventBus, hậu tố `-ui.js` bắt buộc
 * cho file toàn `createElement`).
 *
 * XOÁ (ver12 "Song/Video Unification", Batch 5, mục 6c) — `openVideoPreviewModal()` (modal xem
 * video full-screen cũ, ĐÃ CHẾT từ 21/07/2026 — bị THAY bằng dropdown `openVideoTileActionMenu()`,
 * 0 lời gọi từ đó tới giờ) XOÁ HẲN, thay bằng `openVideoInfoModal()` (tab "Chi tiết" MỚI, mục 6c).
 *
 * `formatVideoDuration()` (core/file-manager/video.js) ĐƯỢC gọi thẳng ở đây dù CÙNG là core — coi
 * như ngoại lệ "hàm định dạng thuần" (t()/tFormat()/escapeHtml()/formatBytes() đều đã dùng khắp
 * project theo đúng tinh thần này, xem core/about-stats.js) — KHÔNG phải "core gọi core" nghiệp vụ
 * (không I/O, không rẽ nhánh tiến trình, chỉ đổi 1 số thành 1 chuỗi hiển thị).
 *
 * NẠP SAU: core/dom-refs.js (không tham chiếu trực tiếp ở đây, nhưng gom nhóm cho dễ đọc),
 * lang/lang.js (t()), core/modal-choice.js (escapeHtml()), core/file-manager/video.js
 * (formatVideoDuration()).
 */

/**
 * Modal "Chi tiết" 1 video — tên hiển thị (customName, SỬA được) + thông tin đọc-chỉ (định dạng/
 * codec/độ phân giải/fps/thời lượng/bitrate/ngày tải, PHÂN TÍCH SẴN lúc upload qua mediainfo.js —
 * xem event/workflow/file-manager-video.js::_extractVideoMediaInfo()). Bấm "Lưu" CHỈ bắn eventBus
 * (Rule 5a — không gọi callback tham số), cùng khuôn `openRenameFolderModal()`
 * (core/file-manager/folder-picker-ui.js).
 * @param {{key: string, filename: string, customName?: string|null, format?: string, codec?: string,
 *          fps?: string, width?: number, height?: number, duration?: number, bitrate?: number,
 *          addedAt?: number}} video
 */
function openVideoInfoModal(video) {
    const stale = document.getElementById('video-info-overlay');
    if (stale) stale.remove();

    const overlay = document.createElement('div');
    overlay.id = 'video-info-overlay';
    overlay.className = 'fixed inset-0 z-[130] bg-black/70 backdrop-blur-sm flex items-center justify-center px-5';

    const card = document.createElement('div');
    card.className = 'bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-sm p-5 shadow-2xl flex flex-col gap-4 max-h-[85vh] overflow-y-auto';

    const titleEl = document.createElement('h3');
    titleEl.className = 'text-base font-bold text-white';
    titleEl.textContent = t('fileManager.video.info.title');
    card.appendChild(titleEl);

    function closeModal() { overlay.remove(); }

    // ---- Tên hiển thị (sửa được) ----
    const nameLabelEl = document.createElement('label');
    nameLabelEl.className = 'text-xs font-medium text-slate-400';
    nameLabelEl.textContent = t('fileManager.video.info.customNameLabel');
    card.appendChild(nameLabelEl);

    const inputEl = document.createElement('input');
    inputEl.type = 'text';
    inputEl.value = video.customName || '';
    inputEl.placeholder = video.filename || '';
    inputEl.className = 'bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500 focus:bg-black/60 transition-colors';
    card.appendChild(inputEl);

    // ---- Thông tin đọc-chỉ ----
    const infoListEl = document.createElement('div');
    infoListEl.className = 'flex flex-col divide-y divide-white/5 rounded-xl border border-white/10 overflow-hidden text-sm';

    const resolutionText = (video.width && video.height) ? `${video.width}×${video.height}` : '—';
    const durationText = video.duration ? formatVideoDuration(video.duration) : '—'; // core/file-manager/video.js — xem docstring đầu file
    const fpsText = video.fps ? `${parseFloat(video.fps).toFixed(video.fps % 1 === 0 ? 0 : 2)}` : '—';
    const bitrateText = video.bitrate ? `${(video.bitrate / 1000000).toFixed(1)} Mbps` : '—';
    const dateText = video.addedAt ? new Date(video.addedAt).toLocaleDateString(navigator.language) : '—';

    const rows = [
        [t('fileManager.video.info.rowFilename'), video.filename || '—'],
        [t('fileManager.video.info.rowFormat'), video.format || '—'],
        [t('fileManager.video.info.rowCodec'), video.codec || '—'],
        [t('fileManager.video.info.rowResolution'), resolutionText],
        [t('fileManager.video.info.rowFps'), fpsText],
        [t('fileManager.video.info.rowDuration'), durationText],
        [t('fileManager.video.info.rowBitrate'), bitrateText],
        [t('fileManager.video.info.rowAddedAt'), dateText],
    ];
    rows.forEach(([label, value]) => {
        const rowEl = document.createElement('div');
        rowEl.className = 'flex justify-between items-center gap-3 px-3 py-2';
        const labelEl = document.createElement('span');
        labelEl.className = 'text-slate-400 shrink-0';
        labelEl.textContent = label;
        const valueEl = document.createElement('span');
        valueEl.className = 'text-slate-200 truncate text-right';
        valueEl.textContent = value; // textContent — an toàn dù filename là dữ liệu người dùng tự đặt
        rowEl.appendChild(labelEl);
        rowEl.appendChild(valueEl);
        infoListEl.appendChild(rowEl);
    });
    card.appendChild(infoListEl);

    // ---- 2 nút Huỷ/Lưu ----
    const btnRow = document.createElement('div');
    btnRow.className = 'flex gap-3';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-sm font-semibold transition-colors';
    cancelBtn.textContent = t('common.cancel');
    const saveBtn = document.createElement('button');
    saveBtn.className = 'flex-1 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold transition-colors';
    saveBtn.textContent = t('common.ok');
    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(saveBtn);
    card.appendChild(btnRow);

    overlay.appendChild(card);
    document.body.appendChild(overlay);
    inputEl.focus();

    // --- addEventListener: gom cuối hàm (Rule 5a) — callback CHỈ bắn eventBus.send() ---
    cancelBtn.addEventListener('click', closeModal);
    saveBtn.addEventListener('click', () => {
        const customName = inputEl.value.trim();
        closeModal();
        eventBus.send({ router: 'fileManagerVideo', type: 'fileManagerVideo.info.rename.confirm', payload: { videoKey: video.key, customName: customName || null } });
    });
}
