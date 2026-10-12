/**
 * event/router/element-style-editor.js — Router cụm "elementStyleEditor" — nội dung Generic Drawer "Element Style
 * Editor", nhận thư từ event/listener/element-style-editor.js, giao hết cho `workflowElementStyleEditor` (mọi thao tác
 * đọc/ghi draft `eseDraft` + vẽ lại Drawer — (B) Workflow, readme/event-bus-flow.md mục 4). Cửa mở công cụ —
 * `workflowElementStyleEditor.open()` — do Workflow domain khác gọi thẳng.
 *
 * NẠP SAU: event/bus.js, event/workflow/element-style-editor.js. NẠP TRƯỚC: event/listener/element-style-editor.js.
 */
const routerElementStyleEditor = (() => {
    function handle(msg) {
        const p = msg.payload;
        switch (msg.type) {
            case 'elementStyleEditor.close.click':
                workflowElementStyleEditor._close();
                break;
            case 'elementStyleEditor.tab.click':
                workflowElementStyleEditor.selectTab(p.tab);
                break;
            case 'elementStyleEditor.enable.change':
                workflowElementStyleEditor.setFieldEnabled(p.section, p.field, p.checked);
                break;
            case 'elementStyleEditor.field.input':
                workflowElementStyleEditor.setFieldValue(p);
                break;
            case 'elementStyleEditor.simpleField.change':
                workflowElementStyleEditor.setSimpleField(p.section, p.field, p.value);
                break;
            case 'elementStyleEditor.loadFont.click':
                workflowElementStyleEditor.loadSelectedGoogleFont();
                break;
            case 'elementStyleEditor.apply.click':
                workflowElementStyleEditor._apply();
                break;
            case 'elementStyleEditor.fontPicker.open.click':
                workflowElementStyleEditor.openFontPicker();
                break;
            case 'elementStyleEditor.fontPicker.back.click':
                workflowElementStyleEditor.closeFontPicker();
                break;
            case 'elementStyleEditor.fontPicker.search.input':
                workflowElementStyleEditor.filterFontPicker(p.query);
                break;
            case 'elementStyleEditor.fontPicker.option.click':
                workflowElementStyleEditor.selectFont(p.fontName);
                break;
            default:
                console.warn(`[routerElementStyleEditor] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('elementStyleEditor', routerElementStyleEditor);
