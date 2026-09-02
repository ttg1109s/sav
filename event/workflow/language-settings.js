/**
 * event/workflow/language-settings.js — "THẰNG THỰC THI CUỐI" của router "languageSettings".
 *
 * QUY TẮC: workflow KHÔNG tự nghĩ logic mới — chỉ gọi hàm core có sẵn (lang/language-settings.js)
 * + đặt modalChoice()/alertModal() ở tầng này (core không biết 2 thứ này tồn tại).
 */
const workflowLanguageSettings = {

    /** Ứng với msg.type = 'languageSettings.upload.change' — gọi "tay" readAndSaveLanguageFile
     *  (core, trả {status, ...}), rồi XỬ LÝ TIẾP theo status -> đủ phối hợp để là workflow.
     * @param {{file: File}} payload
     */
    async handleUpload(payload) {
        const { file } = payload;
        const result = await readAndSaveLanguageFile(file);
        if (result.status === 'parseError') {
            const message = result.message ? escapeHtml(result.message) : t('common.unknownError');
            await alertModal(tFormat('settingsLanguage.upload.parseError', { message }));
        } else if (result.status === 'invalidFile') {
            await alertModal(t('settingsLanguage.upload.invalidFile'));
        } else {
            await alertModal(tFormat('settingsLanguage.upload.success', { name: escapeHtml(result.name) }));
        }
    },

    /** Ứng với msg.type = 'languageSettings.delete.click' khi đang chọn 'en' — chặn, chỉ báo. */
    async rejectDeleteEnglish() {
        await alertModal(t('settingsLanguage.cannotDeleteEnglish'));
    },

    /** Ứng với msg.type = 'languageSettings.delete.click' — hỏi xác nhận trước khi xóa.
     * @param {{code: string, name: string, onConfirmSend: () => void}} payload
     */
    askDeleteLanguage(payload) {
        const { name, onConfirmSend } = payload;
        modalChoice(
            tFormat('settingsLanguage.delete.confirm', { name }),
            [
                { label: t('settingsLanguage.delete.label'), className: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold transition-colors', onClick: onConfirmSend }
            ],
            { title: t('settingsLanguage.delete.label') }
        );
    },

    /** Ứng với msg.type = 'languageSettings.delete.confirm'.
     * @param {{code: string}} payload
     */
    async executeDeleteLanguage(payload) {
        await deleteLanguageByCode(payload.code); // gọi "tay" core — workflow chỉ chuyển tiếp
    }
};
