/**
 * core/upload-validation.js — chặn file sai định dạng/quá cỡ khi người dùng nạp media và ảnh bìa. `accept=""` của
 * <input type="file"> chỉ là gợi ý (chọn "Tất cả file" hoặc kéo-thả là qua mặt), nên kiểm tra thật nằm ở đây, trước khi
 * ghi IndexedDB hay tạo blob URL.
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

        // ===================== (b) ẢNH =====================
        // Chỉ png, jpg/jpeg, webp.
        const VALID_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
        const VALID_IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp']);

        /** Luật kiểm tra theo loại file — tham số thứ 2 của validateFileType(). */
        const AUDIO_UPLOAD_RULE = { mimes: VALID_AUDIO_MIME_TYPES, exts: VALID_AUDIO_EXTENSIONS, labelKey: 'common.validate.typeLabel.audio' };
        const IMAGE_UPLOAD_RULE = { mimes: VALID_IMAGE_MIME_TYPES, exts: VALID_IMAGE_EXTENSIONS, labelKey: 'common.validate.typeLabel.image' };

        /**
         * Kiểm tra định dạng 1 file theo luật (AUDIO_UPLOAD_RULE / IMAGE_UPLOAD_RULE) — xem chiến lược 2 lớp ở đầu file.
         * @param {File} file @param {{mimes: Set<string>, exts: Set<string>, labelKey: string}} rule
         * @returns {{valid: boolean, reason?: string}} reason chỉ có khi valid=false — chữ thường, chứa tên file / MIME thô;
         *   nơi chèn vào modal (HTML) phải escape.
         */
        function validateFileType(file, rule) {
            const typeLabel = t(rule.labelKey);
            const mime = (file.type || '').toLowerCase();
            if (mime) {
                if (rule.mimes.has(mime)) return { valid: true };
                return { valid: false, reason: tFormat('common.validate.unsupportedMime', { mime, typeLabel }) };
            }
            // MIME rỗng -> theo đuôi file (không dấu chấm, chữ thường; không có đuôi -> '').
            const extMatch = /\.([a-zA-Z0-9]+)$/.exec(file.name || '');
            const ext = extMatch ? extMatch[1].toLowerCase() : '';
            if (rule.exts.has(ext)) return { valid: true };
            return { valid: false, reason: tFormat('common.validate.unknownFormat', { filename: file.name, typeLabel }) };
        }

        // ===================== (c) GIỚI HẠN DUNG LƯỢNG MỖI FILE =====================
        // Mỗi file media nạp vào thư viện (Song/Video/Photo) tối đa 500MB: trong PWA iOS chỉ navigator.share() lưu được file ra
        // ngoài, và share phải đọc nguyên file vào RAM — giữ mọi file dưới mức đã đo an toàn (share 600MB vẫn ổn) để file
        // nào cũng xuất/sao lưu được. Cũng là cỡ tối đa mỗi phần zip (event/workflow/zip-download.js).
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
