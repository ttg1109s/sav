/**
 * Restore / Export bài hát: đọc record từ IndexedDB, ghi tag mới nhất (record.tag + record.cover)
 * vào blob mp3 qua browser-id3-writer, trigger download — KHÔNG ghi blob mới này trở lại
 * IndexedDB (record gốc trong DB giữ nguyên blob chưa từng bị ghi tag — xem mục 3.6 plan).
 *
 * SỬA (Batch "Export dọn nợ kiến trúc", phản hồi Giang, plan-v12-song-video-unification.md mục 6f)
 * — `exportSongWithTag(key)` (bản 1 file lẻ) ĐÃ DỜI sang `event/workflow/playlist.js`: hàm đó tự
 * đọc DB + tự bọc `withLoadingShield()` + tự gọi `alertModal()` — đúng HÌNH DẠNG WORKFLOW (điều
 * phối nhiều bước phụ thuộc + side-effect UI), NẰM SAI chỗ khi còn ở 1 file `core/` (core CẤM gọi
 * `withLoadingShield`/`alertModal` theo core-function-conventions.md). File này giờ CHỈ còn 2 hàm
 * Core THUẦN dưới đây — dùng CHUNG cho cả Song lẫn Video (Video bỏ qua `buildTaggedBlob()`, xem
 * `exportVideoFile()`/`exportSelectedVideosZip()`, event/workflow/playlist.js).
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

        function triggerDownload(blob, filename) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = filename; a.click();
            URL.revokeObjectURL(url);
        }
