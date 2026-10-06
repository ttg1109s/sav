/**
 * event/workflow/photo-duration.js — Workflow DÙNG CHUNG tính `duration` (giây) cho 1 ảnh (Photo tích hợp duration như
 * Song/Video). TÁCH (06/10/2026, tách trình sửa video thành trang riêng video-editor.html — nút Chụp lưu ảnh mới cần đúng
 * công thức này) NGUYÊN VẸN từ event/workflow/file-manager-photo.js::computePhotoDuration() (tên cũ giữ lại, gọi sang đây).
 *
 * NẠP SAU: (không phụ thuộc gì — chỉ Web Crypto).
 */
// 4 hằng số cho `computePhotoDuration()` ngay dưới (Photo tích hợp `duration` như Song/Video, thừa
// hưởng Play/Next-Prev/Shuffle của Playlist). Công thức TUYẾN TÍNH THẲNG theo weight, KHÔNG trần
// trên (Giang chốt "không kẹp max") — file càng lớn/độ phân giải càng cao, duration càng tăng.
const DURATION_MIN_SEC = 5;          // sàn — tránh ảnh siêu nhỏ ra duration gần 0 vô nghĩa (KHÔNG phải trần).
const DURATION_PIXEL_WEIGHT = 2;     // 1 pixel ảnh gốc "nặng" tương đương bao nhiêu byte trong công thức.
const DURATION_PER_WEIGHT_SEC = 0.00000125; // giây CỘNG THÊM cho mỗi 1 byte-tương-đương weight.
const DURATION_JITTER_SEC = 0.4;     // biên độ jitter TỐI ĐA từ SHA-256 — chỉ phá trùng số tuyệt đối
                                      // giữa 2 ảnh CÙNG weight, không đủ lớn để đảo thứ tự.

const workflowPhotoDuration = {
    /** MỚI (Giang yêu cầu — Photo tích hợp `duration` như Song/Video, thừa hưởng đúng cơ chế Play/
     * Next-Prev/Shuffle của Playlist, im lặng hoàn toàn lúc hiển thị — xác nhận qua trao đổi trực
     * tiếp, KHÔNG phải "thời gian hiển thị cố định" kiểu Slideshow VBG cũ) — tính `duration` (giây,
     * số thực) HOÀN TOÀN deterministic từ CHÍNH nội dung file (cùng file luôn ra cùng số — không lưu
     * seed random rời rạc nào).
     *
     * CÔNG THỨC (2 bước, hằng số DURATION_* khai báo đầu file — GIÁ TRỊ TẠM, xem comment ở đó):
     *   1. weight   = fileSize (byte) + DURATION_PIXEL_WEIGHT × (width × height)
     *   2. duration = DURATION_MIN_SEC + weight × DURATION_PER_WEIGHT_SEC + jitter
     * TUYẾN TÍNH THẲNG, KHÔNG TRẦN (Giang chốt "không kẹp max") — file càng lớn/độ phân giải càng
     * cao, duration cứ thế tăng theo, không có ngưỡng tiệm cận hay min()/clamp() nào chặn trên.
     * `DURATION_MIN_SEC` là SÀN (không phải trần) — chỉ để ảnh siêu nhỏ không ra duration gần 0.
     * `jitter` (0 → DURATION_JITTER_SEC giây) lấy từ 4 byte đầu SHA-256 của CHÍNH file — CHỈ để 2
     * ảnh CÙNG weight (size + resolution giống hệt) không trùng số tuyệt đối, biên độ nhỏ hơn NHIỀU
     * bước nhảy thật của phần tuyến tính nên KHÔNG đảo thứ tự "ảnh nặng hơn -> duration dài hơn".
     *
     * SHA-256 qua Web Crypto (`crypto.subtle.digest`, native, không cần thư viện) — CẦN secure
     * context (`https:`/`localhost` chắc chắn có; `file:` đã xác nhận hoạt động trên Chromium, CHƯA
     * test Safari/WebKit). Guard `crypto.subtle` không tồn tại -> `duration` vẫn tính bình thường,
     * chỉ `jitter = 0` (KHÔNG chặn cả tiến trình upload chỉ vì thiếu 1 phần jitter).
     *
     * Đặt ở Workflow (không phải core/file-manager/image.js) vì cần `File.arrayBuffer()` — cùng lý
     * do `resizeImageForThumbnail()` ở Workflow (Rule 1-4). Dùng CHUNG bởi `playlist.js::
     * uploadPhotos()` VÀ `image-edit.js::saveEditOverwrite()` (ảnh sửa xong đổi kích thước/dung
     * lượng -> tính lại cho nhất quán).
     * @param {File|Blob} file - blob ẢNH GỐC (không phải thumbBlob).
     * @param {number} width - chiều rộng ảnh gốc (px).
     * @param {number} height - chiều cao ảnh gốc (px).
     * @returns {Promise<number>} duration (giây, số thực, làm tròn 2 chữ số thập phân, KHÔNG có trần trên)
     */
    async compute(file, width, height) {
        const weight = file.size + DURATION_PIXEL_WEIGHT * (width * height);
        let jitter = 0;
        if (window.crypto && window.crypto.subtle) {
            try {
                const digestBuffer = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
                const first4Bytes = new DataView(digestBuffer).getUint32(0); // 0 .. 4294967295
                jitter = (first4Bytes / 4294967295) * DURATION_JITTER_SEC;
            } catch (err) {
                console.error('[computePhotoDuration] crypto.subtle.digest lỗi, bỏ qua jitter:', err);
            }
        }
        const duration = DURATION_MIN_SEC + weight * DURATION_PER_WEIGHT_SEC + jitter;
        return Math.round(duration * 100) / 100;
    },
};
