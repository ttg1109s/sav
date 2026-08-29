/**
 * service/state/slideshow-presets.js — Package STATE domain "slideshow-presets": danh sách "Cấu
 * hình Slideshow" (preset transition/Ken Burns đặt tên được, độc lập khỏi Visual Background — xem
 * core/slideshow-presets.js, event/workflow/slideshow-presets.js). Xem cơ chế package ở
 * service/state.js.
 *
 * MỚI (29/08/2026) — BUG đã sửa: field `slideshowPresets` được dùng khắp
 * event/workflow/slideshow-presets.js/app-settings.js/slideshow.js qua `appState.get()`/`.set()`
 * NHƯNG CHƯA TỪNG được đăng ký package nào — `appState.get('slideshowPresets')` luôn trả
 * `undefined` (fail SILENT theo thiết kế AppState, KHÔNG throw ở tầng đó), khiến
 * `renderSlideshowListBody(undefined, ...)` crash NGANG giữa chừng (đọc `.length`/`.map()` trên
 * `undefined`) TRƯỚC KHI `_render()` kịp chạy — Generic Drawer vẫn đứng yên ở màn CŨ dù
 * `_screenStack` đã push xong (nên nút Back vẫn hoạt động đúng, chỉ nội dung không đổi).
 *
 * PHẢI nạp SAU service/state.js (cần class AppState.definePackage), TRƯỚC
 * service/state/record/index.js (dòng registry('player','all') cần package này đã đăng ký).
 */
        AppState.definePackage('slideshow-presets', {
            schema: {
                slideshowPresets: 'array',
            },
            buildDefaults() {
                return {
                    slideshowPresets: [],
                };
            },
        });
