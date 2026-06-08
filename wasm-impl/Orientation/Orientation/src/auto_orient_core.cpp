// auto_orient_core.cpp
// 目標：以牙科 ORTHO 流程找出最大共平面法向 best_n，最短旋轉至 -Z，回傳 XYZ 歐拉角（弧度）。
// 定義：q = R * p，row-major，歐拉順序「先 X，再 Y，再 Z」（XYZ）。

#include <cstdint>
#include <cmath>
#include <algorithm>
#include <vector>
#include <unordered_map>
#include <limits>
#include <cstdio>

#include "dao_api.h"   // DaoStatus 常數
#include "dao_math.h"  // dao_m::Vec3, Mat3, v3, dot, cross, norm, normalize, I3, mul, rot_from_u_to_v, aabb_min_max

using std::size_t;
using std::int32_t;
using std::uint32_t;

namespace dao_core {
    using namespace dao_m;

    // -------- 小工具 --------
    static inline Vec3 load_vtx(const float* v, uint32_t idx) {
        const float* p = v + idx * 3u;
        return v3(p[0], p[1], p[2]);
    }

    static inline void normal_to_euler_XYZ_align_to_minusZ(const Vec3& n_in, float out_rad3[3]) {
        using namespace dao_m;
        using std::fabs; using std::atan2; using std::asin; using std::cos; using std::sqrt; using std::fmin; using std::fmax; using std::acos;

        // 正規化
        const float nx0 = n_in.x, ny0 = n_in.y, nz0 = n_in.z;
        const float L2 = nx0 * nx0 + ny0 * ny0 + nz0 * nz0;
        if (L2 <= 0.0f) { out_rad3[0] = out_rad3[1] = out_rad3[2] = 0.0f; return; }
        const float L = sqrt(L2);
        const float nx = nx0 / L, ny = ny0 / L, nz = nz0 / L;

        // 直接對準邊界
        if (nz <= -0.999999f) { out_rad3[0] = 0.0f; out_rad3[1] = 0.0f; out_rad3[2] = 0.0f; return; }
        if (nz >= 0.999999f) { const float pi = (float)acos(-1.0f); out_rad3[0] = 0.0f; out_rad3[1] = pi; out_rad3[2] = 0.0f; return; }

        // 構造把 n 轉到 -Z 的旋轉矩陣 R（行向量做為列）
        // z_row = -n
        float zx = -nx, zy = -ny, zz = -nz;

        // 參考軸選擇以穩定 roll：優先 world +X，若退化則用 +Y
        float refx = 1.0f, refy = 0.0f, refz = 0.0f;
        if (fabs(nx) > 0.9f && fabs(ny) < 0.5f) { refx = 0.0f; refy = 1.0f; refz = 0.0f; }

        // x_row = normalize( ref - n*(n·ref) )
        float ndotref = nx * refx + ny * refy + nz * refz;
        float xx = refx - nx * ndotref;
        float xy = refy - ny * ndotref;
        float xz = refz - nz * ndotref;
        float xlen2 = xx * xx + xy * xy + xz * xz;
        if (xlen2 < 1e-12f) {
            // 換另一參考
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

        // y_row = normalize( z_row × x_row )
        float yx = zy * xz - zz * xy;
        float yy = zz * xx - zx * xz;
        float yz = zx * xy - zy * xx;
        float ylen2 = yx * yx + yy * yy + yz * yz;
        float invy = 1.0f / sqrt(fmax(1e-30f, ylen2));
        yx *= invy; yy *= invy; yz *= invy;

        // 重新正交：x_row = normalize( y_row × z_row )
        xx = yy * zz - yz * zy;
        xy = yz * zx - yx * zz;
        xz = yx * zy - yy * zx;
        xlen2 = xx * xx + xy * xy + xz * xz;
        invx = 1.0f / sqrt(fmax(1e-30f, xlen2));
        xx *= invx; xy *= invx; xz *= invx;

        // R 行向量
        const float R00 = xx, R01 = xy, R02 = xz;
        const float R10 = yx, R11 = yy, R12 = yz;
        const float R20 = zx, R21 = zy, R22 = zz;

        // 外在 XYZ 分解：R = Rz(γ) * Ry(β) * Rx(α)
        // β = -asin(R20)
        float ry = -asin(fmax(-1.0f, fmin(1.0f, R20)));
        float cy = cos(ry);

        float rx, rz;
        if (fabs(cy) > 1e-6f) {
            rx = atan2(R21, R22);
            rz = atan2(R10, R00);
        }
        else {
            // gimbal lock：設 rx=0 或 rz=0，採固定 rz 由另一關係求
            rx = 0.0f;
            rz = atan2(-R01, R11);
        }
        out_rad3[0] = rx; // X
        out_rad3[1] = ry; // Y
        out_rad3[2] = rz; // Z

    }

    // 面資訊
    struct FaceInfo {
        Vec3  n;         // 單位法向量（朝外，並保證 b>=0 方向）
        float area;      // 面積
        float b;         // 平面方程 n·x = b（以三角形質心帶入）
        Vec3  centroid;  // 質心
    };

    // 法向量量化鍵
    struct NormalKey {
        int qx, qy, qz;
        bool operator==(const NormalKey& o) const { return qx == o.qx && qy == o.qy && qz == o.qz; }
    };
    struct NormalKeyHasher {
        size_t operator()(const NormalKey& k) const {
            // 簡單 hash
            return (uint32_t)k.qx * 73856093u ^ (uint32_t)k.qy * 19349663u ^ (uint32_t)k.qz * 83492791u;
        }
    };
    static inline NormalKey quantize_normal(const Vec3& n, float step) {
        auto q = [&](float v) { return (int)std::floor(v / step + (v >= 0 ? 0.5f : -0.5f)); };
        return { q(n.x), q(n.y), q(n.z) };
    }

    int compute_auto_orientation_Orthodontic_mod(
        const float* v, int nv,
        const uint32_t* tri, int ntri,
        float out_rad3[3]
    ) {
        if (!v || nv <= 0 || !out_rad3) return DAO_ERR_BAD_INPUT;

        // tri 計數容錯：若大於頂點數，視為傳入的是 index 數量，轉成三角形數
        if (ntri > nv) ntri /= 3;

        // 幾何尺度估計
        Vec3 bbmin, bbmax; aabb_min_max(v, nv, bbmin, bbmax);
        double diag = norm(v3(bbmax.x - bbmin.x, bbmax.y - bbmin.y, bbmax.z - bbmin.z));
        const float dist_tol = (float)std::max(1e-5, 1e-5 * diag);           // 平面距離量化
        const float cos_tol = std::cos(0.5f * (float)M_PI / 180.0f);        // 0.5°
        const float nbin_step = 0.02f;                                        // 法向量量化步長

        std::vector<FaceInfo> faces; faces.reserve((size_t)ntri);
        std::unordered_map<NormalKey, std::vector<int>, NormalKeyHasher> normal_bins;
        normal_bins.reserve((size_t)(ntri / 8 + 1));

        for (int t = 0; t < ntri; ++t) {
            uint32_t i0 = tri[t * 3 + 0], i1 = tri[t * 3 + 1], i2 = tri[t * 3 + 2];
            if (i0 >= (uint32_t)nv || i1 >= (uint32_t)nv || i2 >= (uint32_t)nv) continue;

            Vec3 p0 = load_vtx(v, i0);
            Vec3 p1 = load_vtx(v, i1);
            Vec3 p2 = load_vtx(v, i2);

            Vec3 e1 = v3(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z);
            Vec3 e2 = v3(p2.x - p0.x, p2.y - p0.y, p2.z - p0.z);
            Vec3 c = cross(e1, e2);
            float L = norm(c);
            if (L <= 0.f) continue;

            float area = 0.5f * L;
            Vec3 n = v3(c.x / L, c.y / L, c.z / L);

            Vec3 centroid = v3((p0.x + p1.x + p2.x) / 3.0f,
                (p0.y + p1.y + p2.y) / 3.0f,
                (p0.z + p1.z + p2.z) / 3.0f);

            float b = n.x * centroid.x + n.y * centroid.y + n.z * centroid.z;
            if (b < 0.f) { n = v3(-n.x, -n.y, -n.z); b = -b; } // 統一 b>=0

            int idx = (int)faces.size();
            faces.push_back(FaceInfo{ n, area, b, centroid });

            NormalKey key = quantize_normal(n, nbin_step);
            normal_bins[key].push_back(idx);
        }

        if (faces.empty()) { out_rad3[0] = out_rad3[1] = out_rad3[2] = 0; return DAO_OK; }

        // 先以量化法向分桶，取面積前幾名
        struct BinStat { NormalKey key; double area_sum; };
        std::vector<BinStat> stats; stats.reserve(normal_bins.size());
        for (auto& kv : normal_bins) {
            double s = 0.0; for (int idx : kv.second) s += faces[idx].area;
            stats.push_back({ kv.first, s });
        }
        std::sort(stats.begin(), stats.end(),
            [](const BinStat& a, const BinStat& b) { return a.area_sum > b.area_sum; });
        const int TOPK = (int)std::min<size_t>(stats.size(), 8);

        double best_area = -1.0;
        Vec3   best_n = v3(0, 0, 1);

        for (int bi = 0; bi < TOPK; ++bi) {
            const NormalKey& key = stats[bi].key;
            const auto& idxs = normal_bins[key];

            // 該桶的面積加權平均法向
            Vec3 n_avg = v3(0, 0, 0);
            for (int idx : idxs)
                n_avg = v3(n_avg.x + faces[idx].n.x * faces[idx].area,
                    n_avg.y + faces[idx].n.y * faces[idx].area,
                    n_avg.z + faces[idx].n.z * faces[idx].area);
            n_avg = normalize(n_avg);

            // 拉近到 cos_tol 的面
            std::vector<int> near_set; near_set.reserve(idxs.size());
            for (int idx : idxs) {
                float c = dot(n_avg, faces[idx].n);
                if (c >= cos_tol) near_set.push_back(idx);
            }
            if (near_set.empty()) continue;

            // 以平面距離 b 量化，再以面積加總挑最大群
            struct PlaneBucket { double area_sum; Vec3 n_sum; int count; };
            std::unordered_map<int, PlaneBucket> plane_bins; plane_bins.reserve(near_set.size());

            for (int idx : near_set) {
                const FaceInfo& f = faces[idx];
                float b = f.n.x * f.centroid.x + f.n.y * f.centroid.y + f.n.z * f.centroid.z;
                if (b < 0.f) b = -b;
                int bkey = (int)std::floor(b / dist_tol + 0.5f);
                auto& pb = plane_bins[bkey];
                pb.area_sum += f.area;
                pb.n_sum = v3(pb.n_sum.x + f.n.x * f.area,
                    pb.n_sum.y + f.n.y * f.area,
                    pb.n_sum.z + f.n.z * f.area);
                pb.count += 1;
            }

            for (auto& kv2 : plane_bins) {
                if (kv2.second.area_sum > best_area) {
                    best_area = kv2.second.area_sum;
                    best_n = normalize(kv2.second.n_sum);
                }
            }
        }

        if (best_area <= 0.0) { out_rad3[0] = out_rad3[1] = out_rad3[2] = 0; return DAO_OK; }

        normal_to_euler_XYZ_align_to_minusZ(best_n, out_rad3);
        return DAO_OK;
    }

} // namespace dao_core
