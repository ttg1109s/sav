/**
 * event/workflow/sav-logo.js — Workflow cụm "savLogo".
 *
 * MỚI (12/07/2026, audit kiến trúc `/event/` — xem readme/changelog/v12.md mục 16). Router TRƯỚC
 * ĐÂY tự đọc `appState.get('savLogoExpanded')` rồi gọi thẳng `setSavLogoExpanded()` cho case
 * 'toggle' — "chuẩn bị state cho Core" tự nó là Workflow (readme/event-bus-flow.md mục 4B), dù chỉ
 * đọc đúng 1 key rồi gọi đúng 1 hàm. `setSavLogoExpanded(expand)` nhận thẳng boolean, KHÔNG phải 2
 * hàm khác nhau để chọn — nên KHÔNG cần `VirtualMachineState` ở đây (khác `keepScreenOn.change`/
 * `toggleSelectionMode()`, nơi thật sự chọn giữa 2 hàm core khác nhau).
 *
 * Case 'set' (nhánh hover chuột thật) KHÔNG đổi — `msg.payload.expand` đã có sẵn giá trị boolean
 * cần, không cần đọc `appState` gì thêm, vẫn đúng (A) gọi thẳng Core, giữ nguyên trong router.
 *
 * NẠP SAU: event/bus.js, core/sav-logo.js (setSavLogoExpanded).
 * NẠP TRƯỚC: event/router/sav-logo.js.
 */
const workflowSavLogo = {
    /** Ứng với 'savLogo.expand.toggle' — đảo trạng thái mở/thu logo "SAV" (nhánh cảm ứng). */
    toggleExpand() {
        const expandNext = !appState.get('savLogoExpanded');
        setSavLogoExpanded(expandNext); // core/sav-logo.js
    },
};
