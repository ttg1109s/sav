/**
 * event/workflow/element-style-editor.js — "THẰNG THỰC THI CUỐI" cho công cụ CHUNG "Element Style
 * Editor" (dựng CSS box model + text style qua UI trong Generic Drawer, xuất chuỗi CSS rồi áp
 * inline lên 1 DOM cụ thể).
 *
 * API CÔNG KHAI DUY NHẤT hiện tại: `workflowElementStyleEditor.open(targetEl, onApply,
 * initialCssString?)` — gọi TRỰC TIẾP từ Workflow domain khác (CÙNG tiền lệ gọi chéo Workflow, vd
 * `closeControlCenter()` trong event/workflow/custom-effect.js). `initialCssString` (MỚI 16/08/2026,
 * mục 2) — optional, xem docstring open() bên dưới.
 *   - `targetEl` — DOM áp inline style trực tiếp lúc bấm Áp dụng (applyElementStyleToDom(), core/
 *     element-style-editor.js). Truyền `null` nếu KHÔNG có DOM sống nào cần áp trực tiếp (vd nơi
 *     gọi tự lo lưu + áp qua `onApply` — applyElementStyleToDom() tự guard `!targetEl`, không lỗi).
 *   - `onApply(cssString)` (optional) — callback nhận chuỗi CSS vừa build, để nơi gọi tự LƯU lại
 *     (config/DB) nếu cần persist qua reload — Element Style Editor bản thân KHÔNG tự lưu bất cứ
 *     đâu ngoài `eseGeneratedCss` (appState runtime), đúng vai trò "công cụ chung, không biết
 *     nghiệp vụ cụ thể". MỚI (15/08/2026) — dùng LẦN ĐẦU bởi Subtitle "Styling" (mục 4a, xem
 *     event/workflow/subtitle-style-settings.js::openStyling()): `targetEl = subtitleFrame`
 *     (style CHUNG cho khung bao mọi dòng, KHÔNG áp riêng từng dòng phụ đề) + `onApply` gọi
 *     `setSubtitleBoxCss()` (core/subtitle/subtitle-style-settings.js) rồi `saveConfig()`.
 *
 * Nội dung Box/Text HOÀN TOÀN template string tĩnh (components/element-style-editor-drawer.js,
 * KHÔNG dùng createElement) — Workflow tự querySelector + addEventListener trên genericDrawerBody/
 * Header SAU mỗi lần render (KHÔNG qua eventBus cho các control động trong Drawer), CÙNG pattern
 * event/workflow/custom-effect.js.
 *
 * NẠP SAU: core/generic-drawer.js, core/element-style-editor.js, components/
 * element-style-editor-drawer.js, service/state/element-style-editor.js, event/workflow/
 * generic-drawer-helpers.js (closeFully()), core/dom-refs.js (genericDrawerPanel/Header/Body).
 */

const workflowElementStyleEditor = {
    /** DOM đang được chỉnh trong phiên Drawer hiện tại — chỉ tồn tại trong RAM của Workflow
     * (KHÔNG phải appState, DOM node không phải dữ liệu serializable), reset mỗi lần open(). */
    _targetEl: null,
    /** Callback tuỳ chọn nơi gọi truyền vào — xem docstring đầu file. */
    _onApply: null,

    /** Mở Drawer cho 1 DOM cụ thể — mặc định bắt đầu từ draft TRẮNG (mọi property tắt).
     * MỚI (16/08/2026, mục 2 — Giang yêu cầu "cung cấp cấu hình mặc định giống hiện tại") — tham số
     * `initialCssString` (optional) — nếu nơi gọi TRUYỀN VÀO 1 chuỗi CSS đã lưu sẵn trước đó (đúng
     * định dạng buildElementStyleCssString() xuất ra, vd `subtitleBoxCss`), draft sẽ NẠP LẠI khớp
     * đúng field đó qua applyElementStyleCssStringToDraft() (core) NGAY SAU khi reset trắng — đúng
     * điểm mở rộng đã dự trù sẵn ở đây (xem lịch sử docstring này) "nơi gọi tự đọc style hiện có +
     * dựng lại draft tương ứng... truyền thẳng qua appState.set('eseDraft', ...) sau
     * resetElementStyleDraft()". Không truyền (hoặc truyền rỗng) -> hành vi CŨ giữ nguyên 100% (mở
     * trắng), guard nằm NGAY TRONG applyElementStyleCssStringToDraft() (core, guard `!cssString`). */
    open(targetEl, onApply, initialCssString) {
        this._targetEl = targetEl;
        this._onApply = onApply || null;
        resetElementStyleDraft(); // core
        if (initialCssString) applyElementStyleCssStringToDraft(initialCssString); // core — MỚI, nạp khớp style đã lưu
        setElementStyleActiveTab('box'); // core
        this._render();
    },

    _render() {
        const activeTab = appState.get('eseActiveTab');
        const draft = appState.get('eseDraft');
        const loadedFonts = appState.get('eseLoadedGoogleFonts');
        const config = {
            headerHtml: renderElementStyleEditorHeader(activeTab), // components/element-style-editor-drawer.js
            bodyHtml: renderElementStyleEditorBody(draft, activeTab, loadedFonts),
            bodyClass: 'overflow-y-auto px-4 py-3',
        };
        if (genericDrawerPanel.classList.contains('hidden')) openGenericDrawer(config); // core/generic-drawer.js
        else updateGenericDrawer(config);
        this._wire();
    },

    _wire() {
        const closeBtn = genericDrawerHeader.querySelector('#btn-generic-drawer-close');
        if (closeBtn) closeBtn.addEventListener('click', () => workflowGenericDrawerHelpers.closeFully());

        genericDrawerHeader.querySelectorAll('[data-ese-tab]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                setElementStyleActiveTab(e.currentTarget.dataset.eseTab); // core
                this._render();
            });
        });

        // Toggle bật/tắt property — LUÔN re-render toàn body (hiện/ẩn khối input con).
        genericDrawerBody.querySelectorAll('.ese-enable').forEach((el) => {
            el.addEventListener('change', (e) => {
                const t = e.currentTarget;
                setElementStyleField(t.dataset.section, t.dataset.field, { enabled: t.checked }); // core
                this._render();
            });
        });

        // Mọi input/select giá trị field — data-rerender="1" (vd mode width/height, source font)
        // mới cần vẽ lại toàn body, còn lại chỉ ghi state, giữ nguyên UI (input tự hiện giá trị
        // mới của chính nó, không cần đồng bộ tay).
        genericDrawerBody.querySelectorAll('.ese-field').forEach((el) => {
            const evt = el.tagName === 'SELECT' ? 'change' : 'input';
            el.addEventListener(evt, (e) => {
                const t = e.currentTarget;
                const { section, field, subkey, numeric, rerender } = t.dataset;
                setElementStyleField(section, field, { [subkey]: numeric ? parseFloat(t.value) : t.value }); // core
                if (rerender) this._render();
            });
        });

        // MỚI (15/08/2026, "None là dropdown") — field dropdown-thuần (fontWeight/fontStyle/
        // textAlign/textDecoration/textTransform/whiteSpace) — ghi THẲNG giá trị string, không qua
        // cơ chế merge subkey của .ese-field (bản thân field không phải object). Không field nào
        // trong nhóm này có UI con phụ thuộc giá trị -> không cần re-render.
        genericDrawerBody.querySelectorAll('.ese-simple-field').forEach((el) => {
            el.addEventListener('change', (e) => {
                const t = e.currentTarget;
                setElementStyleSimpleField(t.dataset.section, t.dataset.field, t.value); // core
            });
        });

        // Đồng bộ hiển thị 2 input cùng 1 giá trị (text hex <-> color picker) — CÙNG pattern
        // ce-solid-color-text/picker (components/custom-effect-drawer.js).
        genericDrawerBody.querySelectorAll('[data-cross-target]').forEach((el) => {
            el.addEventListener('input', (e) => {
                const target = genericDrawerBody.querySelector(`#${e.currentTarget.dataset.crossTarget}`);
                if (target) target.value = e.currentTarget.value;
            });
        });

        const loadFontBtn = genericDrawerBody.querySelector('#ese-fontfamily-load-btn');
        if (loadFontBtn) {
            loadFontBtn.addEventListener('click', () => {
                const draft = appState.get('eseDraft');
                const loaded = appState.get('eseLoadedGoogleFonts');
                loadGoogleFont(draft.text.fontFamily.value, draft.text.fontFamily.googleWeight, loaded); // core
                this._render();
            });
        }

        const applyBtn = genericDrawerBody.querySelector('#ese-apply-btn');
        if (applyBtn) applyBtn.addEventListener('click', () => this._apply());
    },

    /** Build chuỗi CSS -> lưu state -> áp inline lên targetEl (nếu có) -> báo `onApply` (nếu có,
     * để nơi gọi tự persist) -> đóng Drawer. */
    _apply() {
        const draft = appState.get('eseDraft');
        const cssString = buildElementStyleCssString(draft); // core, thuần tính toán
        setElementStyleGeneratedCss(cssString); // core
        if (this._targetEl) applyElementStyleToDom(this._targetEl, cssString); // core
        if (this._onApply) this._onApply(cssString);
        workflowGenericDrawerHelpers.closeFully();
    },
};
