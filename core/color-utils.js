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
        /** SỬA (v13 Batch A) — `vizConfig.videoBgEnabled` ĐÃ GỘP vào domain config `visualBg`;
         * điều kiện "có video nền đang che lên" giờ = `enabled && mediaType==='video'`. Hàm này là
         * CHỦ SỞ HỮU DUY NHẤT của màu `#visualizer-solid-bg` (Workflow domain `visualBg` gọi THẲNG
         * hàm này thay vì tự viết 1 core song song — tránh 2 nơi cùng ghi 1 thuộc tính).
         * Rule 1 KHÔNG vi phạm: vẫn ĐÚNG 1 tiến trình (gán màu nền), chỉ khác GIÁ TRỊ gán — viết
         * lại thành 1 biểu thức 3 ngôi cho rõ điều đó. Rule 2 vẫn là nợ DI SẢN của file này (tự
         * `appConfigViz.getAll()`) — KHÔNG mở rộng thêm, chỉ đổi đúng field bị gộp. */
        function updateDOMBackground() { 
            const cfg = appConfigVisualBg.getAll();
            // Video nền che kín -> ép đen (nền màu bên dưới không ai thấy, vẽ gradient là phí).
            // SỬA (v14) — `enabled && mediaType==='video'` (2 field đã xoá) -> `type==='video'` +
            // còn ≥1 item sống trong `source.list`.
            if (cfg.type === 'video' && cfg.source.list.some((k) => k !== null)) {
                visualizerSolidBg.style.backgroundImage = '';
                visualizerSolidBg.style.backgroundColor = '#000000';
                return;
            }
            // SỬA (v13) — `vizConfig.bgColor` ĐÃ DỜI sang `visualBgConfig.solidColor`, và thêm chế
            // độ gradient. Vẫn ĐÚNG 1 tiến trình (sơn nền `#visualizer-solid-bg`), chỉ khác thuộc
            // tính CSS dùng để sơn — gradient bắt buộc đi qua `background-image`.
            const gradientCss = cfg.colorMode === 'gradient'
                ? buildVisualBgGradientCss(cfg.gradientStops, cfg.gradientAngleDeg) // core/visual-bg.js
                : '';
            visualizerSolidBg.style.backgroundImage = gradientCss;
            visualizerSolidBg.style.backgroundColor = gradientCss ? '' : cfg.solidColor;
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
         *
         * SỬA (12/08/2026, Giang báo bug "blur ảnh nền làm mất viền panel") — `filter: blur()` tự
         * tràn ra ngoài biên hộp CSS gốc (không bị `overflow` của chính phần tử mang nó chặn) —
         * `appBg` khớp CHÍNH XÁC viền `#app-stack` (`border-right` desktop, assets/css/style.css)
         * nên phần tràn đó đè mờ luôn viền. SỬA: tách 1 lớp phủ RIÊNG, `blur`/`scale(1.1)` áp lên
         * LỚP PHỦ ĐÓ THAY VÌ `appBg` — `appBg` (cha) giữ `overflow: hidden` (CSS, KHÔNG đụng gì ở
         * đây) nên phần blur tràn ra do phóng to 110% bị cắt gọn NGAY TẠI khung, viền lại nét.
         *
         * SỬA TIẾP (13/08/2026, Giang chỉ ra "scale 1.1 phải áp cho DOM ĐƯỢC BLUR, không phải cả
         * DOM bg image") — bản 12/08 lỡ GỘP 2 vai trò vào 1 phần tử `appBgBlurLayer` (vừa mang
         * `background-image` thật vừa nhận scale/blur) — SAI với đúng yêu cầu gốc "thêm 1 LỚP PHỦ
         * LÊN TRƯỚC [ảnh]" (nghĩa là phải có ảnh GỐC riêng + 1 lớp phủ THÊM VÀO, không phải biến
         * luôn ảnh gốc thành lớp bị blur). SỬA ĐÚNG — tách hẳn 2 phần tử (components/
         * app-view-stack.js):
         *   - `appBgImage` — ảnh GỐC, LUÔN NÉT — nhận `background-image` TRỰC TIẾP, KHÔNG BAO GIỜ
         *     `transform`/`filter`.
         *   - `appBgBlurLayer` — lớp phủ ĐÈ LÊN TRÊN (a) — CHỈ tồn tại/có nội dung khi
         *     `bgBlur > 0`: gán CÙNG 1 `background-image` với `appBgImage` RỒI MỚI áp
         *     `scale(1.1)`/`blur()` lên CHÍNH nó — khi `bgBlur = 0`, layer này rỗng
         *     (`background-image: none`), lộ nguyên ảnh nét ở `appBgImage` bên dưới (2 phần tử
         *     luôn xếp chồng khít nhau, `position:absolute;inset:0` cả 2 — CSS).
         * 2 nhánh gradient/none KHÔNG hề blur nên chỉ cần set lên `appBgImage` (ảnh gốc) như cũ —
         * `appBg` (khung ngoài cùng) giờ THUẦN CẤU TRÚC, không tự mang `background-image` gì cả.
         */
        function updatePlaylistBg() {
            const cfg = appConfigViz.getAll();
            if (cfg.bgImage) {
                const layerImage = `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url(${cfg.bgImage})`;
                appBgImage.style.backgroundImage = layerImage; // ảnh GỐC — LUÔN nét, không đụng transform/filter
                if (cfg.bgBlur > 0) {
                    appBgBlurLayer.style.backgroundImage = layerImage; // bản sao ĐÈ lên trên — CHỈ phần tử này nhận scale/blur
                    appBgBlurLayer.style.filter = `blur(${cfg.bgBlur}px)`;
                    appBgBlurLayer.style.transform = 'scale(1.1)';
                } else {
                    appBgBlurLayer.style.backgroundImage = 'none'; // trong suốt — lộ nguyên ảnh gốc ở appBgImage bên dưới
                    appBgBlurLayer.style.filter = 'none';
                    appBgBlurLayer.style.transform = 'scale(1)';
                }
            }
            else if (cfg.themeMode === 'gradient') {
                appBgBlurLayer.style.backgroundImage = 'none';
                appBgImage.style.backgroundImage = `linear-gradient(135deg, ${cfg.gradientFrom}, ${cfg.gradientTo})`;
            }
            else {
                appBgBlurLayer.style.backgroundImage = 'none';
                appBgImage.style.backgroundImage = 'none';
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

        /** Quy đổi góc CSS `linear-gradient(angleDeg, ...)` (0deg = lên trên, tăng theo chiều kim
         * đồng hồ) sang 2 điểm đầu/cuối trục gradient cho Canvas2D `createLinearGradient()` — CÙNG
         * thuật toán chuẩn CSS spec dùng (điểm chiếu vuông góc qua tâm hộp), để canvas vẽ KHỚP ĐÚNG
         * `linear-gradient(angleDeg, ...)` hiển thị ở DOM, không lệch hướng. */
        function computeCssGradientLine(angleDeg, width, height) {
            const rad = (angleDeg % 360) * Math.PI / 180;
            const dx = Math.sin(rad), dy = -Math.cos(rad);
            const halfW = width / 2, halfH = height / 2;
            const length = Math.abs(halfW * dx) + Math.abs(halfH * dy);
            const cx = width / 2, cy = height / 2;
            return { x0: cx - dx * length, y0: cy - dy * length, x1: cx + dx * length, y1: cy + dy * length };
        }

        /** Dựng CanvasGradient khớp `linear-gradient(angleDeg, stop.color stop.position%...)` CSS —
         * dùng bởi visual 2D cần vẽ ĐÚNG gradient VBG đang hiển thị (kể cả khung hình Movement) lên
         * canvas riêng thay vì tự bịa 1 màu phẳng — xem core/visual-bg.js::getVisualBgFillStyle().
         * `stops` tự sort theo position (Movement spread/swap giữ nguyên thứ tự mảng gốc). */
        function buildCanvasLinearGradient(ctx, angleDeg, width, height, stops) {
            const line = computeCssGradientLine(angleDeg, width, height);
            const grad = ctx.createLinearGradient(line.x0, line.y0, line.x1, line.y1);
            stops.slice().sort((a, b) => a.position - b.position).forEach((s) => grad.addColorStop(Math.max(0, Math.min(1, s.position / 100)), s.color));
            return grad;
        }
        
