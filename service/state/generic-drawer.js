/**
 * service/state/generic-drawer.js — Package STATE domain "generic-drawer". SỬA ("Song/Video
 * Unification" v12) — trước đây dùng bởi CẢ index.html LẪN video-editor.html (2 trang từng có
 * Generic Drawer riêng) — video-editor.html ĐÃ XOÁ HẲN, giờ CHỈ còn index.html dùng package này.
 * Xem cơ chế package ở service/state.js. PHẢI nạp SAU service/state.js.
 */
        AppState.definePackage('generic-drawer', {
            schema: {
                // true từ lúc openGenericDrawer() bắt đầu tới lúc hideGenericDrawerImmediately()
                // chạy xong — dùng bởi Block gate (event/block.js) để chặn mở chồng.
                isGenericDrawerOpen: 'boolean',
            },
            buildDefaults() {
                return {
                    isGenericDrawerOpen: false,
                };
            },
        });
