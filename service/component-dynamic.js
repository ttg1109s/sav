/**
 * service/component-dynamic.js — hạ tầng dùng chung (Rule 3b mở rộng, readme/core-function-
 * conventions.md). Clone 1 chuỗi HTML (biến TPL_* tĩnh hoặc kết quả 1 hàm render*() ở
 * components/*.js) thành DOM, gán giá trị vào đúng slot theo map do NƠI GỌI (Core-ui) soạn sẵn —
 * không biết/không quyết định slot nghĩa là gì, thuần cơ chế, cùng lý do service/db.js.
 */

/**
 * @param {string} html - chuỗi HTML (TPL_* hoặc kết quả render*()).
 * @param {Object<string, {selector: string, prop: string, value: *}>} [slotMap] - vd
 *   { title: { selector: '#video-preview-title', prop: 'textContent', value: filename } }.
 * @returns {DocumentFragment} đã điền xong slot, sẵn sàng append vào DOM thật.
 */
function instantiateComponent(html, slotMap) {
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    const fragment = tpl.content;
    if (slotMap) {
        Object.values(slotMap).forEach(({ selector, prop, value }) => {
            const el = fragment.querySelector(selector);
            if (el) el[prop] = value;
        });
    }
    return fragment;
}
