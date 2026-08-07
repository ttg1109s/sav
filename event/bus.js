/**
 * event/bus.js — TỔNG ĐÀI trung tâm của toàn bộ kiến trúc /event/.
 *
 * NẠP ĐẦU TIÊN (trước cả core/workflow/router/listener) — mọi tầng phía sau đều cần
 * `eventBus` đã tồn tại để gọi `register()` (router) hoặc `send()` (listener).
 *
 * CƠ CHẾ (đã thống nhất):
 *   - Bus giữ 2 danh sách: "router nào đã đăng ký tên gì" (routers) và "msg.type nào bị CHẶN
 *     khi nào" (blocks, xem mục BLOCK GATE dưới) — KHÔNG biết gì khác về nghiệp vụ (không chọn
 *     workflow nào chạy — việc đó thuộc router/virtual-machine-state, xem event/virtual-machine-
 *     state.js).
 *   - Router PHẢI tự khai báo với bus lúc nạp: `eventBus.register('storage', routerStorage)`.
 *   - Listener gửi message qua `eventBus.send(msg)`, msg có shape cố định (xem CONTRACT dưới).
 *   - Bus tra `msg.router` trong danh sách đã đăng ký:
 *       - Có       -> chuyển NGUYÊN msg cho `router.handle(msg)` (bus KHÔNG bóc payload — mỗi
 *                     nghiệp vụ cần data khác nhau, để chính router tự tách).
 *       - Không có -> NO-OP (im lặng, không throw) — tránh 1 lỗi đánh máy tên router làm sập cả
 *                     ứng dụng; chỉ console.warn để dễ dò lúc dev.
 *
 * CONTRACT (hợp đồng) — mọi message gửi qua eventBus.send() PHẢI đúng shape:
 *   @typedef {Object} EventMessage
 *   @property {string} router  - tên router đã đăng ký (vd 'storage')
 *   @property {string} type    - tên hành vi cụ thể, namespace theo router (vd 'storage.deleteBroken.click')
 *   @property {Object} payload - dữ liệu kèm theo, router tự destructure theo nhu cầu riêng
 *
 * Router object PHẢI có dạng:
 *   @typedef {Object} EventRouter
 *   @property {(msg: EventMessage) => void} handle
 *
 * ===================== BLOCK GATE (thêm) =====================
 * Cơ chế CHẶN NHỊ PHÂN 1 msg.type TRƯỚC KHI router.handle() được gọi — dùng khi 1 điều kiện
 * appState cần chặn CÙNG 1 hành vi tới từ NHIỀU router khác nhau (vd nút "đổi kiểu hiệu ứng" tới
 * từ cả nút cycle lẫn select trong Settings — cùng 1 điều kiện chặn, viết 1 lần, cả 2 nơi cùng
 * hưởng, không lệch nhau).
 *
 * CHỈ làm được việc CHẶN/KHÔNG CHẶN (trả boolean) — KHÔNG dùng để chọn "workflow nào chạy" (nếu
 * cần chọn giữa ≥2 đích khác nhau tuỳ state, đó là việc của switch/if NGAY TRONG case router,
 * hoặc event/virtual-machine-state.js — bus không được phép "biết" business logic đó).
 *
 * Đăng ký qua `registerBlock(msgType, groups, options)`:
 *   - `groups` là mảng NHÓM — CHỈ CẦN 1 nhóm đúng là CHẶN (OR giữa các nhóm).
 *   - Mỗi nhóm là mảng điều kiện `{field, operator, value}` — TẤT CẢ điều kiện trong nhóm phải
 *     đúng thì nhóm đó mới tính (AND trong 1 nhóm).
 *   - `field` đọc qua `appState.get(rootKey)` rồi tự đào path lồng bất kỳ độ sâu (vd
 *     'vizConfig.autoSwitchVisualEnabled').
 *   - `operator` dùng chung bộ toán tử ở `service/operation.js` (===/!==/>/</>=/<=/in/notIn).
 *   - `options.notify` (MỚI, 03/07/2026, tuỳ chọn) — chuỗi thông báo, tự bật `alertModal()` đúng
 *     lúc chặn thật xảy ra (không phải lúc đăng ký) — dùng khi người dùng CẦN biết vì sao thao tác
 *     vừa bấm không có phản ứng gì (khác hẳn phần lớn block hiện có, vốn chặn ÂM THẦM vì bản thân
 *     hành vi bị chặn không cần giải thích, vd nút đang mờ/disabled sẵn). Không truyền -> chặn im
 *     lặng như cũ.
 *
 * Đăng ký thực tế xem `event/block.js` (file DATA riêng, load ngay sau file này) — file bus.js
 * chỉ chứa CƠ CHẾ, không chứa danh sách đăng ký nào.
 */
const eventBus = (() => {
    const routers = new Map(); // routerName -> routerObject
    const blocks = new Map();  // msg.type -> mảng NHÓM (OR giữa nhóm) -> mỗi nhóm mảng điều kiện (AND trong nhóm)

    /**
     * Router tự gọi hàm này lúc file router của nó được nạp — đăng ký tên + object xử lý.
     * @param {string} name
     * @param {EventRouter} routerObject - phải có method handle(msg)
     */
    function register(name, routerObject) {
        if (typeof routerObject?.handle !== 'function') {
            console.warn(`[eventBus] register("${name}") bị bỏ qua: routerObject không có method handle().`);
            return;
        }
        if (routers.has(name)) {
            console.warn(`[eventBus] register("${name}") ghi đè router đã đăng ký trước đó cùng tên — kiểm tra lại có bị nạp trùng file không.`);
        }
        routers.set(name, routerObject);
    }

    /** Đọc field theo path lồng bất kỳ độ sâu qua appState (vd 'vizConfig.autoSwitchVisualEnabled').
     * SỬA (fix bus, phản hồi Giang 29/07/2026) — TỪ đợt tách AppConfig (25/07/2026, service/state.js),
     * 5 "config" (vizConfig/slideshowConfig/readerConfig/playlistConfig/playerConfig) KHÔNG còn sống
     * trong AppState nữa (đã dời qua AppConfig, domain riêng — xem AppConfig.defineDomain()/appConfig
     * .access() ở service/state.js) — `appState.get(rootKey)` cho 5 key này giờ luôn trả undefined +
     * console.warn (key không thuộc package nào), khiến MỌI block condition dùng path dạng
     * 'xxxConfig.field' (vd 'vizConfig.videoBgEnabled', event/block.js) ÂM THẦM luôn = undefined, tức
     * KHÔNG BAO GIỜ chặn dù field thật đang đúng điều kiện.
     * FIX: nhận diện rootKey có phải tên 1 domain AppConfig đã đăng ký không (quy ước domain + hậu tố
     * 'Config' — ĐÚNG cho cả 5 domain hiện có: viz/slideshow/reader/playlist/player) — nếu đúng, đọc
     * qua appConfig.access(domain).getAll() thay vì appState.get(). GENERIC theo AppConfig._domains
     * đã đăng ký — domain Config nào thêm sau này cũng tự được nhận diện, không cần sửa lại hàm này. */
    function resolveFieldPath(field, payload) {
        const [rootKey, ...rest] = field.split('.');
        // MỚI (v13 Batch F) — gốc 'payload': đọc THẲNG dữ liệu của chính message đang xét. Cần cho
        // lớp điều kiện "thứ sắp bị xoá có phải thứ đang được tham chiếu không" — thông tin đó chỉ
        // tồn tại trong payload, không có trong appState/appConfig.
        // Payload KHÔNG phải ngoại lệ về bản chất: nó cũng là 1 giá trị dùng để quyết định chặn hay
        // không, y hệt state (Giang chốt) — chỉ khác vòng đời (sống đúng 1 lượt gửi).
        if (rootKey === 'payload') {
            let curPayload = payload;
            for (const key of rest) {
                if (curPayload == null) return undefined;
                curPayload = curPayload[key];
            }
            return curPayload;
        }
        const configDomain = rootKey.endsWith('Config') ? rootKey.slice(0, -'Config'.length) : null;
        let cur = (configDomain && AppConfig._domains[configDomain])
            ? appConfig.access(configDomain).getAll()
            : appState.get(rootKey);
        for (const key of rest) {
            if (cur == null) return undefined;
            cur = cur[key];
        }
        return cur;
    }

    /**
     * Đánh giá 1 điều kiện block. Tách riêng + export để event/virtual-machine-state.js hoặc
     * router có thể tái dùng khi cần AND/OR phức tạp mà không phải viết lại bộ so sánh khác.
     * MỚI (v13 Batch F) — `valueField`: vế PHẢI cũng là 1 đường dẫn, resolve qua CÙNG
     * `resolveFieldPath()`. `operation.evaluate(a, op, b)` vốn chỉ so 2 GIÁ TRỊ, nó không biết và
     * không cần biết mỗi vế từ đâu ra — nên đây là ĐỐI XỨNG HOÁ, không phải năng lực mới.
     * Phải tách thành khoá RIÊNG (không tái dùng `value`) vì 2 thứ cùng kiểu string không tự phân
     * biệt được: `value: 'delete'` là giá trị thật, `valueField: 'somePath.someField'` là
     * đường dẫn. Điều kiện cũ chỉ dùng `value` -> hành vi KHÔNG đổi.
     * @param {{field: string, operator: string, value?: *, valueField?: string}} condition
     * @param {object} payload - payload của message đang xét (cho gốc 'payload').
     * @returns {boolean}
     */
    function evalCondition({ field, operator, value, valueField }, payload) {
        const right = valueField !== undefined ? resolveFieldPath(valueField, payload) : value;
        return operation.evaluate(resolveFieldPath(field, payload), operator, right);
    }

    /**
     * Đăng ký điều kiện CHẶN cho 1 msg.type. Gọi 1 LẦN lúc nạp (xem event/block.js).
     * MỚI (03/07/2026): tham số thứ 3 `options.notify` — nếu có (khác `null`/`undefined`), lúc
     * CHẶN THẬT (isBlocked() trả true) tự bật `alertModal(options.notify)` báo cho người dùng biết
     * VÌ SAO hành động vừa bấm không xảy ra, thay vì im lặng không phản hồi gì. Không truyền
     * `options`/`notify` -> giữ nguyên hành vi cũ (chặn im lặng).
     * @param {string} msgType
     * @param {Array<Array<{field: string, operator: string, value: *}>>} groups - mảng nhóm,
     *        OR giữa nhóm, AND trong 1 nhóm (xem BLOCK GATE ở JSDoc đầu file).
     * @param {{notify?: string}} [options]
     */
    function registerBlock(msgType, groups, options) {
        if (blocks.has(msgType)) {
            console.warn(`[eventBus] registerBlock("${msgType}") ghi đè block đã đăng ký trước đó — kiểm tra lại có bị nạp trùng file không.`);
        }
        blocks.set(msgType, { groups, notify: options?.notify ?? null });
    }

    /** @param {string} msgType @param {object} [payload] @returns {boolean} true nếu đang bị chặn.
     * MỚI: tự bật notify (nếu đăng ký có) đúng lúc chặn thật xảy ra — xem registerBlock() ở trên. */
    function isBlocked(msgType, payload) {
        const entry = blocks.get(msgType);
        if (!entry) return false;
        const blocked = entry.groups.some(group => group.every((cond) => evalCondition(cond, payload))); // OR giữa nhóm, AND trong nhóm
        if (blocked && entry.notify) {
            alertModal(entry.notify); // KHÔNG await — isBlocked() phải trả boolean NGAY, không chờ modal đóng
        }
        return blocked;
    }

    /**
     * Listener gọi hàm này để gửi message. Tra msg.router trong danh sách đã đăng ký.
     * @param {EventMessage} msg
     */
    function send(msg) {
        if (!msg || typeof msg.router !== 'string') {
            console.warn('[eventBus] send() bị bỏ qua: message thiếu field "router" hợp lệ.', msg);
            return;
        }
        if (isBlocked(msg.type, msg.payload)) {
            return; // bị chặn ĐÚNG THIẾT KẾ theo event/block.js — im lặng, KHÔNG console.warn (không phải lỗi)
        }
        const router = routers.get(msg.router);
        if (!router) {
            // NO-OP theo đúng quy ước — không throw, chỉ log để dễ dò lúc dev (vd router chưa nạp
            // xong do sai thứ tự <script>, hoặc đánh máy sai tên router).
            console.warn(`[eventBus] send() không tìm thấy router đã đăng ký tên "${msg.router}" — message bị bỏ qua (no-op).`, msg);
            return;
        }
        router.handle(msg);
    }

    return { register, registerBlock, evalCondition, send };
})();
