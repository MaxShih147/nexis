#include "dao_math.h"
#include <algorithm>
#include <cmath>

namespace dao_m {

    float dot(const Vec3& a, const Vec3& b) { return a.x * b.x + a.y * b.y + a.z * b.z; }

    Vec3 cross(const Vec3& a, const Vec3& b) {
        return { a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x };
    }

    float norm(const Vec3& a) { return std::sqrt(dot(a, a)); }

    Vec3 normalize(const Vec3& a) {
        float n = norm(a);
        if (n > 0.f) return { a.x / n, a.y / n, a.z / n };
        return { 0.f,0.f,0.f };
    }

    Mat3 I3() { return Mat3{ { 1,0,0, 0,1,0, 0,0,1 } }; }

    Mat3 mul(const Mat3& A, const Mat3& B) {
        Mat3 C{ {0} };
        for (int r = 0; r < 3; r++)
            for (int c = 0; c < 3; c++)
                C.m[r * 3 + c] = A.m[r * 3 + 0] * B.m[0 * 3 + c] + A.m[r * 3 + 1] * B.m[1 * 3 + c] + A.m[r * 3 + 2] * B.m[2 * 3 + c];
        return C;
    }

    Vec3 mul(const Mat3& R, const Vec3& v) {
        return {
          R.m[0] * v.x + R.m[1] * v.y + R.m[2] * v.z,
          R.m[3] * v.x + R.m[4] * v.y + R.m[5] * v.z,
          R.m[6] * v.x + R.m[7] * v.y + R.m[8] * v.z
        };
    }

    Mat3 rot_from_u_to_v(Vec3 u, Vec3 v) {
        u = normalize(u); v = normalize(v);
        float c = dot(u, v);
        if (c > 0.999999f) return I3();

        Vec3 k = cross(u, v);
        float s = norm(k);

        if (s < 1e-8f) { // 180¢X
            Vec3 axis = (std::fabs(u.x) > 0.9f) ? v3(0, 1, 0) : v3(1, 0, 0);
            k = normalize(cross(u, axis));
            float x = k.x, y = k.y, z = k.z;
            return Mat3{ { -1 + 2 * x * x, 2 * x * y,   2 * x * z,
                          2 * y * x,   -1 + 2 * y * y, 2 * y * z,
                          2 * z * x,    2 * z * y,  -1 + 2 * z * z } };
        }

        // Rodrigues with unit k = k/s (so s == 1). We use: R = I + K + K^2*(1-c)
        k = { k.x / s, k.y / s, k.z / s };
        float x = k.x, y = k.y, z = k.z;
        Mat3 K{ { 0,-z, y,  z,0,-x,  -y,x,0 } };
        // K2 = K*K
        Mat3 K2{ {0} };
        for (int r = 0; r < 3; r++)
            for (int c2 = 0; c2 < 3; c2++)
                K2.m[r * 3 + c2] = K.m[r * 3 + 0] * K.m[0 * 3 + c2] + K.m[r * 3 + 1] * K.m[1 * 3 + c2] + K.m[r * 3 + 2] * K.m[2 * 3 + c2];

        Mat3 R = I3();
        for (int i = 0; i < 9; i++) R.m[i] += K.m[i] + K2.m[i] * (1.0f - c);
        return R;
    }

    void aabb_min_max(const float* v, int nv, Vec3& out_min, Vec3& out_max) {
        out_min = { v[0], v[1], v[2] };
        out_max = out_min;
        for (int i = 1; i < nv; i++) {
            const float* p = v + i * 3;
            out_min.x = std::min(out_min.x, p[0]);
            out_min.y = std::min(out_min.y, p[1]);
            out_min.z = std::min(out_min.z, p[2]);
            out_max.x = std::max(out_max.x, p[0]);
            out_max.y = std::max(out_max.y, p[1]);
            out_max.z = std::max(out_max.z, p[2]);
        }
    }

} // namespace dao_m
