import { Coordinates, LatLng, GeoJSONPoint } from '../types';
export declare function toRadians(degrees: number): number;
export declare function toDegrees(radians: number): number;
export declare function haversineDistance(point1: Coordinates, point2: Coordinates): number;
export declare function bearing(point1: Coordinates, point2: Coordinates): number;
export declare function destinationPoint(origin: Coordinates, distanceMeters: number, bearingDegrees: number): Coordinates;
export declare function closestPointOnLine(point: Coordinates, lineStart: Coordinates, lineEnd: Coordinates): Coordinates;
export declare function distanceToLine(point: Coordinates, lineStart: Coordinates, lineEnd: Coordinates): number;
export declare function distanceToPolyline(point: Coordinates, polyline: Coordinates[]): {
    distance: number;
    closestPoint: Coordinates;
    segmentIndex: number;
};
export declare function isPointInPolygon(point: Coordinates, polygon: Coordinates[]): boolean;
export interface BoundingBox {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
}
export declare function getBoundingBox(points: Coordinates[]): BoundingBox;
export declare function expandBoundingBox(box: BoundingBox, distanceMeters: number): BoundingBox;
export declare function getBoundingBoxCenter(box: BoundingBox): Coordinates;
export declare function coordinatesToLatLng(coords: Coordinates): LatLng;
export declare function latLngToCoordinates(latLng: LatLng): Coordinates;
export declare function coordinatesToGeoJSON(coords: Coordinates): GeoJSONPoint;
export declare function geoJSONToCoordinates(point: GeoJSONPoint): Coordinates;
export declare function polylineLength(points: Coordinates[]): number;
export declare function interpolateAlongPolyline(points: Coordinates[], distanceFromStart: number): Coordinates | null;
export declare function createLineBuffer(start: Coordinates, end: Coordinates, widthMeters: number): Coordinates[];
export declare function encodeGeohash(coords: Coordinates, precision?: number): string;
export declare function getGeohashNeighbors(geohash: string): string[];
