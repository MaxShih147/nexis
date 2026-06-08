#include <cstdint>
#include <cmath>
#include <vector>
#include <unordered_map>
#include <queue>
#include <limits>
#include <cstdio>
#include <algorithm>

#include "dao_api.h"
#include "dao_math.h"

using std::uint32_t;
using std::int32_t;
using std::size_t;
using namespace dao_m;

// ======================== 小工具 ========================

static float clampf(float x, float lo, float hi)
{
    return x < lo ? lo : (x > hi ? hi : x);
}

static void buildOrthonormalBasis(const Vec3& nIn, Vec3& ex, Vec3& ey)
{
    Vec3 n = normalize(nIn);
    float len = norm(n);
    if (len < 1e-6f)
    {
        n = Vec3{ 0.0f, 0.0f, 1.0f };
    }

    Vec3 t = (std::fabs(n.z) < 0.9f) ? Vec3{ 0.0f, 0.0f, 1.0f }
    : Vec3{ 0.0f, 1.0f, 0.0f };

    ex = normalize(cross(t, n));
    ey = cross(n, ex);
}

static inline Vec3 load_vtx(const float* v, uint32_t idx) {
    const float* p = v + idx * 3u;
    return v3(p[0], p[1], p[2]);
}

// 將輸入法向轉成「旋轉後對齊 -Z」的 XYZ 歐拉角（弧度）
static inline void normal_to_euler_XYZ_align_to_minusZ(const Vec3& n_in, float out_rad3[3]) {
    using std::fabs; using std::atan2; using std::asin; using std::cos;
    using std::sqrt; using std::fmin; using std::fmax; using std::acos;

    const float nx0 = n_in.x, ny0 = n_in.y, nz0 = n_in.z;
    const float L2 = nx0 * nx0 + ny0 * ny0 + nz0 * nz0;
    if (L2 <= 0.0f) { out_rad3[0] = out_rad3[1] = out_rad3[2] = 0.0f; return; }
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

// ======================== 幾何結構 ========================

struct FaceInfo {
    uint32_t i0, i1, i2;
    Vec3     n;
    Vec3     c;
    int      patchId;
};

struct PatchInfo {
    int              id;
    std::vector<int> faces;       // face indices
    Vec3             avgNormal;   // 面積加權平均法向
    float            area;        // 總面積
    float            maxAngleDeg; // 面內法向與 avgNormal 最大夾角
    int              boundaryEdges;
    int              verticalWalls;
    Vec3             center;      // 面積加權中心
};

struct EdgeKey {
    uint32_t a, b;
};

struct EdgeKeyHash {
    size_t operator()(const EdgeKey& e) const noexcept {
        return ((size_t)e.a * 73856093u) ^ ((size_t)e.b * 19349663u);
    }
};

struct EdgeKeyEq {
    bool operator()(const EdgeKey& x, const EdgeKey& y) const noexcept {
        return x.a == y.a && x.b == y.b;
    }
};

struct EdgeFaces {
    int f0 = -1;
    int f1 = -1;
};

struct GuideSearchResult {
    bool found = false;
    Vec3 dir = v3(0, 0, 1);  // 導孔方向（未取負）
};


// 使用 2D 體素 + 掃描線判斷 patch 平面上是否存在孔洞/環結構
// 流程：
// 1) 將此 patch 的所有三角面投影到 (ex, ey) 平面，建立 2D voxel grid（cell 大小約 0.3mm）。
// 2) 對每個 voxel，做「近似保守 rasterization」：只要三角形投影與該像素有明顯交集，就標為實體。
// 3) 橫向和縱向各掃描一次 grid：尋找連續的「實體 → 空心 → 實體」模式，
//    要求中間空心段長度 >= 3mm，前後實體各 >= 0.6mm。
// 4) 若任一方向存在這種掃描線，就認定此 patch 平面上存在孔洞或環結構。
static bool patch_has_hole_by_scanlines(
    const float* v,
    const std::vector<FaceInfo>& faces,
    const PatchInfo& P,
    const Vec3& ex,
    const Vec3& ey)
{
    if (!v || P.faces.empty())
        return false;

    // 投影原點：patch 中心
    Vec3 origin = P.center;

    auto projectPos = [&](uint32_t vid) -> Vec3
        {
            Vec3 p = load_vtx(v, vid);
            Vec3 q{ p.x - origin.x, p.y - origin.y, p.z - origin.z };
            float u = dot(q, ex);
            float vv = dot(q, ey);
            return v3(u, vv, 0.0f);
        };

    // 先取得此 patch 所有三角面的 2D bbox
    float umin = 1e30f, umax = -1e30f;
    float vmin = 1e30f, vmax = -1e30f;

    for (int fi : P.faces) {
        if (fi < 0 || (size_t)fi >= faces.size())
            continue;
        const FaceInfo& F = faces[(size_t)fi];

        uint32_t vids[3] = { F.i0, F.i1, F.i2 };
        for (int k = 0; k < 3; ++k) {
            Vec3 uv = projectPos(vids[k]);
            umin = std::min(umin, uv.x);
            umax = std::max(umax, uv.x);
            vmin = std::min(vmin, uv.y);
            vmax = std::max(vmax, uv.y);
        }
    }

    float width = umax - umin;
    float height = vmax - vmin;
    if (!(width > 0.0f && height > 0.0f))
        return false;

    // 建立 2D voxel grid
    const float voxelSize = 0.3f;      // 0.3 mm
    const float pad = voxelSize * 0.5f;

    float u0 = umin - pad;
    float v0 = vmin - pad;
    float u1 = umax + pad;
    float v1 = vmax + pad;

    int nx = (int)std::ceil((u1 - u0) / voxelSize);
    int ny = (int)std::ceil((v1 - v0) / voxelSize);
    if (nx <= 0 || ny <= 0)
        return false;

    std::vector<uint8_t> occ((size_t)nx * (size_t)ny, 0);

    auto idx = [&](int ix, int iy) -> size_t
        {
            return (size_t)iy * (size_t)nx + (size_t)ix;
        };

    // 2D 點是否在三角形內（帶一點容忍）
    auto pointInTri2D = [](float px, float py,
        float ax, float ay,
        float bx, float by,
        float cx, float cy) -> bool
        {
            float v0x = bx - ax;
            float v0y = by - ay;
            float v1x = cx - ax;
            float v1y = cy - ay;
            float v2x = px - ax;
            float v2y = py - ay;

            float dot00 = v0x * v0x + v0y * v0y;
            float dot01 = v0x * v1x + v0y * v1y;
            float dot02 = v0x * v2x + v0y * v2y;
            float dot11 = v1x * v1x + v1y * v1y;
            float dot12 = v1x * v2x + v1y * v2y;

            float denom = dot00 * dot11 - dot01 * dot01;
            if (std::fabs(denom) < 1e-12f)
                return false;

            float invDen = 1.0f / denom;
            float u = (dot11 * dot02 - dot01 * dot12) * invDen;
            float v = (dot00 * dot12 - dot01 * dot02) * invDen;

            const float eps = -1e-4f;
            return (u >= eps) && (v >= eps) && (u + v <= 1.0f - eps);
        };

    // 1) 光柵化：對每個屬於此 patch 的三角面做近似保守 rasterization 到 2D grid
    for (int fi : P.faces)
    {
        if (fi < 0 || (size_t)fi >= faces.size())
            continue;
        const FaceInfo& F = faces[(size_t)fi];

        uint32_t i0 = F.i0;
        uint32_t i1 = F.i1;
        uint32_t i2 = F.i2;

        Vec3 uv0 = projectPos(i0);
        Vec3 uv1 = projectPos(i1);
        Vec3 uv2 = projectPos(i2);

        float tumin = std::min(uv0.x, std::min(uv1.x, uv2.x));
        float tumax = std::max(uv0.x, std::max(uv1.x, uv2.x));
        float tvmin = std::min(uv0.y, std::min(uv1.y, uv2.y));
        float tvmax = std::max(uv0.y, std::max(uv1.y, uv2.y));

        int ix0 = (int)std::floor((tumin - u0) / voxelSize) - 1;
        int ix1 = (int)std::floor((tumax - u0) / voxelSize) + 1;
        int iy0 = (int)std::floor((tvmin - v0) / voxelSize) - 1;
        int iy1 = (int)std::floor((tvmax - v0) / voxelSize) + 1;

        if (ix0 < 0)      ix0 = 0;
        if (iy0 < 0)      iy0 = 0;
        if (ix1 >= nx)    ix1 = nx - 1;
        if (iy1 >= ny)    iy1 = ny - 1;

        for (int iy = iy0; iy <= iy1; ++iy) {
            for (int ix = ix0; ix <= ix1; ++ix) {
                if (occ[idx(ix, iy)])
                    continue;

                // 像素四角 + 中心取樣，近似保守
                float x0 = u0 + ix * voxelSize;
                float y0 = v0 + iy * voxelSize;
                float x1 = x0 + voxelSize;
                float y1 = y0 + voxelSize;
                float xc = 0.5f * (x0 + x1);
                float yc = 0.5f * (y0 + y1);

                bool hit = false;
                if (pointInTri2D(x0, y0, uv0.x, uv0.y, uv1.x, uv1.y, uv2.x, uv2.y) ||
                    pointInTri2D(x1, y0, uv0.x, uv0.y, uv1.x, uv1.y, uv2.x, uv2.y) ||
                    pointInTri2D(x0, y1, uv0.x, uv0.y, uv1.x, uv1.y, uv2.x, uv2.y) ||
                    pointInTri2D(x1, y1, uv0.x, uv0.y, uv1.x, uv1.y, uv2.x, uv2.y) ||
                    pointInTri2D(xc, yc, uv0.x, uv0.y, uv1.x, uv1.y, uv2.x, uv2.y)) {
                    hit = true;
                }

                if (hit) {
                    occ[idx(ix, iy)] = 1;
                }
            }
        }
    }

    // 2) 掃描：找「實體 -> 空心 -> 實體」且空心段 >= 2.4mm，實體段各 >= 0.6mm
    const float emptyMinLen = 2.4f;   // 空心連續長度至少 2.4mm
    const float solidMinLen = 0.6f;   // 兩側實體各至少 ~2 個 voxel
    const float stepLen = voxelSize;

    auto hasHoleInDir = [&](bool horizontal) -> bool
        {
            int outer = horizontal ? ny : nx; // 掃描線條數
            int inner = horizontal ? nx : ny; // 每條掃描線上的 cell 數

            for (int line = 0; line < outer; ++line) {
                int state = 0; // 0: 尚未進入實體, 1: 第一道實體, 2: 空心, 3: 第二道實體
                float solid1Len = 0.0f;
                float emptyLen = 0.0f;
                float solid2Len = 0.0f;

                for (int k = 0; k < inner; ++k) {
                    bool solid;
                    if (horizontal) {
                        // y 固定, x 變
                        solid = (occ[idx(k, line)] != 0);
                    }
                    else {
                        // x 固定, y 變
                        solid = (occ[idx(line, k)] != 0);
                    }

                    if (solid) {
                        if (state == 0) {
                            state = 1;
                            solid1Len = stepLen;
                        }
                        else if (state == 1) {
                            solid1Len += stepLen;
                        }
                        else if (state == 2) {
                            state = 3;
                            solid2Len = stepLen;
                        }
                        else if (state == 3) {
                            solid2Len += stepLen;
                        }
                    }
                    else {
                        if (state == 1) {
                            state = 2;
                            emptyLen = stepLen;
                        }
                        else if (state == 2) {
                            emptyLen += stepLen;
                        }
                        else if (state == 3) {
                            // 第二道實體中斷，檢查是否已經達到條件
                            if (emptyLen >= emptyMinLen &&
                                solid1Len >= solidMinLen &&
                                solid2Len >= solidMinLen) {
                                return true;
                            }
                            // 重置狀態，重新尋找下一個 pattern
                            state = 0;
                            solid1Len = emptyLen = solid2Len = 0.0f;
                        }
                    }

                    // 在第二道實體進行中時，也可以隨時檢查條件
                    if (state == 3 &&
                        emptyLen >= emptyMinLen &&
                        solid1Len >= solidMinLen &&
                        solid2Len >= solidMinLen) {
                        return true;
                    }
                }

                // 掃描線結束時再檢查一次
                if (state == 3 &&
                    emptyLen >= emptyMinLen &&
                    solid1Len >= solidMinLen &&
                    solid2Len >= solidMinLen) {
                    return true;
                }
            }

            return false;
        };

    bool okH = hasHoleInDir(true);
    bool okV = hasHoleInDir(false);

    return (okH || okV);
}



// ======================== 階段 2：導孔端面判定 ========================
//
// 依照你最新的描述：
// 1. 直立洞壁：與 patch 法向量成 90° ±3°
// 2. 從這些直立洞壁與端面之間的邊組成「連接邊群」
// 3. 投影到 patch 平面後做 bounding box，尺寸在 3~25mm 且近似方形
// 4. 在邊圖上追邊鏈，累積轉角 >= 240° 就視為導孔端面
//

static bool isDrillPatchByEdges(
    const float* v,
    const std::unordered_map<EdgeKey, EdgeFaces, EdgeKeyHash, EdgeKeyEq>& edgeMap,
    const std::vector<FaceInfo>& faces,
    const PatchInfo& P)
{
    float totalAccum = 0.0f;

    if (P.faces.size() < 5 || P.area <= 0.0f)
        return false;

    // patch 法向量
    Vec3 nPatch = normalize(P.avgNormal);
    if (norm(nPatch) < 0.5f)
        return false;

    // 建立局部 2D 座標系，把 patch「放平」
    Vec3 ex, ey;
    buildOrthonormalBasis(nPatch, ex, ey);

    auto projectToPlane = [&](uint32_t vid) -> Vec3
        {
            Vec3 p = load_vtx(v, vid);
            Vec3 q{ p.x - P.center.x, p.y - P.center.y, p.z - P.center.z };
            float u = dot(q, ex);
            float vv = dot(q, ey);
            return v3(u, vv, 0.0f);
        };

    // 先用整個 patch 在平面上的 2D bounding box 做粗篩
    float uminPatch = 1e30f, umaxPatch = -1e30f;
    float vminPatch = 1e30f, vmaxPatch = -1e30f;

    for (int fi : P.faces) {
        const FaceInfo& F = faces[(size_t)fi];
        uint32_t vs[3] = { F.i0, F.i1, F.i2 };

        for (int k = 0; k < 3; ++k) {
            Vec3 uv = projectToPlane(vs[k]);
            uminPatch = std::min(uminPatch, uv.x);
            umaxPatch = std::max(umaxPatch, uv.x);
            vminPatch = std::min(vminPatch, uv.y);
            vmaxPatch = std::max(vmaxPatch, uv.y);
        }
    }

    float width = umaxPatch - uminPatch;
    float height = vmaxPatch - vminPatch;

    // 避免退化情況
    if (!(width > 0.0f && height > 0.0f))
        return false;

    float longEdge = (width > height) ? width : height;
    float shortEdge = (width > height) ? height : width;


    if (P.id == 1848) { // 1848  2748
        //return true;
    }

    // 尺寸條件：長邊 6.5~35，短邊 4~35
    if (longEdge < 6.5f || longEdge > 35.0f) {
        return false;
    }
    if (shortEdge < 4.0f || shortEdge > 35.0f) {
        return false;
    }

    // 長寬比上限：長邊 ? 4 * 短邊
    if (longEdge > 4.0f * shortEdge) {
        return false;
    }


    if (!patch_has_hole_by_scanlines(v, faces, P, ex, ey)) {
        // 沒偵測到顯著孔洞/環結構，暫時視為非導孔端面
        //std::printf("[scan] patch %d has no hole by scanlines\n", P.id);
        return false;
    }

    // 收集「連接導孔端面」的邊（patch 與直立洞壁三角面之間的邊）
    // 直立洞壁條件：與 patch 法向量成 90° ± 3°
    const float cosPerp = std::cos(87.0f * 3.14159265f / 180.0f); // |dot| <= cos(87°)
    std::vector<std::pair<uint32_t, uint32_t>> connEdges;
    connEdges.reserve(64);

    // 也同時用這些邊的端點做 bounding box
    float umin = 1e30f, umax = -1e30f;
    float vmin = 1e30f, vmax = -1e30f;

    for (int fi : P.faces) {
        const FaceInfo& F = faces[(size_t)fi];
        uint32_t vs[3] = { F.i0, F.i1, F.i2 };

        for (int e = 0; e < 3; ++e) {
            uint32_t a = vs[e];
            uint32_t b = vs[(e + 1) % 3];

            EdgeKey key;
            if (a < b) { key.a = a; key.b = b; }
            else { key.a = b; key.b = a; }

            auto it = edgeMap.find(key);
            if (it == edgeMap.end())
                continue;

            const EdgeFaces& ef = it->second;
            int other = -1;
            if (ef.f0 == fi)      other = ef.f1;
            else if (ef.f1 == fi) other = ef.f0;
            if (other < 0)
                continue;

            // 另一側是同一個 patch，就不是端面?洞壁的連接
            if (faces[(size_t)other].patchId == P.id)
                continue;

            // 檢查另一側是否為「直立洞壁」
            Vec3 nWall = faces[(size_t)other].n;
            float lenW = norm(nWall);
            if (lenW < 0.5f)
                continue;

            float invW = 1.0f / lenW;
            nWall = v3(nWall.x * invW, nWall.y * invW, nWall.z * invW);
            float d = std::fabs(dot(nWall, nPatch)); // cos(angle)
            if (d > cosPerp)
                continue; // 不是 90°±3° 的直立洞壁

            // a-b 是導孔端面與直立洞壁之間的「連接邊」
            connEdges.emplace_back(a, b);

            Vec3 uvA = projectToPlane(a);
            Vec3 uvB = projectToPlane(b);

            umin = std::min(umin, std::min(uvA.x, uvB.x));
            umax = std::max(umax, std::max(uvA.x, uvB.x));
            vmin = std::min(vmin, std::min(uvA.y, uvB.y));
            vmax = std::max(vmax, std::max(uvA.y, uvB.y));
        }
    }

    if (connEdges.size() < 4) {
        return false; // 邊太少，不像一圈洞壁
    }
    // 用連接邊群的 bounding box 做尺寸篩選（3mm ~ 25mm 且接近方形）
    const float minDiameter = 3.0f;
    const float maxDiameter = 35.0f;

    float dx = umax - umin;
    float dy = vmax - vmin;
    if (dx <= 0.0f || dy <= 0.0f) {
        return false;
    }
    float minD = std::min(dx, dy);
    float maxD = std::max(dx, dy);
    if (minD < minDiameter || maxD > maxDiameter) {
        return false;
    }

    // 走訪每一個「連通邊群」，用邊與邊之間的夾角累積角度
    // 規則：存在任一連通邊群，其累積轉角 >= 220° 就視為導孔端面
    const float angleThreshold = 220.0f * 3.14159265f / 180.0f;

    std::vector<bool> edgeUsed(connEdges.size(), false);


    float db_maxA = 0;

    for (size_t startEdge = 0; startEdge < connEdges.size(); ++startEdge) {
        if (edgeUsed[startEdge])
            continue;

        // 新的一條「邊鏈」，先放入起始邊的兩個端點
        uint32_t v0 = connEdges[startEdge].first;
        uint32_t v1 = connEdges[startEdge].second;

        std::vector<uint32_t> seq;
        seq.reserve(connEdges.size() + 1);
        seq.push_back(v0);
        seq.push_back(v1);
        edgeUsed[startEdge] = true;

        // 先沿著 v1 這一端往前走（原本的單向邏輯）
        {
            uint32_t cur = v1;
            for (;;) {
                uint32_t next = (uint32_t)(-1);
                size_t   nextIdx = (size_t)(-1);

                for (size_t ei = 0; ei < connEdges.size(); ++ei) {
                    if (edgeUsed[ei])
                        continue;

                    const auto& e = connEdges[ei];
                    if (e.first == cur) {
                        next = e.second;
                        nextIdx = ei;
                        break;
                    }
                    if (e.second == cur) {
                        next = e.first;
                        nextIdx = ei;
                        break;
                    }
                }

                if (nextIdx == (size_t)(-1))
                    break; // 這一端走到開放端

                edgeUsed[nextIdx] = true;
                seq.push_back(next);
                cur = next;

                if (cur == v0)
                    break; // 回到起點，形成環（完整圈已經涵蓋）
            }
        }

        // 再從 v0 這一端「反向」走，把整條 open chain 補滿
        {
            uint32_t cur = v0;
            for (;;) {
                uint32_t prev = (uint32_t)(-1);
                size_t   prevIdx = (size_t)(-1);

                for (size_t ei = 0; ei < connEdges.size(); ++ei) {
                    if (edgeUsed[ei])
                        continue;

                    const auto& e = connEdges[ei];
                    if (e.first == cur) {
                        prev = e.second;
                        prevIdx = ei;
                        break;
                    }
                    if (e.second == cur) {
                        prev = e.first;
                        prevIdx = ei;
                        break;
                    }
                }

                if (prevIdx == (size_t)(-1))
                    break; // 另一端也走到開放端（或沒有更多連結）

                edgeUsed[prevIdx] = true;
                // 插到 seq 的前面，保持頂點順序連續
                seq.insert(seq.begin(), prev);
                cur = prev;
            }
        }

        if (seq.size() < 3)
            continue;

        // 後面累積角度的部分維持不變

        float accum = 0.0f;
        for (size_t i = 0; i + 2 < seq.size(); ++i) {
            Vec3 p0 = projectToPlane(seq[i + 0]);
            Vec3 p1 = projectToPlane(seq[i + 1]);
            Vec3 p2 = projectToPlane(seq[i + 2]);

            Vec3 t0 = v3(p1.x - p0.x, p1.y - p0.y, 0.0f);
            Vec3 t1 = v3(p2.x - p1.x, p2.y - p1.y, 0.0f);

            float len0 = norm(t0);
            float len1 = norm(t1);
            if (len0 < 1e-4f || len1 < 1e-4f)
                continue;

            float inv0 = 1.0f / len0;
            float inv1 = 1.0f / len1;
            t0 = v3(t0.x * inv0, t0.y * inv0, 0.0f);
            t1 = v3(t1.x * inv1, t1.y * inv1, 0.0f);

            float d = clampf(dot(t0, t1), -1.0f, 1.0f);
            float ang = std::acos(d); // >= 0
            accum += ang;
        }


        if (accum > db_maxA)
            db_maxA = accum;


        if (accum >= angleThreshold) {
            //printf("[ok]: %d\n", P.id);
            return true;
        }
    }

    return false;
}


// ============ 階段 3：從所有導孔面中挑選參考面（只用法向關係） ============
//
// 對每一個候選導孔面 i：
//   ni = normalize(Pi->avgNormal)
//   score(i) = sum_j max( dot(ni, nj), 0 )
// 分數愈高，代表「以 i 為參考旋轉後，其他導孔面的平均方向愈接近 +Z」。
//
static PatchInfo* pick_best_drill_patch_stage3(const std::vector<PatchInfo*>& drillPatches)
{
    if (drillPatches.empty())
        return nullptr;

    PatchInfo* best = nullptr;
    float bestScore = std::numeric_limits<float>::lowest();

    const int m = (int)drillPatches.size();
    for (int i = 0; i < m; ++i) {
        PatchInfo* Pi = drillPatches[i];
        if (!Pi)
            continue;

        Vec3 ni = normalize(Pi->avgNormal);
        if (norm(ni) < 1e-6f)
            continue;

        float score = 0.0f;

        for (int j = 0; j < m; ++j) {
            PatchInfo* Pj = drillPatches[j];
            if (!Pj)
                continue;

            Vec3 nj = normalize(Pj->avgNormal);
            if (norm(nj) < 1e-6f)
                continue;

            float d = ni.x * nj.x + ni.y * nj.y + ni.z * nj.z;
            if (d < 0.0f) d = 0.0f;  // 只計算「轉完朝上的部分」
            score += d;
        }

        if (score > bestScore) {
            bestScore = score;
            best = Pi;
        }
    }

    return best;
}


// ======================== 主搜尋流程 ========================

static GuideSearchResult find_guide_direction(
    const float* v,
    int              nv,
    const uint32_t* tri,
    int              ntri
) {
    GuideSearchResult res;
    if (!v || !tri || nv <= 0 || ntri <= 0) {
        return res;
    }

    const int nFaces = ntri;

    // --- 模型尺度估計（目前沒用，但保留） ---
    Vec3 bbmin, bbmax;
    aabb_min_max(v, nv, bbmin, bbmax);
    float dx = bbmax.x - bbmin.x;
    float dy = bbmax.y - bbmin.y;
    float dz = bbmax.z - bbmin.z;
    float diag = norm(v3(dx, dy, dz));
    if (diag <= 0.0f) diag = 1.0f;
    (void)diag;

    // --- Step 1: 頂點量化合併 ---
    struct VKey { int ix, iy, iz; };
    struct VKeyHash {
        size_t operator()(const VKey& k) const noexcept {
            return ((size_t)k.ix * 73856093u)
                ^ ((size_t)k.iy * 19349663u)
                ^ ((size_t)k.iz * 83492791u);
        }
    };
    struct VKeyEq {
        bool operator()(const VKey& a, const VKey& b) const noexcept {
            return a.ix == b.ix && a.iy == b.iy && a.iz == b.iz;
        }
    };

    const float eps = 1e-4f;
    const float invEps = 1.0f / eps;

    std::unordered_map<VKey, uint32_t, VKeyHash, VKeyEq> vmap;
    vmap.reserve((size_t)nv * 2u);
    std::vector<uint32_t> repOfVertex((size_t)nv);

    for (int i = 0; i < nv; ++i) {
        Vec3 p = load_vtx(v, (uint32_t)i);
        int ix = (int)std::floor(p.x * invEps + 0.5f);
        int iy = (int)std::floor(p.y * invEps + 0.5f);
        int iz = (int)std::floor(p.z * invEps + 0.5f);
        VKey key{ ix, iy, iz };
        auto it = vmap.find(key);
        if (it == vmap.end()) {
            vmap.emplace(key, (uint32_t)i);
            repOfVertex[(size_t)i] = (uint32_t)i;
        }
        else {
            repOfVertex[(size_t)i] = it->second;
        }
    }

    std::vector<uint32_t> triMerged((size_t)ntri * 3u);
    for (int t = 0; t < ntri; ++t) {
        uint32_t i0 = tri[3 * t + 0];
        uint32_t i1 = tri[3 * t + 1];
        uint32_t i2 = tri[3 * t + 2];
        triMerged[3 * t + 0] = repOfVertex[i0];
        triMerged[3 * t + 1] = repOfVertex[i1];
        triMerged[3 * t + 2] = repOfVertex[i2];
    }

    // --- Step 2: 建 FaceInfo ---
    std::vector<FaceInfo> faces;
    faces.reserve((size_t)nFaces);

    for (int t = 0; t < nFaces; ++t) {
        uint32_t i0 = triMerged[3 * t + 0];
        uint32_t i1 = triMerged[3 * t + 1];
        uint32_t i2 = triMerged[3 * t + 2];

        Vec3 p0 = load_vtx(v, i0);
        Vec3 p1 = load_vtx(v, i1);
        Vec3 p2 = load_vtx(v, i2);

        Vec3 e1 = v3(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z);
        Vec3 e2 = v3(p2.x - p0.x, p2.y - p0.y, p2.z - p0.z);
        Vec3 c = cross(e1, e2);
        float L = norm(c);
        Vec3 n = (L > 0.0f) ? v3(c.x / L, c.y / L, c.z / L) : v3(0, 0, 0);

        Vec3 centroid = v3(
            (p0.x + p1.x + p2.x) / 3.0f,
            (p0.y + p1.y + p2.y) / 3.0f,
            (p0.z + p1.z + p2.z) / 3.0f
        );

        FaceInfo F;
        F.i0 = i0; F.i1 = i1; F.i2 = i2;
        F.n = n;
        F.c = centroid;
        F.patchId = -1;
        faces.push_back(F);
    }

    if (faces.empty()) {
        return res;
    }

    // --- Step 3: edge map + adjacency for region growing ---
    std::unordered_map<EdgeKey, EdgeFaces, EdgeKeyHash, EdgeKeyEq> edgeMap;
    edgeMap.reserve((size_t)nFaces * 3u);
    std::vector<std::vector<int>> adjFaces((size_t)nFaces);

    auto addEdge = [&](uint32_t i0, uint32_t i1, int fIdx) {
        EdgeKey key;
        if (i0 < i1) { key.a = i0; key.b = i1; }
        else { key.a = i1; key.b = i0; }
        auto it = edgeMap.find(key);
        if (it == edgeMap.end()) {
            EdgeFaces ef;
            ef.f0 = fIdx;
            edgeMap.emplace(key, ef);
        }
        else {
            if (it->second.f1 == -1) {
                it->second.f1 = fIdx;
                int other = it->second.f0;
                if (other >= 0) {
                    adjFaces[(size_t)fIdx].push_back(other);
                    adjFaces[(size_t)other].push_back(fIdx);
                }
            }
        }
        };

    for (int f = 0; f < nFaces; ++f) {
        const FaceInfo& F = faces[(size_t)f];
        addEdge(F.i0, F.i1, f);
        addEdge(F.i1, F.i2, f);
        addEdge(F.i2, F.i0, f);
    }

    // --- Step 4: 以 2° region growing 形成平坦 patch ---
    const float PI = (float)std::acos(-1.0);
    const float cosGrow = std::cos(2.0f * PI / 180.0f);

    std::vector<PatchInfo> patches;
    patches.reserve(1024);
    int nextPatchId = 0;

    for (int f0 = 0; f0 < nFaces; ++f0) {
        if (faces[(size_t)f0].patchId != -1) continue;
        if (norm(faces[(size_t)f0].n) < 0.5f) {
            faces[(size_t)f0].patchId = -2;
            continue;
        }

        int pid = nextPatchId++;
        PatchInfo P;
        P.id = pid;
        P.area = 0.0f;
        P.avgNormal = v3(0, 0, 0);
        P.maxAngleDeg = 0.0f;
        P.boundaryEdges = 0;
        P.verticalWalls = 0;
        P.center = v3(0, 0, 0);

        Vec3 nSeed = faces[(size_t)f0].n;

        std::queue<int> Q;
        Q.push(f0);
        faces[(size_t)f0].patchId = pid;

        while (!Q.empty()) {
            int fIdx = Q.front(); Q.pop();
            P.faces.push_back(fIdx);

            for (int fn : adjFaces[(size_t)fIdx]) {
                if (faces[(size_t)fn].patchId != -1) continue;
                Vec3 n = faces[(size_t)fn].n;
                if (norm(n) < 0.5f) {
                    faces[(size_t)fn].patchId = -2;
                    continue;
                }
                if (dot(n, nSeed) >= cosGrow) {
                    faces[(size_t)fn].patchId = pid;
                    Q.push(fn);
                }
            }
        }

        patches.push_back(P);
    }

    if (patches.empty()) {
        res.found = true;
        res.dir = v3(0, 0, 1);
        return res;
    }

    // --- Step 5: per-patch avgNormal / area / maxAngleDeg / center ---
    for (PatchInfo& P : patches) {
        Vec3 sumN = v3(0, 0, 0);
        float areaSum = 0.0f;
        Vec3 sumC = v3(0, 0, 0);

        for (int fi : P.faces) {
            FaceInfo& F = faces[(size_t)fi];
            Vec3 p0 = load_vtx(v, F.i0);
            Vec3 p1 = load_vtx(v, F.i1);
            Vec3 p2 = load_vtx(v, F.i2);
            Vec3 e1 = v3(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z);
            Vec3 e2 = v3(p2.x - p0.x, p2.y - p0.y, p2.z - p0.z);
            float A = 0.5f * norm(cross(e1, e2));

            areaSum += A;
            sumN = v3(sumN.x + F.n.x * A,
                sumN.y + F.n.y * A,
                sumN.z + F.n.z * A);

            sumC = v3(sumC.x + F.c.x * A,
                sumC.y + F.c.y * A,
                sumC.z + F.c.z * A);
        }

        P.area = areaSum;
        P.avgNormal = normalize(sumN);
        if (areaSum > 0.0f) {
            P.center = v3(sumC.x / areaSum,
                sumC.y / areaSum,
                sumC.z / areaSum);
        }
        else {
            P.center = v3(0, 0, 0);
        }

        float maxAng = 0.0f;
        for (int fi : P.faces) {
            Vec3 n = faces[(size_t)fi].n;
            float c = dot(n, P.avgNormal);
            if (c > 1.0f) c = 1.0f;
            if (c < -1.0f) c = -1.0f;
            float ang = std::acos(c) * 180.0f / PI;
            if (ang > maxAng) maxAng = ang;
        }
        P.maxAngleDeg = maxAng;
    }

    // ---------- Step 6: 統計 boundaryEdges / verticalWalls（debug 用） ----------
    auto forEachFaceEdge = [&](int fIdx, auto&& func) {
        const FaceInfo& F = faces[(size_t)fIdx];
        uint32_t vs[3] = { F.i0, F.i1, F.i2 };
        for (int e = 0; e < 3; ++e) {
            uint32_t a = vs[e];
            uint32_t b = vs[(e + 1) % 3];
            EdgeKey key;
            if (a < b) { key.a = a; key.b = b; }
            else { key.a = b; key.b = a; }
            func(key, fIdx);
        }
        };

    // 這裡保留舊的直立牆統計（10°），純 debug，不參與階段 2 判斷
    const float cosVertical = std::cos(80.0f * 3.14159265f / 180.0f);

    int dbg_considered = 0;
    int dbg_hasBoundary = 0;

    for (PatchInfo& P : patches) {
        int boundary = 0;
        int vwalls = 0;

        Vec3 nPatch = P.avgNormal;
        if (norm(nPatch) < 0.5f) {
            continue;
        }

        dbg_considered++;

        for (int fi : P.faces) {
            forEachFaceEdge(fi, [&](const EdgeKey& key, int selfFace) {
                auto it = edgeMap.find(key);
                if (it == edgeMap.end()) return;
                const EdgeFaces& ef = it->second;

                int other = -1;
                if (ef.f0 == selfFace)      other = ef.f1;
                else if (ef.f1 == selfFace) other = ef.f0;

                // 另一側不是同一個 patch => boundary edge
                if (other < 0 || faces[(size_t)other].patchId != P.id) {
                    boundary++;

                    // 如果另一側有面，就看是不是接近垂直的「牆」
                    if (other >= 0) {
                        Vec3 nWall = faces[(size_t)other].n;
                        if (norm(nWall) > 0.5f) {
                            float d = std::fabs(dot(nWall, nPatch)); // cos(angle)
                            if (d < cosVertical) {
                                vwalls++;
                            }
                        }
                    }
                }
                });
        }

        P.boundaryEdges = boundary;
        P.verticalWalls = vwalls;

        if (boundary > 0) {
            dbg_hasBoundary++;

            if ((int)P.faces.size() >= 20 && P.maxAngleDeg <= 2.0f) {
                float vratio = (boundary > 0)
                    ? (float)vwalls / (float)boundary
                    : 0.0f;
                float dotZ = nPatch.z;
            }
        }
    }

    // ---------- Step 7: 階段 2：篩選「導孔端面」候選 ----------
    std::vector<PatchInfo*> drillPatches;
    drillPatches.reserve(patches.size());

    for (PatchInfo& P : patches) {
        // 面數太少直接跳過，避免小雜訊
        if (P.faces.size() < 5 || P.area <= 0.0f)
            continue;

        if (!isDrillPatchByEdges(v, edgeMap, faces, P))
            continue;

        drillPatches.push_back(&P);

        float vratio = (P.boundaryEdges > 0)
            ? (float)P.verticalWalls / (float)P.boundaryEdges
            : 0.0f;
    }

    GuideSearchResult r{};
    r.found = false;
    r.dir = v3(0.0f, 0.0f, 1.0f);

    if (drillPatches.empty()) {
        return r;
    }

    PatchInfo* best = pick_best_drill_patch_stage3(drillPatches);
    if (!best) {
        return r;  // 保持 found=false, dir=(0,0,1)
    }

    r.found = true;
    r.dir = normalize(best->avgNormal);

    return r;
}

// ======================== 對外 API ========================

int compute_auto_orientation_SurgGuide_mod(
    const float* v,
    int              nv,
    const uint32_t* tri,
    int              ntri,
    float            out_rad3[3]
) {
    if (!v || nv <= 0 || !out_rad3) {
        return DAO_ERR_BAD_INPUT;
    }

    // tri 容錯：若 ntri 明顯是 index 數量，轉成三角形數
    if (tri && ntri > nv) {
        ntri /= 3;
    }
    if (!tri || ntri <= 0) {
        out_rad3[0] = out_rad3[1] = out_rad3[2] = 0.0f;
        return DAO_ERR_BAD_INPUT;
    }

    GuideSearchResult r = find_guide_direction(v, nv, tri, ntri);

    if (!r.found) {
        out_rad3[0] = out_rad3[1] = out_rad3[2] = 0.0f;
        return DAO_OK;
    }

    // 導孔方向要朝 -Z
    Vec3 target = v3(r.dir.x, r.dir.y, r.dir.z);
    normal_to_euler_XYZ_align_to_minusZ(target, out_rad3);

    return DAO_OK;
}
