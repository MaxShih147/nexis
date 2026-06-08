// auto_orient_temp_cb.cpp
// Temp C&B (臨時牙冠/牙橋) 自動旋轉：
//
// 1) mesh 體素化 → solid_vox
// 2) 在體素空間做近似凸包 hull_vox
// 3) concavity_vox = hull_vox && !solid_vox
// 4) 用 erosion + BFS 切出 cavity components
// 5) 單 cavity / 單顆牙：每個 cavity 用原 mesh 射線估算開口方向 d_open_i（全球方向）
// 6) 體積加權平均，90° 門檻過濾 outlier → d_final，讓開口方向朝 +Z
// 7) 若只有一坨 cavity 且一般方式完全找不到方向，且 cavity 體積很大 → 多顆牙 fallback：
//    - 在 concavity 內取 sample 點
//    - 對一組方向 d_k：對每個 sample 檢查 +d_k、-d_k 是否都被牆堵住
//    - B(d_k) = Σ w_i * [blocked_plus && blocked_minus]
//    - 先在 coarse global dirs 上找 B(d) 最小大方向 d_best
//    - 再在 d_best 附近做 2 輪局部細化搜尋，把 B(d) 再壓低
//    - 最後用 escape 比例決定哪一側為開口方向

#include <cstdint>
#include <cmath>
#include <vector>
#include <queue>
#include <limits>
#include <algorithm>
#include <cstdio>

#include "dao_api.h"
#include "dao_math.h"

using std::uint32_t;
using namespace dao_m;

// -------------------- 小工具 --------------------

static inline Vec3 load_vtx(const float* v, uint32_t idx)
{
    const float* p = v + idx * 3u;
    return v3(p[0], p[1], p[2]);
}

// 把輸入向量 n_in 對齊到 -Z，回傳 XYZ Euler（與手術導板共用邏輯）
static void normal_to_euler_XYZ_align_to_minusZ(const Vec3& n_in, float out_rad3[3])
{
    using std::fabs; using std::atan2; using std::asin; using std::cos;
    using std::sqrt; using std::fmin; using std::fmax; using std::acos;

    const float nx0 = n_in.x, ny0 = n_in.y, nz0 = n_in.z;
    const float L2 = nx0 * nx0 + ny0 * ny0 + nz0 * nz0;
    if (L2 <= 0.0f) {
        out_rad3[0] = out_rad3[1] = out_rad3[2] = 0.0f;
        return;
    }
    const float L = sqrt(L2);
    const float nx = nx0 / L, ny = ny0 / L, nz = nz0 / L;

    if (nz <= -0.999999f) {
        out_rad3[0] = 0.0f; out_rad3[1] = 0.0f; out_rad3[2] = 0.0f;
        return;
    }
    if (nz >= 0.999999f) {
        const float pi = (float)acos(-1.0f);
        out_rad3[0] = 0.0f; out_rad3[1] = pi; out_rad3[2] = 0.0f;
        return;
    }

    float zx = -nx, zy = -ny, zz = -nz;

    float refx = 1.0f, refy = 0.0f, refz = 0.0f;
    if (fabs(nx) > 0.9f && fabs(ny) < 0.5f) { refx = 0.0f; refy = 1.0f; refz = 0.0f; }

    float ndotref = nx * refx + ny * refy + nz * refz;
    float xx = refx - nx * ndotref;
    float xy = refy - ny * ndotref;
    float xz = refz - nz * ndotref;
    float xlen2 = xx * xx + xy * xy + xz * xz;

    if (xlen2 < 1e-12f) {
        refx = (refx == 1.0f) ? 0.0f : 1.0f;
        refy = (refy == 1.0f) ? 0.0f : 0.0f;
        refz = 0.0f;
        ndotref = nx * refx + ny * refy + nz * refz;
        xx = refx - nx * ndotref;
        xy = refy - ny * ndotref;
        xz = refz - nz * ndotref;
        xlen2 = xx * xx + xy * xy + xz * xz;
    }
    float invx = 1.0f / sqrt(xlen2);
    xx *= invx; xy *= invx; xz *= invx;

    float yx = zy * xz - zz * xy;
    float yy = zz * xx - zx * xz;
    float yz = zx * xy - zy * xx;
    float ylen2 = yx * yx + yy * yy + yz * yz;
    float invy = 1.0f / sqrt(fmax(1e-30f, ylen2));
    yx *= invy; yy *= invy; yz *= invy;

    xx = yy * zz - yz * zy;
    xy = yz * zx - yx * zz;
    xz = yx * zy - yy * zx;
    xlen2 = xx * xx + xy * xy + xz * xz;
    invx = 1.0f / sqrt(fmax(1e-30f, xlen2));
    xx *= invx; xy *= invx; xz *= invx;

    const float R00 = xx, R01 = xy, R02 = xz;
    const float R10 = yx, R11 = yy, R12 = yz;
    const float R20 = zx, R21 = zy, R22 = zz;

    float ry = -asin(fmax(-1.0f, fmin(1.0f, R20)));
    float cy = cos(ry);

    float rx, rz;
    if (fabs(cy) > 1e-6f) {
        rx = atan2(R21, R22);
        rz = atan2(R10, R00);
    }
    else {
        rx = 0.0f;
        rz = atan2(-R01, R11);
    }

    out_rad3[0] = rx;
    out_rad3[1] = ry;
    out_rad3[2] = rz;
}

// -------------------- 體素 grid 工具 --------------------

struct VoxelGrid {
    int   N;        // N x N x N
    Vec3  bb_min;   // 體素空間對應的最小座標
    float h;        // voxel 邊長
};

static inline int vIdx(int N, int x, int y, int z)
{
    return (z * N + y) * N + x;
}

static inline Vec3 voxel_center(const VoxelGrid& vg, int x, int y, int z)
{
    return v3(
        vg.bb_min.x + (x + 0.5f) * vg.h,
        vg.bb_min.y + (y + 0.5f) * vg.h,
        vg.bb_min.z + (z + 0.5f) * vg.h
    );
}

// -------------------- mesh → voxel --------------------

static void build_voxel_grid_from_aabb(
    const Vec3& bb_min,
    const Vec3& bb_max,
    int         N,
    VoxelGrid& out_vg
)
{
    float ex = bb_max.x - bb_min.x;
    float ey = bb_max.y - bb_min.y;
    float ez = bb_max.z - bb_min.z;
    float maxE = std::max(ex, std::max(ey, ez));
    if (maxE <= 0.0f) maxE = 1.0f;

    float h = maxE / (float)(N - 2);
    float cx = 0.5f * (bb_min.x + bb_max.x);
    float cy = 0.5f * (bb_min.y + bb_max.y);
    float cz = 0.5f * (bb_min.z + bb_max.z);
    float half = 0.5f * maxE;

    Vec3 vg_min = v3(cx - half - h, cy - half - h, cz - half - h);

    out_vg.N = N;
    out_vg.bb_min = vg_min;
    out_vg.h = h;
}

// 簡單 barycentric 測試：假設 p 已經在三角形平面附近
static bool point_in_tri_projection(const Vec3& p, const Vec3& a, const Vec3& b, const Vec3& c)
{
    Vec3 v0 = v3(b.x - a.x, b.y - a.y, b.z - a.z);
    Vec3 v1 = v3(c.x - a.x, c.y - a.y, c.z - a.z);
    Vec3 v2 = v3(p.x - a.x, p.y - a.y, p.z - a.z);

    float d00 = dot(v0, v0);
    float d01 = dot(v0, v1);
    float d11 = dot(v1, v1);
    float d20 = dot(v2, v0);
    float d21 = dot(v2, v1);
    float denom = d00 * d11 - d01 * d01;
    if (std::fabs(denom) < 1e-12f) return false;
    float invDen = 1.0f / denom;
    float v = (d11 * d20 - d01 * d21) * invDen;
    float w = (d00 * d21 - d01 * d20) * invDen;
    float u = 1.0f - v - w;
    return (u >= -1e-3f && v >= -1e-3f && w >= -1e-3f);
}

// 粗略 raster + inside 填滿
static void rasterize_triangles_to_voxels(
    const float* vertices, int nv,
    const uint32_t* indices, int ntri,
    const VoxelGrid& vg,
    std::vector<uint8_t>& solid // 0/1
)
{
    const int N = vg.N;
    const int total = N * N * N;
    solid.assign((size_t)total, 0);

    if (!vertices || nv <= 0 || !indices || ntri <= 0) return;

    for (int t = 0; t < ntri; ++t) {
        uint32_t i0 = indices[t * 3 + 0];
        uint32_t i1 = indices[t * 3 + 1];
        uint32_t i2 = indices[t * 3 + 2];
        if (i0 >= (uint32_t)nv || i1 >= (uint32_t)nv || i2 >= (uint32_t)nv) continue;

        Vec3 a = load_vtx(vertices, i0);
        Vec3 b = load_vtx(vertices, i1);
        Vec3 c = load_vtx(vertices, i2);

        float minx = std::min(a.x, std::min(b.x, c.x));
        float miny = std::min(a.y, std::min(b.y, c.y));
        float minz = std::min(a.z, std::min(b.z, c.z));
        float maxx = std::max(a.x, std::max(b.x, c.x));
        float maxy = std::max(a.y, std::max(b.y, c.y));
        float maxz = std::max(a.z, std::max(b.z, c.z));

        int ix0 = (int)std::floor((minx - vg.bb_min.x) / vg.h) - 1;
        int iy0 = (int)std::floor((miny - vg.bb_min.y) / vg.h) - 1;
        int iz0 = (int)std::floor((minz - vg.bb_min.z) / vg.h) - 1;
        int ix1 = (int)std::floor((maxx - vg.bb_min.x) / vg.h) + 1;
        int iy1 = (int)std::floor((maxy - vg.bb_min.y) / vg.h) + 1;
        int iz1 = (int)std::floor((maxz - vg.bb_min.z) / vg.h) + 1;

        ix0 = std::max(ix0, 0);      ix1 = std::min(ix1, N - 1);
        iy0 = std::max(iy0, 0);      iy1 = std::min(iy1, N - 1);
        iz0 = std::max(iz0, 0);      iz1 = std::min(iz1, N - 1);

        for (int z = iz0; z <= iz1; ++z) {
            for (int y = iy0; y <= iy1; ++y) {
                for (int x = ix0; x <= ix1; ++x) {
                    int idx = vIdx(N, x, y, z);
                    if (solid[(size_t)idx]) continue;
                    Vec3 pc = voxel_center(vg, x, y, z);
                    if (point_in_tri_projection(pc, a, b, c)) {
                        solid[(size_t)idx] = 1; // 表面
                    }
                }
            }
        }
    }

    std::vector<uint8_t> outside((size_t)total, 0);
    std::queue<int> q;

    auto push_if = [&](int x, int y, int z) {
        if (x < 0 || x >= N || y < 0 || y >= N || z < 0 || z >= N) return;
        int idx = vIdx(N, x, y, z);
        if (solid[(size_t)idx]) return;
        if (outside[(size_t)idx]) return;
        outside[(size_t)idx] = 1;
        q.push(idx);
        };

    // 從邊界開始標記外部空氣
    for (int z = 0; z < N; ++z) {
        for (int y = 0; y < N; ++y) {
            push_if(0, y, z);
            push_if(N - 1, y, z);
        }
    }
    for (int z = 0; z < N; ++z) {
        for (int x = 0; x < N; ++x) {
            push_if(x, 0, z);
            push_if(x, N - 1, z);
        }
    }
    for (int y = 0; y < N; ++y) {
        for (int x = 0; x < N; ++x) {
            push_if(x, y, 0);
            push_if(x, y, N - 1);
        }
    }

    while (!q.empty()) {
        int idx = q.front(); q.pop();
        int z = idx / (N * N);
        int rem = idx % (N * N);
        int y = rem / N;
        int x = rem % N;

        push_if(x + 1, y, z);
        push_if(x - 1, y, z);
        push_if(x, y + 1, z);
        push_if(x, y - 1, z);
        push_if(x, y, z + 1);
        push_if(x, y, z - 1);
    }

    // 內部 = 非外部且非 surface 的空格，全設為 solid
    for (int i = 0; i < total; ++i) {
        if (!solid[(size_t)i] && !outside[(size_t)i]) {
            solid[(size_t)i] = 1;
        }
    }
}

// -------------------- voxel 凸包 --------------------

static void build_hull_vox(
    const VoxelGrid& vg,
    const std::vector<uint8_t>& solid,
    std::vector<uint8_t>& hull
)
{
    const int N = vg.N;
    const int total = N * N * N;
    hull.assign((size_t)total, 0);

    std::vector<Vec3> dirs;
    dirs.reserve(26);
    for (int dx = -1; dx <= 1; ++dx) {
        for (int dy = -1; dy <= 1; ++dy) {
            for (int dz = -1; dz <= 1; ++dz) {
                if (dx == 0 && dy == 0 && dz == 0) continue;
                Vec3 v = v3((float)dx, (float)dy, (float)dz);
                v = normalize(v);
                dirs.push_back(v);
            }
        }
    }
    const int K = (int)dirs.size();

    std::vector<float> tmax((size_t)K, -std::numeric_limits<float>::infinity());

    for (int z = 0; z < N; ++z) {
        for (int y = 0; y < N; ++y) {
            for (int x = 0; x < N; ++x) {
                int idx = vIdx(N, x, y, z);
                if (!solid[(size_t)idx]) continue;
                Vec3 pc = voxel_center(vg, x, y, z);
                for (int k = 0; k < K; ++k) {
                    float t = dot(pc, dirs[(size_t)k]);
                    if (t > tmax[(size_t)k]) tmax[(size_t)k] = t;
                }
            }
        }
    }

    const float eps = vg.h * 1.5f;

    for (int z = 0; z < N; ++z) {
        for (int y = 0; y < N; ++y) {
            for (int x = 0; x < N; ++x) {
                int idx = vIdx(N, x, y, z);
                if (solid[(size_t)idx]) {
                    hull[(size_t)idx] = 1;
                    continue;
                }
                Vec3 pc = voxel_center(vg, x, y, z);
                bool insideAll = true;
                for (int k = 0; k < K; ++k) {
                    float t = dot(pc, dirs[(size_t)k]);
                    if (t > tmax[(size_t)k] + eps) {
                        insideAll = false;
                        break;
                    }
                }
                if (insideAll) hull[(size_t)idx] = 1;
            }
        }
    }
}

// -------------------- concavity component with erosion split --------------------

struct CavityComp {
    int   id;
    int   voxelCount;
    Vec3  center;
};

// 6-neighbor erosion: 只有當自己與 6 個鄰居都是 1 才保留
static void erode_6(
    const VoxelGrid& vg,
    const std::vector<uint8_t>& in,
    std::vector<uint8_t>& out
)
{
    const int N = vg.N;
    const int total = N * N * N;
    out.assign((size_t)total, 0);

    auto idxValid = [&](int x, int y, int z) {
        return (x >= 0 && x < N && y >= 0 && y < N && z >= 0 && z < N);
        };

    const int dx[6] = { 1, -1, 0, 0, 0, 0 };
    const int dy[6] = { 0, 0, 1, -1, 0, 0 };
    const int dz[6] = { 0, 0, 0, 0, 1, -1 };

    for (int z = 0; z < N; ++z) {
        for (int y = 0; y < N; ++y) {
            for (int x = 0; x < N; ++x) {
                int idx = vIdx(N, x, y, z);
                if (!in[(size_t)idx]) continue;
                bool keep = true;
                for (int k = 0; k < 6; ++k) {
                    int nx = x + dx[k];
                    int ny = y + dy[k];
                    int nz = z + dz[k];
                    if (!idxValid(nx, ny, nz)) { keep = false; break; }
                    int nidx = vIdx(N, nx, ny, nz);
                    if (!in[(size_t)nidx]) { keep = false; break; }
                }
                if (keep) out[(size_t)idx] = 1;
            }
        }
    }
}

// 在 concavity 上做一次 erosion 得到 core，先在 core 上分群，然後回填到 concavity
static void extract_cavity_components(
    const VoxelGrid& vg,
    const std::vector<uint8_t>& solid,
    const std::vector<uint8_t>& hull,
    std::vector<CavityComp>& out_cavities
)
{
    const int N = vg.N;
    const int total = N * N * N;

    std::vector<uint8_t> concavity((size_t)total, 0);
    for (int i = 0; i < total; ++i) {
        concavity[(size_t)i] = (hull[(size_t)i] && !solid[(size_t)i]) ? 1 : 0;
    }

    // erosion 取得 core
    std::vector<uint8_t> core;
    erode_6(vg, concavity, core);

    bool hasCore = false;
    for (int i = 0; i < total; ++i) {
        if (core[(size_t)i]) { hasCore = true; break; }
    }

    const int MIN_CAVITY_VOXELS = 32;
    out_cavities.clear();

    auto idxValid = [&](int x, int y, int z) {
        return (x >= 0 && x < N && y >= 0 && y < N && z >= 0 && z < N);
        };

    if (!hasCore) {
        // 沒有 core，退回原本 concavity 直接分群
        std::vector<int> compId((size_t)total, -1);
        std::queue<int> q;
        int currentId = 0;

        auto push_if = [&](int x, int y, int z) {
            if (!idxValid(x, y, z)) return;
            int idx = vIdx(N, x, y, z);
            if (!concavity[(size_t)idx]) return;
            if (compId[(size_t)idx] != -1) return;
            compId[(size_t)idx] = currentId;
            q.push(idx);
            };

        for (int z = 0; z < N; ++z) {
            for (int y = 0; y < N; ++y) {
                for (int x = 0; x < N; ++x) {
                    int idx = vIdx(N, x, y, z);
                    if (!concavity[(size_t)idx]) continue;
                    if (compId[(size_t)idx] != -1) continue;

                    CavityComp cc;
                    cc.id = currentId;
                    cc.voxelCount = 0;
                    cc.center = v3(0.0f, 0.0f, 0.0f);

                    compId[(size_t)idx] = currentId;
                    q.push(idx);

                    while (!q.empty()) {
                        int cur = q.front(); q.pop();
                        int zz = cur / (N * N);
                        int rem = cur % (N * N);
                        int yy = rem / N;
                        int xx = rem % N;

                        Vec3 pc = voxel_center(vg, xx, yy, zz);
                        cc.center.x += pc.x;
                        cc.center.y += pc.y;
                        cc.center.z += pc.z;
                        cc.voxelCount++;

                        push_if(xx + 1, yy, zz);
                        push_if(xx - 1, yy, zz);
                        push_if(xx, yy + 1, zz);
                        push_if(xx, yy - 1, zz);
                        push_if(xx, yy, zz + 1);
                        push_if(xx, yy, zz - 1);
                    }

                    if (cc.voxelCount >= MIN_CAVITY_VOXELS) {
                        float inv = 1.0f / (float)cc.voxelCount;
                        cc.center.x *= inv;
                        cc.center.y *= inv;
                        cc.center.z *= inv;
                        out_cavities.push_back(cc);
                    }

                    currentId++;
                }
            }
        }
        return;
    }

    // 有 core: 先在 core 上分群
    std::vector<int> coreId((size_t)total, -1);
    std::queue<int> q;
    int currentCoreId = 0;

    auto idxValidCore = [&](int x, int y, int z) {
        return (x >= 0 && x < N && y >= 0 && y < N && z >= 0 && z < N);
        };

    auto push_core_if = [&](int x, int y, int z) {
        if (!idxValidCore(x, y, z)) return;
        int idx = vIdx(N, x, y, z);
        if (!core[(size_t)idx]) return;
        if (coreId[(size_t)idx] != -1) return;
        coreId[(size_t)idx] = currentCoreId;
        q.push(idx);
        };

    std::vector<int> coreSeeds; // 每個 core 的一個種子 index
    for (int z = 0; z < N; ++z) {
        for (int y = 0; y < N; ++y) {
            for (int x = 0; x < N; ++x) {
                int idx = vIdx(N, x, y, z);
                if (!core[(size_t)idx]) continue;
                if (coreId[(size_t)idx] != -1) continue;

                coreSeeds.push_back(idx);

                coreId[(size_t)idx] = currentCoreId;
                q.push(idx);

                while (!q.empty()) {
                    int cur = q.front(); q.pop();
                    int zz = cur / (N * N);
                    int rem = cur % (N * N);
                    int yy = rem / N;
                    int xx = rem % N;

                    push_core_if(xx + 1, yy, zz);
                    push_core_if(xx - 1, yy, zz);
                    push_core_if(xx, yy + 1, zz);
                    push_core_if(xx, yy - 1, zz);
                    push_core_if(xx, yy, zz + 1);
                    push_core_if(xx, yy, zz - 1);
                }

                currentCoreId++;
            }
        }
    }

    int numCore = currentCoreId;
    if (numCore <= 0) {
        return;
    }

    // 從每個 core component 的種子出發，在 concavity 中擴張成 cavity
    std::vector<int> cavId((size_t)total, -1);
    int currentCavId = 0;

    auto idxValidCav = [&](int x, int y, int z) {
        return (x >= 0 && x < N && y >= 0 && y < N && z >= 0 && z < N);
        };

    for (int cid = 0; cid < numCore; ++cid) {
        int seedIdx = coreSeeds[(size_t)cid];

        CavityComp cc;
        cc.id = currentCavId;
        cc.voxelCount = 0;
        cc.center = v3(0.0f, 0.0f, 0.0f);

        q.push(seedIdx);
        cavId[(size_t)seedIdx] = currentCavId;

        while (!q.empty()) {
            int cur = q.front(); q.pop();
            int zz = cur / (N * N);
            int rem = cur % (N * N);
            int yy = rem / N;
            int xx = rem % N;

            Vec3 pc = voxel_center(vg, xx, yy, zz);
            cc.center.x += pc.x;
            cc.center.y += pc.y;
            cc.center.z += pc.z;
            cc.voxelCount++;

            auto push_cav_if = [&](int x, int y, int z) {
                if (!idxValidCav(x, y, z)) return;
                int idx = vIdx(N, x, y, z);
                if (!concavity[(size_t)idx]) return;
                if (cavId[(size_t)idx] != -1) return;
                cavId[(size_t)idx] = currentCavId;
                q.push(idx);
                };

            push_cav_if(xx + 1, yy, zz);
            push_cav_if(xx - 1, yy, zz);
            push_cav_if(xx, yy + 1, zz);
            push_cav_if(xx, yy - 1, zz);
            push_cav_if(xx, yy, zz + 1);
            push_cav_if(xx, yy, zz - 1);
        }

        if (cc.voxelCount >= MIN_CAVITY_VOXELS) {
            float inv = 1.0f / (float)cc.voxelCount;
            cc.center.x *= inv;
            cc.center.y *= inv;
            cc.center.z *= inv;
            out_cavities.push_back(cc);
        }

        currentCavId++;
    }
}

// -------------------- ray / mesh 相交（單顆牙用） --------------------

static bool ray_intersect_triangle(
    const Vec3& orig,
    const Vec3& dir,
    const Vec3& v0,
    const Vec3& v1,
    const Vec3& v2,
    float& out_t
)
{
    const float EPS = 1e-6f;
    Vec3 e1 = v3(v1.x - v0.x, v1.y - v0.y, v1.z - v0.z);
    Vec3 e2 = v3(v2.x - v0.x, v2.y - v0.y, v2.z - v0.z);
    Vec3 pvec = cross(dir, e2);
    float det = dot(e1, pvec);
    if (det > -EPS && det < EPS) return false;
    float invDet = 1.0f / det;

    Vec3 tvec = v3(orig.x - v0.x, orig.y - v0.y, orig.z - v0.z);
    float u = dot(tvec, pvec) * invDet;
    if (u < -1e-5f || u > 1.0f + 1e-5f) return false;

    Vec3 qvec = cross(tvec, e1);
    float v = dot(dir, qvec) * invDet;
    if (v < -1e-5f || u + v > 1.0f + 1e-5f) return false;

    float t = dot(e2, qvec) * invDet;
    if (t <= EPS) return false;

    out_t = t;
    return true;
}

// -------------------- 一般模式用：全球方向求 cavity 開口 --------------------

// 全局方向的射線集合
static void build_global_dirs(std::vector<Vec3>& dirs)
{
    dirs.clear();
    dirs.reserve(128);
    for (int ix = -2; ix <= 2; ++ix) {
        for (int iy = -2; iy <= 2; ++iy) {
            for (int iz = -2; iz <= 2; ++iz) {
                if (ix == 0 && iy == 0 && iz == 0) continue;
                Vec3 v = v3((float)ix, (float)iy, (float)iz);
                float len = norm(v);
                if (len < 1e-5f) continue;
                v = v3(v.x / len, v.y / len, v.z / len);
                dirs.push_back(v);
            }
        }
    }
}

// 從一個點出發，沿全球多方向對 mesh 射線，找開口方向（單 cavity / 單顆牙用）
static void estimate_open_direction_from_point(
    const float* vertices, int nv,
    const uint32_t* indices, int ntri,
    const Vec3& origin,
    const Vec3&    /*prior_dir*/,
    Vec3& out_dir,
    bool& out_valid
)
{
    out_valid = false;
    out_dir = v3(0.0f, 0.0f, 0.0f);

    if (!vertices || nv <= 0 || !indices || ntri <= 0) return;

    Vec3 bb_min, bb_max;
    aabb_min_max(vertices, nv, bb_min, bb_max);
    float dx = bb_max.x - bb_min.x;
    float dy = bb_max.y - bb_min.y;
    float dz = bb_max.z - bb_min.z;
    float maxE = std::max(dx, std::max(dy, dz));
    float max_t = maxE * 4.0f;

    std::vector<Vec3> dirs;
    build_global_dirs(dirs);
    if (dirs.empty()) return;

    Vec3 sum_open = v3(0.0f, 0.0f, 0.0f);
    int  cnt_open = 0;

    for (const Vec3& ddir : dirs) {
        float nearest_t = max_t;
        bool  hit_any = false;

        for (int t = 0; t < ntri; ++t) {
            uint32_t i0 = indices[t * 3 + 0];
            uint32_t i1 = indices[t * 3 + 1];
            uint32_t i2 = indices[t * 3 + 2];
            if (i0 >= (uint32_t)nv || i1 >= (uint32_t)nv || i2 >= (uint32_t)nv) continue;
            Vec3 v0 = load_vtx(vertices, i0);
            Vec3 v1 = load_vtx(vertices, i1);
            Vec3 v2 = load_vtx(vertices, i2);
            float thit;
            if (ray_intersect_triangle(origin, ddir, v0, v1, v2, thit)) {
                if (thit < nearest_t) {
                    nearest_t = thit;
                    hit_any = true;
                }
            }
        }

        if (!hit_any) {
            sum_open.x += ddir.x;
            sum_open.y += ddir.y;
            sum_open.z += ddir.z;
            cnt_open++;
        }
    }

    if (cnt_open <= 0) {
        return;
    }
    float len = norm(sum_open);
    if (len <= 1e-6f) {
        return;
    }
    out_dir = v3(sum_open.x / len, sum_open.y / len, sum_open.z / len);
    out_valid = true;
}

// 對 concavity 做三軸「連通列」過濾：
// 若在某一軸上，一整條 (固定另外兩軸) 的列完全沒有 solid，
// 則該列上所有 concavity 體素都移除。
// 這對「完全外部的開放凹槽」很有效，可減少雜訊。
static void filter_concavity_by_solid_columns(
    const VoxelGrid& vg,
    const std::vector<uint8_t>& solid,
    std::vector<uint8_t>& concavity
)
{
    const int N = vg.N;
    auto idx = [&](int x, int y, int z) {
        return vIdx(N, x, y, z);
        };

    // ---- X 軸列：固定 (y,z)，沿 x 看有沒有 solid ----
    for (int z = 0; z < N; ++z) {
        for (int y = 0; y < N; ++y) {
            bool hasSolid = false;
            for (int x = 0; x < N; ++x) {
                int id = idx(x, y, z);
                if (solid[(size_t)id]) {
                    hasSolid = true;
                    break;
                }
            }
            if (!hasSolid) {
                // 整列沒有 solid → 此列上的 concavity 全部刪除
                for (int x = 0; x < N; ++x) {
                    int id = idx(x, y, z);
                    concavity[(size_t)id] = 0;
                }
            }
        }
    }

    // ---- Y 軸列：固定 (x,z)，沿 y 看有無 solid ----
    for (int z = 0; z < N; ++z) {
        for (int x = 0; x < N; ++x) {
            bool hasSolid = false;
            for (int y = 0; y < N; ++y) {
                int id = idx(x, y, z);
                if (solid[(size_t)id]) {
                    hasSolid = true;
                    break;
                }
            }
            if (!hasSolid) {
                for (int y = 0; y < N; ++y) {
                    int id = idx(x, y, z);
                    concavity[(size_t)id] = 0;
                }
            }
        }
    }

    // ---- Z 軸列：固定 (x,y)，沿 z 看有無 solid ----
    for (int y = 0; y < N; ++y) {
        for (int x = 0; x < N; ++x) {
            bool hasSolid = false;
            for (int z = 0; z < N; ++z) {
                int id = idx(x, y, z);
                if (solid[(size_t)id]) {
                    hasSolid = true;
                    break;
                }
            }
            if (!hasSolid) {
                for (int z = 0; z < N; ++z) {
                    int id = idx(x, y, z);
                    concavity[(size_t)id] = 0;
                }
            }
        }
    }
}


// -------------------- 多顆牙 fallback：B(d) 最小方向 + 局部細化 --------------------

static void build_concavity_vox(
    const VoxelGrid& vg,
    const std::vector<uint8_t>& solid,
    const std::vector<uint8_t>& hull,
    std::vector<uint8_t>& concavity
)
{
    const int total = vg.N * vg.N * vg.N;
    concavity.assign((size_t)total, 0);
    for (int i = 0; i < total; ++i) {
        concavity[(size_t)i] = (hull[(size_t)i] && !solid[(size_t)i]) ? 1 : 0;
    }
}

// voxel 空間內，從 origin 沿 dir 前進，判斷：
// - 是否被 solid 擋住（blocked）
// - 是否能逃出 hull / bbox（escape）
static void ray_block_or_escape_in_voxels(
    const VoxelGrid& vg,
    const std::vector<uint8_t>& solid,
    const std::vector<uint8_t>& hull,
    const Vec3& origin,
    const Vec3& dir,
    bool& out_blocked,
    bool& out_escape
)
{
    const int N = vg.N;
    out_blocked = false;
    out_escape = false;

    auto idxValid = [&](int x, int y, int z) {
        return (x >= 0 && x < N && y >= 0 && y < N && z >= 0 && z < N);
        };

    const float step_len = vg.h * 0.5f;
    const int   max_steps = N * 2;

    Vec3 p = origin;
    for (int s = 0; s < max_steps; ++s) {
        p.x += dir.x * step_len;
        p.y += dir.y * step_len;
        p.z += dir.z * step_len;

        float fx = (p.x - vg.bb_min.x) / vg.h;
        float fy = (p.y - vg.bb_min.y) / vg.h;
        float fz = (p.z - vg.bb_min.z) / vg.h;
        int ix = (int)std::floor(fx);
        int iy = (int)std::floor(fy);
        int iz = (int)std::floor(fz);

        if (!idxValid(ix, iy, iz)) {
            out_escape = true;
            return;
        }
        int idx = vIdx(N, ix, iy, iz);
        if (!hull[(size_t)idx]) {
            out_escape = true;
            return;
        }
        if (solid[(size_t)idx]) {
            out_blocked = true;
            return;
        }
    }

    out_blocked = true;
}

// 多顆牙 sample 結構
struct MT_Sample {
    Vec3 pos;
    int  dist;
    int  idx;
};

// 計算單一方向 d 的 B(d)：對所有 sample 檢查雙向是否都被擋住
static float compute_B_for_dir_voxels(
    const VoxelGrid& vg,
    const std::vector<uint8_t>& solid,
    const std::vector<uint8_t>& hull,
    const std::vector<MT_Sample>& samples,
    const Vec3& d
)
{
    float acc = 0.0f;
    for (const auto& s : samples) {
        bool block_p = false, esc_p = false;
        bool block_m = false, esc_m = false;

        ray_block_or_escape_in_voxels(vg, solid, hull, s.pos, d, block_p, esc_p);
        ray_block_or_escape_in_voxels(vg, solid, hull, s.pos, v3(-d.x, -d.y, -d.z), block_m, esc_m);

        if (block_p && block_m) {
            float w = (float)(s.dist + 1);
            acc += w;
        }
    }
    return acc;
}

// 在 d_init 周圍作局部細化搜尋 B(d) 最小方向
static Vec3 refine_direction_local_B(
    const VoxelGrid& vg,
    const std::vector<uint8_t>& solid,
    const std::vector<uint8_t>& hull,
    const std::vector<MT_Sample>& samples,
    const Vec3& d_init,
    int                           iters
)
{
    Vec3 d_best = d_init;
    if (norm(d_best) < 1e-6f) return d_best;
    d_best = normalize(d_best);

    float B_best = compute_B_for_dir_voxels(vg, solid, hull, samples, d_best);

    for (int it = 0; it < iters; ++it) {
        // 建局部正交基底
        Vec3 r = v3(1.0f, 0.0f, 0.0f);
        if (std::fabs(dot(r, d_best)) > 0.9f) {
            r = v3(0.0f, 1.0f, 0.0f);
        }
        Vec3 u = cross(d_best, r);
        if (norm(u) < 1e-6f) continue;
        u = normalize(u);
        Vec3 v = cross(d_best, u);
        if (norm(v) < 1e-6f) continue;
        v = normalize(v);

        // 本輪擾動角度（度數→弧度）
        float base_deg = 25.0f;
        float angle_deg = base_deg * std::pow(0.5f, (float)it); // 25, 12.5, ...
        float angle_rad = angle_deg * (float)M_PI / 180.0f;
        float eps = std::sin(angle_rad); // 小角度近似 perturb 強度

        // 以 d_best 為中心，取一圈候選方向
        static const int OFFS[8][2] = {
            { 1, 0}, {-1, 0},
            { 0, 1}, { 0,-1},
            { 1, 1}, {-1, 1},
            { 1,-1}, {-1,-1}
        };

        Vec3 local_best = d_best;
        float local_B = B_best;

        for (int k = 0; k < 8; ++k) {
            int ax = OFFS[k][0];
            int ay = OFFS[k][1];

            Vec3 offset = v3(
                (float)ax * u.x + (float)ay * v.x,
                (float)ax * u.y + (float)ay * v.y,
                (float)ax * u.z + (float)ay * v.z
            );
            if (norm(offset) < 1e-6f) continue;
            offset = normalize(offset);

            Vec3 cand = v3(
                d_best.x + eps * offset.x,
                d_best.y + eps * offset.y,
                d_best.z + eps * offset.z
            );
            if (norm(cand) < 1e-6f) continue;
            cand = normalize(cand);

            float B_cand = compute_B_for_dir_voxels(vg, solid, hull, samples, cand);
            if (B_cand < local_B) {
                local_B = B_cand;
                local_best = cand;
            }
        }

        d_best = local_best;
        B_best = local_B;
    }

    return d_best;
}

// 利用 concavity 的距離場 + 簡單 NMS，估算「牙中空間種子」的數量
// 僅用來判斷是「多顆牙」還是「單顆牙」，不算方向。
static int estimate_concavity_seed_count(
    const VoxelGrid& vg,
    const std::vector<uint8_t>& solid,
    const std::vector<uint8_t>& hull
)
{
    const int N = vg.N;
    const int total = N * N * N;

    // 1) concavity mask
    std::vector<uint8_t> concavity;
    build_concavity_vox(vg, solid, hull, concavity);
    filter_concavity_by_solid_columns(vg, solid, concavity);

    int concavityCount = 0;
    for (int i = 0; i < total; ++i) {
        if (concavity[(size_t)i]) concavityCount++;
    }
    if (concavityCount == 0) return 0;

    auto idxValid = [&](int x, int y, int z) {
        return (x >= 0 && x < N && y >= 0 && y < N && z >= 0 && z < N);
        };

    const int dx6[6] = { 1, -1, 0, 0, 0, 0 };
    const int dy6[6] = { 0, 0, 1, -1, 0, 0 };
    const int dz6[6] = { 0, 0, 0, 0, 1, -1 };

    // 2) 距離場：從 concavity 邊界往內 BFS
    const int INF = 1000000000;
    std::vector<int> dist((size_t)total, INF);
    std::queue<int> q;

    int boundaryCount = 0;
    for (int z = 0; z < N; ++z) {
        for (int y = 0; y < N; ++y) {
            for (int x = 0; x < N; ++x) {
                int idx = vIdx(N, x, y, z);
                if (!concavity[(size_t)idx]) continue;

                bool isBoundary = false;
                for (int k = 0; k < 6; ++k) {
                    int nx = x + dx6[k];
                    int ny = y + dy6[k];
                    int nz = z + dz6[k];
                    if (!idxValid(nx, ny, nz)) {
                        isBoundary = true;
                        break;
                    }
                    int nidx = vIdx(N, nx, ny, nz);
                    if (!concavity[(size_t)nidx]) {
                        isBoundary = true;
                        break;
                    }
                }
                if (isBoundary) {
                    dist[(size_t)idx] = 0;
                    q.push(idx);
                    boundaryCount++;
                }
            }
        }
    }

    if (boundaryCount == 0) return 0;

    while (!q.empty()) {
        int idx = q.front(); q.pop();
        int z = idx / (N * N);
        int rem = idx % (N * N);
        int y = rem / N;
        int x = rem % N;
        int dcur = dist[(size_t)idx];

        for (int k = 0; k < 6; ++k) {
            int nx = x + dx6[k];
            int ny = y + dy6[k];
            int nz = z + dz6[k];
            if (!idxValid(nx, ny, nz)) continue;
            int nidx = vIdx(N, nx, ny, nz);
            if (!concavity[(size_t)nidx]) continue;
            if (dist[(size_t)nidx] > dcur + 1) {
                dist[(size_t)nidx] = dcur + 1;
                q.push(nidx);
            }
        }
    }

    // 3) 找距離場 local max
    struct Peak {
        int x, y, z;
        int d;
    };
    std::vector<Peak> peaks;

    const int D_PEAK_MIN = 3; // 至少離邊界 3 層
    for (int z = 0; z < N; ++z) {
        for (int y = 0; y < N; ++y) {
            for (int x = 0; x < N; ++x) {
                int idx = vIdx(N, x, y, z);
                if (!concavity[(size_t)idx]) continue;
                int d = dist[(size_t)idx];
                if (d < D_PEAK_MIN || d >= INF) continue;

                bool isLocalMax = true;
                for (int k = 0; k < 6; ++k) {
                    int nx = x + dx6[k];
                    int ny = y + dy6[k];
                    int nz = z + dz6[k];
                    if (!idxValid(nx, ny, nz)) continue;
                    int nidx = vIdx(N, nx, ny, nz);
                    if (!concavity[(size_t)nidx]) continue;
                    int nd = dist[(size_t)nidx];
                    if (nd > d) {
                        isLocalMax = false;
                        break;
                    }
                }
                if (isLocalMax) {
                    peaks.push_back(Peak{ x, y, z, d });
                }
            }
        }
    }

    if (peaks.empty()) return 0;

    // 4) 依距離大小排序 + NMS，估算「獨立山頭」數量
    std::sort(peaks.begin(), peaks.end(), [](const Peak& a, const Peak& b) {
        return a.d > b.d;
        });

    std::vector<Peak> seeds;
    const float MIN_SEED_GRID_DIST = 4.0f;
    const float MIN_SEED_GRID_DIST2 = MIN_SEED_GRID_DIST * MIN_SEED_GRID_DIST;
    const int   MAX_SEEDS = 32; // 這裡只用來判斷多顆牙，不會用來算方向

    for (const Peak& p : peaks) {
        bool tooClose = false;
        for (const Peak& s : seeds) {
            float dx = (float)p.x - (float)s.x;
            float dy = (float)p.y - (float)s.y;
            float dz = (float)p.z - (float)s.z;
            float r2 = dx * dx + dy * dy + dz * dz;
            if (r2 < MIN_SEED_GRID_DIST2) {
                tooClose = true;
                break;
            }
        }
        if (!tooClose) {
            seeds.push_back(p);
            if ((int)seeds.size() >= MAX_SEEDS) break;
        }
    }

    return (int)seeds.size();
}


// 多顆牙 fallback：
// 1) concavity 的距離場找「深部的局部峰值」作為牙中空間候選點（seeds）
// 2) 用 voxel 射線的「出口模式」過濾掉大通道 / 牙縫
// 3) 對留下的種子用單顆牙演算法 estimate_open_direction_from_point() 算開口方向
// 4) 若完全沒有種子通過出口測試，則從所有 seeds 中挑出 escape_ratio / two_side_ratio 較小的幾顆「次佳種子」
//    強制套用單顆牙演算法，避免像弧形多牙那種情況全部被踢光。
// 多顆牙 fallback：利用 concavity 距離場 + voxel ray 找代表性的 seed，
// 然後只對「分數最好的少數 seed」跑一次 mesh 版 estimate_open_direction_from_point。
static bool multi_tooth_fallback_direction(
    const VoxelGrid& vg,
    const std::vector<uint8_t>& solid,
    const std::vector<uint8_t>& hull,
    const float* vertices, int nv,
    const uint32_t* indices, int ntri,
    const Vec3& C_all,
    Vec3& out_dir
)
{
    const int N = vg.N;
    const int total = N * N * N;

    auto idxValid = [&](int x, int y, int z) {
        return (x >= 0 && x < N && y >= 0 && y < N && z >= 0 && z < N);
        };

    const int dx6[6] = { 1, -1, 0, 0, 0, 0 };
    const int dy6[6] = { 0, 0, 1, -1, 0, 0 };
    const int dz6[6] = { 0, 0, 0, 0, 1, -1 };

    // ---- 建 concavity + 前處理 ----
    std::vector<uint8_t> concavity;
    build_concavity_vox(vg, solid, hull, concavity);
    filter_concavity_by_solid_columns(vg, solid, concavity);

    int concavityCount = 0;
    for (int i = 0; i < total; ++i) {
        if (concavity[(size_t)i]) concavityCount++;
    }
    if (concavityCount == 0) return false;

    // ---- 距離場：從 concavity 邊界往內 BFS ----
    const int INF = 1000000000;
    std::vector<int> dist((size_t)total, INF);
    std::queue<int> q;

    int boundaryCount = 0;
    for (int z = 0; z < N; ++z) {
        for (int y = 0; y < N; ++y) {
            for (int x = 0; x < N; ++x) {
                int idx = vIdx(N, x, y, z);
                if (!concavity[(size_t)idx]) continue;

                bool isBoundary = false;
                for (int k = 0; k < 6; ++k) {
                    int nx = x + dx6[k];
                    int ny = y + dy6[k];
                    int nz = z + dz6[k];
                    if (!idxValid(nx, ny, nz)) {
                        isBoundary = true;
                        break;
                    }
                    int nidx = vIdx(N, nx, ny, nz);
                    if (!concavity[(size_t)nidx]) {
                        isBoundary = true;
                        break;
                    }
                }
                if (isBoundary) {
                    dist[(size_t)idx] = 0;
                    q.push(idx);
                    boundaryCount++;
                }
            }
        }
    }
    if (boundaryCount == 0) return false;

    while (!q.empty()) {
        int idx = q.front(); q.pop();
        int z = idx / (N * N);
        int rem = idx % (N * N);
        int y = rem / N;
        int x = rem % N;
        int dcur = dist[(size_t)idx];

        for (int k = 0; k < 6; ++k) {
            int nx = x + dx6[k];
            int ny = y + dy6[k];
            int nz = z + dz6[k];
            if (!idxValid(nx, ny, nz)) continue;
            int nidx = vIdx(N, nx, ny, nz);
            if (!concavity[(size_t)nidx]) continue;
            if (dist[(size_t)nidx] > dcur + 1) {
                dist[(size_t)nidx] = dcur + 1;
                q.push(nidx);
            }
        }
    }

    // ---- 在距離場上找局部峰值 peaks ----
    struct Peak {
        int x, y, z;
        int d;
    };
    std::vector<Peak> peaks;

    const int D_PEAK_MIN = 3; // 至少離邊界 3 層 voxel
    for (int z = 0; z < N; ++z) {
        for (int y = 0; y < N; ++y) {
            for (int x = 0; x < N; ++x) {
                int idx = vIdx(N, x, y, z);
                if (!concavity[(size_t)idx]) continue;
                int d = dist[(size_t)idx];
                if (d < D_PEAK_MIN || d >= INF) continue;

                bool isLocalMax = true;
                for (int k = 0; k < 6; ++k) {
                    int nx = x + dx6[k];
                    int ny = y + dy6[k];
                    int nz = z + dz6[k];
                    if (!idxValid(nx, ny, nz)) continue;
                    int nidx = vIdx(N, nx, ny, nz);
                    if (!concavity[(size_t)nidx]) continue;
                    int nd = dist[(size_t)nidx];
                    if (nd > d) {
                        isLocalMax = false;
                        break;
                    }
                }
                if (isLocalMax) {
                    peaks.push_back(Peak{ x, y, z, d });
                }
            }
        }
    }
    if (peaks.empty()) return false;

    // 依距離由大到小排序
    std::sort(peaks.begin(), peaks.end(), [](const Peak& a, const Peak& b) {
        return a.d > b.d;
        });

    // ---- NMS 取代表性 seeds ----
    std::vector<Peak> seeds;
    const float MIN_SEED_GRID_DIST = 4.0f;
    const float MIN_SEED_GRID_DIST2 = MIN_SEED_GRID_DIST * MIN_SEED_GRID_DIST;
    const int   MAX_SEEDS = 16;   // 代表性 seeds 上限，後面會再從中選 top M 去跑 mesh

    for (const Peak& p : peaks) {
        bool tooClose = false;
        for (const Peak& s : seeds) {
            float dx = (float)p.x - (float)s.x;
            float dy = (float)p.y - (float)s.y;
            float dz = (float)p.z - (float)s.z;
            float r2 = dx * dx + dy * dy + dz * dz;
            if (r2 < MIN_SEED_GRID_DIST2) {
                tooClose = true;
                break;
            }
        }
        if (!tooClose) {
            seeds.push_back(p);
            if ((int)seeds.size() >= MAX_SEEDS) break;
        }
    }
    if (seeds.empty()) return false;


    // ---- 出口模式分析（voxel ray）----
    std::vector<Vec3> dirs;
    build_global_dirs(dirs);
    if (dirs.empty()) return false;
    const int K = (int)dirs.size();

    const float ESCAPE_MAX = 0.55f;
    const float TWO_SIDE_MAX = 0.25f;

    struct ToothSeedDir {
        Vec3  dir;
        float weight;
    };
    struct SeedEval {
        Vec3  pos;
        int   d;
        float escape_ratio;
        float two_side_ratio;
    };

    std::vector<ToothSeedDir> goodSeeds;
    std::vector<SeedEval>     allSeeds;

    // 預先建立「幾乎相反」方向 pair（只算一次）
    std::vector<std::pair<int, int>> oppPairs;
    oppPairs.reserve(K);
    for (int i = 0; i < K; ++i) {
        for (int j = i + 1; j < K; ++j) {
            float dp = dot(dirs[(size_t)i], dirs[(size_t)j]);
            if (dp < -0.99f) {
                oppPairs.emplace_back(i, j);
            }
        }
    }
    const int pairTotalAll = (int)oppPairs.size();

    // 「外部」早停門檻
    const int escapeHardLimit =
        (K > 0) ? ((int)std::floor(ESCAPE_MAX * (float)K) + 1) : 0;
    const int twoSideHardLimit =
        (pairTotalAll > 0) ? ((int)std::floor(TWO_SIDE_MAX * (float)pairTotalAll) + 1) : 0;

    // 共用 escape buffer
    std::vector<uint8_t> escape((size_t)K, 0);

    // 先只計算 escape_ratio / two_side_ratio，不做 mesh ray
    for (const Peak& s : seeds) {
        Vec3 p = voxel_center(vg, s.x, s.y, s.z);

        std::fill(escape.begin(), escape.end(), 0);
        int  escapeCount = 0;
        bool earlyEscapeBad = false;

        // escape_ratio
        for (int k = 0; k < K; ++k) {
            bool block_p = false, esc_p = false;
            ray_block_or_escape_in_voxels(vg, solid, hull, p, dirs[(size_t)k], block_p, esc_p);
            if (esc_p) {
                escape[(size_t)k] = 1;
                escapeCount++;
                if (escapeHardLimit > 0 && escapeCount >= escapeHardLimit) {
                    earlyEscapeBad = true;
                    break;
                }
            }
        }

        float escape_ratio = 1.0f;
        float two_side_ratio = 0.0f;

        if (earlyEscapeBad) {
            // 已確定 escape_ratio > ESCAPE_MAX
            escape_ratio = (K > 0) ? ((float)escapeHardLimit / (float)K) : 1.0f;
            two_side_ratio = 1.0f;
        }
        else {
            escape_ratio = (K > 0) ? ((float)escapeCount / (float)K) : 1.0f;

            // two_side_ratio
            int pair_escape_both = 0;
            if (pairTotalAll > 0) {
                int  pair_cnt = 0;
                bool earlyTwoSideBad = false;

                for (const auto& pr : oppPairs) {
                    int i = pr.first;
                    int j = pr.second;
                    if (escape[(size_t)i] && escape[(size_t)j]) {
                        pair_escape_both++;
                        if (twoSideHardLimit > 0 && pair_escape_both >= twoSideHardLimit) {
                            earlyTwoSideBad = true;
                            break;
                        }
                    }
                    pair_cnt++;
                }

                if (earlyTwoSideBad) {
                    two_side_ratio = (float)twoSideHardLimit / (float)pairTotalAll;
                }
                else if (pair_cnt > 0) {
                    two_side_ratio = (float)pair_escape_both / (float)pair_cnt;
                }
                else {
                    two_side_ratio = 0.0f;
                }
            }
            else {
                two_side_ratio = 0.0f;
            }
        }

        SeedEval eval;
        eval.pos = p;
        eval.d = s.d;
        eval.escape_ratio = escape_ratio;
        eval.two_side_ratio = two_side_ratio;
        allSeeds.push_back(eval);
    }

    // ---- 只對「分數最高的少數 seeds」跑 mesh 版 open_dir ----
    const int MAX_EST_SEEDS = 4;  // 最多對幾顆 seed 跑 estimate_open_direction_from_point

    // 先試「嚴格集合」：escape_ratio <= ESCAPE_MAX && two_side_ratio <= TWO_SIDE_MAX
    struct ScoredIdx {
        int   idx;
        float score;
    };
    std::vector<ScoredIdx> strictList;
    strictList.reserve(allSeeds.size());
    for (int i = 0; i < (int)allSeeds.size(); ++i) {
        const auto& e = allSeeds[(size_t)i];
        if (e.escape_ratio > ESCAPE_MAX || e.two_side_ratio > TWO_SIDE_MAX) continue;
        // 分數：越深 (d 大)、越封閉 (escape_ratio / two_side_ratio 小) 越好
        float score = (float)e.d * (1.0f - e.escape_ratio) * (1.0f - e.two_side_ratio);
        strictList.push_back({ i, score });
    }

    auto sort_by_score_desc = [](std::vector<ScoredIdx>& arr) {
        std::sort(arr.begin(), arr.end(), [](const ScoredIdx& a, const ScoredIdx& b) {
            return a.score > b.score;
            });
        };

    if (!strictList.empty()) {
        sort_by_score_desc(strictList);
        int used = 0;
        for (const auto& si : strictList) {
            if (used >= MAX_EST_SEEDS) break;
            const auto& e = allSeeds[(size_t)si.idx];
            Vec3 p = e.pos;
            Vec3 prior = v3(p.x - C_all.x, p.y - C_all.y, p.z - C_all.z);

            Vec3 d_open;
            bool ok = false;
            estimate_open_direction_from_point(
                vertices, nv,
                indices, ntri,
                p,
                prior,
                d_open,
                ok
            );
            if (!ok) continue;

            float w = (float)e.d;
            if (w <= 0.0f) w = 1.0f;

            ToothSeedDir tsd;
            tsd.dir = d_open;
            tsd.weight = w;
            goodSeeds.push_back(tsd);
            used++;
        }
    }

    // 若嚴格集合完全沒成功，就用「relaxed 排序」再挑少數幾顆跑一次 mesh
    if (goodSeeds.empty() && !allSeeds.empty()) {
        std::vector<ScoredIdx> relaxedList;
        relaxedList.reserve(allSeeds.size());
        for (int i = 0; i < (int)allSeeds.size(); ++i) {
            const auto& e = allSeeds[(size_t)i];
            float bad = e.escape_ratio + e.two_side_ratio; // 越小越好
            relaxedList.push_back({ i, -bad }); // score 越大越好，所以取負
        }
        sort_by_score_desc(relaxedList);

        int used = 0;
        for (const auto& si : relaxedList) {
            if (used >= MAX_EST_SEEDS) break;
            const auto& e = allSeeds[(size_t)si.idx];
            Vec3 p = e.pos;
            Vec3 prior = v3(p.x - C_all.x, p.y - C_all.y, p.z - C_all.z);

            Vec3 d_open;
            bool ok = false;
            estimate_open_direction_from_point(
                vertices, nv,
                indices, ntri,
                p,
                prior,
                d_open,
                ok
            );
            if (!ok) continue;

            float w = (float)e.d;
            if (w <= 0.0f) w = 1.0f;

            ToothSeedDir tsd;
            tsd.dir = d_open;
            tsd.weight = w;
            goodSeeds.push_back(tsd);
            used++;
        }
    }

    if (goodSeeds.empty()) {
        return false;
    }

    // ---- 對選出的 seeds 做加權平均 + 90° 門檻 ----
    Vec3 s_all = v3(0.0f, 0.0f, 0.0f);
    float totalW = 0.0f;
    for (const auto& sd : goodSeeds) {
        s_all.x += sd.dir.x * sd.weight;
        s_all.y += sd.dir.y * sd.weight;
        s_all.z += sd.dir.z * sd.weight;
        totalW += sd.weight;
    }
    if (totalW <= 0.0f) return false;

    float len_all = norm(s_all);
    if (len_all <= 1e-6f) return false;
    Vec3 d_avg = v3(s_all.x / len_all, s_all.y / len_all, s_all.z / len_all);

    Vec3 s_all2 = v3(0.0f, 0.0f, 0.0f);
    float totalW2 = 0.0f;
    for (const auto& sd : goodSeeds) {
        float dp = dot(sd.dir, d_avg);
        if (dp >= 0.0f) {
            s_all2.x += sd.dir.x * sd.weight;
            s_all2.y += sd.dir.y * sd.weight;
            s_all2.z += sd.dir.z * sd.weight;
            totalW2 += sd.weight;
        }
    }

    Vec3 d_final;
    if (totalW2 > 0.0f) {
        float len2 = norm(s_all2);
        if (len2 <= 1e-6f) {
            d_final = d_avg;
        }
        else {
            d_final = v3(s_all2.x / len2, s_all2.y / len2, s_all2.z / len2);
        }
    }
    else {
        d_final = d_avg;
    }

    out_dir = d_final; // 開口方向，外層再轉對齊 -Z
    return true;
}



// -------------------- 主流程 --------------------

int compute_auto_orientation_TempCB_mod(
    const float* vertices, int nv,
    const uint32_t* indices, int ntri_in,
    float out_rad3[3]
)
{
    if (!vertices || nv <= 0 || !out_rad3) {
        if (out_rad3) {
            out_rad3[0] = out_rad3[1] = out_rad3[2] = 0.0f;
        }
        return DAO_ERR_BAD_INPUT;
    }

    int ntri = 0;
    if (indices && ntri_in > 0) {
        ntri = ntri_in;
    }

    Vec3 bb_min, bb_max;
    aabb_min_max(vertices, nv, bb_min, bb_max);

    const int VOX_N = 96;
    VoxelGrid vg;
    build_voxel_grid_from_aabb(bb_min, bb_max, VOX_N, vg);

    std::vector<uint8_t> solid;
    rasterize_triangles_to_voxels(vertices, nv, indices, ntri, vg, solid);

    std::vector<uint8_t> hull;
    build_hull_vox(vg, solid, hull);

    std::vector<CavityComp> cavities;
    extract_cavity_components(vg, solid, hull, cavities);

    for (size_t i = 0; i < cavities.size(); ++i) {
        const auto& c = cavities[i];
    }

    if (cavities.empty()) {
        out_rad3[0] = out_rad3[1] = out_rad3[2] = 0.0f;
        return DAO_OK;
    }

    // 全模型重心（單顆牙 / 多顆牙都共用）
    Vec3 C_all = v3(0.0f, 0.0f, 0.0f);
    for (int i = 0; i < nv; ++i) {
        Vec3 p = load_vtx(vertices, (uint32_t)i);
        C_all.x += p.x;
        C_all.y += p.y;
        C_all.z += p.z;
    }
    float inv_nv = 1.0f / (float)nv;
    C_all.x *= inv_nv;
    C_all.y *= inv_nv;
    C_all.z *= inv_nv;

    // ---- 單一巨大 cavity 的「多顆牙模式判斷」 ----
    bool is_multi_tooth = false;
    int  seed_count_for_mode = 0;
    const int BIG_CAVITY_VOX = 20000;          // 原本就用的門檻
    const int PEAK_MULTI_THRESHOLD = 3;        // 種子數 >=3 視為多顆牙

    if (cavities.size() == 1 && cavities[0].voxelCount >= BIG_CAVITY_VOX) {
        seed_count_for_mode = estimate_concavity_seed_count(vg, solid, hull);
        if (seed_count_for_mode >= PEAK_MULTI_THRESHOLD) {
            is_multi_tooth = true;
        }
    }

    // ---- 一般模式：每個 cavity 用單顆牙演算法求開口方向 ----
    // 若 is_multi_tooth==true，則跳過這一段，直接走多顆牙 fallback。
    std::vector<Vec3> d_open_list;
    std::vector<float> vol_list;
    d_open_list.reserve(cavities.size());
    vol_list.reserve(cavities.size());

    const float voxelVol = vg.h * vg.h * vg.h;

    if (!is_multi_tooth) {
        for (size_t idx = 0; idx < cavities.size(); ++idx) {
            const auto& cav = cavities[idx];
            Vec3 C_void = cav.center;
            Vec3 prior = v3(C_void.x - C_all.x, C_void.y - C_all.y, C_void.z - C_all.z);
            float lenp = norm(prior);

            Vec3 d_open;
            bool ok = false;
            estimate_open_direction_from_point(
                vertices, nv,
                indices, ntri,
                C_void,
                prior,
                d_open,
                ok
            );

            if (!ok) {
                continue;
            }

            d_open_list.push_back(d_open);
            vol_list.push_back((float)cav.voxelCount * voxelVol);
        }

        int m = (int)d_open_list.size();
        if (m > 0) {
            // 保持原本單顆牙多 cavity 的加權平均 + 90° 門檻邏輯
            Vec3 s_all = v3(0.0f, 0.0f, 0.0f);
            float totalVol = 0.0f;
            for (int i = 0; i < m; ++i) {
                s_all.x += d_open_list[(size_t)i].x * vol_list[(size_t)i];
                s_all.y += d_open_list[(size_t)i].y * vol_list[(size_t)i];
                s_all.z += d_open_list[(size_t)i].z * vol_list[(size_t)i];
                totalVol += vol_list[(size_t)i];
            }
            if (totalVol <= 0.0f) {
                out_rad3[0] = out_rad3[1] = out_rad3[2] = 0.0f;
                return DAO_OK;
            }

            float len_all = norm(s_all);
            if (len_all <= 1e-6f) {
                out_rad3[0] = out_rad3[1] = out_rad3[2] = 0.0f;
                return DAO_OK;
            }
            Vec3 d_avg = v3(s_all.x / len_all, s_all.y / len_all, s_all.z / len_all);

            // 90° 門檻：dot < 0 的視為 outlier
            Vec3 s_all2 = v3(0.0f, 0.0f, 0.0f);
            float totalVol2 = 0.0f;
            for (int i = 0; i < m; ++i) {
                const Vec3& d = d_open_list[(size_t)i];
                float dp = dot(d, d_avg);
                if (dp >= 0.0f) {
                    s_all2.x += d.x * vol_list[(size_t)i];
                    s_all2.y += d.y * vol_list[(size_t)i];
                    s_all2.z += d.z * vol_list[(size_t)i];
                    totalVol2 += vol_list[(size_t)i];
                }
            }

            Vec3 d_final;
            if (totalVol2 > 0.0f) {
                float len2 = norm(s_all2);
                if (len2 <= 1e-6f) {
                    d_final = d_avg;
                }
                else {
                    d_final = v3(s_all2.x / len2, s_all2.y / len2, s_all2.z / len2);
                }
            }
            else {
                d_final = d_avg;
            }

            Vec3 n_for_align = v3(-d_final.x, -d_final.y, -d_final.z);
            normal_to_euler_XYZ_align_to_minusZ(n_for_align, out_rad3);
            return DAO_OK;
        }
    } // end if (!is_multi_tooth)

    // ---- 多顆牙 fallback：單一巨大 cavity，或一般模式完全失敗 ----
    if (cavities.size() == 1 && cavities[0].voxelCount >= BIG_CAVITY_VOX) {
        Vec3 d_multi;
        bool ok_multi = multi_tooth_fallback_direction(
            vg, solid, hull,
            vertices, nv,
            indices, ntri,
            C_all,
            d_multi
        );
        if (ok_multi) {
            Vec3 n_for_align = v3(-d_multi.x, -d_multi.y, -d_multi.z);
            normal_to_euler_XYZ_align_to_minusZ(n_for_align, out_rad3);
            return DAO_OK;
        }
    }

    // ---- 最後 fallback：不旋轉 ----
    out_rad3[0] = out_rad3[1] = out_rad3[2] = 0.0f;
    return DAO_OK;
}

