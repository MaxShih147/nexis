
#include <cstdint>
#include "dao_api.h"

#if defined(__EMSCRIPTEN__)
#  include <emscripten/emscripten.h>
#  define DAO_EXPORT extern "C" EMSCRIPTEN_KEEPALIVE
#else
#  define DAO_EXPORT extern "C"
#endif

// 正畸模組
namespace dao_core {
    int compute_auto_orientation_Orthodontic_mod(
        const float* vertices, int nv,
        const uint32_t* indices, int ntri,
        float out_rad3[3]
    );
}

// 手術導板
int compute_auto_orientation_SurgGuide_mod(
    const float* vertices, int nv,
    const uint32_t* indices, int ntri,
    float out_rad3[3]
);

// Splint（咬合板/牙合墊）
int compute_auto_orientation_Splint_mod(
    const float* vertices, int nv,
    const uint32_t* indices, int ntri,
    float out_rad3[3]
);

// Temp C&B
int compute_auto_orientation_TempCB_mod(
    const float* vertices, int nv,
    const uint32_t* indices, int ntri,
    float out_rad3[3]
);

// 總控
static inline DaoStatus compute_auto_orientation(
    const float* vertices, int32_t num_vertices,
    const uint32_t* indices, int32_t tri_count,
    int32_t module,
    float out_rad3[3]
) {
    if (!vertices || num_vertices <= 0 || !out_rad3) return DAO_ERR_BAD_INPUT;
    const int ntri = (indices && tri_count > 0) ? (int)tri_count : 0;

    switch (module) {
    case 0: // ORTHO
    {
        int rc = dao_core::compute_auto_orientation_Orthodontic_mod(
            vertices, (int)num_vertices, indices, ntri, out_rad3
        );

        return (DaoStatus)rc;
    }
    case 1: // SPLINT
    {
        int rc = compute_auto_orientation_Splint_mod(
            vertices, (int)num_vertices, indices, ntri, out_rad3
        );
        return (DaoStatus)rc;
    }
    case 2: // SURG_GUIDE
    {
        int rc = compute_auto_orientation_SurgGuide_mod(
            vertices, (int)num_vertices, indices, ntri, out_rad3
        );
        return (DaoStatus)rc;
    }
    case 3: // TEMP_CB
    {
        int rc = compute_auto_orientation_TempCB_mod(
            vertices, (int)num_vertices, indices, ntri, out_rad3
        );
        return (DaoStatus)rc;
    }
    default:
        return DAO_ERR_UNSUPPORTED_MODULE;
    }
}

// 對外匯出 API
DAO_EXPORT DaoStatus dao_auto_orient_compute_rotation(
    const float* vertices, int32_t num_vertices,
    const uint32_t* indices, int32_t num_triangles,
    int32_t        module,
    float          out_rad3[3]
) {
    return compute_auto_orientation(vertices, num_vertices, indices, num_triangles, module, out_rad3);
}

int main() { return 0; }

