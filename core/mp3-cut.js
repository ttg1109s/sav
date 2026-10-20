/**
 * core/mp3-cut.js — Core cắt 1 đoạn audio thành file .mp3 cho tool "Cut MP3" (Subtitle Editor). Điều phối:
 * event/workflow/subtitle-editor.js::cutMp3FromRegion().
 *
 * 2 đường, Workflow chọn theo kết quả `indexMp3Frames()`:
 *   - Nguồn là MP3 -> cắt THEO FRAME (`buildMp3FrameCut()`): chép nguyên các frame gốc, không giải mã/mã hoá lại -> âm thanh
 *     giống hệt bản gốc (đủ kênh, đúng sample rate, đúng bitrate). Điểm cắt làm tròn ra biên frame (~26 ms).
 *   - Nguồn khác (m4a, flac, wav...) -> giải mã ở sample rate gốc (Workflow) -> `sliceAudioBufferToPcm16()` ->
 *     `encodeMp3FromPcm16()` (lamejs, 192 kbps).
 * Lỗi cũ (20/10/2026): bản trước mã hoá từ `getDecodedData()` của WaveSurfer — v7 giải mã ở 8000 Hz mặc định nên file cắt
 * bị đục/méo, khác bản gốc.
 *
 * Rule 3d — `encodeMp3FromPcm16()` là wrapper lamejs (CDN, pages/subtitle-editor.html), cô lập để sau này đổi bộ mã hoá
 * (WebCodecs/Mediabunny) mà Workflow giữ nguyên lời gọi.
 *
 * NẠP SAU: không phụ thuộc gì (lamejs chỉ cần lúc chạy).
 */

const MP3_BITRATE_KBPS_V1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const MP3_BITRATE_KBPS_V2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
// Khoá = 2 bit version của header: 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5 (1 = reserved).
const MP3_SAMPLE_RATES_BY_VERSION = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };
const MP3_SYNC_SCAN_LIMIT_BYTES = 65536; // dò frame đầu trong 64 KB sau ID3v2
const MP3_MIN_CHAINED_FRAMES = 3; // ≥3 frame nối liền mới coi là MP3 thật (tránh khớp nhầm 0xFFE trong dữ liệu rác)
const MP3_REENCODE_KBPS = 192;
const MP3_REENCODE_BLOCK = 1152;

/**
 * Lập bảng frame MPEG Layer III của file. Bỏ ID3v2 đầu file và frame thông tin Xing/Info/VBRI (frame im lặng chỉ chứa
 * metadata — giữ lại sẽ khai sai độ dài của đoạn cắt). Dừng ở header hỏng đầu tiên sau chuỗi frame (ID3v1/APE cuối file).
 * @param {Uint8Array} bytes
 * @returns {null|{offsets:number[], sizes:number[], bitrateIndexes:number[], sampleRate:number, samplesPerFrame:number,
 *   delaySamples:number}}
 *   null = không phải MP3 (Layer III).
 */
function indexMp3Frames(bytes) {
    const len = bytes.length;
    let start = 0;
    if (len >= 10 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) { // "ID3"
        const tagSize = ((bytes[6] & 0x7f) << 21) | ((bytes[7] & 0x7f) << 14) | ((bytes[8] & 0x7f) << 7) | (bytes[9] & 0x7f);
        start = 10 + tagSize + ((bytes[5] & 0x10) ? 10 : 0);
    }
    const scanLimit = Math.min(len, start + MP3_SYNC_SCAN_LIMIT_BYTES);
    const offsets = [], sizes = [], bitrateIndexes = [];
    let candidate = start, pos = start, ref = null;

    // 1 vòng: đi theo chuỗi frame từ `candidate`; gãy trước khi đủ MP3_MIN_CHAINED_FRAMES -> dời candidate 1 byte, đi lại.
    while (pos + 4 <= len) {
        const b1 = bytes[pos + 1], b2 = bytes[pos + 2];
        const version = (b1 >> 3) & 3;
        const brIdx = b2 >> 4, srIdx = (b2 >> 2) & 3;
        const valid = bytes[pos] === 0xff && (b1 & 0xe0) === 0xe0 && version !== 1 && ((b1 >> 1) & 3) === 1
            && brIdx > 0 && brIdx < 15 && srIdx < 3
            && (!ref || (ref.version === version && ref.srIdx === srIdx));
        const sampleRate = valid ? MP3_SAMPLE_RATES_BY_VERSION[version][srIdx] : 0;
        const kbps = valid ? (version === 3 ? MP3_BITRATE_KBPS_V1 : MP3_BITRATE_KBPS_V2)[brIdx] : 0;
        const size = valid ? Math.floor(((version === 3 ? 144000 : 72000) * kbps) / sampleRate) + ((b2 >> 1) & 1) : 0;
        if (valid && pos + size <= len) {
            if (!ref) ref = { version, srIdx, sampleRate, samplesPerFrame: version === 3 ? 1152 : 576 };
            offsets.push(pos); sizes.push(size); bitrateIndexes.push(brIdx);
            pos += size;
            continue;
        }
        if (offsets.length >= MP3_MIN_CHAINED_FRAMES) break; // hết chuỗi frame (cuối file / tag cuối)
        candidate += 1;
        if (candidate >= scanLimit) return null;
        pos = candidate; ref = null;
        offsets.length = 0; sizes.length = 0; bitrateIndexes.length = 0;
    }
    if (offsets.length < MP3_MIN_CHAINED_FRAMES) return null;

    // Frame đầu là frame thông tin? "Xing"/"Info" nằm sau side info (17/32 byte MPEG1, 9/17 byte MPEG2/2.5 — mono/stereo),
    // "VBRI" luôn ở byte 36. CRC (protection bit = 0) đẩy side info lùi 2 byte.
    const first = offsets[0];
    const isMono = ((bytes[first + 3] >> 6) & 3) === 3;
    const sideInfo = ref.version === 3 ? (isMono ? 17 : 32) : (isMono ? 9 : 17);
    const tagAt = first + 4 + ((bytes[first + 1] & 1) ? 0 : 2) + sideInfo;
    const tag = String.fromCharCode(bytes[tagAt], bytes[tagAt + 1], bytes[tagAt + 2], bytes[tagAt + 3]);
    const vbri = String.fromCharCode(bytes[first + 36], bytes[first + 37], bytes[first + 38], bytes[first + 39]);
    const isInfoFrame = tag === 'Xing' || tag === 'Info' || vbri === 'VBRI';
    // Tag gapless LAME/Lavc/Lavf (sau các trường Xing có mặt theo flags): trình duyệt bỏ (encoder delay + 529) mẫu đầu, nên
    // giây 0 của waveform = mẫu thứ `delaySamples` của chuỗi frame. Không có tag -> 0.
    const flags = (tag === 'Xing' || tag === 'Info') ? bytes[tagAt + 7] : 0;
    const lameAt = tagAt + 8 + ((flags & 1) ? 4 : 0) + ((flags & 2) ? 4 : 0) + ((flags & 4) ? 100 : 0) + ((flags & 8) ? 4 : 0);
    const encoder = lameAt + 24 <= len ? String.fromCharCode(bytes[lameAt], bytes[lameAt + 1], bytes[lameAt + 2], bytes[lameAt + 3]) : '';
    const hasGapless = flags > 0 && (encoder === 'LAME' || encoder === 'Lavc' || encoder === 'Lavf');
    const delaySamples = hasGapless ? ((bytes[lameAt + 21] << 4) | (bytes[lameAt + 22] >> 4)) + 529 : 0;
    if (isInfoFrame) {
        offsets.shift(); sizes.shift(); bitrateIndexes.shift();
    }
    return { offsets, sizes, bitrateIndexes, sampleRate: ref.sampleRate, samplesPerFrame: ref.samplesPerFrame, delaySamples };
}

/**
 * Ghép các frame phủ đoạn [startSec, endSec] thành 1 file MP3 mới, đầu file là frame "Info" (CBR) / "Xing" (VBR) mới khai
 * đúng số frame + số byte — trình phát đọc đúng độ dài, tua chính xác cả với file VBR. Không chép ID3.
 * @param {Uint8Array} bytes @param {ReturnType<typeof indexMp3Frames>} index @param {number} startSec @param {number} endSec
 * @returns {{bytes: Uint8Array, durationSec: number}}
 */
function buildMp3FrameCut(bytes, index, startSec, endSec) {
    const secPerFrame = index.samplesPerFrame / index.sampleRate;
    const delaySec = index.delaySamples / index.sampleRate;
    const total = index.offsets.length;
    const from = Math.max(0, Math.floor((startSec + delaySec) / secPerFrame));
    const to = Math.min(total, Math.ceil((endSec + delaySec) / secPerFrame));
    if (to <= from) throw new Error('Vùng chọn nằm ngoài dữ liệu MP3 của bài.');

    let audioBytes = 0;
    for (let k = from; k < to; k++) audioBytes += index.sizes[k];
    const isVbr = index.bitrateIndexes.slice(from, to).some((br) => br !== index.bitrateIndexes[from]);

    // Frame thông tin: header frame đầu đoạn, bỏ CRC + padding; tăng bitrate tới khi frame đủ chỗ cho side info rỗng + 16
    // byte (tag, flags, số frame, số byte). Side info toàn 0 -> bộ giải mã đọc ra 1 frame im lặng.
    const h = index.offsets[from];
    const version = (bytes[h + 1] >> 3) & 3;
    const isMono = ((bytes[h + 3] >> 6) & 3) === 3;
    const sideInfo = version === 3 ? (isMono ? 17 : 32) : (isMono ? 9 : 17);
    const table = version === 3 ? MP3_BITRATE_KBPS_V1 : MP3_BITRATE_KBPS_V2;
    const need = 4 + sideInfo + 16;
    let brIdx = bytes[h + 2] >> 4;
    let infoSize = 0;
    for (; brIdx < 15; brIdx++) {
        infoSize = Math.floor(((version === 3 ? 144000 : 72000) * table[brIdx]) / index.sampleRate);
        if (infoSize >= need) break;
    }

    const out = new Uint8Array(infoSize + audioBytes);
    out[0] = 0xff;
    out[1] = bytes[h + 1] | 0x01;
    out[2] = (brIdx << 4) | (bytes[h + 2] & 0x0c) | (bytes[h + 2] & 0x01);
    out[3] = bytes[h + 3];
    const view = new DataView(out.buffer);
    const tag = isVbr ? 'Xing' : 'Info';
    for (let i = 0; i < 4; i++) out[4 + sideInfo + i] = tag.charCodeAt(i);
    view.setUint32(4 + sideInfo + 4, 0x03); // flags: có số frame + số byte
    view.setUint32(4 + sideInfo + 8, to - from);
    view.setUint32(4 + sideInfo + 12, out.length);

    let write = infoSize;
    for (let k = from; k < to; k++) {
        out.set(bytes.subarray(index.offsets[k], index.offsets[k] + index.sizes[k]), write);
        write += index.sizes[k];
    }
    return { bytes: out, durationSec: (to - from) * secPerFrame };
}

/**
 * Cắt [startSec, endSec] của AudioBuffer (giải mã ở sample rate gốc) thành PCM 16-bit — tối đa 2 kênh (lamejs chỉ nhận
 * mono/stereo), kẹp -1..1 trước khi đổi.
 * @param {AudioBuffer} audioBuffer @param {number} startSec @param {number} endSec
 * @returns {{channels: Int16Array[], sampleRate: number, durationSec: number}}
 */
function sliceAudioBufferToPcm16(audioBuffer, startSec, endSec) {
    const sampleRate = audioBuffer.sampleRate;
    const startSample = Math.max(0, Math.floor(startSec * sampleRate));
    const endSample = Math.min(audioBuffer.length, Math.ceil(endSec * sampleRate));
    const length = endSample - startSample;
    if (length <= 0) throw new Error('Vùng chọn rỗng, không có gì để cắt.');
    const channelCount = Math.min(2, Math.max(1, audioBuffer.numberOfChannels));
    const channels = [];
    for (let c = 0; c < channelCount; c++) {
        const src = audioBuffer.getChannelData(c).subarray(startSample, endSample);
        const pcm = new Int16Array(length);
        for (let i = 0; i < length; i++) {
            const s = Math.max(-1, Math.min(1, src[i]));
            pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        channels.push(pcm);
    }
    return { channels, sampleRate, durationSec: length / sampleRate };
}

/**
 * Mã hoá PCM 16-bit -> các khúc MP3 (lamejs, MP3_REENCODE_KBPS). Mono truyền 1 kênh, stereo truyền cặp trái/phải cùng
 * khối 1152 mẫu (1 frame MPEG1).
 * @param {{channels: Int16Array[], sampleRate: number}} pcm @returns {Int8Array[]}
 */
function encodeMp3FromPcm16(pcm) {
    const encoder = new lamejs.Mp3Encoder(pcm.channels.length, pcm.sampleRate, MP3_REENCODE_KBPS);
    const left = pcm.channels[0];
    const right = pcm.channels[1] || pcm.channels[0];
    const chunks = [];
    for (let i = 0; i < left.length; i += MP3_REENCODE_BLOCK) {
        const chunk = encoder.encodeBuffer(left.subarray(i, i + MP3_REENCODE_BLOCK), right.subarray(i, i + MP3_REENCODE_BLOCK));
        if (chunk.length > 0) chunks.push(chunk);
    }
    const tail = encoder.flush();
    if (tail.length > 0) chunks.push(tail);
    return chunks;
}

/** Tên file của đoạn cắt: "<tên bài> [cut <đầu> - <cuối>].mp3", thay `:`/`,` (không hợp lệ trên 1 số hệ file) bằng `-`.
 * @param {string} baseTitle @param {string} startStr - secToStr() @param {string} endStr @returns {string} */
function buildCutMp3FileName(baseTitle, startStr, endStr) {
    return `${baseTitle} [cut ${startStr} - ${endStr}].mp3`.replace(/[:,]/g, '-');
}
