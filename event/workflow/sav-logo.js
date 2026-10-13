/**
 * event/workflow/sav-logo.js — Workflow cụm "savLogo": case 'toggle' cần đọc `savLogoExpanded` để chuẩn bị input cho core.
 * Case 'set' (payload đã có `expand`) router gọi thẳng core.
 *
 * NẠP SAU: event/bus.js, core/sav-logo.js. NẠP TRƯỚC: event/router/sav-logo.js.
 */
const workflowSavLogo = {
    /** 'savLogo.expand.toggle' — đảo trạng thái mở/thu logo (nhánh cảm ứng). */
    toggleExpand() {
        const expandNext = !appState.get('savLogoExpanded');
        setSavLogoExpanded(expandNext); // core/sav-logo.js
    },
};
