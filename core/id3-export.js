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
         * (zip >500MB) vẫn crash app") — `navigator.share()` với file lớn phải bàn giao dữ liệu qua
         * tiến trình OS (Share Sheet), nhiều khả năng cần 1 bản sao ĐẦY ĐỦ trong bộ nhớ để chuyển
         * giao — ĐÚNG bước duy nhất KHÁC với lúc packing (packing stream thẳng vào OPFS, không hề
         * dựng lại Blob nào). File vượt `LARGE_FILE_SKIP_SHARE_BYTES` (500MB, Giang đề xuất) bỏ HẲN
         * `navigator.share()` — né bước OS phải nhận toàn bộ file cùng lúc.
         *
         * FIX (10/09/2026, Giang báo qua ảnh chụp — bỏ navigator.share() cho file lớn KHÔNG còn
         * crash, nhưng `<a download>` với `blob:` URL lại lỗi "Không thể hoàn tất tác vụ (Lỗi
         * WebKitBlobResource 1.)" — bug WebKit đã ghi nhận từ 2019, chưa sửa, CHỈ xảy ra với URL
         * `blob:` lớn, tìm kiếm không thấy cách vá ở tầng JS cho chính đường `blob:` này) — file lớn
         * giờ ưu tiên `triggerLargeFileDownloadViaServiceWorker()` (core/large-file-download.js —
         * Cache Storage + Service Worker, phục vụ qua 1 URL CÙNG ORIGIN THẬT thay vì `blob:`, né hẳn
         * lớp bug đó) NẾU khả dụng (`isLargeFileDownloadSupported()` — cần HTTPS, KHÔNG hoạt động
         * qua `file://`); không khả dụng thì mới rơi về `<a download>`/`blob:` cũ như trước (vẫn có
         * thể dính đúng bug WebKitBlobResource, CHƯA có cách nào khác đã xác nhận hoạt động qua
         * `file://`).
         *
         * Đồng thời bỏ luôn bước bọc `new File([blob], filename, {type})` cho nhánh `<a download>`/
         * `blob:` cuối (dù file lớn hay nhỏ) — `a.download` đã tự đặt tên hiển thị, KHÔNG cần dựng
         * Blob/File MỚI chỉ để đổi tên (dựng Blob mới từ 1 Blob/File đã có là bước có khả năng ép
         * sao chép lại toàn bộ byte, nghi vấn hàng đầu gây crash ở `navigator.share()`) — dùng thẳng
         * `blob` GỐC (đã sẵn là 1 File thật nếu tới từ OPFS, xem `buildZipStreamingToOpfs()`, core/
         * streaming-zip.js).
         *
         * CHƯA KIỂM CHỨNG THỰC TẾ trên thiết bị (nhánh Service Worker MỚI thêm) — Giang cần tự test
         * lại với file zip lớn thật, chạy qua HTTPS, trước khi coi đây đã xong dứt điểm.
         * @param {Blob} blob @param {string} filename
         */
        // SỬA (06/10/2026, Giang đo bằng share-size-test.html: share 600MB vẫn ổn trên PWA) — nâng ngưỡng bỏ
        // share từ 500MB lên 600MB. BẮT BUỘC > cỡ tối đa mỗi phần zip (MEDIA_FILE_MAX_BYTES = 500MB, core/
        // upload-validation.js) cộng phần header zip — nếu không, 1 phần zip ~500MB + vài KB header sẽ rơi sang
        // nhánh Service Worker, mà trong PWA iOS nhánh đó mở màn "Open in..." kẹt app (Quick Look).
        const LARGE_FILE_SKIP_SHARE_BYTES = 600 * 1024 * 1024;

        // DỜI (06/10/2026, dọn nợ Rule 1/3 — Giang yêu cầu "xử lý nốt nợ kỹ thuật") — `triggerDownload()` (core tự rẽ 3 đường
        // Service Worker / Share / <a download> + gọi core khác) và `promptDownloadReady()` (core dựng modal + callback gọi
        // thẳng core) sang Workflow `workflowZipDownload.deliverFile()` / `promptSingle()` (event/workflow/zip-download.js —
        // giữ nguyên toàn bộ lý do/hành vi đã ghi ở docstring cũ: share cần user activation, file > LARGE_FILE_SKIP_SHARE_BYTES
        // bỏ share, SW chỉ có qua HTTPS, <a download> là lưới cuối). Ở đây chỉ còn 2 hàm THI HÀNH đúng 1 việc mỗi hàm.

        /**
         * Mở Share Sheet của hệ điều hành cho 1 File (iOS: "Lưu vào Tệp"). PHẢI gọi trong lúc còn user activation (Workflow
         * gọi đồng bộ ngay trong lượt bấm). Không tự fallback — trả kết quả để Workflow quyết định.
         * @param {File} file
         * @returns {Promise<'shared'|'aborted'|'failed'>} 'aborted' = người dùng tự huỷ Share Sheet
         */
        async function shareFileViaSystem(file) {
            try {
                await navigator.share({ files: [file] });
                return 'shared';
            } catch (err) {
                if (err && err.name === 'AbortError') return 'aborted';
                console.warn('[shareFileViaSystem] navigator.share() lỗi:', err);
                return 'failed';
            }
        }

        /**
         * Tải qua `<a download>` trên 1 URL Workflow tạo sẵn (Workflow tự tạo + thu hồi blob URL — Rule 3b). `a.download` tự
         * đặt tên hiển thị, không cần bọc `new File()`.
         * @param {string} url @param {string} filename
         */
        function clickDownloadAnchor(url, filename) {
            const a = document.createElement('a');
            a.href = url; a.download = filename; a.click();
        }

        /** Định dạng số mili-giây thành chuỗi ngắn cho "thời gian xử lý" trong modal tải xuống
         * (event/workflow/zip-download.js) — MỚI (10/09/2026, Giang yêu cầu). Cố tình KHÔNG dùng
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
