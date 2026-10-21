/**
 * core/color-utils.js — tiện ích màu + ghi 2 lớp nền tĩnh: `#visualizer-solid-bg` (updateDOMBackground) và nền App Panel
 * `#app-bg-*` (updatePlaylistBg, setAppBgVideoPlayback, suspendGlassBackdrop/restoreGlassBackdrop). Không đọc config: Workflow đọc rồi truyền vào
 * (workflowVisualBg.paintSolidBg(), workflowTheme — event/workflow/{visual-bg-common,theme}.js).
 */
        /** '#rgb' / '#rrggbb' -> {r, g, b}; độ dài khác -> 0 cả 3 kênh. */
        function hexToRgb(hex) {
            let r = 0, g = 0, b = 0;
            if (hex.length == 4) { r = "0x" + hex[1] + hex[1]; g = "0x" + hex[2] + hex[2]; b = "0x" + hex[3] + hex[3]; }
            else if (hex.length == 7) { r = "0x" + hex[1] + hex[2]; g = "0x" + hex[3] + hex[4]; b = "0x" + hex[5] + hex[6]; }
            return {r: +r, g: +g, b: +b};
        }

        /** Nội suy 2 màu hex theo `factor` (0-1) -> 'rgb(r, g, b)'. Tự đọc kênh màu (cùng cách hexToRgb()) — core không gọi core. */
        function interpolateColor(color1, color2, factor) {
            const channels = [0, 0, 0];
            for (let i = 0; i < 3; i++) {
                const a = color1.length == 4 ? +("0x" + color1[i + 1] + color1[i + 1]) : (color1.length == 7 ? +("0x" + color1.slice(1 + i * 2, 3 + i * 2)) : 0);
                const b = color2.length == 4 ? +("0x" + color2[i + 1] + color2[i + 1]) : (color2.length == 7 ? +("0x" + color2.slice(1 + i * 2, 3 + i * 2)) : 0);
                channels[i] = Math.round(a + factor * (b - a));
            }
            return `rgb(${channels[0]}, ${channels[1]}, ${channels[2]})`;
        }

        /** Nội suy 2 màu {r,g,b} theo `factor` (0-1) -> {r,g,b} (không làm tròn). @param {{r:number,g:number,b:number}} a
         * @param {{r:number,g:number,b:number}} b @param {number} factor @returns {{r:number,g:number,b:number}} */
        function interpolateRgb(a, b, factor) {
            return { r: a.r + (b.r - a.r) * factor, g: a.g + (b.g - a.g) * factor, b: a.b + (b.b - a.b) * factor };
        }

        /** Sơn `#visualizer-solid-bg` (nền màu màn Visualizer, chủ sở hữu duy nhất). Video VBG đang che kín (toggle tổng bật,
         * type video, còn ≥1 item sống) -> ép đen; còn lại gradient hoặc màu đặc theo `colorMode` (gradient đi `background-image`).
         * @param {object} cfg visualBgConfig @param {string} gradientCss buildVisualBgGradientCss() của cfg (Workflow tính sẵn) */
        function updateDOMBackground(cfg, gradientCss) {
            const isCoveredByVideo = cfg.enabled !== false && cfg.type === 'video' && cfg.source.list.some((k) => k !== null);
            const paintedGradient = cfg.colorMode === 'gradient' ? gradientCss : '';
            visualizerSolidBg.style.backgroundImage = isCoveredByVideo ? '' : paintedGradient;
            visualizerSolidBg.style.backgroundColor = isCoveredByVideo ? '#000000' : (paintedGradient ? '' : cfg.solidColor);
        }

        /**
         * Ghi nền App Panel theo `view` (computeThemeBackgroundView().playlistBg, core/theme-background.js): 2 biến CSS kính
         * (`.uitk-glass-tunable`, assets/css/glass.css), video nền (`#app-bg-video`, nằm dưới) và `#app-bg-image` (ảnh/gradient,
         * hoặc chỉ overlay khi nền là video). Video: có `videoSrc` -> nạp (cùng URL thì giữ nguyên, không giật); không có -> gỡ
         * src để giải phóng decoder (chỉ pause vẫn giữ tài nguyên giải mã).
         * @param {PlaylistBgView} view
         */
        function updatePlaylistBg(view) {
            document.documentElement.style.setProperty('--uitk-app-glass-filter', view.glassFilter);
            document.documentElement.style.setProperty('--uitk-app-glass-tint', view.glassTint);
            if (view.videoSrc) {
                if (appBgVideo.dataset.src !== view.videoSrc) {
                    appBgVideo.dataset.src = view.videoSrc;
                    appBgVideo.muted = true; // iOS chỉ cho phát nền khi muted — gán cả property (attribute ở template chỉ là defaultMuted)
                    appBgVideo.poster = view.videoPoster;
                    appBgVideo.src = view.videoSrc;
                }
            } else if (appBgVideo.dataset.src) {
                appBgVideo.pause();
                appBgVideo.removeAttribute('src');
                appBgVideo.removeAttribute('poster');
                appBgVideo.load();
                delete appBgVideo.dataset.src;
            }
            appBgVideo.style.display = view.videoSrc ? 'block' : 'none';
            appBgImage.style.backgroundImage = view.imageBg;
        }

        /**
         * Bật/tắt PHÁT video nền App (chỉ play/pause, src do updatePlaylistBg()). Chưa nạp video -> bỏ qua. `play()` bị từ chối
         * (vd iOS Low Power Mode) -> nuốt lỗi, poster vẫn hiện như ảnh tĩnh.
         * @param {boolean} shouldPlay
         */
        function setAppBgVideoPlayback(shouldPlay) {
            if (!appBgVideo || !appBgVideo.dataset.src) return;
            if (shouldPlay) {
                const playResult = appBgVideo.play();
                if (playResult && typeof playResult.catch === 'function') playResult.catch(() => {});
            } else {
                appBgVideo.pause();
            }
        }

        /**
         * Ép WebKit/iOS Safari tính lại `backdrop-filter` của mọi lớp kính ngay sau khi nền đổi (compositor giữ "ảnh chụp" nền cũ
         * phía sau kính tới khi có tác động khác) — 2 bước, Workflow hẹn khung hình giữa 2 bước (workflowTheme._forceGlassRepaint()).
         * Bước 1: đổi tạm `backdrop-filter` sang `blur(0px)` + ép reflow. Không đụng `transform` (nhiều lớp kính trượt/ẩn hiện
         * bằng class transform). @returns {Element[]} các lớp kính vừa đổi (đưa cho restoreGlassBackdrop())
         */
        function suspendGlassBackdrop() {
            const glassEls = [...document.querySelectorAll('.glass-panel, .glass-modal, .drawer-glass, .glass-control-center, .uitk-glass-surface, .uitk-glass-elevated, [data-uitk~="vizChromeBtn"], [data-uitk~="vizPanelSurface"], .pc-surface')];
            glassEls.forEach((el) => {
                el.style.webkitBackdropFilter = 'blur(0px)';
                el.style.backdropFilter = 'blur(0px)';
                void el.offsetHeight; // ép reflow — áp giá trị tạm ngay, không gộp batch với bước 2
            });
            return glassEls;
        }

        /** Bước 2 (khung hình kế): xoá inline -> `backdrop-filter` về đúng giá trị của class. @param {Element[]} glassEls */
        function restoreGlassBackdrop(glassEls) {
            glassEls.forEach((el) => {
                el.style.webkitBackdropFilter = '';
                el.style.backdropFilter = '';
            });
        }

        /** Dựng CanvasGradient khớp `linear-gradient(angleDeg, stop.color stop.position%...)` của CSS — visual 2D vẽ đúng
         * gradient VBG đang hiển thị (workflowVisualBg.canvasFillStyle(), event/workflow/visual-bg-common.js). Trục gradient tính theo đúng CSS spec
         * (0deg = lên trên, theo chiều kim đồng hồ, điểm chiếu vuông góc qua tâm hộp). `stops` tự sort theo position. */
        function buildCanvasLinearGradient(ctx, angleDeg, width, height, stops) {
            const rad = (angleDeg % 360) * Math.PI / 180;
            const dx = Math.sin(rad), dy = -Math.cos(rad);
            const halfW = width / 2, halfH = height / 2;
            const length = Math.abs(halfW * dx) + Math.abs(halfH * dy);
            const grad = ctx.createLinearGradient(halfW - dx * length, halfH - dy * length, halfW + dx * length, halfH + dy * length);
            stops.slice().sort((a, b) => a.position - b.position).forEach((s) => grad.addColorStop(Math.max(0, Math.min(1, s.position / 100)), s.color));
            return grad;
        }
