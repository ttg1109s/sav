/**
 * core/file-manager/folder.js — Folder nhạc (File Manager → Song → Folder), ver 12 "Multi Media".
 * Toàn bộ function MỚI ở file này viết từ đầu theo plan-v12-multimedia.md mục 4.b1 — tuân 4 rule
 * ở core-function-conventions.md.
 *
 * GHI CHÚ THIẾT KẾ (đọc trước khi sửa file này): các hàm CRUD thô định nghĩa ở service/db.js
 * (getFolderRecord/setFolderRecord/deleteFolderRecord/getAllFolderKeys,
 * getFolderSongMap/setFolderSongMap/deleteFolderSongMap) được coi là TẦNG DỮ LIỆU thuần (tương
 * đương idbKeyval.get/set/del dùng trực tiếp khắp project) — KHÔNG tính là "core khác" theo Rule 3
 * (core-function-conventions.md). Rule 3 nhắm tới việc 1 hàm core MỚI gọi 1 hàm core NGHIỆP VỤ
 * khác (có thể là workflow-shaped) mà không dùng kết quả — không nhắm tới việc gọi thẳng hàm CRUD
 * đọc/ghi 1 record IndexedDB. Nhờ vậy, các hàm dưới đây được phép tự đọc/ghi nhiều record trong
 * CÙNG 1 hàm nếu đó là ĐÚNG 1 tiến trình nghiệp vụ duy nhất (Rule 1) — ví dụ deleteFolder() đọc +
 * ghi nhiều record `songs` để dọn field `folder[folderId]` TRƯỚC khi xoá `folder_song`/`folders`,
 * vẫn là 1 tiến trình "xoá 1 folder", không phải nhiều tiến trình khác nhau.
 *
 * Schema (CHỐT — xem plan-v12-multimedia.md mục 4.b1):
 *   folders     : { [folderId]: { id, name, type, excludeFromMainPlaylist } }
 *   folder_song : { [folderId]: { list: [songKey|null, ...], empty: number } } — tombstone null
 *                 khi gỡ bài khỏi folder, KHÔNG splice (giữ nguyên index/position).
 *
 * MỚI (ver12 "Song/Video Unification", Batch 4, xem plan-v12-song-video-unification.md mục 5) —
 * 2 field MỚI trên record `folders`:
 *   - `type: 'song'|'video'|null` — folder mới/rỗng là `null` (chưa xác định); item ĐẦU TIÊN thêm
 *     vào (qua addSongsToFolder()) khoá loại folder lại, từ đó chặn thêm loại KHÁC (xem
 *     addSongsToFolder() bên dưới). Folder TẠO TRƯỚC batch này không có field này (undefined) —
 *     nơi ĐỌC field này (addSongsToFolder(), event/workflow/file-manager-song.js hiển thị icon)
 *     PHẢI tự suy luận ngầm `type ?? (có bài thật trong folder_song.list ? 'song' : null)` — KHÔNG
 *     cần migration/backfill DB riêng, không ghi lại record cũ chỉ vì đọc.
 *   - `excludeFromMainPlaylist: boolean` (default false, field vắng mặt = false) — Scope vs
 *     Exclude (mục 5): CHỈ ảnh hưởng view "Tất cả" (core/playlist/scope.js::loadAllSongs()), không
 *     đụng gì view Scope theo 1 folder cụ thể (loadSongsFromFolder() không đọc field này).
 *   songs (field mới trên record có sẵn) : record.folder = { [folderId]: position (number) } —
 *                 sự TỒN TẠI của key folderId đã đủ biết "từng thêm vào folder này chưa"; trạng
 *                 thái đang-ở-trong hay đã-gỡ đọc thẳng từ folder_song[folderId].list[position].
 *   meta.deletedFolderIds : string[] — MỚI (03/07/2026, đợt 5). Danh sách folderId ĐÃ TỪNG bị xoá,
 *                 dùng để KHÔNG BAO GIỜ cấp lại (xem resolveFolderId()) — chặn bug tham chiếu cũ
 *                 (record.folder[folderId] còn sót trên bài đã tombstone-rồi-folder-bị-xoá) đọc
 *                 nhầm sang 1 folder MỚI trùng id.
 *
 * NẠP SAU: service/db.js (cần mọi hàm CRUD kể trên + slugify() dùng chung cho resolveFolderId),
 * event/virtual-machine-state.js (addSongsToFolder() dùng VirtualMachineState.run() để chọn đúng
 * hàm theo trạng thái thành viên — chỉ tham chiếu BÊN TRONG thân hàm, không chạy lúc parse, nên
 * an toàn dù event/virtual-machine-state.js nạp SAU file này trong index.html thật, giống cách
 * nhiều file core khác tham chiếu hàm định nghĩa muộn hơn).
 */

/**
 * Sinh folderId DUY NHẤT từ tên folder, tái dùng slugify() đã có ở db.js (cùng thuật toán với
 * resolveSongKey — KHÔNG trùng logic, chỉ đổi store kiểm tra tồn tại).
 *
 * SỬA 03/07/2026 (đợt 5) — THÊM điều kiện thứ 2: id ứng viên KHÔNG được nằm trong
 * `meta.deletedFolderIds` (danh sách id đã TỪNG bị xoá, dù hiện không còn record `folders` nào).
 * LÝ DO: `deleteFolder()` chỉ dọn được `record.folder[folderId]` cho bài ĐANG active trong folder
 * lúc xoá (không thể biết bài nào đã bị TOMBSTONE trước đó — folder_song.list đã null hoá, mất
 * dấu vết songKey). Nếu 1 folderId bị tái sử dụng (folder mới trùng tên -> trùng slug), bài từng
 * bị tombstone-rồi-folder-bị-xoá vẫn còn `record.folder[folderId] = vị trí cũ` sống sót trên chính
 * record của nó — đọc nhầm sang `folder_song` MỚI (rỗng) sẽ bị hiểu sai thành 'active' (vì
 * `list[vị trí cũ]` ở mảng rỗng là `undefined`, không phải `null`) -> addSongsToFolder() coi như
 * "đã có sẵn", bỏ qua, không thêm thật — đúng bug bác vừa phát hiện (TH1: báo thành công nhưng
 * folder vẫn rỗng). Cách sửa AN TOÀN NHẤT (không đổi schema `folders`/`folder_song` hiện có, không
 * cần quét toàn bộ thư viện bài — vẫn giữ deleteFolder() ở đúng O(số bài ĐANG có trong folder)):
 * KHÔNG BAO GIỜ cấp lại 1 id đã từng tồn tại, kể cả sau khi xoá — folder tạo lại cùng tên sẽ nhận
 * id khác (`...-2`, `...-3`...), y hệt cơ chế suffix có sẵn khi trùng tên với folder ĐANG SỐNG.
 * @param {string} name
 * @returns {Promise<string>}
 */
async function resolveFolderId(name) {
    const baseSlug = slugify(name) || 'folder'; // CÓ return, DÙNG ngay dưới -> hợp lệ Rule 3
    console.log(`[resolveFolderId] callTo: "slugify", request: "chuẩn hoá tên '${name}' thành slug làm base cho id"`);
    const deletedIds = (await getMeta('deletedFolderIds')) || []; // data layer (service/db.js)
    let candidate = baseSlug;
    let suffix = 2;
    while (true) {
        const existing = await getFolderRecord(candidate);
        if (!existing && !deletedIds.includes(candidate)) return candidate;
        candidate = `${baseSlug}-${suffix}`; suffix++;
    }
}

/**
 * Tạo 1 folder mới rỗng — nhận `folderId` ĐÃ ĐƯỢC XÁC ĐỊNH SẴN qua tham số (nơi gọi tự
 * `resolveFolderId(name)` TRƯỚC, rồi gọi hàm này — 2 core TÁCH RỜI, Workflow tự gọi CẢ HAI theo
 * đúng thứ tự, xem "SỬA 14/07/2026" bên dưới). 1 tiến trình duy nhất: kiểm tra trùng TÊN (không
 * phải id — id lúc này CHẮC CHẮN không trùng, đã tự `resolveFolderId()` đảm bảo) -> ghi metadata ->
 * ghi mapping rỗng — nhánh "trùng tên -> dừng sớm" là guard clause (Rule 1 cho phép), KHÔNG phải
 * rẽ nhánh 2 tiến trình khác nhau.
 *
 * SỬA 03/07/2026 (đợt 6, điểm 4) — TRƯỚC ĐÂY không hề kiểm tra trùng TÊN, chỉ tránh trùng ID kỹ
 * thuật (2 folder có thể cùng hiển thị "Yêu thích" nhưng khác id ngầm — bị coi là 2 "không gian"
 * riêng biệt, gây nhầm lẫn thật). Giờ CHẶN HẲN — so khớp CASE-SENSITIVE (phân biệt hoa/thường):
 * "abc" / "ABC" / "Abc" được coi là 3 tên KHÁC NHAU, được phép cùng tồn tại; CHỈ chặn khi trùng
 * tuyệt đối từng ký tự.
 *
 * [TỰ SỬA 14/07/2026, tự audit lại Rule 3 — Giang yêu cầu "đụng hàm di sản phải refactor luôn theo
 * rule"] — trước đây hàm này TỰ gọi `listFolders()` (kiểm tra trùng tên) VÀ `resolveFolderId()`
 * (sinh id) — CẢ 2 đều là core KHÁC trong CÙNG file, biện minh "có return value nên hợp lệ" — SAI
 * theo Rule 3 hiện hành. `listFolders()` đã inline TRỰC TIẾP (2 dòng, không đáng tách riêng).
 * `resolveFolderId()` KHÁC — có vòng lặp + logic riêng đáng kể (đọc `deletedFolderIds`, tự sinh
 * suffix), tự nó là 1 NGHIỆP VỤ HOÀN CHỈNH ("cấp 1 id an toàn cho tên này") — KHÔNG hợp lệ làm hàm
 * con (không qua được phép thử Rule 3c: gọi độc lập vẫn ra 1 giá trị có Ý NGHĨA NGHIỆP VỤ RIÊNG,
 * không phải giá trị trung gian vô nghĩa). Đổi hẳn CHỮ KÝ hàm — nhận `folderId` qua tham số thay vì
 * tự tính — nơi gọi (Workflow) giờ PHẢI tự gọi `resolveFolderId(name)` TRƯỚC, xem 2 nơi gọi:
 * `event/workflow/file-manager-song.js::createFolderFromInput()`,
 * `event/workflow/playlist.js::createFolderInPicker()`.
 * @param {string} folderId - ĐÃ resolve sẵn qua `resolveFolderId(name)`.
 * @param {string} name
 * @returns {Promise<{status: 'duplicateName'|'ok', folderId?: string}>}
 */
async function createFolder(folderId, name) {
    const existingIds = await getAllFolderKeys(); // service/db.js — API ngoại lệ Rule 3b
    const existingFolders = (await Promise.all(existingIds.map((id) => getFolderRecord(id)))).filter(Boolean); // service/db.js
    if (existingFolders.some(f => f.name === name)) return { status: 'duplicateName' };

    // MỚI (Batch 4) — type: null tường minh (chưa xác định loại) — phân biệt với folder TẠO
    // TRƯỚC batch này (field vắng mặt hoàn toàn) chỉ để rõ ý, cả 2 đọc ra đều falsy như nhau.
    await setFolderRecord(folderId, { id: folderId, name, type: null });
    await setFolderSongMap(folderId, { list: [], empty: 0 });
    return { status: 'ok', folderId };
}

/**
 * Đổi tên 1 folder đã có. Guard clause thuần (không tồn tại / trùng tên -> dừng sớm) — KHÔNG phải
 * rẽ nhánh tiến trình theo Rule 1.
 * SỬA 03/07/2026 (đợt 6, điểm 4) — thêm guard chặn trùng tên (case-sensitive), TRỪ chính folder
 * đang đổi tên (đổi tên "về lại tên cũ y hệt" không tính là trùng với "chính nó").
 * @param {string} folderId
 * @param {string} newName
 * @returns {Promise<{status: 'notFound'|'duplicateName'|'ok'}>}
 */
async function renameFolder(folderId, newName) {
    const record = await getFolderRecord(folderId);
    if (!record) return { status: 'notFound' };

    const existingFolders = await listFolders(); // CÓ return, DÙNG ngay dưới -> hợp lệ Rule 3
    console.log(`[renameFolder] callTo: "listFolders", request: "kiểm tra tên '${newName}' đã tồn tại ở folder khác chưa (case-sensitive)"`);
    if (existingFolders.some(f => f.id !== folderId && f.name === newName)) return { status: 'duplicateName' };

    record.name = newName;
    await setFolderRecord(folderId, record);
    return { status: 'ok' };
}

/**
 * Xoá 1 folder — thứ tự BẮT BUỘC theo plan mục 6 "Đã chốt": dọn field `folder[folderId]` khỏi
 * TỪNG bài đang có trong `list` TRƯỚC, xong mới xoá `folder_song`, cuối cùng xoá metadata `folders`.
 * @param {string} folderId
 * @returns {Promise<{status: 'notFound'|'ok'}>}
 */
/**
 * SỬA (ver12 "Song/Video Unification", phản hồi Giang 28/07/2026) — thêm tham số `mediaType`
 * ('song'|'video') — TRƯỚC ĐÂY hardcode `getSongRecord`/`setSongRecord`, khiến xoá 1 folder type
 * 'video' không dọn được field `record.folder[folderId]` trên record Video (record đó nằm ở store
 * KHÁC hẳn — `videos`, không phải `songs` — `getSongRecord()` trả `undefined` cho videoKey). Chọn
 * ĐÚNG hàm đọc/ghi service/db.js theo `mediaType` (data layer, ngoại lệ Rule 3) — KHÔNG rẽ nhánh
 * TỪNG item trong vòng lặp (1 folder LUÔN đúng 1 loại, chọn 1 LẦN trước vòng lặp là đủ).
 * @param {string} folderId
 * @param {'song'|'video'} [mediaType] - mặc định 'song' (an toàn cho folder rỗng/type null — vòng
 *        lặp bên dưới khi đó cũng rỗng, không tham chiếu store nào).
 * @returns {Promise<{status: 'notFound'|'ok'}>}
 */
async function deleteFolder(folderId, mediaType) {
    const folderMap = await getFolderSongMap(folderId);
    if (!folderMap) return { status: 'notFound' };

    const getRecordFn = mediaType === 'video' ? getVideoRecord : getSongRecord; // service/db.js
    const setRecordFn = mediaType === 'video' ? setVideoRecord : setSongRecord; // service/db.js

    // [TỰ SỬA 14/07/2026, tự audit lại Rule 3] — trước đây gọi getFolderSongKeys() (1 core KHÁC
    // trong CÙNG file) rồi biện minh "có return value nên hợp lệ" — SAI theo đúng Rule 3 hiện hành
    // (readme/core-function-conventions.md mục 3a: "không còn tiêu chí nào để hợp lệ hoá core gọi
    // core"). Inline TRỰC TIẾP logic 1 dòng của getFolderSongKeys() (lọc tombstone null) tại đây,
    // không gọi hàm đó nữa.
    const songKeys = folderMap.list.filter((k) => k != null);
    for (const songKey of songKeys) {
        const record = await getRecordFn(songKey);
        if (!record || !record.folder) continue; // guard: record đã bị xoá/hỏng dữ liệu ở nơi khác — bỏ qua, không chặn xoá folder
        delete record.folder[folderId];
        await setRecordFn(songKey, record);
    }

    await deleteFolderSongMap(folderId);
    await deleteFolderRecord(folderId);

    // MỚI (03/07/2026, đợt 5) — ghi nhận id này ĐÃ TỪNG DÙNG, vĩnh viễn không cấp lại (xem giải
    // thích đầy đủ ở resolveFolderId() phía trên).
    const deletedIds = (await getMeta('deletedFolderIds')) || [];
    if (!deletedIds.includes(folderId)) {
        deletedIds.push(folderId);
        await setMeta('deletedFolderIds', deletedIds);
    }

    return { status: 'ok' };
}

/**
 * Đặt lại TOÀN BỘ folder về rỗng (`list: [], empty: 0`) — dùng khi xoá sạch thư viện nhạc (mục 3,
 * CHỐT 03/07/2026): lúc đó mọi bài đã mất, mọi `folder_song` còn lại chỉ là tham chiếu rác tới
 * songKey không còn tồn tại. KHÔNG xoá record `folders` (giữ tên folder người dùng đã đặt) — chỉ
 * dọn rỗng nội dung. Rule 1: đơn tuyến (1 tiến trình "dọn sạch mọi folder"), lặp qua từng folder là
 * chi tiết triển khai, không phải rẽ nhánh nghiệp vụ khác nhau.
 * @returns {Promise<void>}
 */
async function clearAllFolderSongData() {
    const ids = await getAllFolderKeys(); // data layer (service/db.js)
    for (const id of ids) {
        await setFolderSongMap(id, { list: [], empty: 0 }); // data layer (service/db.js)
    }
}

/**
 * SỬA LẦN 2 (sau trao đổi Rule 3): bản trước tách `insertNewFolderMembership`/
 * `refillTombstonedFolderMembership` thành 2 hàm core riêng rồi GỌI chúng (void, không return) từ
 * bên trong `addSongsToFolder()` — dù đi qua VirtualMachineState, đây VẪN LÀ core gọi core void chỉ
 * để side-effect (Rule 3, "bất kể đơn giản, bất kể qua cơ chế chọn hàm nào"). VMState chỉ giải
 * quyết Rule 1 (CHỌN hàm nào chạy) — KHÔNG "miễn" Rule 3 (hàm được chọn có được phép void hay
 * không). Sửa đúng: 2 callback của VMState.run() dưới đây là CODE NỘI BỘ (closure) của chính
 * addSongsToFolder(), KHÔNG gọi ra hàm nào khác — không còn là "core gọi core" nữa nên Rule 3 không
 * áp dụng, đồng thời vẫn giữ đúng Rule 1 (điều phối qua VMState, không if/else tay).
 *
 * [TỰ SỬA LẦN 3, 27/07/2026, phản hồi Giang — tự audit lại phát hiện SAI Ở LẦN SỬA TRƯỚC]
 * `getFolderMembershipState()` TỪNG được giữ lại như 1 hàm core RIÊNG (top-level), biện minh
 * "CÓ return value, đúng tiêu chí Rule 3c" — SAI: điều kiện ĐẦU TIÊN của Rule 3c là hàm con PHẢI là
 * "closure lồng bên trong, KHÔNG PHẢI hàm top-level riêng" — hàm đó khai `function
 * getFolderMembershipState(...)` Ở TOP-LEVEL file, không phải closure bên trong
 * `addSongsToFolder()`, nên KHÔNG đạt điều kiện này — đây VẪN LÀ core gọi core (Rule 3 vi phạm
 * thật, không phải trường hợp ngoại lệ). Sửa: xoá hẳn hàm top-level đó, INLINE logic 2 dòng của nó
 * trực tiếp vào bên trong vòng lặp `addSongsToFolder()` (xem bên dưới) — giờ mới thật sự là "code
 * nội bộ", không gọi ra hàm nào khác, đúng cả Rule 1 lẫn Rule 3.
 */
/** Thêm NHIỀU bài vào 1 folder — đúng thuật toán CHỐT ở plan mục 4.b1 "Thêm vào folder".
 *
 * MỚI (Batch 4, "Song/Video Unification" mục 5) — tham số `mediaType` ('song'|'video') + validate
 * cùng loại: 1 folder CHỈ chứa đúng 1 loại — item đầu tiên thêm vào quyết định `type`, từ đó chặn
 * thêm loại KHÁC (guard clause thuần, Rule 1 — bỏ nhánh này đi hàm vẫn còn NGUYÊN đúng 1 tiến trình
 * "thêm songKeys vào folder", chỉ mất phần "dừng sớm nếu khác loại"). Suy luận type HIỆU LỰC hiện
 * tại (đã lưu, hoặc ngầm định từ nội dung nếu folder tạo TRƯỚC batch này) rồi INLINE ngay tại đây
 * (KHÔNG tách hàm riêng — 1 biểu thức 3 phép toán, tách ra sẽ chỉ để lộ 1 lời gọi core→core không
 * cần thiết, vi phạm Rule 3). Cả lô `songKeys` LUÔN cùng 1 `mediaType` (nơi gọi hiện tại — Song —
 * chỉ truyền 'song'; video sẽ nối vào cùng cơ chế này ở batch sau) nên chỉ cần kiểm tra 1 LẦN,
 * không phải per-item.
 * @param {string[]} songKeys
 * @param {string} folderId
 * @param {'song'|'video'} mediaType
 * @returns {Promise<{status: 'notFound'|'typeMismatch'|'ok', addedCount: number}>}
 */
async function addSongsToFolder(songKeys, folderId, mediaType) {
    const folderRecord = await getFolderRecord(folderId);
    if (!folderRecord) return { status: 'notFound', addedCount: 0 };
    const folderMap = await getFolderSongMap(folderId);
    if (!folderMap) return { status: 'notFound', addedCount: 0 };

    const hasAnyMemberBefore = folderMap.list.some((k) => k != null);
    const effectiveType = folderRecord.type ?? (hasAnyMemberBefore ? 'song' : null);
    if (effectiveType && effectiveType !== mediaType) return { status: 'typeMismatch', addedCount: 0 };

    let addedCount = 0;
    // SỬA (phản hồi Giang 28/07/2026) — chọn ĐÚNG hàm đọc/ghi service/db.js theo `mediaType` MỘT
    // LẦN trước vòng lặp (record Video nằm store `videos`, KHÁC hẳn `songs` — TRƯỚC ĐÂY hardcode
    // getSongRecord/setSongRecord khiến thêm Video vào folder không lưu được gì, dù validate type ở
    // trên đã đúng). Data layer, ngoại lệ Rule 3.
    const getRecordFn = mediaType === 'video' ? getVideoRecord : getSongRecord;
    const setRecordFn = mediaType === 'video' ? setVideoRecord : setSongRecord;
    for (const songKey of songKeys) {
        const record = await getRecordFn(songKey);
        if (!record) continue; // guard: bài không còn tồn tại — bỏ qua, không chặn cả lô (early-exit thuần, đúng guard clause)
        if (!record.folder) record.folder = {};

        // [TỰ SỬA 27/07/2026] INLINE trực tiếp (trước đây gọi getFolderMembershipState(), 1 hàm
        // core top-level RIÊNG — SAI Rule 3, xem docstring phía trên) — cùng đúng 2 dòng logic,
        // giờ là CODE NỘI BỘ của addSongsToFolder(), không gọi ra hàm nào khác.
        const membershipState = !(folderId in record.folder)
            ? 'new'
            : (folderMap.list[record.folder[folderId]] === null ? 'tombstoned' : 'active');
        VirtualMachineState.run([
            // 2 callback dưới đây là CODE NỘI BỘ (đóng gói trong chính addSongsToFolder), KHÔNG
            // gọi ra hàm core nào khác -> không phải "core gọi core", Rule 3 không áp dụng.
            { state: membershipState, operation: '===', value: 'new', callback: () => {
                const position = folderMap.list.length;
                folderMap.list.push(songKey);
                record.folder[folderId] = position;
                addedCount++;
            } },
            { state: membershipState, operation: '===', value: 'tombstoned', callback: () => {
                const position = record.folder[folderId];
                folderMap.list[position] = songKey;
                folderMap.empty--;
                addedCount++;
            } },
            { state: membershipState, operation: '===', value: 'active', callback: () => {} }, // đã ở trong rồi — no-op có chủ đích (khai báo rõ, tránh cảnh báo "không rule nào khớp")
        ]);
        await setRecordFn(songKey, record);
    }
    await setFolderSongMap(folderId, folderMap);

    // MỚI (Batch 4) — khoá `type` NGAY sau lần thêm thành công đầu tiên (chỉ ghi khi record CHƯA
    // có type — tránh ghi lại vô ích mỗi lần thêm nếu đã khoá từ trước).
    if (!folderRecord.type && addedCount > 0) {
        folderRecord.type = mediaType;
        await setFolderRecord(folderId, folderRecord);
    }
    return { status: 'ok', addedCount };
}

/**
 * Gỡ cascade 1 bài khỏi TẤT CẢ folder nó từng thuộc — dùng khi bài bị XOÁ THẬT khỏi `songs`
 * (khác "gỡ khỏi 1 folder cụ thể", xem plan mục 6 "Đã chốt"). Nhận songRecord qua tham số (Rule 2
 * — không tự appState.get()), KHÔNG tự setSongRecord() lại record (nơi gọi đang xoá hẳn record đó
 * ngay sau, ghi lại vô nghĩa).
 * @param {Object} songRecord - record đầy đủ của bài SẮP bị xoá (đã getSongRecord() từ trước)
 */
async function removeSongFromAllFolders(songRecord) {
    if (!songRecord || !songRecord.folder) return;
    for (const folderId of Object.keys(songRecord.folder)) {
        const folderMap = await getFolderSongMap(folderId);
        if (!folderMap) continue; // guard: folder đã bị xoá trước đó, record chỉ còn sót field cũ
        const position = songRecord.folder[folderId];
        if (folderMap.list[position] != null) {
            folderMap.list[position] = null;
            folderMap.empty++;
            await setFolderSongMap(folderId, folderMap);
        }
    }
}

/**
 * Gỡ ĐÚNG 1 bài khỏi 1 folder cụ thể — CHỈ gỡ khỏi danh sách, KHÔNG xoá bài (khác hẳn "Xoá bài
 * khỏi Playlist", xem plan-v12-multimedia.md mục 6 "Đã chốt"). Đối xứng với addSongsToFolder() —
 * cùng thuật toán tombstone (`list[position] = null`, `empty++`) đã CHỐT ở mục 4.b1.
 * MỚI (Phase 2, CHỐT 03/07/2026) — dùng bởi icon X trong Folder Detail Drawer.
 * @param {string} songKey
 * @param {string} folderId
 * @returns {Promise<{status: 'notFound'|'ok'}>}
 */
/**
 * SỬA (phản hồi Giang 28/07/2026) — thêm tham số `mediaType`, cùng lý do đã sửa ở deleteFolder()
 * ngay trên (record Video nằm store KHÁC, `getSongRecord()` không đọc được).
 * @param {string} songKey
 * @param {string} folderId
 * @param {'song'|'video'} [mediaType] - mặc định 'song'.
 * @returns {Promise<{status: 'notFound'|'ok'}>}
 */
async function removeSongFromFolder(songKey, folderId, mediaType) {
    const getRecordFn = mediaType === 'video' ? getVideoRecord : getSongRecord; // service/db.js
    const record = await getRecordFn(songKey);
    if (!record || !record.folder || !(folderId in record.folder)) return { status: 'notFound' };

    const folderMap = await getFolderSongMap(folderId);
    if (!folderMap) return { status: 'notFound' };

    const position = record.folder[folderId];
    if (folderMap.list[position] !== null) {
        folderMap.list[position] = null;
        folderMap.empty++;
        await setFolderSongMap(folderId, folderMap);
    }
    return { status: 'ok' };
}

/**
 * Gỡ TẤT CẢ bài khỏi 1 folder (rỗng hoá nội dung) — KHÁC hẳn deleteFolder(): folder (metadata/tên)
 * VẪN GIỮ NGUYÊN, chỉ dọn sạch danh sách bài BÊN TRONG. MỚI (14/07/2026, Giang yêu cầu — nút "Xoá
 * hết bài" trong Folder Detail). Cùng thứ tự AN TOÀN với deleteFolder(): dọn field
 * `record.folder[folderId]` khỏi TỪNG bài đang có TRƯỚC, rồi mới ghi `folder_song` rỗng.
 * SỬA (phản hồi Giang 28/07/2026) — thêm tham số `mediaType`, cùng lý do deleteFolder()/
 * removeSongFromFolder() ngay trên.
 * @param {string} folderId
 * @param {'song'|'video'} [mediaType] - mặc định 'song'.
 * @returns {Promise<{status: 'notFound'|'ok'}>}
 */
async function removeAllSongsFromFolder(folderId, mediaType) {
    const folderMap = await getFolderSongMap(folderId);
    if (!folderMap) return { status: 'notFound' };

    const getRecordFn = mediaType === 'video' ? getVideoRecord : getSongRecord; // service/db.js
    const setRecordFn = mediaType === 'video' ? setVideoRecord : setSongRecord; // service/db.js

    // Inline (không gọi getFolderSongKeys() — xem giải thích đầy đủ ở deleteFolder() phía trên).
    const songKeys = folderMap.list.filter((k) => k != null);
    for (const songKey of songKeys) {
        const record = await getRecordFn(songKey);
        if (!record || !record.folder) continue; // guard: record đã bị xoá/hỏng dữ liệu ở nơi khác — bỏ qua
        delete record.folder[folderId];
        await setRecordFn(songKey, record);
    }

    await setFolderSongMap(folderId, { list: [], empty: 0 });
    return { status: 'ok' };
}

/**
 * Bật/tắt cờ "loại khỏi view Tất cả" của 1 folder (Scope vs Exclude, MỚI Batch 4, xem
 * plan-v12-song-video-unification.md mục 5). Guard clause thuần (Rule 1) — folder không tồn tại
 * thì dừng sớm, KHÔNG phải rẽ nhánh tiến trình khác.
 * @param {string} folderId
 * @param {boolean} enabled
 * @returns {Promise<{status: 'notFound'|'ok'}>}
 */
async function setFolderExcludeFlag(folderId, enabled) {
    const record = await getFolderRecord(folderId);
    if (!record) return { status: 'notFound' };
    record.excludeFromMainPlaylist = enabled;
    await setFolderRecord(folderId, record);
    return { status: 'ok' };
}

/**
 * Gom OR (hợp) toàn bộ songKey đang bị loại khỏi view "Tất cả" — hợp của `folder_song.list` của
 * MỌI folder có `excludeFromMainPlaylist === true` (mục 5, "Exclude là OR trên mọi folder chứa bài
 * đó"). Rule 1: đơn tuyến — CHỈ tính 1 tập hợp duy nhất, không rẽ nhánh nghiệp vụ nào khác. Rule 3:
 * chỉ gọi API `service/db.js` (data layer, ngoại lệ — xem docstring đầu file) — KHÔNG gọi core nào
 * khác trong file này.
 * @returns {Promise<Set<string>>}
 */
async function getExcludedSongKeysFromFolders() {
    const ids = await getAllFolderKeys(); // service/db.js
    const records = await Promise.all(ids.map((id) => getFolderRecord(id))); // service/db.js
    const excludedFolderIds = records.filter((r) => r && r.excludeFromMainPlaylist).map((r) => r.id);

    const excludedKeys = new Set();
    for (const folderId of excludedFolderIds) {
        const folderMap = await getFolderSongMap(folderId); // service/db.js
        if (!folderMap) continue; // guard: folder vừa bị xoá giữa lúc đang gom — bỏ qua, không coi là lỗi
        for (const key of folderMap.list) { if (key != null) excludedKeys.add(key); }
    }
    return excludedKeys;
}

/**
 * MỚI (ver12 "Song/Video Unification", Batch 5, mục 6e) — THAY getFolderSongsForDisplay() cũ
 * (core/file-manager/folder-detail-ui.js, đọc tên/nghệ sĩ qua `playlistCache` — CHỈ đúng khi
 * Playlist đang browse ĐÚNG loại của folder đó, vì `playlistCache` chỉ chứa 1 nguồn tại 1 thời
 * điểm). Đọc TRỰC TIẾP `service/db.js` theo `mediaType` của folder — ĐÚNG bất kể Playlist đang
 * browse nguồn nào. 1 folder KHÔNG BAO GIỜ trộn 2 loại (khoá type ngay từ item đầu tiên, xem
 * addSongsToFolder()) nên chỉ cần đọc ĐÚNG 1 store cho toàn bộ danh sách, không phải phán đoán
 * từng item riêng lẻ.
 * Bài/video không còn tồn tại (đã xoá, còn sót key trong folder_song) vẫn hiển thị bằng chính key
 * làm tên tạm — KHÔNG loại khỏi danh sách, để người dùng vẫn gỡ được tham chiếu rác đó.
 * @param {Object} folderMap - { list, empty } của 1 folder
 * @param {'song'|'video'|null} mediaType - `folder.type` (hiệu lực) — `null`/rỗng thì folder chưa
 *        có nội dung, `folderMap.list` lúc đó cũng luôn rỗng nên nhánh nào cũng cho kết quả `[]`.
 * @returns {Promise<Array<{key: string, title: string, artist: string}>>}
 */
async function getFolderItemsForDisplay(folderMap, mediaType) {
    const keys = folderMap.list.filter((k) => k != null);
    if (mediaType === 'video') {
        return Promise.all(keys.map(async (key) => {
            const record = await getVideoRecord(key); // service/db.js
            return { key, title: record ? (record.customName || stripFileExtension(record.filename)) : key, artist: '' }; // SỬA (phản hồi Giang 28/07) — bỏ đuôi mở rộng khi rơi về filename gốc
        }));
    }
    return Promise.all(keys.map(async (key) => {
        const record = await getSongRecord(key); // service/db.js
        return { key, title: record ? record.tag.title : key, artist: record ? record.tag.artist : '' };
    }));
}

/**
 * Liệt kê toàn bộ folder hiện có (metadata), dùng cho picker/UI danh sách.
 * @returns {Promise<Array<{id: string, name: string}>>}
 */
async function listFolders() {
    const ids = await getAllFolderKeys();
    const records = await Promise.all(ids.map(id => getFolderRecord(id)));
    return records.filter(Boolean);
}

/** Pure — danh sách songKey ĐANG THẬT trong folder (lọc bỏ lỗ tombstone null). Không I/O. */
function getFolderSongKeys(folderMap) {
    return folderMap.list.filter(k => k != null);
}

/** Pure — check rỗng hoàn toàn O(1), không scan mảng. Không I/O. */
function isFolderEmpty(folderMap) {
    return folderMap.empty === folderMap.list.length;
}
