define([
	'goo/math/Vector3',
	'goo/math/MathUtils'
], function (
	Vector3,
	MathUtils
) {
	'use strict';

	/**
	 * Constructs a new ray.
	 */
	function Ray(origin, direction, length) {

		this.origin = new Vector3();
		this.direction = new Vector3();
		this.inverseDirection = new Vector3();
		this.length = Number.MAX_SAFE_INTEGER;

		this.constructOriginDirection(origin || Vector3.ZERO, direction || Vector3.UNIT_Z, length || Number.MAX_SAFE_INTEGER);
	}

	var tmpVec1 = new Vector3();
	var tmpVec2 = new Vector3();
	var tmpVec3 = new Vector3();
	var tmpVec4 = new Vector3();


	/**
	 * @param direction Vector3
	 * @returns this
	 */
	Ray.prototype.setDirection = function (direction) {
		this.direction.setVector(direction);
		this.inverseDirection.setDirect(MathUtils.safeInvert(direction.x),MathUtils.safeInvert(direction.y),MathUtils.safeInvert(direction.z));
		return this;
	};


	/**
	 * constructs a ray given an origin, direction and length
	 * @param {Vector3} origin
	 * @param {Vector3} direction
	 * @param {number} length
	 * @returns this
	 */
	Ray.prototype.constructOriginDirection = function (origin, direction, length) {

		this.origin.setVector(origin);

		this.direction.setVector(direction);
		this.setDirection(this.direction);

		this.length = length;
		return this;
	}

	/**
	 * constructs a ray given a from and a to vector
	 * @param from Vector3
	 * @param to Vector3
	 * @returns this
	 */
	Ray.prototype.constructFromTo = function (from, to) {

		this.origin.setVector(from);

		this.direction.setVector(to);
		this.direction.subVector(from);

		this.normalizeDirection();
		this.setDirection(this.direction);

		return this;
	};

	/**
	 * Check for intersection of this ray and and a quad or triangle, either just inside the shape or for the plane defined by the shape (doPlanar == true)
	 *
	 * @param polygonVertices 3 or 4 vector3s defining a triangle or quad
	 * @param [doPlanar]
	 * @param locationStore Vector3 to store our intersection point in.
	 * @returns true if this ray intersects a polygon described by the given vertices.
	 */
	Ray.prototype.intersects = function (polygonVertices, doPlanar, locationStore) {
		if (polygonVertices.length === 3) {
			return this.intersectsTriangle(polygonVertices[0], polygonVertices[1], polygonVertices[2], doPlanar, locationStore);
		} else if (polygonVertices.length === 4) {
			return this.intersectsTriangle(polygonVertices[0], polygonVertices[1], polygonVertices[2], doPlanar, locationStore)
				|| this.intersectsTriangle(polygonVertices[0], polygonVertices[2], polygonVertices[3], doPlanar, locationStore);
		}
		return false;
	};

	/**
	 * Ray vs triangle implementation.
	 *
	 * @param pointA First
	 * @param pointB
	 * @param pointC
	 * @param [doPlanar]
	 * @param [locationStore]
	 * @returns true if this ray intersects a triangle formed by the given three points.
	 */
	Ray.prototype.intersectsTriangle = function (pointA, pointB, pointC, doPlanar, locationStore) {
		var diff = tmpVec1.setVector(this.origin).subVector(pointA);
		var edge1 = tmpVec2.setVector(pointB).subVector(pointA);
		var edge2 = tmpVec3.setVector(pointC).subVector(pointA);
		var norm = tmpVec4.setVector(edge1).cross(edge2);

		var dirDotNorm = this.direction.dot(norm);
		var sign;
		if (dirDotNorm > MathUtils.EPSILON) {
			sign = 1.0;
		} else if (dirDotNorm < -MathUtils.EPSILON) {
			sign = -1.0;
			dirDotNorm = -dirDotNorm;
		} else {
			// ray and triangle/quad are parallel
			return false;
		}

		var dirDotDiffxEdge2 = sign * this.direction.dot(Vector3.cross(diff, edge2, edge2));
		var result = false;
		if (dirDotDiffxEdge2 >= 0.0) {
			var dirDotEdge1xDiff = sign * this.direction.dot(edge1.cross(diff));
			if (dirDotEdge1xDiff >= 0.0) {
				if (dirDotDiffxEdge2 + dirDotEdge1xDiff <= dirDotNorm) {
					var diffDotNorm = -sign * diff.dot(norm);
					if (diffDotNorm >= 0.0) {
						// ray intersects triangle
						// if storage vector is null, just return true,
						if (!locationStore) {
							return true;
						}
						// else fill in.
						var inv = 1.0 / dirDotNorm;
						var t = diffDotNorm * inv;
						if (!doPlanar) {
							locationStore.setVector(this.origin).addDirect(this.direction.x * t, this.direction.y * t, this.direction.z * t);
						} else {
							// these weights can be used to determine
							// interpolated values, such as texture coord.
							// eg. texcoord s,t at intersection point:
							// s = w0*s0 + w1*s1 + w2*s2;
							// t = w0*t0 + w1*t1 + w2*t2;
							var w1 = dirDotDiffxEdge2 * inv;
							var w2 = dirDotEdge1xDiff * inv;
							// float w0 = 1.0 - w1 - w2;
							locationStore.setDirect(t, w1, w2);
						}
						result = true;
					}
				}
			}
		}
		return result;
	};

	/**
	 * @param worldVertices an array (size 3 or 4) of vectors describing a polygon
	 * @returns the distance from our origin to the primitive or Infinity if we do not intersect.
	 */
	Ray.prototype.getDistanceToPrimitive = function (worldVertices) {
		// Intersection test
		var intersect = tmpVec1;
		if (this.intersects(worldVertices, false, intersect)) {
			return this.origin.distance(intersect.x, intersect.y, intersect.z);
		}
		return Infinity;
	};

	/**
	 * @param plane
	 * @param locationStore if not null, and this ray intersects the plane, the world location of the point of intersection is stored in this vector.
	 * @returns true if the ray collides with the given Plane
	 */
	Ray.prototype.intersectsPlane = function (plane, locationStore) {
		var normal = plane.normal;
		var denominator = normal.dot(this.direction);

		if (Math.abs(denominator) < 0.00001) {
			return false; // coplanar
		}

		var numerator = -normal.dot(this.origin) + plane.constant;
		var ratio = numerator / denominator;

		if (ratio < 0.00001) {
			return false; // intersects behind origin
		}

		if (locationStore) {
			locationStore.setVector(this.direction).scale(ratio).addVector(this.origin);
		}

		return true;
	};

	/**
	 * @param boundMin
	 * @param boundMax
	 * @param locationStore if not null, and this ray intersects the plane, the world location of the point of intersection is stored in this vector.
	 * @return false if behind ray origin or no intersection else distance to intersection point
	 */
	Ray.prototype.intersectsAABox = function (boundMin, boundMax, inverseDir){
		//
		//@source: http://gamedev.stackexchange.com/a/18459
		//

		var tXMin = (boundMin.x - this.origin.x)*inverseDir.x;
		var tXMax = (boundMax.x - this.origin.x)*inverseDir.x;
		var tYMin = (boundMin.y - this.origin.y)*inverseDir.y;
		var tYMax = (boundMax.y - this.origin.y)*inverseDir.y;
		var tZMin = (boundMin.z - this.origin.z)*inverseDir.z;
		var tZMax = (boundMax.z - this.origin.z)*inverseDir.z;

		var tMin = Math.max(Math.max(Math.min(tXMin, tXMax), Math.min(tYMin, tYMax)), Math.min(tZMin, tZMax));
		var tMax = Math.min(Math.min(Math.max(tXMin, tXMax), Math.max(tYMin, tYMax)), Math.max(tZMin, tZMax));

		var distance = 0;

		//intersecting AABB, but whole AABB is behind us
		if (tMax < 0)
		{
			distance = tMax;
			return false;
		}

		//doesn't intersect AABB
		if (tMin > tMax)
		{
			distance = tMax;
			return false;
		}

		distance = tMin;

		return distance;
	}
	
	/**
	 * @param {Vector3} point
	 * @param {Vector3} [store] if not null, the closest point is stored in this param
	 * @returns the squared distance from this ray to the given point.
	 */
	Ray.prototype.distanceSquared = function (point, store) {
		var vectorA = tmpVec1;

		vectorA.setVector(point).subVector(this.origin);
		var t0 = this.direction.dot(vectorA);
		if (t0 > 0) {
			// d = |P - (O + t*D)|
			vectorA.setVector(this.direction).scale(t0);
			vectorA.addVector(this.origin);
		} else {
			// ray is closest to origin point
			vectorA.setVector(this.origin);
		}

		// Save away the closest point if requested.
		if (store) {
			store.setVector(vectorA);
		}

		vectorA.subVector(point);
		return vectorA.lengthSquared();
	};

	/**
	 * normalizes a non unit direction and stores the direction length
	 *
	 * @returns direction
	 */
	Ray.prototype.normalizeDirection = function(){
		//get length
		this.length = this.direction.length();

		//calc invert length
		var invertedLength = MathUtils.safeInvert(this.length);

		//normalize direction
		this.direction.mul(invertedLength);

		return this.direction;
	};
	
	return Ray;
});