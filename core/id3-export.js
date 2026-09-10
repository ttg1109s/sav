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
         *
         * FIX (10/09/2026, Giang báo bug "nén xong không crash, nhưng bấm Tải xuống với file lớn
         * (zip >500MB) vẫn crash app") — tìm hiểu + kiểm chứng qua nhiều nguồn: (1) Safari/WebKit có
         * lịch sử lỗi/giới hạn thật với Blob rất lớn qua `URL.createObjectURL()`/đọc lại (nhiều báo
         * cáo độc lập, không phải lỗi code app); (2) StreamSaver.js — giải pháp phổ biến nhất để tải
         * file lớn không tốn RAM — CHÍNH THỨC không hỗ trợ Safari (thiếu Streams/Service Worker theo
         * đúng cách cần), không dùng được cho đúng nền tảng đang gặp lỗi; (3) `navigator.share()`
         * phải bàn giao dữ liệu qua tiến trình OS (Share Sheet) — nhiều khả năng cần 1 bản sao ĐẦY ĐỦ
         * trong bộ nhớ để chuyển giao, không "stream" được như ghi file thường — ĐÚNG bước duy nhất
         * KHÁC với lúc packing (packing stream thẳng vào OPFS, không hề dựng lại Blob nào).
         *
         * SỬA: file vượt `LARGE_FILE_SKIP_SHARE_BYTES` (500MB, Giang đề xuất) bỏ HẲN
         * `navigator.share()` — né bước OS phải nhận toàn bộ file cùng lúc — dùng thẳng `<a
         * download>` như cơ chế tải mặc định của trình duyệt. Đồng thời bỏ luôn bước bọc
         * `new File([blob], filename, {type})` cho nhánh `<a download>` (dù file lớn hay nhỏ) —
         * `a.download` đã tự đặt tên hiển thị, KHÔNG cần dựng Blob/File MỚI chỉ để đổi tên (dựng
         * Blob mới từ 1 Blob/File đã có là bước có khả năng ép sao chép lại toàn bộ byte, nghi vấn
         * hàng đầu gây crash) — dùng thẳng `blob` GỐC (đã sẵn là 1 File thật nếu tới từ OPFS, xem
         * `buildZipStreamingToOpfs()`, core/streaming-zip.js).
         *
         * ĐÁNH ĐỔI: file lớn trong PWA/standalone sẽ quay lại đúng hành vi Quick Look đã sửa trước
         * đó (không tự lưu, chỉ xem trước) — CHƯA có cách nào khác được xác nhận hoạt động trên
         * Safari cho file cỡ lớn (StreamSaver.js không hỗ trợ Safari); ưu tiên "tải được, dù bất
         * tiện" hơn "chắc chắn crash app". CHƯA KIỂM CHỨNG THỰC TẾ trên thiết bị — nếu `<a download>`
         * VẪN crash với file cỡ này, đây là giới hạn hiện tại của WebKit với Blob lớn, không phải lỗi
         * code app — Giang báo lại kết quả test.
         * @param {Blob} blob @param {string} filename
         */
        const LARGE_FILE_SKIP_SHARE_BYTES = 500 * 1024 * 1024; // 500MB — Giang đề xuất

        async function triggerDownload(blob, filename) {
            const isLargeFile = blob.size > LARGE_FILE_SKIP_SHARE_BYTES;
            if (!isLargeFile && navigator.canShare && navigator.share) {
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
            // <a download> trực tiếp trên `blob` GỐC — KHÔNG bọc new File() (xem lý do đầy đủ ở
            // docstring hàm này) — `a.download` tự lo phần đặt tên hiển thị.
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
         *
         * FIX (10/09/2026, Giang báo bug "tải zip lỗi/rỗng ở Storage Management, Folder, chế độ
         * Chọn") — GỐC BỆNH: nút "Tải xuống" TRƯỚC ĐÂY gọi `triggerDownload(blob, filename)` (hàm
         * ASYNC — `navigator.share()`/đọc Blob vẫn đang chạy dở) nhưng KHÔNG `await` nó trước khi
         * gọi `resolve()` ngay dòng sau — Promise của `promptDownloadReady()` vì vậy resolve gần
         * như NGAY LẬP TỨC, trước khi việc tải/share thật sự xong. Với zip STREAM từ OPFS
         * (`buildZipStreamingToOpfs()`, core/streaming-zip.js — mọi zip ở Storage Management/Folder
         * Download/chế độ Chọn giờ đều đi qua đường này), nơi gọi (`zipAndDownloadOrFallback()`,
         * event/workflow/file-manager-storage.js; `exportSelectedSongsZip()` và 2 hàm zip Video/
         * Photo tương ứng, event/workflow/playlist.js) LUÔN `await promptDownloadReady(...)` XONG
         * RỒI MỚI gọi `cleanupStreamingZipTemp()` xoá file .zip tạm khỏi OPFS — resolve sớm khiến
         * bước xoá đó chạy CHỒNG LẤN lúc `navigator.share()`/`<a download>` còn đang đọc dở đúng
         * file vừa bị xoá, sinh lỗi/file rỗng/Share Sheet báo thất bại. Giờ `.finally(resolve)` —
         * đợi `triggerDownload()` chạy XONG (thành công hay lỗi đều tính là xong) rồi mới resolve,
         * đảm bảo bước dọn OPFS ở nơi gọi luôn diễn ra SAU khi đã đọc xong dữ liệu thật.
         *
         * MỚI (10/09/2026, Giang yêu cầu) — nếu `blob` đi qua `_compressZipEntries()` (core/storage-
         * manager.js — MỌI luồng zip: Storage Management/Folder/chế độ Chọn), nó có sẵn thuộc tính
         * JS tuỳ biến `_zipDurationMs` (tổng thời gian nén, đo ở đó) — đọc lại đây để hiện thêm
         * "thời gian xử lý" trong modal. Export lẻ 1 file (Song/Video/Photo, KHÔNG qua
         * `_compressZipEntries()`) sẽ KHÔNG có thuộc tính này — modal tự rơi về bản KHÔNG có dòng
         * thời gian xử lý (2 chuỗi dịch riêng, xem lang/patch/patch-common.js).
         * @param {Blob} blob @param {string} filename
         * @returns {Promise<void>} resolve khi modal đã đóng VÀ triggerDownload() đã chạy xong (bấm Tải xuống), hoặc đóng ngay (bấm Huỷ)
         */
        function promptDownloadReady(blob, filename) {
            return new Promise((resolve) => {
                const bodyText = blob._zipDurationMs != null
                    ? tFormat('common.export.readyBodyWithDuration', { size: formatBytes(blob.size), duration: _formatProcessingDuration(blob._zipDurationMs) })
                    : tFormat('common.export.readyBody', { size: formatBytes(blob.size) }); // core/about-stats.js
                modalChoice( // core/modal-choice-ui.js
                    bodyText,
                    [{ label: t('common.export.readyBtnDownload'), className: 'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors', themeKeys: 'btnPrimaryBg btnPrimaryHoverBg textOnAccent', onClick: () => { triggerDownload(blob, filename).finally(resolve); } }],
                    { title: t('common.export.readyTitle'), onCancel: () => resolve() }
                );
            });
        }

        /** Định dạng số mili-giây thành chuỗi ngắn cho "thời gian xử lý" trong modal
         * `promptDownloadReady()` ngay trên — MỚI (10/09/2026, Giang yêu cầu). Cố tình KHÔNG dùng
         * `formatDurationLong()` (core/about-stats.js, đơn vị giờ/phút — dành cho tổng thời lượng
         * nghe, quá thô cho việc đo vài giây/vài chục giây của bước nén zip).
         * @param {number} ms @returns {string}
         */
        function _formatProcessingDuration(ms) {
            const totalSeconds = ms / 1000;
            if (totalSeconds < 60) return `${totalSeconds.toFixed(1)}s`;
            const m = Math.floor(totalSeconds / 60);
            const s = Math.round(totalSeconds % 60);
            return `${m}m ${s}s`;
        }
