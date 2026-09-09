/**
 * Restore / Export bài hát: đọc record từ IndexedDB, ghi tag mới nhất (record.tag + record.cover)
 * vào blob mp3 qua browser-id3-writer, trigger download — KHÔNG ghi blob mới này trở lại
 * IndexedDB (record gốc trong DB giữ nguyên blob chưa từng bị ghi tag — xem mục 3.6 plan).
 *
 * SỬA (Batch "Export dọn nợ kiến trúc", phản hồi Giang, plan-v12-song-video-unification.md mục 6f)
 * — `exportSongWithTag(key)` (bản 1 file lẻ) ĐÃ DỜI sang `event/workflow/playlist.js`: hàm đó tự
 * đọc DB + tự bọc `withLoadingShield()` + tự gọi `alertModal()` — đúng HÌNH DẠNG WORKFLOW (điều
 * phối nhiều bước phụ thuộc + side-effect UI), NẰM SAI chỗ khi còn ở 1 file `core/` (core CẤM gọi
 * `withLoadingShield`/`alertModal` theo core-function-conventions.md). File này giờ còn 4 hàm
 * Core THUẦN dưới đây — dùng CHUNG cho cả Song lẫn Video (Video bỏ qua `buildTaggedBlob()`, xem
 * `exportVideoFile()`/`exportSelectedVideosZip()`, event/workflow/playlist.js). `triggerDownload()`/
 * `promptDownloadReady()` MỚI (10/09/2026) dùng chung rộng hơn nữa — cả Storage Management/Folder
 * Download (event/workflow/file-manager-storage.js, file-manager-folder-browser.js).
 */
        async function buildTaggedBlob(record) {
            const arrayBuffer = await record.blob.arrayBuffer();
            const writer = new ID3Writer(arrayBuffer);
            writer.setFrame('TIT2', record.tag.title || '');
            writer.setFrame('TPE1', [record.tag.artist || '']);
            writer.setFrame('TALB', record.tag.album || '');

            if (record.cover) {
                const coverBuffer = await record.cover.arrayBuffer();
                writer.setFrame('APIC', {
                    type: 3,
                    data: coverBuffer,
                    description: 'Cover'
                });
            }

            writer.addTag();
            return writer.getBlob();
        }

        /**
         * FIX (10/09/2026, Giang báo bug qua ảnh chụp — "export ở PWA bị ép về màn Quick Look thay
         * vì tải xuống thật") — `<a download>` + `.click()` hoạt động ĐÚNG trên desktop/Android,
         * nhưng iOS standalone/PWA thường KHÔNG tải thật (mở Quick Look xem trước — "Mở trong
         * CapCut"/"Thêm...", không tự lưu vào Files). `navigator.share({files:[...]})` mở ĐÚNG Share
         * Sheet thật của iOS (có "Lưu vào Files"/"Lưu Video") — dùng khi hỗ trợ
         * (`canShare({files})`), fallback về `<a download>` cũ khi không (desktop/Android/Safari cũ
         * hơn 15, hoặc bất kỳ lỗi nào khác).
         *
         * LƯU Ý BẮT BUỘC nơi GỌI hàm này — `navigator.share()` chỉ hoạt động trong lúc còn "user
         * activation" (vài giây kể từ lượt bấm THẬT của người dùng, KHÔNG sống sót qua 1 tác vụ bất
         * đồng bộ dài như build zip) — nếu gọi hàm này SAU KHI đã `await` một tác vụ dài,
         * `navigator.share()` sẽ lỗi (KHÔNG mở Share Sheet, rơi về `<a download>` = quay lại đúng
         * bug Quick Look). Nơi gọi PHẢI đảm bảo hàm này chạy TRỰC TIẾP trong 1 event handler thật
         * (vd nút "Tải xuống" của modalChoice(), xem `promptDownloadReady()` ngay dưới — KHÔNG gọi
         * thẳng `triggerDownload()` ngay sau khi 1 blob build xong nữa).
         * @param {Blob} blob @param {string} filename
         */
        async function triggerDownload(blob, filename) {
            if (navigator.canShare && navigator.share) {
                try {
                    const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
                    if (navigator.canShare({ files: [file] })) {
                        await navigator.share({ files: [file] });
                        return;
                    }
                } catch (err) {
                    // Người dùng tự bấm Huỷ ở Share Sheet cũng ném AbortError tại đây — tôn trọng,
                    // KHÔNG rơi xuống <a download> trong case đó (đã hiện đúng UI, họ chỉ đổi ý).
                    if (err && err.name === 'AbortError') return;
                    console.warn('[triggerDownload] navigator.share() lỗi, dùng lại <a download>:', err);
                }
            }
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = filename; a.click();
            URL.revokeObjectURL(url);
        }

        /**
         * MỚI (10/09/2026, cùng bug/lý do docstring `triggerDownload()` ngay trên) — hiện
         * modalChoice() "File đã sẵn sàng — {size}", nút "Tải xuống" bên trong CHÍNH nó mới gọi
         * `triggerDownload()` (giữ ĐÚNG user-activation của lượt bấm nút đó, KHÔNG phải lượt bấm gốc
         * đã hết hạn từ lâu) — DÙNG CHUNG cho MỌI luồng export/tải xuống hiện có (Song/Video/Photo
         * export lẻ + zip hàng loạt ở event/workflow/playlist.js, zip Storage Management + Folder
         * Download ở event/workflow/file-manager-storage.js) — nơi gọi CHỈ cần build xong blob rồi
         * gọi hàm này THAY VÌ tự gọi `triggerDownload()` trực tiếp.
         * @param {Blob} blob @param {string} filename
         * @returns {Promise<void>} resolve khi modal đã đóng (bấm Tải xuống HOẶC Huỷ)
         */
        function promptDownloadReady(blob, filename) {
            return new Promise((resolve) => {
                modalChoice( // core/modal-choice-ui.js
                    tFormat('common.export.readyBody', { size: formatBytes(blob.size) }), // core/about-stats.js
                    [{ label: t('common.export.readyBtnDownload'), className: 'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors', themeKeys: 'btnPrimaryBg btnPrimaryHoverBg textOnAccent', onClick: () => { triggerDownload(blob, filename); resolve(); } }],
                    { title: t('common.export.readyTitle'), onCancel: () => resolve() }
                );
            });
        }
