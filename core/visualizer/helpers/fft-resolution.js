* core/visualizer/helpers/fft-resolution.js — group nào cần fftSizeHighRes (cross-cutting,
 * không thuộc riêng 1 group). Nạp sau core/config.js, trước visualizer-display.js.
 */
const FFT_HIGH_RES_GROUPS = ['vortex', 'lighting', 'connector'];
function needsHighResFft(group) {
    return FFT_HIGH_RES_GROUPS.includes(group);
}
