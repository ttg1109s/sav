/**
 * Hàm tiện ích màu sắc & cập nhật nền (hexToRgb, interpolateColor, updateDOMBackground, updatePlaylistBg).
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
        
        function updatePlaylistBg() {
            const cfg = appState.get('vizConfig');
            if (cfg.bgImage) { playlistBg.style.backgroundImage = `url(${cfg.bgImage})`; playlistBg.style.filter = `blur(${cfg.bgBlur}px)`; } 
            else { playlistBg.style.backgroundImage = 'none'; playlistBg.style.filter = `blur(0px)`;}
        }
        
