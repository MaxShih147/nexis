// auto_orient_splint.cpp
// Splint (咬合板/牙合墊) 自動旋轉：
// 1) 用 3D PCA 找出物件「最薄方向」(n_thin)
// 2) 將 n_thin 大致對齊 Z 軸，先把物件放平 (R0)
// 3) 在放平座標系下，用上下兩側三角面的法向「傾斜度」判斷牙合面在上/下
//    若牙合面在下，做一次 Z 翻轉，讓牙合面朝上、平面朝下，得到 R_final

#include <cstdint>
#include <cmath>
#include <vector>
#include <limits>
#include <cstdio>

#include "dao_api.h"
#include "dao_math.h"

using std::uint32_t;
using dao_m::Vec3;
using dao_m::Mat3;
using dao_m::v3;
using dao_m::dot;
using dao_m::cross;
using dao_m::norm;
using dao_m::mul;
using dao_m::rot_from_u_to_v;

// 小工具 ---------------------------------------------------------------------

static inline Vec3 load_vtx(const float* v, uint32_t idx) {
    const float* p = v + idx * 3u;
    return v3(p[0], p[1], p[2]);
}

static inline float clampf(float x, float lo, float hi) {
    return (x < lo) ? lo : (x > hi ? hi : x);
}

// Mat3 -> XYZ Euler (R = Rz * Ry * Rx)
static inline void mat3_to_euler_XYZ(const Mat3& R, float out_rad3[3]) {
    using std::asin;
    using std::atan2;
    using std::cos;
    using std::fabs;

    const float R00 = R.m[0];
    const float R01 = R.m[1];
    const float R02 = R.m[2];
    const float R10 = R.m[3];
    const float R11 = R.m[4];
    const float R12 = R.m[5];
    const float R20 = R.m[6];
    const float R21 = R.m[7];
    const float R22 = R.m[8];

    float ry = -asin(clampf(R20, -1.0f, 1.0f));
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

// 對稱 3x3 矩陣，用 Jacobi 做特徵分解 ---------------------------------------

struct Sym3 {
    double m[3][3]; // row-major, 對稱
};

static Sym3 make_cov3(double cxx, double cxy, double cxz,
    double cyy, double cyz, double czz) {
    Sym3 A;
    A.m[0][0] = cxx; A.m[0][1] = cxy; A.m[0][2] = cxz;
    A.m[1][0] = cxy; A.m[1][1] = cyy; A.m[1][2] = cyz;
    A.m[2][0] = cxz; A.m[2][1] = cyz; A.m[2][2] = czz;
    return A;
}

// 3x3 Jacobi 分解（特徵值 + 特徵向量）
static void jacobi_eigen_decomposition(const Sym3& Ain, double eval[3], Vec3 evec[3]) {
    Sym3 A = Ain;
    double V[3][3] = {
        {1.0, 0.0, 0.0},
        {0.0, 1.0, 0.0},
        {0.0, 0.0, 1.0}
    };

    const int MAX_IT = 24;
    const double EPS = 1e-12;

    for (int it = 0; it < MAX_IT; ++it) {
        int p = 0, q = 1;
        double max_off = std::fabs(A.m[0][1]);
        double v02 = std::fabs(A.m[0][2]);
        if (v02 > max_off) { max_off = v02; p = 0; q = 2; }
        double v12 = std::fabs(A.m[1][2]);
        if (v12 > max_off) { max_off = v12; p = 1; q = 2; }

        if (max_off < EPS)
            break;

        double app = A.m[p][p];
        double aqq = A.m[q][q];
        double apq = A.m[p][q];

        double phi = 0.5 * std::atan2(2.0 * apq, (aqq - app));
        double c = std::cos(phi);
        double s = std::sin(phi);

        for (int k = 0; k < 3; ++k) {
            double aik = A.m[k][p];
            double akq = A.m[k][q];
            A.m[k][p] = c * aik - s * akq;
            A.m[k][q] = s * aik + c * akq;
        }
        for (int k = 0; k < 3; ++k) {
            double akp = A.m[p][k];
            double akq = A.m[q][k];
            A.m[p][k] = c * akp - s * akq;
            A.m[q][k] = s * akp + c * akq;
        }

        A.m[0][1] = A.m[1][0];
        A.m[0][2] = A.m[2][0];
        A.m[1][2] = A.m[2][1];

        for (int k = 0; k < 3; ++k) {
            double vip = V[k][p];
            double viq = V[k][q];
            V[k][p] = c * vip - s * viq;
            V[k][q] = s * vip + c * viq;
        }
    }

    for (int i = 0; i < 3; ++i) {
        eval[i] = A.m[i][i];
        evec[i].x = (float)V[0][i];
        evec[i].y = (float)V[1][i];
        evec[i].z = (float)V[2][i];
    }
}

// 主程式 ----------------------------------------------------------------------

int compute_auto_orientation_Splint_mod(
    const float* v, int nv,
    const uint32_t* tri, int ntri,
    float out_rad3[3]
) {
    if (!v || nv <= 0 || !out_rad3) return DAO_ERR_BAD_INPUT;

    if (ntri > nv) ntri /= 3;
    if (!tri || ntri <= 0) {
        out_rad3[0] = out_rad3[1] = out_rad3[2] = 0.0f;
        return DAO_OK;
    }

    if (nv < 3) {
        out_rad3[0] = out_rad3[1] = out_rad3[2] = 0.0f;
        return DAO_OK;
    }

    // -------------------------------------------------------------------------
    // Step 1: 用頂點共變異矩陣找最薄方向 n_thin
    // -------------------------------------------------------------------------
    int stride = 1;
    if (nv > 400000)      stride = 8;
    else if (nv > 200000) stride = 4;
    else if (nv > 100000) stride = 2;

    double mx = 0.0, my = 0.0, mz = 0.0;
    int count = 0;
    for (int i = 0; i < nv; i += stride) {
        Vec3 p = load_vtx(v, (uint32_t)i);
        mx += p.x;
        my += p.y;
        mz += p.z;
        ++count;
    }
    if (count == 0) {
        out_rad3[0] = out_rad3[1] = out_rad3[2] = 0.0f;
        return DAO_OK;
    }
    mx /= (double)count;
    my /= (double)count;
    mz /= (double)count;

    double cxx = 0.0, cxy = 0.0, cxz = 0.0;
    double cyy = 0.0, cyz = 0.0, czz = 0.0;

    for (int i = 0; i < nv; i += stride) {
        Vec3 p = load_vtx(v, (uint32_t)i);
        double x = (double)p.x - mx;
        double y = (double)p.y - my;
        double z = (double)p.z - mz;

        cxx += x * x;
        cxy += x * y;
        cxz += x * z;
        cyy += y * y;
        cyz += y * z;
        czz += z * z;
    }

    if (cxx + cyy + czz <= 0.0) {
        out_rad3[0] = out_rad3[1] = out_rad3[2] = 0.0f;
        return DAO_OK;
    }

    Sym3 C = make_cov3(cxx, cxy, cxz, cyy, cyz, czz);

    double eval[3];
    Vec3   evec[3];
    jacobi_eigen_decomposition(C, eval, evec);

    int idx_min = 0;
    if (eval[1] < eval[idx_min]) idx_min = 1;
    if (eval[2] < eval[idx_min]) idx_min = 2;

    Vec3 n_thin = evec[idx_min];

    float lenv = std::sqrt(n_thin.x * n_thin.x + n_thin.y * n_thin.y + n_thin.z * n_thin.z);
    if (lenv < 1e-8f) {
        out_rad3[0] = out_rad3[1] = out_rad3[2] = 0.0f;
        return DAO_OK;
    }
    n_thin.x /= lenv;
    n_thin.y /= lenv;
    n_thin.z /= lenv;

    // -------------------------------------------------------------------------
    // Step 2: 將最薄方向大致對齊 Z 軸，得到基礎旋轉 R0
    // -------------------------------------------------------------------------
    Vec3 z_up = v3(0.0f, 0.0f, 1.0f);
    Vec3 z_down = v3(0.0f, 0.0f, -1.0f);

    float dot_up = dot(n_thin, z_up);
    float dot_down = dot(n_thin, z_down);
    float dot_abs = std::fabs(dot_up);

    const float cos_eps = 0.996f; // 約 5°

    Mat3 R0;
    if (dot_abs >= cos_eps) {
        // 已接近 ±Z，不再額外旋轉
        R0 = Mat3{ {
            1.0f, 0.0f, 0.0f,
            0.0f, 1.0f, 0.0f,
            0.0f, 0.0f, 1.0f
        } };
    }
    else {
        Vec3 target = (dot_up >= dot_down) ? z_up : z_down;
        R0 = rot_from_u_to_v(n_thin, target);
    }

    // -------------------------------------------------------------------------
    // Step 3: 在 R0 座標下，用上下三角面傾斜度判斷牙合面在上/下
    // -------------------------------------------------------------------------
    double zmin = std::numeric_limits<double>::infinity();
    double zmax = -std::numeric_limits<double>::infinity();

    for (int i = 0; i < nv; i += stride) {
        Vec3 p = load_vtx(v, (uint32_t)i);
        Vec3 q = mul(R0, p);
        double z = (double)q.z;
        if (z < zmin) zmin = z;
        if (z > zmax) zmax = z;
    }

    double thickness_z = zmax - zmin;
    if (thickness_z <= 1e-6) {
        Mat3 R_final0 = R0;
        mat3_to_euler_XYZ(R_final0, out_rad3);
        //std::printf("[SPLINT] n_thin=(%.5f, %.5f, %.5f) STEP3 degenerate thickness_z=%.6f\n",
        //    n_thin.x, n_thin.y, n_thin.z, thickness_z);
        return DAO_OK;
    }

    const double beta = 0.25; // 上下各取 1/4 厚度範圍
    double z_top_min = zmax - beta * thickness_z;
    double z_bot_max = zmin + beta * thickness_z;

    double total_area = 0.0;
    double top_area = 0.0, top_tilt_sum = 0.0;
    double bot_area = 0.0, bot_tilt_sum = 0.0;

    for (int t = 0; t < ntri; ++t) {
        uint32_t i0 = tri[t * 3 + 0];
        uint32_t i1 = tri[t * 3 + 1];
        uint32_t i2 = tri[t * 3 + 2];
        if (i0 >= (uint32_t)nv || i1 >= (uint32_t)nv || i2 >= (uint32_t)nv) continue;

        Vec3 p0 = load_vtx(v, i0);
        Vec3 p1 = load_vtx(v, i1);
        Vec3 p2 = load_vtx(v, i2);

        Vec3 e1 = v3(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z);
        Vec3 e2 = v3(p2.x - p0.x, p2.y - p0.y, p2.z - p0.z);
        Vec3 c = cross(e1, e2);
        float L = norm(c);
        if (L <= 0.0f) continue;

        float area = 0.5f * L;
        total_area += area;

        Vec3 n_unit = v3(c.x / L, c.y / L, c.z / L);

        Vec3 q0 = mul(R0, p0);
        Vec3 q1 = mul(R0, p1);
        Vec3 q2 = mul(R0, p2);
        double cz = ((double)q0.z + (double)q1.z + (double)q2.z) / 3.0;

        Vec3 nR = mul(R0, n_unit);
        double nz = (double)nR.z;
        if (nz < -1.0) nz = -1.0;
        if (nz > 1.0) nz = 1.0;
        double tilt = std::sqrt(std::max(0.0, 1.0 - nz * nz)); // 偏離 Z 的程度

        if (cz >= z_top_min) {
            top_area += area;
            top_tilt_sum += area * tilt;
        }
        else if (cz <= z_bot_max) {
            bot_area += area;
            bot_tilt_sum += area * tilt;
        }
    }

    bool do_flip = false;
    double tilt_top = 0.0, tilt_bot = 0.0;

    if (top_area > 0.0 && bot_area > 0.0 && total_area > 0.0) {
        tilt_top = top_tilt_sum / top_area;
        tilt_bot = bot_tilt_sum / bot_area;

        double diff = std::fabs(tilt_top - tilt_bot);
        double max_tilt = std::max(tilt_top, tilt_bot);

        const double min_rel = 0.2;  // 相對差至少 20%
        const double min_abs = 0.05; // 絕對差至少 0.05

        if (max_tilt > 0.0 && diff > min_abs && diff / max_tilt > min_rel) {
            if (tilt_bot > tilt_top) {
                // 下側較粗 → 牙合面在下 → 需翻轉
                do_flip = true;
            }
        }
    }

    Mat3 R_flip = Mat3{ {
        1.0f, 0.0f, 0.0f,
        0.0f, 1.0f, 0.0f,
        0.0f, 0.0f,-1.0f
    } };

    Mat3 R_final = do_flip ? mul(R_flip, R0) : R0;
    
    // 輸出 Euler 角
    mat3_to_euler_XYZ(R_final, out_rad3);

    return DAO_OK;
}
