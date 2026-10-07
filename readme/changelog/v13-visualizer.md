# Ver 13 — Visualizer

Phần tách riêng của [v13.md](./v13.md). Mốc 14/07/2026 → 07/10/2026.

## 1. Vòng render và phân tích audio

- **20/07** — vòng lặp chính chạy bằng `taskManager` mode `raf` (Workflow tự tick, ngoài Listener→Router).
- **21/09 — Show Visual = tắt** (Giang: tắt cả vẽ lẫn render nhưng vẫn cập nhật status bar): tách 2 task `raf` trong
  `event/workflow/visualizer-render.js` — `audioAnalysis` (luôn chạy: FFT, beat, energy, hue, số liệu status bar, nhịp
  Game, nốt bay) và `visualizerRender` (chỉ vẽ; tắt khi Show Visual tắt).
- **28/09 — dọn visualizer Phase 1–5** (3 patch nối tiếp): tách workflow phân tích audio; workflow render thành host +
  một workflow mỗi group trong `event/workflow/visualizer/`; resize qua Listener→Router; control trong Custom Effect
  drawer qua listener ủy quyền → router `customEffect`; Auto-switch rẽ nhánh bằng `VirtualMachineState`; brain.js và
  bộ dựng WebGL thành core thuần; ngưỡng beat theo flux chuẩn hoá theo số bin. Giang chốt: helper toán thuần đang gọi
  core→core thì tách thành core nhỏ hơn, Workflow điều phối; bộ dựng three.js được ở core nếu không vi phạm rule.
- **01/10 — phân tích audio** (Giang chốt): âm lượng người dùng không ảnh hưởng phân tích; EQ có ảnh hưởng (đúng ý —
  EQ đổi tính chất nhạc); beat/energy/BPM dùng chung không đổi theo FFT size của effect đang chọn; BPM chính xác hơn
  (`core/audio-tempo.js`). Mọi tham số audio vào **kho `audioAnalysis`** (`service/audio-analysis.js`, API đọc-only — ngoại
  lệ có chủ đích như `AppConfig`); effect chỉ đọc qua `frame.audio.xxx()`; mỗi group tự khai FFT size phổ vẽ của mình
  (`spectrumSize(style)`). Workflow điều phối audio graph tách ra `event/workflow/audio-engine.js`. Chờ test trên máy.
- **05/10** — về Playlist trên màn hẹp chỉ dừng 2 task và ẩn `#visualizer-stage` ([v13-media-storage.md](./v13-media-storage.md) mục 3).
- **07/10** — helper ánh xạ tần số dùng chung chuyển sang `core/visualizer/tonotopic.js` (dùng bởi cả bar dot và
  connector).

## 2. Custom Effect

- **14/08** — mở rộng các field sâu thành chỉnh được ("làm hết danh sách ứng viên custom").
- **23/09** — nội dung drawer là component riêng (`components/custom-effect-drawer.js`); mở bằng giữ 1,5 s nút đổi
  effect.
- **25/09 (quy tắc)** — giá trị Custom Effect **không dùng chung** giữa các style cùng group (chỉnh `maxH` ở mirror
  không được đổi ở cascade); drawer chia thẻ theo loại cài đặt, không tiêu đề thẻ; trong thẻ thứ tự công tắc >
  dropdown > input > slider.
- **07/10** — khoá chỉnh Custom Effect khi Auto-switch đang bật.

## 3. Effect

| Group / style | Thay đổi |
|---|---|
| Galaxy / Space | Bỏ dần từ 21/07 (panel tinh chỉnh, các style), rồi **gỡ hẳn** cả engine, file group và field Custom Effect |
| Lighting (thunder, fireworks) | Gộp Lightning + Fireworks thành một kiểu `lighting`; 14 kiểu nổ pháo hoa, hoàn toàn theo audio; Finale bật/tắt bằng công tắc (`finaleEnabled`); pháo hoa không blur/glow |
| Vortex | Tự đổi hướng đường hầm qua công tắc (`redirectEnabled`); 25/09 làm lại (tham số tích luỹ, "gồ" thành, đổi hướng hỗn loạn) |
| Bar mirror | Bỏ thanh giữa; 25/09 giữ bản chất gương + cánh bướm (bass ở mép cánh, treble ở thân giữa, đối xứng 2 trục), khe giữa thành "thân" chỉnh được, nửa phản chiếu là dải riêng; 07/10 bỏ hẳn "Peak caps" |
| Bar dot (25/09) | Style mới, tách từ trục thời gian của brain: chấm bị chạm có glow, sóng lan theo audio, kiểu phồng bán kính / kéo 2 phía, dạng sin và xung vuông, dây rung đàn hồi theo cao độ (7 nốt); chế độ gradient rải màu theo từng chấm |
| Bar black hole (28–29/09) | Số thanh theo chu vi (ô 15 px, rộng 5–15 px, bo góc 0–5 px); làm mượt theo dt, không peak caps, bỏ chớp khi sao chạm vành; sao giữ trắng gốc, vẽ thành vệt cong theo quỹ đạo xoắn; **chùm tia Hawking** (công tắc, hướng ngẫu nhiên 360° chạm mép màn, nửa sau dưới hố + thanh, nửa trước đè lên, màu theo color mode). Glow từng hình bằng `shadowBlur` (bản tối ưu downsample bị loại vì xấu); giữ mapping thanh cũ trên FFT 256 (bản log-frequency FFT 2048 bị loại) |
| Rain glass | Cửa sổ "Big City" theo color mode Custom Effect (sáng = đúng màu, tối = màu tương phản, gradient từng ô) |
| Shape clock (26–28/09) | Đồng hồ lộ máy (bánh răng không chạm nhau, phủ kín mặt, kính phủ), theo color mode + blur/glow, kim giây chạy mượt; kim chỉ theo cơ chế "Past & Future" (nốt 1–7: <4 lùi, 4 kẹt — kim rung tại chỗ, bánh răng dính; >4 tiến; tốc độ theo BPM); quả lắc (dây có motion blur, độ dài không vượt chiều cao màn, bóng mờ của quả); nền mặt số (mặc định ảnh bìa bài, chọn ảnh thư viện, độ mờ); vạch phút sáng/phóng khi kim giây đi qua. Vòng "time scan" và cơ chế lật/di chuyển riêng đã thử rồi bỏ |
| Connector circuit | 20/09: khối lập phương k×k×k (16–64 nút) lấp từ ngoài vào, mỗi nút theo một dải tần, bắn xung khi dải có onset, đích theo cao độ. **06/10 làm lại**: chip vuông, chân mảnh liền thân trên 4 cạnh (tổng chân = số chip), đường mạch thẳng/góc vuông chân-tới-chân có nút tròn ở chỗ giao, bit đi từ chân và phải vào hẳn chip đích; chân nào bắn kết hợp onset + năng lượng + cao độ; camera 3 chế độ (orbit, bám một luồng bit, nhìn cố định từ ngoài có thanh X/Y/Z + xoay). 07/10: Glow gộp vào bloom (công tắc + cường độ) |
| Connector brain | Thêm 22/09 (port nguyên phần canvas của infographic Brain Filter, rồi chuyển sang color mode chung, sửa tỉ lệ trên màn dọc); **gỡ 01/10**; lựa chọn đã lưu về style khác |
| Connector synapse | **Gỡ 06/10** — group connector chỉ còn `circuit` |

## 4. Auto-switch

- 19/07: sửa select đổi effect vẫn chạy khi Auto-switch đang bật.
- 28/09: rẽ nhánh theo pha (`resolveAutoSwitchSyncPhase()` → `off`/`start`/`resume`/`pause`) bằng `VirtualMachineState`
  trong Workflow — ví dụ chuẩn của event-bus-flow.md mục 7a.

← [v13.md](./v13.md)
