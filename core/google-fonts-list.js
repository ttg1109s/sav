/**
 * core/google-fonts-list.js — Danh sách CURATED ~100 Google Font phổ biến nhất, kèm chỉ báo hỗ
 * trợ Việt/Nhật/Trung/Hàn — dùng làm list gợi ý lúc chọn "Google" làm nguồn font (Element Style
 * Editor, components/element-style-editor-drawer.js::_renderEseFontFamilyField()) — TRƯỚC ĐÓ ô
 * nhập chỉ là text tự do, Giang chỉ ra "không cung cấp list thì ai biết được mà chọn".
 *
 * === TẠI SAO KHÔNG GỌI API (bundle TĨNH thay vì fetch runtime) ===
 * Giang chọn "phương án 2" sau khi cân nhắc — API chính thức Google Fonts Developer API cần API
 * key (khó quản lý an toàn cho app chạy thẳng qua `file://`, không có backend giấu key), còn
 * nguồn JSON cộng đồng KHÔNG cần key thì hoặc quá NẶNG (vd `google-fonts-complete` ~11MB do kèm
 * URL từng file font/variant — dư thừa, app không cần), hoặc quá CŨ (thiếu nhiều font phổ biến gần
 * đây). List NÀY tự soạn thủ công, nhẹ (chỉ TÊN + chỉ báo ngôn ngữ, không kèm file/variant), không
 * cần mạng để HIỂN THỊ — mạng CHỈ cần lúc thật sự tải font qua `loadGoogleFont()` (core/
 * element-style-editor.js), đúng hành vi đã có sẵn của app.
 *
 * === ĐỘ TIN CẬY CỦA `scripts` ===
 * Tổng hợp thủ công từ kiến thức đã biết về Google Fonts subset support tại thời điểm soạn — KHÔNG
 * gọi Developer API để xác nhận (không có key). Google có thể thêm/bớt subset 1 font theo thời
 * gian. Nếu nghi ngờ 1 font trong list KHÔNG thật sự hiện đúng 1 ngôn ngữ nào đó, cách kiểm chứng
 * CHẮC CHẮN nhất là tự tải thử qua `loadGoogleFont()` trong Element Style Editor rồi xem chữ có
 * hiện đúng không (chữ bị thiếu trong subset sẽ hiện ô vuông rỗng "tofu" hoặc fallback sang font hệ
 * thống — nhận ra ngay bằng mắt, không cần công cụ gì thêm).
 *
 * `scripts` — mảng ngôn ngữ font NÀY hỗ trợ, trong số:
 *   - 'vi' (tiếng Việt, subset Google gọi là "vietnamese")
 *   - 'ja' (tiếng Nhật)
 *   - 'zh' (tiếng Trung — giản thể SC/phồn thể TC, xem hậu tố tên font)
 *   - 'ko' (tiếng Hàn)
 * Font Latin phổ biến ĐA SỐ chỉ có 'vi' — Google Fonts KHÔNG có khái niệm "1 font phủ hết mọi chữ
 * viết", Latin và CJK (Trung/Nhật/Hàn) hầu như LUÔN là gia đình font TÁCH RIÊNG (vd "Noto Sans" chỉ
 * Latin/Việt, muốn tiếng Nhật phải dùng riêng "Noto Sans JP") — đây là giới hạn THẬT của hệ sinh
 * thái Google Fonts, không phải thiếu sót của list này. Bộ Noto Sans/Serif (JP/KR/SC/TC) được
 * Google thiết kế ĐỒNG BỘ hình dáng dù tách file — ưu tiên chọn nếu Giang cần nhìn THỐNG NHẤT giữa
 * nhiều ngôn ngữ trong cùng 1 project.
 *
 * === CHƯA WIRE VÀO UI ===
 * File này CHỈ là dữ liệu (patch-only theo yêu cầu — "chỉ cần cung cấp file sửa/xoá"). Nơi dùng dự
 * kiến sau này: components/element-style-editor-drawer.js::_renderEseFontFamilyField() — đổi ô
 * nhập text tự do (nguồn 'google') thành `<select>`/`<datalist>` đọc từ `listGoogleFont`, lọc theo
 * `scripts` nếu Giang muốn (vd chỉ hiện font có 'vi' cho phụ đề tiếng Việt).
 *
 * NẠP: không phụ thuộc file nào khác (thuần khai báo hằng số) — nạp trước
 * components/element-style-editor-drawer.js là đủ, thứ tự chính xác không quan trọng.
 */
const listGoogleFont = [
    // ---- Latin / hỗ trợ tiếng Việt (subset "vietnamese") — ~70 font phổ biến nhất ----
    { name: 'Roboto', scripts: ['vi'] },
    { name: 'Open Sans', scripts: ['vi'] },
    { name: 'Lato', scripts: ['vi'] },
    { name: 'Montserrat', scripts: ['vi'] },
    { name: 'Poppins', scripts: ['vi'] },
    { name: 'Inter', scripts: ['vi'] },
    { name: 'Nunito', scripts: ['vi'] },
    { name: 'Nunito Sans', scripts: ['vi'] },
    { name: 'Raleway', scripts: ['vi'] },
    { name: 'Source Sans 3', scripts: ['vi'] },
    { name: 'Noto Sans', scripts: ['vi'] },
    { name: 'Noto Serif', scripts: ['vi'] },
    { name: 'Be Vietnam Pro', scripts: ['vi'] },
    { name: 'Work Sans', scripts: ['vi'] },
    { name: 'Quicksand', scripts: ['vi'] },
    { name: 'Mulish', scripts: ['vi'] },
    { name: 'Rubik', scripts: ['vi'] },
    { name: 'Karla', scripts: ['vi'] },
    { name: 'Manrope', scripts: ['vi'] },
    { name: 'Jost', scripts: ['vi'] },
    { name: 'Cabin', scripts: ['vi'] },
    { name: 'Barlow', scripts: ['vi'] },
    { name: 'Oswald', scripts: ['vi'] },
    { name: 'PT Sans', scripts: ['vi'] },
    { name: 'PT Serif', scripts: ['vi'] },
    { name: 'Merriweather', scripts: ['vi'] },
    { name: 'Playfair Display', scripts: ['vi'] },
    { name: 'Lora', scripts: ['vi'] },
    { name: 'Crimson Pro', scripts: ['vi'] },
    { name: 'EB Garamond', scripts: ['vi'] },
    { name: 'Josefin Sans', scripts: ['vi'] },
    { name: 'Dancing Script', scripts: ['vi'] },
    { name: 'Pacifico', scripts: ['vi'] },
    { name: 'Lobster', scripts: ['vi'] },
    { name: 'Comfortaa', scripts: ['vi'] },
    { name: 'Fredoka', scripts: ['vi'] },
    { name: 'Baloo 2', scripts: ['vi'] },
    { name: 'Bangers', scripts: ['vi'] },
    { name: 'Righteous', scripts: ['vi'] },
    { name: 'Archivo', scripts: ['vi'] },
    { name: 'DM Sans', scripts: ['vi'] },
    { name: 'DM Serif Display', scripts: ['vi'] },
    { name: 'Space Grotesk', scripts: ['vi'] },
    { name: 'Sora', scripts: ['vi'] },
    { name: 'Outfit', scripts: ['vi'] },
    { name: 'Plus Jakarta Sans', scripts: ['vi'] },
    { name: 'Urbanist', scripts: ['vi'] },
    { name: 'Lexend', scripts: ['vi'] },
    { name: 'Public Sans', scripts: ['vi'] },
    { name: 'IBM Plex Sans', scripts: ['vi'] },
    { name: 'Roboto Slab', scripts: ['vi'] },
    { name: 'Roboto Condensed', scripts: ['vi'] },
    { name: 'Roboto Mono', scripts: ['vi'] },
    { name: 'Fira Sans', scripts: ['vi'] },
    { name: 'Bebas Neue', scripts: ['vi'] },
    { name: 'Anton', scripts: ['vi'] },
    { name: 'Abril Fatface', scripts: ['vi'] },
    { name: 'Great Vibes', scripts: ['vi'] },
    { name: 'Satisfy', scripts: ['vi'] },
    { name: 'Caveat', scripts: ['vi'] },
    { name: 'Indie Flower', scripts: ['vi'] },
    { name: 'Permanent Marker', scripts: ['vi'] },
    { name: 'Amatic SC', scripts: ['vi'] },
    { name: 'Kalam', scripts: ['vi'] },
    { name: 'Patrick Hand', scripts: ['vi'] },
    { name: 'Signika', scripts: ['vi'] },
    { name: 'Varela Round', scripts: ['vi'] },
    { name: 'Exo 2', scripts: ['vi'] },
    { name: 'Titillium Web', scripts: ['vi'] },
    { name: 'Hind', scripts: ['vi'] },

    // ---- Tiếng Nhật (gia đình font TÁCH RIÊNG khỏi Latin, xem docstring trên đầu) ----
    { name: 'Noto Sans JP', scripts: ['ja'] },
    { name: 'Noto Serif JP', scripts: ['ja'] },
    { name: 'M PLUS 1p', scripts: ['ja'] },
    { name: 'M PLUS Rounded 1c', scripts: ['ja'] },
    { name: 'Kosugi', scripts: ['ja'] },
    { name: 'Kosugi Maru', scripts: ['ja'] },
    { name: 'Sawarabi Gothic', scripts: ['ja'] },
    { name: 'Sawarabi Mincho', scripts: ['ja'] },
    { name: 'Zen Kaku Gothic New', scripts: ['ja'] },
    { name: 'Zen Maru Gothic', scripts: ['ja'] },
    { name: 'Shippori Mincho', scripts: ['ja'] },
    { name: 'Dela Gothic One', scripts: ['ja'] },

    // ---- Tiếng Trung — giản thể (SC) + phồn thể (TC), xem hậu tố tên font ----
    { name: 'Noto Sans SC', scripts: ['zh'] },
    { name: 'Noto Serif SC', scripts: ['zh'] },
    { name: 'Noto Sans TC', scripts: ['zh'] },
    { name: 'Noto Serif TC', scripts: ['zh'] },
    { name: 'Noto Sans HK', scripts: ['zh'] },
    { name: 'ZCOOL XiaoWei', scripts: ['zh'] },
    { name: 'ZCOOL QingKe HuangYou', scripts: ['zh'] },
    { name: 'Ma Shan Zheng', scripts: ['zh'] },
    { name: 'Zhi Mang Xing', scripts: ['zh'] },
    { name: 'Long Cang', scripts: ['zh'] },
    { name: 'Liu Jian Mao Cao', scripts: ['zh'] },

    // ---- Tiếng Hàn ----
    { name: 'Noto Sans KR', scripts: ['ko'] },
    { name: 'Noto Serif KR', scripts: ['ko'] },
    { name: 'Nanum Gothic', scripts: ['ko'] },
    { name: 'Nanum Myeongjo', scripts: ['ko'] },
    { name: 'Nanum Pen Script', scripts: ['ko'] },
    { name: 'Black Han Sans', scripts: ['ko'] },
    { name: 'Do Hyeon', scripts: ['ko'] },
    { name: 'Gaegu', scripts: ['ko'] },
    { name: 'Jua', scripts: ['ko'] },
    { name: 'Gothic A1', scripts: ['ko'] },
    { name: 'Song Myung', scripts: ['ko'] },
    { name: 'Poor Story', scripts: ['ko'] },
];
