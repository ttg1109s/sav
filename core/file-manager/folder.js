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
 * MỚI (hợp nhất Photo vào Playlist, CHỐT Giang — "sửa theo cấu trúc {song:{list folder}, video:{},
 * photo:{}} để O(1) list folder, khỏi phải logic") —
 *   meta.folderIndex : { song: string[], video: string[], photo: string[] } — folderId GOM SẴN
 *                 theo type, DUY TRÌ TĂNG DẦN (createFolder() thêm/deleteFolder() bớt), KHÔNG BAO
 *                 GIỜ quét lại toàn bộ `folders` để tự suy luận nữa (trừ đúng 1 lần migrate dữ liệu
 *                 cũ, xem migrateFolderIndexIfNeeded() cuối file, gọi 1 LẦN lúc boot). `listFolders
 *                 (type)` giờ đọc THẲNG `folderIndex[type]` — O(số folder ĐÚNG type đó), không còn
 *                 quét+lọc O(tổng mọi type) như bản cũ. `addSongsToFolder()` theo đó BỎ HẲN bước
 *                 validate/rẽ nhánh typeMismatch — UI chỉ bao giờ đưa vào ĐÚNG folder cùng type
 *                 (đọc từ `folderIndex[activeMediaSource]`), không còn khả năng lệch type để phải
 *                 phòng.
 *
 * MỚI (ver12 "Song/Video Unification", Batch 4, xem plan-v12-song-video-unification.md mục 5) —
 * 2 field MỚI trên record `folders`:
 *   - `type: 'song'|'video'|'photo'` — CHỐT LẠI (hợp nhất Photo vào Playlist, "cho phép trùng tên,
 *     định danh = folder name + type") — type giờ gán NGAY LÚC TẠO (Playlist source nào đang active
 *     lúc tạo folder thì gán type đó, xem resolveFolderId()/createFolder()), KHÔNG còn khái niệm
 *     "chưa xác định (null), khoá dần theo item đầu tiên thêm vào" của bản CŨ. Folder TẠO TRƯỚC thay
 *     đổi này có thể vẫn còn `type: null`/undefined — nơi ĐỌC field này PHẢI tự suy luận ngầm
 *     `type || 'song'` (xem addSongsToFolder()) — KHÔNG cần migration/backfill DB riêng.
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
 * Sinh folderId DUY NHẤT từ tên folder + type, tái dùng slugify() đã có ở db.js (cùng thuật toán
 * với resolveSongKey — KHÔNG trùng logic, chỉ đổi store kiểm tra tồn tại).
 *
 * MỞ RỘNG (CHỐT Giang — "cho phép trùng tên, định danh = folder name + type") — id CHÍNH THỨC gộp
 * LUÔN `type` vào base slug (`${slug}-${type}`), KHÔNG còn chỉ dựa vào tên — 2 folder CÙNG TÊN
 * nhưng KHÁC type (vd "Yêu thích" cho Song và "Yêu thích" cho Photo) tự nhiên nhận 2 id khác nhau
 * ngay từ bước sinh id, không cần thêm cơ chế phân biệt nào khác ở tầng trên. Folder TẠO TRƯỚC thay
 * đổi này (id KHÔNG có hậu tố type) KHÔNG bị đụng tới — id là khoá tra cứu nội bộ, không cần khớp
 * quy ước mới để tiếp tục hoạt động đúng.
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
 * KHÔNG BAO GIỜ cấp lại 1 id đã từng tồn tại, kể cả sau khi xoá — folder tạo lại cùng tên+type sẽ
 * nhận id khác (`...-2`, `...-3`...), y hệt cơ chế suffix có sẵn khi trùng tên+type với folder ĐANG
 * SỐNG.
 * @param {string} name
 * @param {'song'|'video'|'photo'} type
 * @returns {Promise<string>}
 */
async function resolveFolderId(name, type) {
    const baseSlug = `${slugify(name) || 'folder'}-${type}`; // CÓ return, DÙNG ngay dưới -> hợp lệ Rule 3
    console.log(`[resolveFolderId] callTo: "slugify", request: "chuẩn hoá tên '${name}' + type '${type}' thành slug làm base cho id"`);
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
 * `resolveFolderId(name, type)` TRƯỚC, rồi gọi hàm này — 2 core TÁCH RỜI, Workflow tự gọi CẢ HAI theo
 * đúng thứ tự). 1 tiến trình duy nhất: kiểm tra trùng TÊN (không phải id — id lúc này CHẮC CHẮN
 * không trùng, đã tự `resolveFolderId()` đảm bảo) -> ghi metadata -> ghi mapping rỗng -> thêm vào
 * `folderIndex[type]` — nhánh "trùng tên -> dừng sớm" là guard clause (Rule 1 cho phép), KHÔNG phải
 * rẽ nhánh 2 tiến trình khác nhau.
 *
 * MỞ RỘNG (hợp nhất Photo vào Playlist, CHỐT Giang — "cấu trúc {song,video,photo} để O(1) list
 * folder") — trùng tên giờ đọc THẲNG `folderIndex[type]` (chỉ fetch record CÙNG type, không quét
 * toàn bộ `folders`) — O(số folder cùng type), không còn O(tổng mọi type) như bản trước. Tạo xong
 * PUSH folderId vào `folderIndex[type]`, ghi lại `meta.folderIndex` — đây là nơi DUY NHẤT
 * `folderIndex` được THÊM phần tử (đối xứng deleteFolder() là nơi DUY NHẤT bớt).
 * So khớp tên CASE-SENSITIVE (phân biệt hoa/thường): "abc" / "ABC" / "Abc" được coi là 3 tên KHÁC
 * NHAU, được phép cùng tồn tại (kể cả cùng type); CHỈ chặn khi trùng tuyệt đối từng ký tự (VÀ cùng
 * type).
 * @param {string} folderId - ĐÃ resolve sẵn qua `resolveFolderId(name, type)`.
 * @param {string} name
 * @param {'song'|'video'|'photo'} type
 * @returns {Promise<{status: 'duplicateName'|'ok', folderId?: string}>}
 */
async function createFolder(folderId, name, type) {
    const folderIndex = (await getMeta('folderIndex')) || { song: [], video: [], photo: [] }; // data layer — fallback phòng hiếm khi migrate chưa kịp chạy
    const sameTypeIds = folderIndex[type] || [];
    const sameTypeFolders = (await Promise.all(sameTypeIds.map((id) => getFolderRecord(id)))).filter(Boolean); // service/db.js
    if (sameTypeFolders.some(f => f.name === name)) return { status: 'duplicateName' };

    await setFolderRecord(folderId, { id: folderId, name, type });
    await setFolderSongMap(folderId, { list: [], empty: 0 });

    if (!folderIndex[type]) folderIndex[type] = [];
    folderIndex[type].push(folderId);
    await setMeta('folderIndex', folderIndex); // data layer
    return { status: 'ok', folderId };
}

/**
 * Đổi tên 1 folder đã có. Guard clause thuần (không tồn tại / trùng tên -> dừng sớm) — KHÔNG phải
 * rẽ nhánh tiến trình theo Rule 1.
 * MỞ RỘNG (hợp nhất Photo vào Playlist) — đọc `folderIndex[record.type]` (O(cùng type)) thay vì
 * `listFolders()` toàn bộ — cùng tối ưu đã áp dụng ở createFolder().
 * SỬA 03/07/2026 (đợt 6, điểm 4) — thêm guard chặn trùng tên (case-sensitive), TRỪ chính folder
 * đang đổi tên (đổi tên "về lại tên cũ y hệt" không tính là trùng với "chính nó").
 * @param {string} folderId
 * @param {string} newName
 * @returns {Promise<{status: 'notFound'|'duplicateName'|'ok'}>}
 */
async function renameFolder(folderId, newName) {
    const record = await getFolderRecord(folderId);
    if (!record) return { status: 'notFound' };

    const folderIndex = (await getMeta('folderIndex')) || { song: [], video: [], photo: [] }; // data layer
    const sameTypeIds = folderIndex[record.type] || [];
    const sameTypeFolders = (await Promise.all(sameTypeIds.map((id) => getFolderRecord(id)))).filter(Boolean); // service/db.js
    if (sameTypeFolders.some(f => f.id !== folderId && f.name === newName)) return { status: 'duplicateName' };

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
 * MỞ RỘNG (hợp nhất Photo vào Playlist) — thêm nhánh 'photo' (store `images`).
 * @param {string} folderId
 * @param {'song'|'video'|'photo'} [mediaType] - mặc định 'song' (an toàn cho folder rỗng/type null
 *        — vòng lặp bên dưới khi đó cũng rỗng, không tham chiếu store nào).
 * @returns {Promise<{status: 'notFound'|'ok'}>}
 */
async function deleteFolder(folderId, mediaType) {
    const folderMap = await getFolderSongMap(folderId);
    if (!folderMap) return { status: 'notFound' };

    const getRecordFn = mediaType === 'video' ? getVideoRecord : mediaType === 'photo' ? getImageRecord : getSongRecord; // service/db.js
    const setRecordFn = mediaType === 'video' ? setVideoRecord : mediaType === 'photo' ? setImageRecord : setSongRecord; // service/db.js

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

    // MỞ RỘNG (hợp nhất Photo vào Playlist) — bớt folderId khỏi `folderIndex[mediaType]` — đối
    // xứng với bước "push vào index" ở createFolder(). Dò cả 3 nhóm thay vì chỉ đúng `mediaType`
    // truyền vào — phòng trường hợp hiếm `mediaType` truyền sai/thiếu (mặc định 'song' ở tham số),
    // đảm bảo id mồ côi không sót lại ở nhóm nào.
    const folderIndex = (await getMeta('folderIndex')) || { song: [], video: [], photo: [] }; // data layer
    let indexChanged = false;
    for (const t of ['song', 'video', 'photo']) {
        if (!folderIndex[t]) continue;
        const idx = folderIndex[t].indexOf(folderId);
        if (idx !== -1) { folderIndex[t].splice(idx, 1); indexChanged = true; }
    }
    if (indexChanged) await setMeta('folderIndex', folderIndex); // data layer

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
 * BỎ HẲN RẼ NHÁNH (hợp nhất Photo vào Playlist, CHỐT Giang — "Add song không cần rẽ nhánh, chỉ cần
 * thêm -> lấy media hiện tại -> set type cho nó luôn") — KHÔNG còn validate/so khớp type nữa: folder
 * giờ luôn có `type` CỐ ĐỊNH từ lúc tạo (xem createFolder()), và UI CHỈ BAO GIỜ đưa vào đây 1 folder
 * đã được lọc ĐÚNG type từ `folderIndex[activeMediaSource]` (xem event/workflow/playlist.js::
 * openAddToFolderPicker*()) — không còn khả năng lệch type để phải phòng ngừa, tham số `mediaType`
 * giờ CHỈ dùng để chọn ĐÚNG store đọc/ghi (song/video/photo), không còn dùng để validate.
 * @param {string[]} songKeys
 * @param {string} folderId
 * @param {'song'|'video'|'photo'} mediaType
 * @returns {Promise<{status: 'notFound'|'ok', addedCount: number}>}
 */
async function addSongsToFolder(songKeys, folderId, mediaType) {
    const folderMap = await getFolderSongMap(folderId);
    if (!folderMap) return { status: 'notFound', addedCount: 0 };

    let addedCount = 0;
    // SỬA (phản hồi Giang 28/07/2026) — chọn ĐÚNG hàm đọc/ghi service/db.js theo `mediaType` MỘT
    // LẦN trước vòng lặp (record Video nằm store `videos`, KHÁC hẳn `songs` — TRƯỚC ĐÂY hardcode
    // getSongRecord/setSongRecord khiến thêm Video vào folder không lưu được gì, dù validate type ở
    // trên đã đúng). Data layer, ngoại lệ Rule 3. MỞ RỘNG (hợp nhất Photo) — thêm nhánh 'photo'.
    const getRecordFn = mediaType === 'video' ? getVideoRecord : mediaType === 'photo' ? getImageRecord : getSongRecord;
    const setRecordFn = mediaType === 'video' ? setVideoRecord : mediaType === 'photo' ? setImageRecord : setSongRecord;
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
 * ngay trên (record Video nằm store KHÁC, `getSongRecord()` không đọc được). MỞ RỘNG (hợp nhất
 * Photo vào Playlist) — thêm nhánh 'photo'.
 * @param {string} songKey
 * @param {string} folderId
 * @param {'song'|'video'|'photo'} [mediaType] - mặc định 'song'.
 * @returns {Promise<{status: 'notFound'|'ok'}>}
 */
async function removeSongFromFolder(songKey, folderId, mediaType) {
    const getRecordFn = mediaType === 'video' ? getVideoRecord : mediaType === 'photo' ? getImageRecord : getSongRecord; // service/db.js
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
 * removeSongFromFolder() ngay trên. MỞ RỘNG (hợp nhất Photo vào Playlist) — thêm nhánh 'photo'.
 * @param {string} folderId
 * @param {'song'|'video'|'photo'} [mediaType] - mặc định 'song'.
 * @returns {Promise<{status: 'notFound'|'ok'}>}
 */
async function removeAllSongsFromFolder(folderId, mediaType) {
    const folderMap = await getFolderSongMap(folderId);
    if (!folderMap) return { status: 'notFound' };

    const getRecordFn = mediaType === 'video' ? getVideoRecord : mediaType === 'photo' ? getImageRecord : getSongRecord; // service/db.js
    const setRecordFn = mediaType === 'video' ? setVideoRecord : mediaType === 'photo' ? setImageRecord : setSongRecord; // service/db.js

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
 * browse nguồn nào. 1 folder KHÔNG BAO GIỜ trộn loại (type cố định từ lúc tạo, xem createFolder())
 * nên chỉ cần đọc ĐÚNG 1 store cho toàn bộ danh sách, không phải phán đoán từng item riêng lẻ.
 * MỞ RỘNG (hợp nhất Photo vào Playlist) — thêm nhánh 'photo' (đọc `images`, title = filename bỏ
 * đuôi, không có artist — cùng công thức Adapter buildPhotoPlaylistCache(), core/playlist/loader.js).
 * Bài/video/ảnh không còn tồn tại (đã xoá, còn sót key trong folder_song) vẫn hiển thị bằng chính
 * key làm tên tạm — KHÔNG loại khỏi danh sách, để người dùng vẫn gỡ được tham chiếu rác đó.
 * @param {Object} folderMap - { list, empty } của 1 folder
 * @param {'song'|'video'|'photo'|null} mediaType - `folder.type` (hiệu lực) — `null`/rỗng thì folder
 *        chưa có nội dung, `folderMap.list` lúc đó cũng luôn rỗng nên nhánh nào cũng cho kết quả `[]`.
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
    if (mediaType === 'photo') {
        return Promise.all(keys.map(async (key) => {
            const record = await getImageRecord(key); // service/db.js
            return { key, title: record ? stripFileExtension(record.filename) : key, artist: '' };
        }));
    }
    return Promise.all(keys.map(async (key) => {
        const record = await getSongRecord(key); // service/db.js
        return { key, title: record ? record.tag.title : key, artist: record ? record.tag.artist : '' };
    }));
}

/**
 * Liệt kê toàn bộ folder hiện có (metadata), dùng cho picker/UI danh sách.
 * VIẾT LẠI (hợp nhất Photo vào Playlist, CHỐT Giang — "cấu trúc {song,video,photo} để O(1) list
 * folder, khỏi phải logic") — đọc THẲNG `meta.folderIndex[type]` (folderId đã gom sẵn theo type,
 * duy trì tăng dần bởi createFolder()/deleteFolder()) — CHỈ fetch record của ĐÚNG type cần, O(số
 * folder type đó). KHÔNG còn quét `getAllFolderKeys()` + lọc O(tổng mọi type) như bản trước.
 * Không truyền `type` -> gộp cả 3 nhóm (vẫn cần cho vài chỗ đọc chéo type, vd
 * getExcludedSongKeysFromFolders()).
 * @param {'song'|'video'|'photo'} [type]
 * @returns {Promise<Array<{id: string, name: string, type: string}>>}
 */
async function listFolders(type) {
    const folderIndex = (await getMeta('folderIndex')) || { song: [], video: [], photo: [] }; // data layer
    const ids = type ? (folderIndex[type] || []) : [...(folderIndex.song || []), ...(folderIndex.video || []), ...(folderIndex.photo || [])];
    const records = await Promise.all(ids.map((id) => getFolderRecord(id))); // service/db.js
    return records.filter(Boolean);
}

/**
 * Migrate 1 LẦN DUY NHẤT — build `meta.folderIndex` lần đầu cho dữ liệu cũ (folder tạo TRƯỚC khi
 * có index này, thời điểm đó identity chỉ là tên, chưa gộp type vào id) — quét TOÀN BỘ `folders`
 * (đúng NGOẠI LỆ DUY NHẤT còn dùng `getAllFolderKeys()` kiểu cũ trong cả file, mọi chỗ khác từ nay
 * đọc thẳng index). Idempotent qua `meta.folderIndexMigrated` (boolean) — gọi lại không sao, tự
 * dừng sớm nếu đã chạy rồi. Gọi 1 LẦN lúc boot (event/workflow/app-boot.js), TRƯỚC bất kỳ thao tác
 * folder nào của người dùng trong phiên — `listFolders()`/`createFolder()`/`deleteFolder()` từ đó
 * trở đi LUÔN giả định `meta.folderIndex` đã tồn tại đúng, không tự kiểm tra/migrate lại (Rule 1:
 * mỗi hàm 1 tiến trình — migrate là tiến trình RIÊNG, chỉ chạy đúng 1 lần ở boot, không lặp lại
 * ngầm bên trong mọi lần đọc/ghi folder).
 * @returns {Promise<void>}
 */
async function migrateFolderIndexIfNeeded() {
    const migrated = await getMeta('folderIndexMigrated'); // data layer
    if (migrated) return;

    const ids = await getAllFolderKeys(); // data layer — ngoại lệ DUY NHẤT còn quét toàn bộ, chỉ chạy 1 lần
    const records = await Promise.all(ids.map((id) => getFolderRecord(id)));
    const folderIndex = { song: [], video: [], photo: [] };
    for (const record of records) {
        if (!record) continue;
        const t = record.type || 'song'; // legacy folder (type null/undefined, tạo TRƯỚC Batch 4) coi như 'song'
        if (!folderIndex[t]) folderIndex[t] = [];
        if (!folderIndex[t].includes(record.id)) folderIndex[t].push(record.id);
    }
    await setMeta('folderIndex', folderIndex);
    await setMeta('folderIndexMigrated', true);
}

/** Pure — danh sách songKey ĐANG THẬT trong folder (lọc bỏ lỗ tombstone null). Không I/O. */
function getFolderSongKeys(folderMap) {
    return folderMap.list.filter(k => k != null);
}

/** Pure — check rỗng hoàn toàn O(1), không scan mảng. Không I/O. */
function isFolderEmpty(folderMap) {
    return folderMap.empty === folderMap.list.length;
}
