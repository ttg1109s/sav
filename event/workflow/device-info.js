/**
 * event/workflow/device-info.js — nhận diện thiết bị 1 lần lúc boot (gọi từ event/workflow/app-boot.js, không await):
 * lưu `deviceInfo` (service/state/app-misc.js) cho nơi khác dùng ngầm (vd panel Storage nhận Safari < 17), ghi đúng 1 dòng
 * log (Debug console). Không có UI.
 *
 * NẠP SAU: core/device-detect.js. NẠP TRƯỚC: event/workflow/app-boot.js.
 */
const workflowDeviceInfo = {
    async detectOnBoot() {
        let result;
        try {
            result = await detectDeviceWithUaParser(navigator.userAgent); // core/device-detect.js
        } catch (err) {
            console.warn('[device-info] ua-parser-js lỗi — bỏ qua nhận diện thiết bị:', err);
            return;
        }
        if (!result) { console.warn('[device-info] ua-parser-js chưa nạp (CDN lỗi/offline) — bỏ qua nhận diện thiết bị'); return; }
        const info = summarizeDeviceInfo(result); // core/device-detect.js
        appState.set('deviceInfo', info);
        console.log(`writer: "workflowDeviceInfo.detectOnBoot", page: "deviceInfo", content: "${formatDeviceInfoLog(info)}"`);
    },
};
