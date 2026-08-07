/**
 * service/state/visual-bg.js — Package STATE domain "visual-bg" (v13, plan-v13-visual-background-
 * unification.md). THAY HẲN `service/state/video-bg.js` cũ (XOÁ file đó) — domain "video-bg" đã bị
 * gộp vào "Visual Background" chung với ảnh nền tĩnh + slideshow album.
 *
 * CHỈ chứa giá trị RUNTIME (không persist được): 2 blob: URL đang áp dụng thật lên DOM. Bản thân
 * LỰA CHỌN của người dùng (type, nguồn...) sống ở CONFIG domain `visualBg`
 * (core/config.js::DEFAULT_VISUAL_BG_CONFIG, persist qua `meta.visualBgConfig`) — 2 nơi KHÁC nhau
 * về bản chất, không trộn: config lưu KEY (bền vững qua nhiều session), state giữ object URL
 * (chết theo session, phải resolve lại từ key mỗi lần boot).
 *
 * PHẢI nạp SAU service/state.js.
 */
        AppState.definePackage('visual-bg', {
            schema: {
                // blob: URL của video nền ĐANG gán vào `#bg-video` — '' = chưa gán gì. Dùng để
                // revoke đúng URL cũ trước khi tạo URL mới (tránh rò bộ nhớ khi đổi nguồn nhiều lần).
                visualBgVideoObjectUrl: 'string',
                // blob: URL của ảnh nền tĩnh ĐANG gán vào `#visual-bg-image` — '' = chưa gán gì.
                visualBgImageObjectUrl: 'string',
                // URL đã THẬT SỰ gán vào thuộc tính src của `#bg-video` (bookkeeping chống gán lại
                // src thừa mỗi lần Next/Prev) — GIỮ NGUYÊN vai trò của `_videoBgLoadedUrl` cũ ở
                // package "video-bg", chỉ đổi tên cho khớp domain mới.
                visualBgVideoLoadedUrl: 'nullable-string',
            },
            buildDefaults() {
                return {
                    visualBgVideoObjectUrl: '',
                    visualBgImageObjectUrl: '',
                    visualBgVideoLoadedUrl: null,
                };
            },
        });
