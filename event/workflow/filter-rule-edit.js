/**
 * event/workflow/filter-rule-edit.js — thao tác DÙNG CHUNG trên 1 bộ rule filter (`playlistFilterConfig[mediaType]`
 * shape) đang hiện trong Generic Drawer: màn Edit preset (workflowPlaylistFilterPresets) và màn "Cài đặt filter"
 * của folder (workflowFileManagerFolderBrowser). Nơi gọi giữ quyền sở hữu `config` (preset live-commit / folder
 * draft) — ở đây chỉ sửa rule + đồng bộ DOM của hàng tương ứng.
 *
 * DOM: các control mang `data-filter-field`/`data-filter-prop` (components/playlist-filter-drawer.js); sự kiện đi
 * qua 1 delegate duy nhất `handlePlaylistFilterPanelEvent()` (event/listener/playlist.js), chọn router theo
 * `data-filter-owner` của khối chứa.
 *
 * NẠP SAU: core/playlist/filter.js (_filterFieldKind/_parseFilterNumberInput/_formatFilterNumberForInput/
 * _formatSecondsAsHms), core/time-picker-modal.js, core/dom-refs.js (genericDrawerBody).
 */

// Hiển thị giá trị rule: 'seconds' là <button> time-picker (text), còn lại là <input> (value).
const FILTER_RULE_DISPLAY_BY_KIND = { // core/playlist/filter.js
    seconds: (el, kind, value) => { el.textContent = _formatSecondsAsHms(value); },
    text: (el, kind, value) => { el.value = value || ''; },
    numeric: (el, kind, value) => { el.value = _formatFilterNumberForInput(kind, value); },
};
const FILTER_RULE_PARSE_BY_IS_TEXT = { // core/playlist/filter.js
    true: (kind, raw) => raw,
    false: (kind, raw) => _parseFilterNumberInput(kind, raw),
};
const FILTER_RULE_NEW_BY_IS_TEXT = {
    true: () => ({ op: '===', value: '' }),
    false: () => ({ mode: 'single', op: '===', value: 0, valueTo: 0 }),
};
const FILTER_RULE_BY_ENABLED = {
    true: (kind) => FILTER_RULE_NEW_BY_IS_TEXT[kind === 'text'](),
    false: () => null,
};
const FILTER_RULE_PROP_SETTER = {
    op: (rule, field, kind, raw) => { rule.op = raw; },
    mode: (rule, field, kind, raw) => { rule.mode = raw; workflowFilterRuleEdit._setRowModeUi(workflowFilterRuleEdit._rowEl(field), raw); },
    value: (rule, field, kind, raw) => { rule.value = FILTER_RULE_PARSE_BY_IS_TEXT[kind === 'text'](kind, raw); },
    valueTo: (rule, field, kind, raw) => { rule.valueTo = _parseFilterNumberInput(kind, raw); }, // core/playlist/filter.js
};
const FILTER_RULE_EDIT_BY_IS_ENABLED_PROP = {
    true: (config, field, prop, kind, raw) => workflowFilterRuleEdit._setFieldEnabled(config, field, kind, raw),
    false: (config, field, prop, kind, raw) => workflowFilterRuleEdit._setFieldProp(config, field, prop, kind, raw),
};
// Đồng bộ 1 hàng: có khối single/range (field số) hoặc chỉ 1 ô value (field text).
const FILTER_RULE_ROW_SYNC_BY_HAS_MODE_BLOCKS = {
    false: (rowEl, kind, rule) => {
        workflowFilterRuleEdit._setDisplayUi(rowEl.querySelector('[data-filter-prop="value"]'), kind, rule.value);
    },
    true: (rowEl, kind, rule, rangeBlock, singleBlock) => {
        const wf = workflowFilterRuleEdit;
        wf._setDisplayUi(singleBlock && singleBlock.querySelector('[data-filter-prop="value"]'), kind, rule.value);
        wf._setDisplayUi(rangeBlock && rangeBlock.querySelector('[data-filter-prop="value"]'), kind, rule.value);
        wf._setDisplayUi(rangeBlock && rangeBlock.querySelector('[data-filter-prop="valueTo"]'), kind, rule.valueTo);
        wf._setRowModeUi(rowEl, rule.mode);
    },
};

const workflowFilterRuleEdit = {

    /** Đổ toàn bộ `config` lên DOM vừa dựng (component render rỗng, không tự bind giá trị). */
    syncUi(config) {
        for (const field of Object.keys(config)) {
            const rule = config[field];
            const rowEl = this._rowEl(field);
            if (!rowEl) continue;
            const enableEl = rowEl.querySelector('[data-filter-prop="enabled"]');
            if (enableEl) enableEl.checked = !!rule;
            this._setRowBodyEnabledUi(rowEl, !!rule);
            if (!rule) continue;
            const opEl = rowEl.querySelector('[data-filter-prop="op"]');
            if (opEl && rule.op !== undefined) opEl.value = rule.op;
            const modeEl = rowEl.querySelector('[data-filter-prop="mode"]');
            if (modeEl && rule.mode !== undefined) modeEl.value = rule.mode;
            const rangeBlock = rowEl.querySelector('[data-filter-range-block]');
            const singleBlock = rowEl.querySelector('[data-filter-single-block]');
            FILTER_RULE_ROW_SYNC_BY_HAS_MODE_BLOCKS[!!(rangeBlock || singleBlock)](rowEl, _filterFieldKind(field), rule, rangeBlock, singleBlock); // core/playlist/filter.js
        }
    },

    /**
     * Sửa 1 prop của 1 field TẠI CHỖ trong `config` + cập nhật DOM hàng đó. `rawValue`: boolean với 'enabled',
     * chuỗi từ input với op/mode/value/valueTo.
     * @returns {boolean} false = không đổi gì (field không thuộc config, field đang tắt, prop lạ) — nơi gọi bỏ qua lưu.
     */
    applyFieldChange(config, field, prop, rawValue) {
        if (!(field in config)) return false;
        return FILTER_RULE_EDIT_BY_IS_ENABLED_PROP[prop === 'enabled'](config, field, prop, _filterFieldKind(field), rawValue); // core/playlist/filter.js
    },

    /** Nút time-picker (totalTime/duration): chọn xong cập nhật chữ trên nút rồi gọi `onPick(seconds)` (nơi gọi tự ghi). */
    openTimePicker(config, field, prop, onPick) {
        const rule = config[field];
        if (!rule) return; // guard: field đang tắt (nút bị pointer-events-none)
        openTimePickerModal({ // core/time-picker-modal.js
            title: t(`playlistFilterPanel.field.${field}`),
            format: 'h-m-s',
            valueMs: (rule[prop] || 0) * 1000,
            minMs: 0,
            maxMs: 359999000, // 99:59:59
            onConfirm: (resultMs) => {
                const seconds = Math.round(resultMs / 1000);
                this._setDisplayUi(genericDrawerBody.querySelector(`[data-filter-field="${field}"][data-filter-prop="${prop}"][data-filter-time-trigger]`), 'seconds', seconds);
                onPick(seconds);
            },
        });
    },

    _setFieldEnabled(config, field, kind, enabled) {
        config[field] = FILTER_RULE_BY_ENABLED[enabled](kind);
        this._setRowBodyEnabledUi(this._rowEl(field), enabled);
        return true;
    },

    _setFieldProp(config, field, prop, kind, rawValue) {
        const rule = config[field];
        if (!rule) return false; // guard: field đang tắt — bỏ qua input ẩn
        const setter = FILTER_RULE_PROP_SETTER[prop];
        if (!setter) return false;
        setter(rule, field, kind, rawValue);
        return true;
    },

    _rowEl(field) {
        return genericDrawerBody.querySelector(`[data-filter-row="${field}"]`);
    },

    _setDisplayUi(el, kind, value) {
        if (!el) return;
        (FILTER_RULE_DISPLAY_BY_KIND[kind] || FILTER_RULE_DISPLAY_BY_KIND.numeric)(el, kind, value);
    },

    /** Mờ + khoá thân hàng khi field tắt (checkbox bật/tắt nằm ngoài `data-filter-body` nên không bị khoá theo). */
    _setRowBodyEnabledUi(rowEl, enabled) {
        const bodyBlockEl = rowEl && rowEl.querySelector('[data-filter-body]');
        if (!bodyBlockEl) return;
        bodyBlockEl.classList.toggle('opacity-40', !enabled);
        bodyBlockEl.classList.toggle('pointer-events-none', !enabled);
    },

    /** Hiện khối single hoặc range theo mode. */
    _setRowModeUi(rowEl, mode) {
        if (!rowEl || mode === undefined) return;
        const rangeBlock = rowEl.querySelector('[data-filter-range-block]');
        const singleBlock = rowEl.querySelector('[data-filter-single-block]');
        if (!rangeBlock || !singleBlock) return;
        rangeBlock.classList.toggle('hidden', mode === 'single');
        singleBlock.classList.toggle('hidden', mode !== 'single');
    },
};
