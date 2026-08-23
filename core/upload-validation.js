/**
 * upload-validation.js — Chặn định dạng KHÔNG hợp lệ ở 3 nơi nhận file từ người dùng:
 * nạp nhạc (media-upload — SỬA tên, phản hồi Giang "1 khung, không nhân bản": input này giờ dùng
 * CHUNG cho cả nhạc/video/ảnh khi nạp vào Playlist, trước đây tên audio-upload), ảnh nền
 * (setting-bg-upload), video nền (setting-video-upload).
 *
 * VÌ SAO CẦN FILE NÀY (không chỉ dựa vào `accept=""` của <input type="file">): thuộc tính
 * `accept` chỉ là GỢI Ý cho hộp thoại chọn file của OS/browser — người dùng vẫn có thể chọn
 * "Tất cả file" rồi chọn bất kỳ thứ gì (.exe, .pdf, .txt đổi đuôi...), hoặc kéo-thả file trực
 * tiếp vào input (kéo-thả bỏ qua hoàn toàn bộ lọc accept). Validate THẬT phải nằm ở tầng JS,
 * ngay khi nhận `file` trong listener 'change', TRƯỚC khi ghi vào IndexedDB hay tạo blob URL.
 *
 * CHIẾN LƯỢC KIỂM TRA — 2 lớp, ưu tiên MIME, fallback qua đuôi file:
 *   (1) `file.type` (MIME do browser tự suy ra từ nội dung/đuôi file) khớp whitelist -> hợp lệ.
 *   (2) Một số OS/browser/file hiếm khi để `file.type` RỖNG (không suy ra được MIME) dù file
 *       thật chuẩn — không thể chỉ dựa lớp (1) nếu không muốn chặn nhầm file hợp lệ. Khi MIME
 *       rỗng, fallback kiểm tra ĐUÔI file qua whitelist riêng. Khi MIME CÓ giá trị nhưng KHÔNG
 *       khớp whitelist, coi là sai định dạng dứt khoát — không cho đuôi file "gỡ" lại, vì MIME
 *       sai rõ ràng là dấu hiệu file bị đổi đuôi giả mạo.
 *
 * Cùng tinh thần với VALID_MP3_MIME_TYPES + isQuickValidMime() đã có sẵn ở db.js (chấp nhận MIME
 * rỗng cho mp3) — file này áp dụng nguyên tắc đó rộng ra cho audio (đa định dạng hơn mp3),
 * ảnh nền, và video nền.
 */

        // ===================== (a) NHẠC =====================
        // Định dạng nhạc phổ biến trình duyệt phát được qua thẻ <audio>: mp3, wav, ogg, m4a/aac, flac, webm-audio.
        const VALID_AUDIO_MIME_TYPES = new Set([
            'audio/mpeg', 'audio/mp3', 'audio/mpa', 'audio/wav', 'audio/x-wav', 'audio/wave',
            'audio/ogg', 'audio/x-m4a', 'audio/m4a', 'audio/mp4', 'audio/aac', 'audio/flac',
            'audio/x-flac', 'audio/webm'
        ]);
        const VALID_AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'webm']);

        // ===================== (b) ẢNH NỀN =====================
        // Theo đúng yêu cầu: CHỈ png, jpg/jpeg, webp (không mở rộng thêm gif/svg/bmp...).
        const VALID_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
        const VALID_IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp']);

        // ===================== (c) VIDEO NỀN =====================
        // Định dạng video phổ biến trình duyệt phát được qua thẻ <video>: mp4, webm, ogv, mov (Safari).
        const VALID_VIDEO_MIME_TYPES = new Set(['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']);
        const VALID_VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'ogv', 'ogg', 'mov']);

        /** Lấy đuôi file (không dấu chấm, chữ thường) — '' nếu không có đuôi. */
        function getFileExtension(filename) {
            const m = /\.([a-zA-Z0-9]+)$/.exec(filename || '');
            return m ? m[1].toLowerCase() : '';
        }

        /**
         * Hàm kiểm tra dùng chung cho cả 3 loại file — xem chiến lược 2 lớp ở đầu file.
         * Trả về { valid: boolean, reason?: string } — reason chỉ có khi valid=false, dùng để
         * hiện thông báo lỗi cụ thể cho người dùng.
         */
        function validateFileType(file, mimeWhitelist, extWhitelist, typeLabel) {
            const mime = (file.type || '').toLowerCase();
            if (mime) {
                if (mimeWhitelist.has(mime)) return { valid: true };
                return { valid: false, reason: tFormat('common.validate.unsupportedMime', { mime: mime || t('common.validate.unsupportedMimeUnknown'), typeLabel }) };
            }
            // MIME rỗng -> fallback theo đuôi file.
            const ext = getFileExtension(file.name);
            if (extWhitelist.has(ext)) return { valid: true };
            return { valid: false, reason: tFormat('common.validate.unknownFormat', { filename: file.name, typeLabel }) };
        }

        function validateAudioFile(file) {
            return validateFileType(file, VALID_AUDIO_MIME_TYPES, VALID_AUDIO_EXTENSIONS, t('common.validate.typeLabel.audio'));
        }
        function validateImageFile(file) {
            return validateFileType(file, VALID_IMAGE_MIME_TYPES, VALID_IMAGE_EXTENSIONS, t('common.validate.typeLabel.image'));
        }
        function validateVideoFile(file) {
            return validateFileType(file, VALID_VIDEO_MIME_TYPES, VALID_VIDEO_EXTENSIONS, t('common.validate.typeLabel.video'));
        }
