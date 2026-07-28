/**
 * event/virtual-machine-state.js — chạy NHIỀU callback độc lập theo điều kiện, gọi NGAY TRONG 1
 * case của router, thay cho switch/if lồng tay. KHÁC event/block.js ở 3 điểm:
 *
 *   1. Mục đích: block.js CHẶN (boolean, chạy trước router) — cái này CHỌN CHẠY GÌ (0..N
 *      callback, chạy SAU khi đã vào router, ngay tại 1 case cụ thể).
 *   2. KHÔNG có registry/Map — rules truyền TRỰC TIẾP tại chỗ gọi run(), không lưu lại gì sau khi
 *      chạy xong. Không có "msg.type" nào để đăng ký nên không có khái niệm trùng lặp/ghi đè
 *      giữa các router — domain tự nhiên vì rule nằm ngay trong file router sở hữu nó.
 *   3. File này KHÔNG biết gì về appState/msg/eventBus/core/workflow — router tự đọc state, tự
 *      đóng gói `callback` (thường bọc quanh 1 hàm core/workflow có sẵn); run() chỉ so
 *      `state operator value` (qua service/operation.js — CÙNG bộ toán tử với block.js, tránh 2
 *      bảng lệch nhau) rồi gọi callback nếu nó là function.
 *
 * NHIỀU RULE KHỚP CÙNG LÚC LÀ ĐÚNG THIẾT KẾ — run() KHÔNG dừng ở rule đầu tiên khớp, tất cả rule
 * thoả điều kiện đều được gọi callback (vd state=10 vừa khớp '=== 10' vừa khớp '>= 10' thì CẢ
 * HAI callback đều chạy).
 *
 * CÁCH DÙNG (trong 1 case của router):
 *   case 'cluster.action.click': {
 *       const someState = appState.get('someState'); // đọc 1 lần, không đọc lại trong mỗi rule
 *       VirtualMachineState.run([
 *           { state: someState, operation: '===', value: 10, callback: () => workflow1(msg) },
 *           { state: someState, operation: '>=',  value: 10, callback: () => workflow2(msg) },
 *       ]);
 *       break;
 *   }
 *
 * MỚI (phản hồi Giang — "vẫn phải có chế độ đồng bộ", sau khi chỉ ra `run()` fire-and-forget từng
 * bị hiểu lầm/né tránh sai chỗ ở event/workflow/app-boot.js) — 2 CHẾ ĐỘ TÁCH BẠCH, CÙNG 1 bộ đánh
 * giá rule (`_evalRules()` dưới), khác nhau CHỈ ở return value:
 *   - `run(rules)` — GIỮ NGUYÊN 100% như thiết kế gốc phía trên: fire-and-forget, KHÔNG trả gì,
 *     dùng cho tuyệt đại đa số case router (không cần biết/chờ kết quả callback).
 *   - `runAsync(rules)` — CÙNG cú pháp rules hệt `run()`, nhưng trả về `Promise.all(...)` của TẤT
 *     CẢ return value từ các callback đã khớp (callback thường HAY async đều được — Promise.all()
 *     tự bọc giá trị không phải Promise thành resolved ngay) — DÙNG KHI caller cần `await` cho tới
 *     khi callback (có thể async) chạy xong rồi mới tiếp tục, ví dụ boot sequence cần đọc xong
 *     type của 1 folder trước khi làm bước kế tiếp (event/workflow/app-boot.js).
 *
 * NẠP: không phụ thuộc gì (không đụng DOM/appState/eventBus) — an toàn ở bất kỳ đâu trong block
 * 5, đặt cạnh event/bus.js cho nhất quán vị trí với event/block.js.
 */
const VirtualMachineState = (() => {

    /**
     * Đánh giá TỪNG rule, gọi callback nếu khớp, GOM lại return value của mọi callback đã chạy —
     * DÙNG CHUNG bởi cả run()/runAsync() bên dưới, tránh lặp logic đánh giá 2 nơi.
     * @param {{state: *, operation: string, value: *, callback: Function}[]} rules - xét TỪNG
     *        rule độc lập, không có thứ tự ưu tiên loại trừ nhau — chỉ ảnh hưởng thứ tự CHẠY nếu
     *        ≥2 rule cùng khớp (chạy tuần tự đúng thứ tự khai báo trong mảng).
     * @returns {{firedAny: boolean, results: *[]}}
     */
    function _evalRules(rules) {
        let firedAny = false;
        const results = [];
        for (const rule of rules) {
            if (!operation.evaluate(rule.state, rule.operation, rule.value)) continue;
            if (typeof rule.callback !== 'function') {
                console.warn('[VirtualMachineState] callback không phải function, bỏ qua rule.', rule);
                continue;
            }
            results.push(rule.callback());
            firedAny = true;
        }
        return { firedAny, results };
    }

    /** Chế độ đồng bộ gốc — fire-and-forget, KHÔNG trả gì (xem "CÁCH DÙNG" phía trên). */
    function run(rules) {
        const { firedAny } = _evalRules(rules);
        if (!firedAny) {
            console.warn('[VirtualMachineState] run() — không rule nào khớp.', rules);
        }
    }

    /** Chế độ CHỜ ĐƯỢC — trả `Promise.all()` để caller `await` (xem "MỚI" phía trên). */
    function runAsync(rules) {
        const { firedAny, results } = _evalRules(rules);
        if (!firedAny) {
            console.warn('[VirtualMachineState] runAsync() — không rule nào khớp.', rules);
        }
        return Promise.all(results);
    }

    return { run, runAsync };
})();
