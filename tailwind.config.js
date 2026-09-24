/**
 * tailwind.config.js — MỚI (24/09/2026, Giang chọn \"dùng file Tailwind build sẵn\" thay Play CDN cdn.tailwindcss.com).
 *
 * Build ra assets/css/tailwind.css (xem readme/tailwind-build.md). PHẢI build lại mỗi khi code dùng 1 class Tailwind
 * CHƯA từng xuất hiện trong project — quên build thì class đó không có style (Play CDN cũ tự sinh lúc chạy, bản build
 * thì không).
 *
 * `content`: Tailwind quét CHỮ trong các file này tìm tên class — class phải xuất hiện NGUYÊN VẸN trong code (vd
 * 'bg-sky-500'); ghép chuỗi kiểu `bg-${color}-500` sẽ KHÔNG được nhận ra -> viết đủ tên, hoặc thêm vào `safelist`.
 */
module.exports = {
    content: [
        './index.html',
        './subtitle-editor.html',
        './components/**/*.js',
        './core/**/*.js',
        './event/**/*.js',
        './service/**/*.js',
        './lang/**/*.js',
    ],
    // Giữ nguyên cấu hình cũ khai báo tay cho Play CDN (index.html/subtitle-editor.html): hover: chỉ chạy khi thiết bị
    // có chuột thật — tránh trạng thái hover \"kẹt\" sau khi chạm trên mobile.
    future: {
        hoverOnlyWhenSupported: true,
    },
    safelist: [],
};
