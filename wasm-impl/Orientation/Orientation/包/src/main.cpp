// main.cpp
// 單一導出：dao_auto_orient_compute_rotation -> 回傳三個弧度 [rx, ry, rz]（XYZ）。不存在任何回傳矩陣 API。

#include <cstdint>
#include "dao_api.h"

#if defined(__EMSCRIPTEN__)
#  include <emscripten/emscripten.h>
#  define DAO_EXPORT extern "C" EMSCRIPTEN_KEEPALIVE
#else
#  define DAO_EXPORT extern "C"
#endif

namespace dao_core {
    // 只回傳 XYZ 弧度
    int compute_auto_orientation_EulerXYZ_mod(
        const float* v, int nv,
        const uint32_t* tri, int ntri,
        int32_t module,
        float out_rad3[3]
    );
}

// 名稱沿用：dao_auto_orient_compute_rotation
// 規格變更：最後一個輸出參數為 float out_rad3[3]，單位為弧度，順序 XYZ（先 X、再 Y、再 Z）
DAO_EXPORT DaoStatus dao_auto_orient_compute_rotation(
    const float* vertices, int32_t vertex_count,
    const uint32_t* indices, int32_t tri_count,
    int32_t        module,
    float          out_rad3[3]
) {
    if (!vertices || vertex_count <= 0 || !out_rad3) return DAO_ERR_BAD_INPUT;

    int rc = dao_core::compute_auto_orientation_EulerXYZ_mod(
        vertices, (int)vertex_count,
        indices, (int)tri_count,
        module,
        out_rad3
    );
    if (rc == DAO_ERR_UNSUPPORTED_MODULE) return (DaoStatus)DAO_ERR_UNSUPPORTED_MODULE;
    return (rc == 0) ? DAO_OK : DAO_ERR_BAD_INPUT;
}

// Emscripten 需要一個 main；native 也可正常編譯
int main() { return 0; }
