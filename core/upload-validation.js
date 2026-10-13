/**
 * core/upload-validation.js — chặn file sai định dạng/quá cỡ khi người dùng nạp nhạc (media-upload) và ảnh nền.
 * `accept=""` của <input type="file"> chỉ là gợi ý (chọn "Tất cả file" hoặc kéo-thả là qua mặt), nên kiểm tra thật
 * nằm ở đây, trước khi ghi IndexedDB hay tạo blob URL.
 *
 * Kiểm tra 2 lớp: MIME (`file.type`) khớp whitelist -> hợp lệ; MIME có nhưng không khớp -> sai dứt khoát (dấu hiệu đổi
 * đuôi giả); MIME rỗng (một số OS/browser không suy ra được) -> xét đuôi file theo whitelist riêng.
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

        // ===================== (c) GIỚI HẠN DUNG LƯỢNG MỖI FILE =====================
        // MỚI (06/10/2026, Giang chốt sau khi đo bằng share-size-test.html: share 600MB vẫn ổn) —
        // mỗi file media nạp vào thư viện (Song/Video/Photo) tối đa 500MB. Lý do: trong PWA iOS chỉ
        // navigator.share() lưu được file ra ngoài, và share phải đọc nguyên file vào RAM — giữ mọi
        // file dưới mức đã đo an toàn để file nào cũng xuất/sao lưu được. DÙNG CHUNG làm cỡ tối đa
        // mỗi phần zip (core/storage-manager.js::groupZipEntriesBySize()).
        const MEDIA_FILE_MAX_BYTES = 500 * 1024 * 1024;

        /**
         * Kiểm tra dung lượng 1 file media trước khi nạp — cùng dạng trả về với validateFileType().
         * @param {File} file
         * @returns {{valid: boolean, reason?: string}}
         */
        function validateMediaFileSize(file) {
            if (file.size <= MEDIA_FILE_MAX_BYTES) return { valid: true };
            const toMb = (bytes) => Math.round(bytes / (1024 * 1024));
            return { valid: false, reason: tFormat('common.validate.fileTooLarge', { sizeMb: toMb(file.size), limitMb: toMb(MEDIA_FILE_MAX_BYTES) }) };
        }
