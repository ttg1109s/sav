/**
 * Hàm tiện ích màu sắc & cập nhật nền (hexToRgb, interpolateColor, updateDOMBackground,
 * updatePlaylistBg — dùng CHUNG cho cả Playlist lẫn Settings từ 07/07/2026, xem
 * components/app-view-stack.js).
 * (Trích từ file gốc, dòng 553-575 trong khối <script>)
 */
        function hexToRgb(hex) {
            let r = 0, g = 0, b = 0;
            if (hex.length == 4) { r = "0x" + hex[1] + hex[1]; g = "0x" + hex[2] + hex[2]; b = "0x" + hex[3] + hex[3]; } 
            else if (hex.length == 7) { r = "0x" + hex[1] + hex[2]; g = "0x" + hex[3] + hex[4]; b = "0x" + hex[5] + hex[6]; }
            return {r: +r, g: +g, b: +b};
        }

        function interpolateColor(color1, color2, factor) {
            const rgb1 = hexToRgb(color1); const rgb2 = hexToRgb(color2);
            let result = { r: Math.round(rgb1.r + factor * (rgb2.r - rgb1.r)), g: Math.round(rgb1.g + factor * (rgb2.g - rgb1.g)), b: Math.round(rgb1.b + factor * (rgb2.b - rgb1.b)) };
            return `rgb(${result.r}, ${result.g}, ${result.b})`;
        }

        /** FIX (04/07/2026, mục 1a phản hồi Giang) — tô màu vào `#visualizer-solid-bg` (element
         * riêng của Visualizer UI) THAY `document.body` — `document.body`'s background từng bị
         * nghi ngờ là 1 phần nguyên nhân màu Settings tràn vào status bar/tai thỏ OS (1 số trình
         * duyệt tự suy màu vùng đó từ nền `<body>` bất kể có gì đè lên trên). `body` giờ giữ
         * NGUYÊN #000000 tĩnh khai báo thuần trong CSS, không còn bị JS đụng vào nữa. */
        function updateDOMBackground() { 
            const cfg = appState.get('vizConfig');
            if(!cfg.videoBgEnabled) visualizerSolidBg.style.backgroundColor = cfg.bgColor; 
            else visualizerSolidBg.style.backgroundColor = '#000000';
        }
        
        /**
         * HOTFIX 16 (08/07/2026, Giang chốt) — SỬA TIẾP bản HOTFIX 15: bản đó set thẳng lên
         * `#side-left-container`, đúng hướng "thoát khỏi vùng cuộn" nhưng lộ ra vấn đề MỚI —
         * `#side-left-container` cũng chính là phần tử chứa nội dung thật (Playlist/Settings), nên
         * `filter: blur()` (tính năng "Độ mờ nền") lem sang cả chữ/nút. SỬA: set lên `appBg` —
         * phần tử MỚI (components/app-view-stack.js), ANH EM với `sideLeftContainer` (cùng nằm
         * trong `#app-stack`, không phải hậu duệ của khung cuộn ngang) — vừa không bị `scrollLeft`
         * của `sideLeftContainer` kéo theo (đúng lý do HOTFIX 15 đã đúng), vừa KHÔNG chứa chữ/nội
         * dung gì nên `filter: blur()` giờ an toàn tuyệt đối, không lem sang đâu cả.
         *
         * Overlay đen 40% (trước là 1 div riêng, rồi gộp vào background-image ở HOTFIX 15) vẫn giữ
         * nguyên kỹ thuật gộp lớp gradient — chỉ đổi phần tử đích.
         */
        function updatePlaylistBg() {
            const cfg = appState.get('vizConfig');
            if (cfg.bgImage) {
                appBg.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url(${cfg.bgImage})`;
                appBg.style.filter = `blur(${cfg.bgBlur}px)`;
            }
            else {
                appBg.style.backgroundImage = 'none';
                appBg.style.filter = `blur(0px)`;
            }
        }

        // (updateSettingsBg() ĐÃ XOÁ — 07/07/2026, batch gộp Playlist+Settings chung container:
        // `#playlist-bg` giờ VẬT LÝ dùng chung cho CẢ 2 màn (xem components/app-view-stack.js) —
        // gọi `updatePlaylistBg()` 1 LẦN LÀ ĐỦ cho cả Playlist lẫn Settings, không cần hàm thứ 2
        // áp lại y hệt cho 1 phần tử khác nữa. Mọi nơi gọi `updateSettingsBg(cfg)` trước đây ĐÃ BỎ
        // dòng gọi đó — xem event/workflow/visualizer-display.js, event/workflow/file-manager-
        // photo.js, core/config.js.)
        
