"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toRadians = toRadians;
exports.toDegrees = toDegrees;
exports.haversineDistance = haversineDistance;
exports.bearing = bearing;
exports.destinationPoint = destinationPoint;
exports.closestPointOnLine = closestPointOnLine;
exports.distanceToLine = distanceToLine;
exports.distanceToPolyline = distanceToPolyline;
exports.isPointInPolygon = isPointInPolygon;
exports.getBoundingBox = getBoundingBox;
exports.expandBoundingBox = expandBoundingBox;
exports.getBoundingBoxCenter = getBoundingBoxCenter;
exports.coordinatesToLatLng = coordinatesToLatLng;
exports.latLngToCoordinates = latLngToCoordinates;
exports.coordinatesToGeoJSON = coordinatesToGeoJSON;
exports.geoJSONToCoordinates = geoJSONToCoordinates;
exports.polylineLength = polylineLength;
exports.interpolateAlongPolyline = interpolateAlongPolyline;
exports.createLineBuffer = createLineBuffer;
exports.encodeGeohash = encodeGeohash;
exports.getGeohashNeighbors = getGeohashNeighbors;
const EARTH_RADIUS_METERS = 6371000;
function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}
function toDegrees(radians) {
    return radians * (180 / Math.PI);
}
function haversineDistance(point1, point2) {
    const lat1 = toRadians(point1.latitude);
    const lat2 = toRadians(point2.latitude);
    const deltaLat = toRadians(point2.latitude - point1.latitude);
    const deltaLng = toRadians(point2.longitude - point1.longitude);
    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
        Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_METERS * c;
}
function bearing(point1, point2) {
    const lat1 = toRadians(point1.latitude);
    const lat2 = toRadians(point2.latitude);
    const deltaLng = toRadians(point2.longitude - point1.longitude);
    const x = Math.sin(deltaLng) * Math.cos(lat2);
    const y = Math.cos(lat1) * Math.sin(lat2) -
        Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
    const theta = Math.atan2(x, y);
    return (toDegrees(theta) + 360) % 360;
}
function destinationPoint(origin, distanceMeters, bearingDegrees) {
    const angularDistance = distanceMeters / EARTH_RADIUS_METERS;
    const bearingRad = toRadians(bearingDegrees);
    const lat1 = toRadians(origin.latitude);
    const lng1 = toRadians(origin.longitude);
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angularDistance) +
        Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearingRad));
    const lng2 = lng1 + Math.atan2(Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(lat1), Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2));
    return {
        latitude: toDegrees(lat2),
        longitude: toDegrees(lng2),
    };
}
function closestPointOnLine(point, lineStart, lineEnd) {
    const A = point.latitude - lineStart.latitude;
    const B = point.longitude - lineStart.longitude;
    const C = lineEnd.latitude - lineStart.latitude;
    const D = lineEnd.longitude - lineStart.longitude;
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) {
        param = dot / lenSq;
    }
    let closestLat;
    let closestLng;
    if (param < 0) {
        closestLat = lineStart.latitude;
        closestLng = lineStart.longitude;
    }
    else if (param > 1) {
        closestLat = lineEnd.latitude;
        closestLng = lineEnd.longitude;
    }
    else {
        closestLat = lineStart.latitude + param * C;
        closestLng = lineStart.longitude + param * D;
    }
    return { latitude: closestLat, longitude: closestLng };
}
function distanceToLine(point, lineStart, lineEnd) {
    const closest = closestPointOnLine(point, lineStart, lineEnd);
    return haversineDistance(point, closest);
}
function distanceToPolyline(point, polyline) {
    let minDistance = Infinity;
    let closestPoint = polyline[0];
    let segmentIndex = 0;
    for (let i = 0; i < polyline.length - 1; i++) {
        const closest = closestPointOnLine(point, polyline[i], polyline[i + 1]);
        const distance = haversineDistance(point, closest);
        if (distance < minDistance) {
            minDistance = distance;
            closestPoint = closest;
            segmentIndex = i;
        }
    }
    return { distance: minDistance, closestPoint, segmentIndex };
}
function isPointInPolygon(point, polygon) {
    let inside = false;
    const x = point.longitude;
    const y = point.latitude;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].longitude;
        const yi = polygon[i].latitude;
        const xj = polygon[j].longitude;
        const yj = polygon[j].latitude;
        if (((yi > y) !== (yj > y)) &&
            (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }
    return inside;
}
function getBoundingBox(points) {
    if (points.length === 0) {
        throw new Error('Cannot get bounding box of empty array');
    }
    return points.reduce((box, point) => ({
        minLat: Math.min(box.minLat, point.latitude),
        maxLat: Math.max(box.maxLat, point.latitude),
        minLng: Math.min(box.minLng, point.longitude),
        maxLng: Math.max(box.maxLng, point.longitude),
    }), {
        minLat: points[0].latitude,
        maxLat: points[0].latitude,
        minLng: points[0].longitude,
        maxLng: points[0].longitude,
    });
}
function expandBoundingBox(box, distanceMeters) {
    const latDelta = distanceMeters / 111000;
    const lngDelta = distanceMeters / (111000 * Math.cos(toRadians((box.minLat + box.maxLat) / 2)));
    return {
        minLat: box.minLat - latDelta,
        maxLat: box.maxLat + latDelta,
        minLng: box.minLng - lngDelta,
        maxLng: box.maxLng + lngDelta,
    };
}
function getBoundingBoxCenter(box) {
    return {
        latitude: (box.minLat + box.maxLat) / 2,
        longitude: (box.minLng + box.maxLng) / 2,
    };
}
function coordinatesToLatLng(coords) {
    return [coords.latitude, coords.longitude];
}
function latLngToCoordinates(latLng) {
    return { latitude: latLng[0], longitude: latLng[1] };
}
function coordinatesToGeoJSON(coords) {
    return {
        type: 'Point',
        coordinates: [coords.longitude, coords.latitude],
    };
}
function geoJSONToCoordinates(point) {
    return {
        latitude: point.coordinates[1],
        longitude: point.coordinates[0],
    };
}
function polylineLength(points) {
    let length = 0;
    for (let i = 0; i < points.length - 1; i++) {
        length += haversineDistance(points[i], points[i + 1]);
    }
    return length;
}
function interpolateAlongPolyline(points, distanceFromStart) {
    if (points.length < 2)
        return null;
    let accumulated = 0;
    for (let i = 0; i < points.length - 1; i++) {
        const segmentLength = haversineDistance(points[i], points[i + 1]);
        if (accumulated + segmentLength >= distanceFromStart) {
            const remainingDistance = distanceFromStart - accumulated;
            const fraction = remainingDistance / segmentLength;
            return {
                latitude: points[i].latitude + fraction * (points[i + 1].latitude - points[i].latitude),
                longitude: points[i].longitude + fraction * (points[i + 1].longitude - points[i].longitude),
            };
        }
        accumulated += segmentLength;
    }
    return points[points.length - 1];
}
function createLineBuffer(start, end, widthMeters) {
    const bearing12 = bearing(start, end);
    const perpendicular1 = (bearing12 + 90) % 360;
    const perpendicular2 = (bearing12 + 270) % 360;
    const corner1 = destinationPoint(start, widthMeters, perpendicular1);
    const corner2 = destinationPoint(start, widthMeters, perpendicular2);
    const corner3 = destinationPoint(end, widthMeters, perpendicular2);
    const corner4 = destinationPoint(end, widthMeters, perpendicular1);
    return [corner1, corner4, corner3, corner2, corner1];
}
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
function encodeGeohash(coords, precision = 6) {
    let minLat = -90, maxLat = 90;
    let minLng = -180, maxLng = 180;
    let hash = '';
    let isEven = true;
    let bit = 0;
    let ch = 0;
    while (hash.length < precision) {
        if (isEven) {
            const mid = (minLng + maxLng) / 2;
            if (coords.longitude >= mid) {
                ch |= 1 << (4 - bit);
                minLng = mid;
            }
            else {
                maxLng = mid;
            }
        }
        else {
            const mid = (minLat + maxLat) / 2;
            if (coords.latitude >= mid) {
                ch |= 1 << (4 - bit);
                minLat = mid;
            }
            else {
                maxLat = mid;
            }
        }
        isEven = !isEven;
        if (bit < 4) {
            bit++;
        }
        else {
            hash += BASE32[ch];
            bit = 0;
            ch = 0;
        }
    }
    return hash;
}
function getGeohashNeighbors(geohash) {
    return [geohash];
}
//# sourceMappingURL=geo.js.map