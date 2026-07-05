/**
 * event/listener/file-manager-cleanup.js — TẤT CẢ listener của cụm "fileManagerCleanup". NẠP SAU
 * CÙNG (sau bus, core, router, VÀ SAU dom-refs.js).
 */

if (btnFileManagerCleanupRun) {
    btnFileManagerCleanupRun.addEventListener('click', () => {
        eventBus.send({ router: 'fileManagerCleanup', type: 'fileManagerCleanup.run.click', payload: {} });
    });
}
