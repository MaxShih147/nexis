#pragma once
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

    // ---- 統一狀態碼（與 core 對齊：成功=0，錯誤為負值） ----
    typedef enum {
        DAO_OK = 0,
        DAO_ERR_BAD_INPUT = -1, // 參數為空或數量<=0
        DAO_ERR_UNSUPPORTED_MODULE = -7, // 要求的牙科模組尚未支援/未實作
        DAO_ERR_INTERNAL = -9  // 其他內部錯誤
    } DaoStatus;

    // ---- 版本 / 初始化 / 記憶體（沿用原設計） ----

    // 版本字串（WASM 記憶體中的 UTF-8、null 結尾）
    const char* dao_version_c();

    // 初始化/釋放（可選）
    DaoStatus dao_init();
    void      dao_shutdown();

    // 提供給 JS 自管線性記憶體（可選）
    void* dao_alloc(uint32_t n_bytes);
    void  dao_free(void* p);

    // ---- Auto-Orientation 對外介面（只有「有模組參數」的版本） ----
    //
    // module 參數（int32）：牙科模組類型
    //   0 = ORTHO（正畸模型；目前已實作）
    //   1 = SPLINT（暫未實作 → 回 DAO_ERR_UNSUPPORTED_MODULE）
    //   2 = SURG_GUIDE（暫未實作）
    //   3 = TEMP_CB（暫未實作）
    //
    // 回傳：XYZ 歐拉角（弧度）到 out_rad3[3]，順序先 X 再 Y 再 Z
    DaoStatus dao_auto_orient_compute_rotation(
        const float* vertices, int32_t num_vertices,
        const uint32_t* indices, int32_t num_indices,
        int32_t        module,
        float          out_rad3[3]
    );

#ifdef __cplusplus
}
#endif
