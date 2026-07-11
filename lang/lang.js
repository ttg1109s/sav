/**
 * lang.js — Bộ điều phối đa ngôn ngữ (i18n) cho toàn bộ app.
 *
 * ĐÃ DỜI từ js/core/lang.js sang /lang/lang.js. Lý do tách: object LANG_EN_KEYS (default tiếng
 * Anh, ~312 key) đã được CHIA NHỎ thành 6 file patch riêng trong /lang/patch/*.js (bắt buộc viết
 * dưới dạng .js, KHÔNG phải .json — project chạy qua file://, không thể fetch() file tĩnh nào,
 * nên dữ liệu default phải nạp qua <script> như mọi file core khác). File NÀY chỉ còn giữ ENGINE
 * i18n (gộp patch + t/tFormat/validate/save/apply/list) — không còn tự chứa key nào trực tiếp.
 *
 * KIẾN TRÚC (đã chốt lại sau khi review batch đầu, cập nhật khi tách /lang/):
 *   - `en` (tiếng Anh) là NGÔN NGỮ GỐC/DEFAULT — nằm CỨNG trong RAM, GHÉP LẠI ngay khi file này
 *     chạy, từ 7 biến global LANG_PATCH_* (xem /lang/patch/*.js, mỗi file 1 biến, nạp TRƯỚC file
 *     này). KHÔNG fetch, KHÔNG qua IndexedDB — luôn có sẵn ngay từ dòng đầu tiên app chạy, làm
 *     điểm tựa/fallback cuối cùng, và là NGUỒN KEY CHUẨN để validate mọi ngôn ngữ khác (diff: key
 *     thừa bị cắt, key thiếu lấy từ đây, value không phải string cũng coi là thiếu).
 *   - MỌI ngôn ngữ khác (kể cả tiếng Việt) đều là dữ liệu do NGƯỜI DÙNG TỰ UPLOAD (file .json) —
 *     project chạy qua `file://`, không tự fetch() được file tĩnh nào khác ngoài chính nó, nên
 *     không có ngôn ngữ "có sẵn cài cứng" nào khác ngoài en. File .json chuẩn (vd vi.json) sẽ được
 *     cung cấp qua 1 đường link tải riêng (README/changelog) — người dùng tự tải về rồi upload lại
 *     qua UI Settings, không tự động nạp.
 *   - Ngôn ngữ đã upload được lưu trong IndexedDB, store `languages` (xem db.js,
 *     getLanguagePack/setLanguagePack/deleteLanguagePack/getAllLanguageCodes) — key = mã ngôn ngữ
 *     lấy từ field `meta.code` trong chính file JSON, value = bản đã validate (đã cắt key thừa +
 *     bù key thiếu từ en + loại value không phải string). Upload lại CÙNG mã code đã có sẵn ->
 *     GHI ĐÈ (chèn lên) bản cũ, không tạo trùng.
 *
 * FILE JSON NGƯỜI DÙNG UPLOAD — cấu trúc bắt buộc (không đổi so với trước khi tách /lang/):
 *   {
 *     "meta": { "code": "vi", "name": "Tiếng Việt" },
 *     "keys": { "playlistView.heading": "Bài hát", ... }
 *   }
 *   - meta.code: mã ngôn ngữ ngắn (vd "vi", "fr", "ja") — dùng làm key IndexedDB + dùng trong
 *     <select> chọn ngôn ngữ.
 *   - meta.name: tên hiển thị cho người dùng chọn (vd "Tiếng Việt").
 *   - keys: object phẳng "namespace.key" -> "chuỗi đã dịch". Namespace theo đúng tên biến TPL_*
 *     của file component/template chứa nó (bỏ "TPL_", camelCase) — xem 5 file /lang/patch/*.js để
 *     biết đầy đủ danh sách namespace + toàn bộ key chuẩn (đây chính là "đề bài" để dịch).
 *
 * VALIDATE LÚC NẠP (saveLanguagePack()) — ÁP DỤNG CHO MỌI FILE UPLOAD:
 *   1. Key có trong LANG_EN_KEYS nhưng KHÔNG có trong file upload, HOẶC có nhưng value không phải
 *      kiểu string -> lấy giá trị tương ứng từ LANG_EN_KEYS (coi như "thiếu").
 *   2. Key có trong file upload nhưng KHÔNG có trong LANG_EN_KEYS -> CẮT BỎ hẳn (không lưu — cho
 *      nhẹ data, tránh rác tích lũy qua nhiều phiên bản app).
 *   3. Kết quả sau validate luôn có ĐÚNG NGUYÊN VẸN bộ key giống LANG_EN_KEYS, không hơn không kém.
 *
 * THỨ TỰ NẠP (xem index.html):
 *   /lang/patch/patch-common.js, patch-playlist.js, patch-visualizer.js, patch-subtitle-settings.js,
 *   patch-settings-misc.js, patch-file-manager.js, patch-subtitle-editor.js (MỚI 10/07/2026, dùng
 *   ở CẢ index.html LẪN subtitle-editor.html) (thứ tự nội bộ giữa 7 file KHÔNG quan trọng — key
 *   không trùng nhau giữa các patch, Object.assign chỉ cần cả 7 biến đã tồn tại) ->
 *   /lang/lang.js (file này, gộp lại) -> /lang/language-settings.js (UI Settings ngôn ngữ, cần
 *   t/tFormat/saveLanguagePack/...).
 *   Khối /lang/ NÓI CHUNG vẫn giữ đúng vị trí nạp như lang.js cũ trước đây: NGAY SAU config.js,
 *   TRƯỚC mọi file components/core/playlist khác dùng hàm t()/tFormat(). PHẢI nạp SAU db.js nếu
 *   muốn dùng các hàm saveLanguagePack/applySavedLanguage/deleteLanguagePack (cần
 *   getLanguagePack/setLanguagePack/deleteLanguagePack/getAllLanguageCodes) — nhưng t()/tFormat()
 *   tự chạy được ngay cả khi gọi TRƯỚC db.js, vì 2 hàm đó chỉ đọc RAM (activeLangKeys), không đụng
 *   IndexedDB.
 */

/**
 * LANG_EN_KEYS — NGÔN NGỮ GỐC, NẰM CỨNG TRONG RAM. Đây là nguồn key chuẩn duy nhất của toàn app —
 * mọi ngôn ngữ khác được validate (diff) dựa trên chính object này. Gộp từ 7 biến LANG_PATCH_*
 * (mỗi biến do 1 file /lang/patch/*.js nạp trước tạo ra — MỚI 10/07/2026: thêm
 * LANG_PATCH_SUBTITLE_EDITOR cho trang subtitle-editor.html) — bản thân file này không tự khai báo
 * key nào, chỉ Object.assign lại.
 */
const LANG_EN_KEYS = Object.assign(
    {},
    LANG_PATCH_COMMON,
    LANG_PATCH_PLAYLIST,
    LANG_PATCH_VISUALIZER,
    LANG_PATCH_SUBTITLE_SETTINGS,
    LANG_PATCH_SETTINGS_MISC,
    LANG_PATCH_FILE_MANAGER,
    LANG_PATCH_SUBTITLE_EDITOR
);

/**
 * ENGINE I18N — tối giản, không phụ thuộc framework.
 *
 * currentLangCode: mã ngôn ngữ đang active. 'en' nghĩa là đang dùng LANG_EN_KEYS trực tiếp
 * (không qua IndexedDB). Mã khác ('vi', 'fr'...) nghĩa là activeLangKeys đã được nạp từ
 * IndexedDB qua applySavedLanguage().
 *
 * activeLangKeys: object key->value đang dùng để tra cứu. Khởi tạo = LANG_EN_KEYS ngay tại
 * đây (không đợi DOMContentLoaded/IndexedDB) vì nhiều file template (TPL_*) gọi t() ngay
 * lúc parse (template literal cấp module, chạy trước DOMContentLoaded).
 */
let currentLangCode = 'en';
let activeLangKeys = LANG_EN_KEYS;

/**
 * t(key, fallback?) — tra cứu giá trị đã dịch theo currentLangCode hiện tại.
 * Không tìm thấy key trong ngôn ngữ active -> fallback về LANG_EN_KEYS (nguồn chuẩn luôn
 * đầy đủ) -> fallback cuối cùng là chính `key` truyền vào (hoặc `fallback` nếu có cung
 * cấp) để không bao giờ hiện "undefined" ra UI dù thiếu key nào.
 */
function t(key, fallback) {
    if (activeLangKeys && Object.prototype.hasOwnProperty.call(activeLangKeys, key)) return activeLangKeys[key];
    if (Object.prototype.hasOwnProperty.call(LANG_EN_KEYS, key)) return LANG_EN_KEYS[key];
    return fallback !== undefined ? fallback : key;
}

/**
 * tFormat(key, vars) — như t(), nhưng thay thế placeholder kiểu "{name}" bằng giá trị
 * tương ứng trong object `vars`. Ví dụ: tFormat('common.upload.loadingProgress', {done: 1, total: 5})
 * -> "Loading 1 / 5..." (en) hoặc bản dịch tương ứng của ngôn ngữ active.
 */
function tFormat(key, vars) {
    let str = t(key);
    if (vars) {
        for (const k of Object.keys(vars)) {
            str = str.split('{' + k + '}').join(vars[k]);
        }
    }
    return str;
}

/**
 * validateLanguagePack(rawKeys) — đối chiếu object key->value thô (vd parse từ file JSON
 * người dùng upload) với LANG_EN_KEYS (nguồn chuẩn), trả về 1 object MỚI ĐÃ VALIDATE:
 *   - Key có trong LANG_EN_KEYS nhưng rawKeys thiếu, HOẶC rawKeys có nhưng value không
 *     phải string -> lấy giá trị từ LANG_EN_KEYS.
 *   - Key có trong rawKeys nhưng KHÔNG có trong LANG_EN_KEYS -> bị cắt bỏ hẳn, không đưa
 *     vào kết quả.
 * Kết quả luôn có ĐÚNG NGUYÊN VẸN bộ key giống LANG_EN_KEYS, không hơn không kém.
 */
function validateLanguagePack(rawKeys) {
    const safeRaw = (rawKeys && typeof rawKeys === 'object') ? rawKeys : {};
    const result = {};
    for (const key of Object.keys(LANG_EN_KEYS)) {
        const val = safeRaw[key];
        result[key] = (typeof val === 'string') ? val : LANG_EN_KEYS[key];
    }
    return result;
}

/**
 * saveLanguagePack(parsedJson) — nhận object đã JSON.parse() từ file người dùng upload,
 * kiểm tra cấu trúc bắt buộc (meta.code dạng string non-empty), validate toàn bộ `keys`
 * qua validateLanguagePack(), rồi lưu vào IndexedDB store `languages` (key = meta.code —
 * upload lại cùng mã sẽ GHI ĐÈ bản cũ, không tạo trùng).
 *
 * Trả về Promise<{ok: true, code, name}> nếu thành công, hoặc Promise<{ok: false, reason}>
 * nếu cấu trúc file không hợp lệ (thiếu meta.code, hoặc meta.code rỗng/không phải string).
 * KHÔNG tự áp dụng ngôn ngữ vừa lưu — gọi applySavedLanguage(code) riêng nếu muốn dùng ngay.
 */
async function saveLanguagePack(parsedJson) {
    const meta = parsedJson && parsedJson.meta;
    const code = meta && typeof meta.code === 'string' ? meta.code.trim() : '';
    if (!code) return { ok: false, reason: 'invalid_meta_code' };
    const name = (meta && typeof meta.name === 'string' && meta.name.trim()) ? meta.name.trim() : code;
    const validatedKeys = validateLanguagePack(parsedJson && parsedJson.keys);
    const pack = { meta: { code, name }, keys: validatedKeys };
    await setLanguagePack(code, pack);
    return { ok: true, code, name };
}

/**
 * applySavedLanguage(code) — đổi ngôn ngữ active sang 1 mã đã có trong IndexedDB (hoặc
 * 'en' để quay về default cứng trong RAM, không cần đọc IndexedDB).
 * Trả về true nếu áp dụng thành công, false nếu code='en' (luôn thành công thật ra, xem
 * dưới) hoặc không tìm thấy record tương ứng trong IndexedDB (giữ nguyên ngôn ngữ hiện tại).
 * KHÔNG tự gọi applyLanguageToDom() — nơi gọi (UI chọn ngôn ngữ, batch sau) tự gọi nối tiếp
 * nếu cần cập nhật DOM ngay không reload.
 */
async function applySavedLanguage(code) {
    if (code === 'en') {
        currentLangCode = 'en';
        activeLangKeys = LANG_EN_KEYS;
        return true;
    }
    const pack = await getLanguagePack(code);
    if (!pack || !pack.keys) return false;
    currentLangCode = code;
    activeLangKeys = pack.keys;
    return true;
}

/** deleteLanguagePack đã có sẵn ở db.js (xoá thẳng record IndexedDB theo mã) — KHÔNG định
 * nghĩa lại ở đây để tránh trùng tên. Nơi gọi (UI chọn ngôn ngữ) tự quyết định gọi
 * applySavedLanguage('en') SAU KHI xoá nếu ngôn ngữ đang active chính là mã vừa bị xoá. */

/**
 * listAvailableLanguages() — liệt kê toàn bộ ngôn ngữ có thể chọn: luôn có 'en' (cứng RAM,
 * đứng đầu danh sách) + mọi mã đã lưu trong IndexedDB. Trả về mảng [{code, name}, ...].
 */
async function listAvailableLanguages() {
    const result = [{ code: 'en', name: 'English' }];
    const codes = await getAllLanguageCodes();
    for (const code of codes) {
        const pack = await getLanguagePack(code);
        if (pack && pack.meta) result.push({ code: pack.meta.code || code, name: pack.meta.name || code });
    }
    return result;
}

/**
 * applyLanguageToDom() — quét toàn bộ DOM hiện tại, áp lại bản dịch cho mọi phần tử có
 * đánh dấu data-i18n (text node), data-i18n-title (thuộc tính title), data-i18n-placeholder
 * (thuộc tính placeholder). Gọi sau applySavedLanguage() để cập nhật UI đã render mà không
 * cần reload trang (batch UI chọn ngôn ngữ sau sẽ dùng hàm này).
 */
function applyLanguageToDom() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
        el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
        el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
        el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
}
