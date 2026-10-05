/**
 * Logo header (06/10/2026: "Audivis" <-> "Audio Visualizer"; trước là "SAV") — mở/thu chữ khi hover (desktop, chuột thật) hoặc tap (mobile/cảm ứng).
 *
 * 2 CHIẾN LƯỢC LOẠI TRỪ NHAU, chọn lúc nạp trang qua matchMedia('(hover: hover) and (pointer:
 * fine)') — KHÔNG đổi lại khi xoay máy/đổi thiết bị input giữa phiên:
 *   - Desktop (hover thật): mouseenter/mouseleave, hover tự nhiên.
 *   - Mobile/cảm ứng: 'mouseleave' KHÔNG đáng tin trên cảm ứng (WebKit chỉ giả lập mouseenter khi
 *     tap, không bao giờ tự bắn mouseleave khi tap sang chỗ khác — xem WebKit bug #128534 về
 *     mouseenter không ổn định khi có touch listener). Dùng 'click' trên logo để TOGGLE, + 'click'
 *     ở CẤP DOCUMENT để tự thu khi bấm ra ngoài (cùng pattern overlay khác trong app).
 *
 * ÁP DỤNG /event/ (cụm "savLogo"): `addEventListener` cũ đã CHUYỂN sang event/listener/sav-logo.js
 * + event/router/sav-logo.js (gọi thẳng, không cần workflow). DOM ref (savLogo) lấy từ
 * core/dom-refs.js theo đúng quy ước.
 */
        /** Core thuần: mở/thu chữ logo theo giá trị `expand`.
         * SỬA (06/10/2026, Giang — nạp lại cụm savLogo cho logo "Audivis" -> "Audio Visualizer") — KHÔNG còn tự gán
         * `style.maxWidth` từng span theo `data-expand-width` như bản "SAV" cũ: chỉ bật/tắt 1 class trên #sav-logo,
         * toàn bộ chuyển động (bung chữ + đổi "v" -> "V") nằm ở CSS transition (assets/css/misc.css). */
        function setSavLogoExpanded(expand) {
            if (!savLogo) return;
            appState.set('savLogoExpanded', expand);
            savLogo.classList.toggle('sav-logo-expanded', expand);
        }

        /** Core thuần: có phải thiết bị hover thật (desktop, chuột) không — dùng để router/listener
         *  quyết định gắn nhánh nào lúc nạp trang. */
        function hasRealHoverDevice() {
            return !!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches);
        }
