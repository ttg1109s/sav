/**
 * service/operation.js — so sánh toán tử DÙNG CHUNG cho `event/block.js` (bus gate, chạy TRƯỚC
 * router) và `event/virtual-machine-state.js` (chạy NHIỀU workflow ngay trong 1 case của router)
 * — 1 bộ toán tử DUY NHẤT, tránh 2 nơi tự định nghĩa 2 bảng dễ lệch nhau.
 *
 * PHẠM VI: `operation.evaluate(a, op, b)` CHỈ so sánh 2 giá trị rồi trả `true`/`false` — không
 * biết gì về `appState`/`msg`/`callback`/router/workflow. Nơi gọi (bus.js, virtual-machine-
 * state.js) tự lo phần đọc field/gọi callback, file này thuần là tiện ích so sánh.
 *
 * NẠP: không phụ thuộc gì (không đụng DOM/appState/eventBus) — đặt cạnh `service/state.js`
 * trong nhóm `service/`, miễn nạp TRƯỚC `event/bus.js` (nơi gọi `operation.evaluate()` lần đầu
 * qua `evalCondition()`).
 */
const operation = (() => {

    /** Toán tử so sánh đơn giá trị. */
    const SCALAR_OPS = {
        '===': (a, b) => a === b,
        '!==': (a, b) => a !== b,
        '>':   (a, b) => a > b,
        '<':   (a, b) => a < b,
        '>=':  (a, b) => a >= b,
        '<=':  (a, b) => a <= b,
        // MỚI (Playlist Filter, core/playlist/filter.js) — so khớp chuỗi con, không phân biệt
        // hoa/thường. Nơi gọi tự chuẩn hoá dấu tiếng Việt (normalizeSongName(), core/song-search.js)
        // TRƯỚC khi truyền vào đây nếu cần — file này KHÔNG tự làm việc đó (không phụ thuộc gì,
        // xem docstring đầu file).
        'contains':    (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase().includes(b.toLowerCase()),
        'notContains': (a, b) => typeof a === 'string' && typeof b === 'string' && !a.toLowerCase().includes(b.toLowerCase()),
    };

    /**
     * Toán tử 'in'/'notIn' — `b` PHẢI là array. Dựng `Set` tạm để tra thành viên O(1) (thay vì
     * `Array.includes()` O(n)), rồi `.clear()` ngay sau khi lấy xong kết quả — `set` chỉ sống
     * trong đúng 1 lần gọi hàm này, không cache/giữ lại giữa các lần `evaluate()` khác nhau.
     * @param {*} a - giá trị cần tra có nằm trong `b` hay không
     * @param {Array} b - danh sách giá trị hợp lệ
     * @param {boolean} negate - true nếu là 'notIn' (đảo kết quả)
     */
    function evalSetMembership(a, b, negate) {
        if (!Array.isArray(b)) {
            console.warn(`[operation] operator 'in'/'notIn' yêu cầu value là array, nhận:`, b);
            return false;
        }
        const set = new Set(b);
        const result = set.has(a);
        set.clear();
        return negate ? !result : result;
    }

    /**
     * So sánh `a operator b`, trả `true`/`false`. Không throw — operator không hỗ trợ thì
     * `console.warn` rồi trả `false` (an toàn theo hướng "không khớp" thay vì làm sập luồng gọi).
     * @param {*} a - giá trị thực tế (thường đọc từ appState)
     * @param {string} op - '===' | '!==' | '>' | '<' | '>=' | '<=' | 'in' | 'notIn' | 'contains' | 'notContains'
     * @param {*} b - giá trị so sánh (array bắt buộc nếu op là 'in'/'notIn')
     * @returns {boolean}
     */
    function evaluate(a, op, b) {
        if (op === 'in') return evalSetMembership(a, b, false);
        if (op === 'notIn') return evalSetMembership(a, b, true);
        const cmp = SCALAR_OPS[op];
        if (!cmp) {
            console.warn(`[operation] operator không hỗ trợ: "${op}"`);
            return false;
        }
        return cmp(a, b);
    }

    return { evaluate };
})();
