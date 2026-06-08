#pragma once
#include <cmath>

namespace dao_m {

	struct Vec3 { float x, y, z; };
	struct Mat3 { float m[9]; }; // row-major

	inline Vec3 v3(float x, float y, float z) { return { x,y,z }; }

	float  dot(const Vec3& a, const Vec3& b);
	Vec3   cross(const Vec3& a, const Vec3& b);
	float  norm(const Vec3& a);
	Vec3   normalize(const Vec3& a);

	Mat3   I3();
	Mat3   mul(const Mat3& A, const Mat3& B);
	Vec3   mul(const Mat3& R, const Vec3& v);

	// shortest rotation mapping u -> v (Rodrigues + 180¢X fallback)
	Mat3   rot_from_u_to_v(Vec3 u, Vec3 v);

	// AABB utilities
	void   aabb_min_max(const float* v, int nv, Vec3& out_min, Vec3& out_max);

} // namespace dao_m
