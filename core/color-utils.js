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
            const cfg = appConfigViz.getAll();
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
         *
         * MỞ RỘNG (09/07/2026, Theme mode "Gradient" mới, phản hồi Giang mục 1) — thêm nhánh thứ 2:
         * `cfg.themeMode === 'gradient'` -> vẽ `linear-gradient(135deg, gradientFrom, gradientTo)`
         * thẳng lên `appBg` (không overlay đen, không blur — gradient tự nó đã đủ tương phản, khác
         * ảnh thật cần overlay để chữ dễ đọc). THỨ TỰ ƯU TIÊN CỐ Ý: kiểm tra `cfg.bgImage` TRƯỚC —
         * hàm này gọi được từ NHIỀU nơi (theme.js/visualizer-display.js/file-manager-photo.js), có
         * những thời điểm `cfg.themeMode` chưa kịp cập nhật đồng bộ (vd đang giữa luồng mở picker
         * ảnh) nhưng `cfg.bgImage` đã có Blob thật — ưu tiên hiển thị ĐÚNG NỘI DUNG THẬT đang có,
         * không phụ thuộc `themeMode` có đồng bộ kịp hay chưa. `themeMode==='gradient'` chỉ đúng ý
         * nghĩa khi CHẮC CHẮN không có ảnh nào đang áp (bgImage rỗng — bất biến này do
         * `applyBgImageEnabled(false)` đảm bảo mỗi khi chuyển sang mode khác 'background', xem
         * event/workflow/theme.js::applyNonBackgroundMode()).
         */
        function updatePlaylistBg() {
            const cfg = appConfigViz.getAll();
            if (cfg.bgImage) {
                appBg.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url(${cfg.bgImage})`;
                appBg.style.filter = `blur(${cfg.bgBlur}px)`;
            }
            else if (cfg.themeMode === 'gradient') {
                appBg.style.backgroundImage = `linear-gradient(135deg, ${cfg.gradientFrom}, ${cfg.gradientTo})`;
                appBg.style.filter = `blur(0px)`;
            }
            else {
                appBg.style.backgroundImage = 'none';
                appBg.style.filter = `blur(0px)`;
            }
        }

        /**
         * FIX (09/07/2026, phản hồi Giang mục 3 — "chọn background image thì bên các element vẫn
         * bị background cũ, khi thao tác bất kỳ thì mới thấy sự trong suốt") — bug KHÔNG nằm ở
         * logic app: `updatePlaylistBg()` ở trên ĐÃ ghi đúng giá trị mới NGAY LẬP TỨC. Đây là bug
         * đã biết của WebKit/iOS Safari với `backdrop-filter` (`.glass-panel`/`.glass-modal`/
         * `.drawer-glass`/`.glass-control-center`, xem assets/css/style.css) — compositor "chụp"
         * lại NHỮNG GÌ NẰM PHÍA SAU 1 phần tử `backdrop-filter` tại thời điểm layer được tạo, và
         * không PHẢI LÚC NÀO cũng tự chụp lại khi nội dung phía sau đổi qua đường JS thuần (đổi
         * `background-image` không tự kích hoạt recomposite) — ảnh/gradient MỚI đã có ở `appBg`
         * nhưng lớp kính mờ phía trên vẫn hiển thị "ảnh chụp" CŨ, cho tới khi có 1 tác động khác ép
         * trình duyệt vẽ lại layer đó (cuộn, mở drawer khác...).
         *
         * Core thuần — CHỈ ép trình duyệt tính lại `backdrop-filter`, không đọc/ghi `appState`, KHÔNG
         * đụng `transform` (nhiều phần tử kính trong app dùng `transform` qua class Tailwind để
         * trượt/ẩn hiện — vd `-translate-y-full` — ghi đè `style.transform` ở đây sẽ PHÁ animation
         * của chúng). Kỹ thuật: đổi TẠM `backdrop-filter` sang `blur(0px)` rồi trả về giá trị CSS
         * gốc (qua class, không phải inline) ngay khung hình kế tiếp — ép compositor tính lại đúng
         * lúc đó, chớp mắt không kịp thấy (dưới 1 frame ~16ms).
         *
         * Rule 3: hàm này KHÔNG tự gọi sau `updatePlaylistBg()` (2 core không được gọi nhau) — mọi
         * Workflow đổi nền (theme.js/visualizer-display.js/file-manager-photo.js) tự gọi CẢ 2 hàm
         * theo đúng thứ tự (updatePlaylistBg() trước, forceGlassRepaint() ngay sau).
         */
        function forceGlassRepaint() {
            const glassEls = document.querySelectorAll('.glass-panel, .glass-modal, .drawer-glass, .glass-control-center');
            glassEls.forEach((el) => {
                el.style.webkitBackdropFilter = 'blur(0px)';
                el.style.backdropFilter = 'blur(0px)';
                void el.offsetHeight; // ép reflow — áp giá trị TẠM này ngay, không gộp batch với dòng dưới
                requestAnimationFrame(() => {
                    el.style.webkitBackdropFilter = '';
                    el.style.backdropFilter = ''; // xoá inline -> quay lại đúng giá trị từ class CSS gốc
                });
            });
        }

        // (updateSettingsBg() ĐÃ XOÁ — 07/07/2026, batch gộp Playlist+Settings chung container:
        // `#playlist-bg` giờ VẬT LÝ dùng chung cho CẢ 2 màn (xem components/app-view-stack.js) —
        // gọi `updatePlaylistBg()` 1 LẦN LÀ ĐỦ cho cả Playlist lẫn Settings, không cần hàm thứ 2
        // áp lại y hệt cho 1 phần tử khác nữa. Mọi nơi gọi `updateSettingsBg(cfg)` trước đây ĐÃ BỎ
        // dòng gọi đó — xem event/workflow/visualizer-display.js, event/workflow/file-manager-
        // photo.js, core/config.js.)
        
