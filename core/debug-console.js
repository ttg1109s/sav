/**
 * core/debug-console.js — MỚI (18/07/2026, Giang yêu cầu — "mục mới trong Settings > Misc, vào
 * hiện console log", phục vụ debug lúc test trên mobile không mở được DevTools thật).
 *
 * Bọc `console.log`/`console.warn`/`console.error` để NGOÀI VIỆC vẫn in ra console thật (KHÔNG
 * thay thế hành vi gốc, chỉ "nghe lén" thêm), CÒN lưu lại vào 1 ring buffer trong RAM (tối đa
 * DEBUG_CONSOLE_MAX_ENTRIES dòng — dòng CŨ NHẤT tự bị đẩy ra khi đầy, tránh phình RAM vô hạn nếu
 * mở app rất lâu). `components/debug-console-drawer.js` + `event/workflow/settings-misc.js` đọc
 * buffer này qua `getDebugConsoleLogs()` để hiển thị trong panel Settings > Misc > Debug Console.
 *
 * NẠP SỚM NHẤT CÓ THỂ (đầu index.html, TRƯỚC CẢ i18n/lang.js) — để bắt được CÀNG NHIỀU log càng
 * tốt từ suốt quá trình boot (mọi file core/event khác đều `console.log` rất nhiều dòng dạng
 * "writer: ..." ngay lúc chạy — nạp file này TRỄ sẽ bỏ lỡ log của MỌI file nạp trước nó). File này
 * KHÔNG phụ thuộc gì (không đụng DOM/appState/eventBus/t()) — an toàn đứng ở vị trí ĐẦU TIÊN
 * tuyệt đối trong danh sách script nội bộ của project.
 *
 * LƯU Ý KIẾN TRÚC — đây là 1 NGOẠI LỆ CÓ CHỦ Ý với quy ước "core chỉ khai const/function, không
 * side-effect ở top-level": việc gán đè `console.log = ...` PHẢI chạy NGAY lúc file này nạp (không
 * thể trì hoãn vào trong 1 hàm rồi chờ ai đó gọi — nếu vậy sẽ lại bỏ lỡ mọi log xảy ra TRƯỚC lúc
 * hàm đó được gọi, đúng vấn đề cần giải quyết). Bản thân việc bọc console KHÔNG đọc appState/DOM,
 * không phải "core nghiệp vụ" theo nghĩa Rule 1-5 (không ai gọi core khác, không core-gọi-core) —
 * chỉ là 1 utility toàn cục độc lập, tương tự cách `core/tab-hide-reload.js` từng làm (dù file đó
 * là di sản cũ, khác lý do).
 */
const DEBUG_CONSOLE_MAX_ENTRIES = 500;
const _debugConsoleBuffer = [];

const _originalConsoleLog = console.log.bind(console);
const _originalConsoleWarn = console.warn.bind(console);
const _originalConsoleError = console.error.bind(console);

/** Format 1 argument console.log/warn/error thành chuỗi hiển thị được. String giữ nguyên; Error
 * lấy name+message (KHÔNG cả stack — quá dài cho panel mobile); object khác thử JSON.stringify
 * (bọc try/catch phòng circular reference — vd DOM element/appState object lồng nhau); còn lại
 * String() thô (number/boolean/undefined/null...).
 * @param {*} arg
 * @returns {string}
 */
function _formatDebugConsoleArg(arg) {
    if (typeof arg === 'string') return arg;
    if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
    if (arg === null || arg === undefined) return String(arg);
    if (typeof arg === 'object') { try { return JSON.stringify(arg); } catch (e) { return '[object không stringify được]'; } }
    return String(arg);
}

/** Đẩy 1 dòng log mới vào buffer — TỰ ĐỘNG đẩy dòng CŨ NHẤT ra nếu đã đầy
 * (DEBUG_CONSOLE_MAX_ENTRIES). Hàm nội bộ, KHÔNG export global (chỉ 3 wrapper console.* bên dưới
 * gọi).
 * @param {'log'|'warn'|'error'} level
 * @param {IArguments|Array} args
 */
function _pushDebugConsoleEntry(level, args) {
    _debugConsoleBuffer.push({
        time: Date.now(),
        level,
        text: Array.from(args).map(_formatDebugConsoleArg).join(' '),
    });
    if (_debugConsoleBuffer.length > DEBUG_CONSOLE_MAX_ENTRIES) _debugConsoleBuffer.shift();
}

console.log = function (...args) { _pushDebugConsoleEntry('log', args); _originalConsoleLog(...args); };
console.warn = function (...args) { _pushDebugConsoleEntry('warn', args); _originalConsoleWarn(...args); };
console.error = function (...args) { _pushDebugConsoleEntry('error', args); _originalConsoleError(...args); };

/**
 * Core thuần: lấy TOÀN BỘ log đã bắt được cho tới giờ, THEO THỨ TỰ THỜI GIAN (cũ -> mới) — TRẢ VỀ
 * BẢN SAO (`.slice()`, không trả trực tiếp mảng gốc) để nơi gọi lỡ tay sửa/xoá phần tử không làm
 * sai lệch buffer thật.
 * @returns {Array<{time: number, level: 'log'|'warn'|'error', text: string}>}
 */
function getDebugConsoleLogs() {
    return _debugConsoleBuffer.slice();
}

/** Core thuần: xoá sạch buffer (nút "Xoá" trong panel Debug Console). */
function clearDebugConsoleLogs() {
    _debugConsoleBuffer.length = 0;
}
