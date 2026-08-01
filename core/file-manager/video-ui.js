/**
 * core/file-manager/video-ui.js — MỚI (21/07/2026), File Manager -> Video.
 *
 * XOÁ (ver12 "Song/Video Unification", Batch 5, mục 6c, 27/07/2026) — `openVideoPreviewModal()`
 * (modal xem video full-screen cũ, ĐÃ CHẾT từ 21/07/2026 — bị thay bằng dropdown
 * `openVideoTileActionMenu()`) XOÁ HẲN, thay bằng `openVideoInfoModal()` (tab "Chi tiết" riêng).
 *
 * XOÁ TIẾP (phản hồi Giang 28/07/2026) — `openVideoInfoModal()` CŨNG xoá hẳn, KHÔNG viết lại: phát
 * hiện modal Details/Edit/Cover CÓ SẴN của Playlist (`core/playlist/actions.js::
 * openSongEditModal()`) đã tự mở được cho CẢ Video (Batch 1, Adapter khiến playlistCache của Video
 * dùng chung shape với Song) — chỉ là CHƯA video-aware. Sửa thẳng hàm đó video-aware (tab "Chi
 * tiết" đổi thành thông số kỹ thuật, tab "Sửa" chỉ còn 1 ô customName, tab "Ảnh bìa" ẩn hẳn) THAY
 * VÌ giữ 2 hệ thống "Chi tiết" song song (1 ở Playlist, 1 ở File Manager) — tránh lệch dữ liệu
 * (Play Count/Listened chỉ hoạt động đúng ở modal của Playlist). Lựa chọn "Chi tiết" trong dropdown
 * tile File Manager → Video (`openVideoTileActionMenu()`, event/workflow/file-manager-video.js)
 * cũng đã bỏ theo — panel File Manager → Video này SẼ BỊ XOÁ HẲN ở 6d (chờ Batch 6 "Upload theo
 * Nguồn tại Playlist"), không đáng xây/giữ 1 đường dùng tạm.
 *
 * File này hiện KHÔNG có hàm nào — giữ lại (rỗng) để không phải sửa index.html nếu sau này thật sự
 * cần 1 hàm dựng UI riêng cho Video. Xoá tay nếu Giang muốn dọn hẳn.
 */

/** MỚI (31/07/2026, Giang chỉ ra "core tạo ra addEventListener chứ không phải workflow" — rà rộng
 * ra ngoài Photo/Edit) — TÁCH RA từ event/workflow/file-manager-video.js::openVideoBgPicker(),
 * cùng khuôn `openPhotoImagePickerDrawerUi()` (core/file-manager/photo-ui.js) — dựng headerHtml +
 * gọi `openGenericDrawer()` + wire NGAY closeBtn/delegated click tile, TẤT CẢ Ở ĐÂY (Rule 5a — DOM
 * động, callback CHỈ `eventBus.send()`, gom cuối hàm). `bodyHtml` nhận SẴN từ Workflow (Rule 2).
 * @param {string} title @param {string} bodyHtml
 */
function openVideoPickerDrawerUi(title, bodyHtml) {
    openGenericDrawer({ // core/generic-drawer.js
        height: '90vh',
        zIndex: Z_INDEX.GENERIC_DRAWER, // service/z-index.js — mặc định, không có modal nào khác mở đồng thời picker này
        headerHtml: `
            <div class="flex justify-between items-center px-5 pb-3 border-b border-slate-200">
                <h3 class="text-base font-bold text-slate-900">${title}</h3>
                <button id="btn-generic-drawer-close" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-500" title="${t('common.close')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        `,
        bodyHtml,
        bodyClass: 'flex flex-col',
    });
    const closeBtn = genericDrawerHeader.querySelector('#btn-generic-drawer-close');
    if (closeBtn) closeBtn.addEventListener('click', () => eventBus.send({ router: 'fileManagerVideo', type: 'fileManagerVideo.videoPicker.close.click', payload: {} }));

    // Click tile — delegated NGAY TRÊN genericDrawerBody (phần tử TĨNH DÙNG CHUNG nhiều feature,
    // dom-refs.js — cùng lý do PHẢI tự wire ở đây thay vì Listener tĩnh, xem docstring
    // core/file-manager/photo-ui.js::openPhotoImagePickerDrawerUi()).
    genericDrawerBody.addEventListener('click', (e) => {
        const tile = e.target.closest('[data-video-key]');
        if (!tile) return;
        eventBus.send({ router: 'fileManagerVideo', type: 'fileManagerVideo.videoPicker.tile.click', payload: { videoKey: tile.dataset.videoKey } });
    });
}

