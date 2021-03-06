"use strict";
(function(exports, undefined) {

    var CollideType = {
        Poly_Poly: 1,
        Circle_Circle: 2,
        Poly_Circle: 3,
    }

    var CollideManager = function(cfg) {

        for (var key in cfg) {
            this[key] = cfg[key];
        }
    }

    CollideManager.prototype = {
        constructor: CollideManager,

        solveIterations: 10,

        gridCellSize: 128,
        gridCol: 512,

        init: function(world) {
            this.world = world;

            this.penetrated = {};
            this.contactConstraints = [];
            this.contactConstraintCount = 0;

            this.collide = this.collide || this.collideSimple;
            // this.collide = this.collide || this.collideGrid;

        },

        collideMap: {
            1: "collideCircleCircle",
            2: "collidePolyPoly",
            3: "collidePolyCircle",

        },

        collideCount: 0,
        collideGrid: function(timeStep) {

            var gridCellSize = this.gridCellSize;
            var gridCol = this.gridCol;
            var grid = {};
            var cc = 0;

            this.contactConstraintCount = 0;
            var bodies = this.world.bodies;

            for (var i = 0, len = bodies.length; i < len; i++) {
                var bodyA = bodies[i];

                var box1 = bodyA.aabb;
                var colMin = box1[0] / gridCellSize >> 0,
                    rowMin = box1[1] / gridCellSize >> 0,
                    colMax = box1[2] / gridCellSize >> 0,
                    rowMax = box1[3] / gridCellSize >> 0;

                var checked = {};
                var startIdx = rowMin * gridCol + colMin;

                for (var row = rowMin; row <= rowMax; row++) {
                    var idx = startIdx;
                    for (var col = colMin; col <= colMax; col++) {
                        var group = grid[idx];
                        if (!group) {
                            grid[idx] = [bodyA];
                        } else {
                            for (var c = 0, glen = group.length; c < glen; c++) {
                                var bodyB = group[c];
                                if (!checked[bodyB._sn]) {
                                    checked[bodyB._sn] = true;

                                    this.collideTowBodies(bodyA, bodyB, timeStep);
                                    cc++

                                }
                            }
                            group.push(bodyA);
                        }
                        idx++;
                    }
                    startIdx += gridCol;
                }
            }
            if (cc > this.collideCount) {
                this.collideCount = cc;
                // console.log(len,cc);
            }
        },

        collideSimple: function(timeStep) {
            var cc = 0;

            this.contactConstraintCount = 0;
            var bodies = this.world.bodies;

            for (var i = 0, len = bodies.length; i < len - 1; i++) {
                var bodyA = bodies[i];
                for (var j = i + 1; j < len; j++) {

                    this.collideTowBodies(bodyA, bodies[j], timeStep);
                    cc++

                }
            }
            if (cc > this.collideCount) {
                this.collideCount = cc;
                // console.log(len,cc);
            }
        },

        collideTowBodies: function(bodyA, bodyB, timeStep) {
            if (bodyA.sleeping && bodyB.sleeping) {
                return null;
            }
            if (bodyA.invMass == 0 && bodyB.invMass == 0) {
                return null;
            }
            var contactKey = bodyA._sn + "_" + bodyB._sn;
            var boxA = bodyA.aabb,
                boxB = bodyB.aabb;
            var contactConstraint = false;
            if (boxA[0] < boxB[2] && boxA[2] > boxB[0] && boxA[1] < boxB[3] && boxA[3] > boxB[1]) {

                contactConstraint = this[this.collideMap[bodyA.shapeType | bodyB.shapeType]](bodyA, bodyB);

            }
            if (contactConstraint) {
                if (!this.penetrated[contactKey]) {
                    this.onCollided(bodyA, bodyB, contactConstraint, timeStep);
                    this.penetrated[contactKey] = true;
                }
            } else {
                if (this.penetrated[contactKey]) {
                    this.onSeparated(bodyA, bodyB, timeStep)
                    this.penetrated[contactKey] = false;
                }
            }
            return contactConstraint;
        },


        solve: function(timeStep) {
            var contactConstraints = this.contactConstraints;
            var contactConstraintCount = this.contactConstraintCount;
            var iterations=this.solveIterations;

            for (var i = 0; i < iterations; i++) {
                for (var j = 0; j < contactConstraintCount; j++) {
                    var contactConstraint = contactConstraints[j];
                    var solved = contactConstraint.solve(timeStep, iterations,i);
                    if (solved) {
                        this.onCollideSolve(contactConstraint, timeStep, iterations,i)
                    }

                }
            }

        },


        onCollided: function(bodyA, bodyB, contactConstraint, timeStep) {

        },
        onSeparated: function(bodyA, bodyB, timeStep) {

        },
        onCollideSolve: function(contactConstraint, timeStep) {

        },


        collideCircleCircle: function(bodyA, bodyB) {

            var contactConstraints = this.contactConstraints;
            var contactConstraintCount = this.contactConstraintCount;

            var centreA = bodyA.centre,
                centreB = bodyB.centre;

            var dx = centreB[0] - centreA[0],
                dy = centreB[1] - centreA[1];
            var distanceSq = dx * dx + dy * dy;
            var rt = bodyA.radius + bodyB.radius;
            if (distanceSq > rt * rt) {
                return false;
            }


            var distance = Math.sqrt(distanceSq);

            var normalA = [
                dx / distance, dy / distance
            ]
            var ratioA = bodyA.radius / distance;
            var contactOnA = [
                centreA[0] + (centreB[0] - centreA[0]) * ratioA,
                centreA[1] + (centreB[1] - centreA[1]) * ratioA
            ]

            var normalB = [-normalA[0], -normalA[1]]
            var ratioB = bodyB.radius / distance;
            var contactOnB = [
                centreB[0] + (centreA[0] - centreB[0]) * ratioB, centreB[1] + (centreA[1] - centreB[1]) * ratioB
            ]

            if (!contactConstraints[contactConstraintCount]) {
                contactConstraints[contactConstraintCount] = new ContactConstraint();
            }
            var contactConstraint = contactConstraints[contactConstraintCount++];
            var overlap = rt - distance;

            // normalA[2] = centreA[0] * normalA[0] + centreA[1] * normalA[1];
            contactConstraint.set(bodyA, bodyB, normalA);
            // contactConstraint.set(bodyA, bodyB, normalA);

            contactConstraint.addContact(contactOnA, contactOnB, overlap);

            this.contactConstraintCount = contactConstraintCount;
            return contactConstraint;


        },

        collidePolyCircle: function(bodyA, bodyB) {

            var poly, circle;
            if (bodyA.shapeType == ShapeType.Poly) {
                poly = bodyA;
                circle = bodyB;
            } else {
                poly = bodyB;
                circle = bodyA;
            }

            var result = this.featurePairPolyCircle(poly, circle);
            if (!result) {
                return false;
            }

            var contactConstraints = this.contactConstraints;
            var contactConstraintCount = this.contactConstraintCount;

            var facePoly = result.facePoly;
            var vertPoly = result.vertPoly;
            var faceIdx = result.faceIdx;
            var faceNormal = result.faceNormal;
            var vertexIdx = result.closestIdx;
            var faceIdx = result.faceIdx;
            var overlap = result.minDist;

            if (!contactConstraints[contactConstraintCount]) {
                contactConstraints[contactConstraintCount] = new ContactConstraint();
            }
            var contactConstraint = contactConstraints[contactConstraintCount++];

            var contactOnFace0;
            var contactOnVert0;

            var centre = circle.centre;

            if (facePoly == circle) {
                var r = circle.radius;
                contactOnVert0 = result.closest;
                contactOnFace0 = [faceNormal[0] * r + centre[0], faceNormal[1] * r + centre[1]];
            } else {

                var faceV0 = facePoly.vertices[faceIdx];
                var faceV1 = facePoly.vertices[(faceIdx + 1) % facePoly.vertexCount];

                contactOnVert0 = result.closest;
                contactOnFace0 = Polygon.projectPointToEdge(contactOnVert0, faceV0, faceV1);

            }


            contactConstraint.set(facePoly, vertPoly, faceNormal);
            contactConstraint.addContact(contactOnFace0, contactOnVert0);
            this.contactConstraintCount = contactConstraintCount;
            return contactConstraint;
        },


        featurePairPolyCircle: function(poly, circle) {

            var result = {};

            var centre = circle.centre;
            var cx = centre[0],
                cy = centre[1];
            var radius = circle.radius;


            var allOutside = true;

            var min = -Number.MAX_VALUE;
            var faceIdx = -1,
                normal = null;

            for (var i = 0; i < poly.vertexCount; i++) {

                var n = poly.normals[i];
                var nx = n[0];
                var ny = n[1];
                var NdotP = n[2];

                var dist = nx * cx + ny * cy - NdotP;
                if (dist > radius) {
                    return false;
                }
                if (dist > min) {
                    allOutside = false;
                    min = dist;
                    faceIdx = i;
                    normal = n;
                }
            }
            if (allOutside) {
                return false;
            }


            if (min < Number.MIN_VALUE) {
                // if (min < 0) {
                // console.log("min < 0",min)
                result.facePoly = poly;
                result.vertPoly = circle;
                result.minDist = min;
                result.faceNormal = normal;
                result.faceIdx = faceIdx;

                var closest = [-normal[0] * radius + cx, -normal[1] * radius + cy];
                result.closest = closest;
                result.closestIdx = null;
                return result;
            }

            var vertIdx0 = faceIdx;
            var vertIdx1 = (vertIdx0 + 1) % poly.vertexCount;
            var v0 = poly.vertices[vertIdx0];
            var v1 = poly.vertices[vertIdx1];

            var dx = v1[0] - v0[0],
                dy = v1[1] - v0[1];

            var disX0 = cx - v0[0],
                disY0 = cy - v0[1];
            var disX1 = cx - v1[0],
                disY1 = cy - v1[1];

            var p0 = disX0 * dx + disY0 * dy;
            var p1 = -disX1 * dx + -disY1 * dy;
            var radiusSq = circle.radiusSq;


            if (p0 <= 0) {
                var disSq = disX0 * disX0 + disY0 * disY0;
                if (disSq > radiusSq) {
                    return false;
                }
                var dis = Math.sqrt(disSq);
                var nx = -disX0 / dis,
                    ny = -disY0 / dis;

                normal = [nx, ny];
                // min = normal[2] + radius;

                result.facePoly = circle;
                result.vertPoly = poly;
                result.minDist = min;
                result.faceNormal = normal;
                result.faceIdx = null;
                result.closest = v0;
                result.closestIdx = vertIdx0;

            } else if (p1 <= 0) {
                var disSq = disX1 * disX1 + disY1 * disY1;
                if (disSq > radiusSq) {
                    return false;
                }
                var dis = Math.sqrt(disSq);
                var nx = -disX1 / dis,
                    ny = -disY1 / dis;

                normal = [nx, ny];
                // min = normal[2] + radius;

                result.facePoly = circle;
                result.vertPoly = poly;
                result.minDist = min;
                result.faceNormal = normal;
                result.faceIdx = null;
                result.closest = v1;
                result.closestIdx = vertIdx1;

            } else {
                result.facePoly = poly;
                result.vertPoly = circle;
                result.minDist = min;
                result.faceNormal = normal;
                result.faceIdx = faceIdx;

                var closest = [-normal[0] * radius + cx, -normal[1] * radius + cy];
                result.closest = closest;
                result.closestIdx = null;
            }

            return result;
        },


        collidePolyPoly: function(bodyA, bodyB) {


            var vertPoly, facePoly, faceIdx, faceNormal;
            var vertV0, vertV1, faceV0, faceV1;
            var face, vertex, fpcFlag;


            var result = this.featurePairPolyPoly(bodyA, bodyB);
            if (!result) {
                return false;
            }
            var facePoly = result.facePoly;
            var vertPoly = result.vertPoly;
            var faceIdx = result.faceIdx;
            var faceNormal = result.faceNormal;
            var vertexIdx = result.closestIdx;
            var overlap = result.minDist;

            var va = vertPoly.vertices[vertexIdx == 0 ? vertPoly.vertexCount - 1 : vertexIdx - 1];
            var vb = vertPoly.vertices[vertexIdx];
            var vc = vertPoly.vertices[(vertexIdx + 1) % vertPoly.vertexCount];

            var vaDist = va[0] * faceNormal[0] + va[1] * faceNormal[1] - faceNormal[2];
            var vcDist = vc[0] * faceNormal[0] + vc[1] * faceNormal[1] - faceNormal[2];

            var vertV0, vertV1;
            if (vaDist < 0 || vcDist < 0) {
                if (vaDist < vcDist) {
                    vertV0 = va;
                    vertV1 = vb;
                } else {
                    vertV0 = vb;
                    vertV1 = vc;
                }
            }

            faceV0 = facePoly.vertices[faceIdx];
            faceV1 = facePoly.vertices[(faceIdx + 1) % facePoly.vertexCount];

            var contactConstraints = this.contactConstraints;
            var contactConstraintCount = this.contactConstraintCount;

            if (!contactConstraints[contactConstraintCount]) {
                contactConstraints[contactConstraintCount] = new ContactConstraint();
            }
            var contactConstraint = contactConstraints[contactConstraintCount++];

            var contactOnFace0, contactOnVert0, contactOnFace1, contactOnVert1;
            var overlap;
            if (vertV0) {
                contactOnFace0 = Polygon.projectPointToEdge(vertV0, faceV0, faceV1);
                contactOnVert0 = Polygon.projectPointToEdge(faceV1, vertV0, vertV1);

                contactOnFace1 = Polygon.projectPointToEdge(vertV1, faceV0, faceV1);
                contactOnVert1 = Polygon.projectPointToEdge(faceV0, vertV0, vertV1);
            } else {
                contactOnVert0 = vertPoly.vertices[vertexIdx];
                contactOnFace0 = Polygon.projectPointToEdge(contactOnVert0, faceV0, faceV1);
            }

            contactConstraint.set(facePoly, vertPoly, faceNormal);


            contactConstraint.addContact(contactOnFace0, contactOnVert0);
            if (contactOnFace1) {
                contactConstraint.addContact(contactOnFace1, contactOnVert1);
            }

            this.contactConstraintCount = contactConstraintCount;
            return contactConstraint;
        },

        featurePairPolyPoly: function(bodyA, bodyB) {

            var result = {};

            var facePoly = bodyA,
                vertPoly = bodyB;

            var faceLen = facePoly.vertexCount,
                vertLen = vertPoly.vertexCount;

            var faceNormals = facePoly.normals,
                vertVertices = vertPoly.vertices;


            var min1, closestIdx1, closest1, faceIdx1, normal1;
            var first = true;

            while (true) {

                var min = -Number.MAX_VALUE,
                    closestIdx = -1,
                    closest = null,
                    faceIdx = -1,
                    normal = null;
                var dist;
                for (var i = 0; i < faceLen; i++) {
                    var n = faceNormals[i];
                    var nx = n[0];
                    var ny = n[1];
                    var NdotP = n[2];

                    var allOutside = true;

                    var _min = 0;
                    var _closestIdx = -1,
                        _closest, _faceIdx, _normal;

                    for (var j = 0; j < vertLen; j++) {
                        var v = vertVertices[j];
                        var vx = v[0];
                        var vy = v[1];
                        dist = nx * vx + ny * vy - NdotP;
                        if (dist < _min) {
                            allOutside = false;
                            _min = dist;
                            _closestIdx = j;
                            _closest = v;
                            _faceIdx = i;
                            _normal = n;
                        }
                    }

                    if (allOutside) {
                        return false;
                    }

                    if (_min > min) {
                        min = _min;
                        closestIdx = _closestIdx;
                        closest = _closest;
                        faceIdx = _faceIdx;
                        normal = _normal;
                    }
                }


                if (!first) {
                    if (min1 === min) {
                        var dx = closest1[0] - vertPoly.x,
                            dy = closest1[1] - vertPoly.y;
                        var centreDist1 = dx * dx + dy * dy;

                        var dx = closest[0] - facePoly.x,
                            dy = closest[1] - facePoly.y;
                        var centreDist2 = dx * dx + dy * dy;

                        if (centreDist1 < centreDist2) {
                            min = min1 - 1;
                        }
                    }
                    if (min1 > min) {
                        result.facePoly = bodyA;
                        result.vertPoly = bodyB;
                        result.minDist = min1;
                        result.closestIdx = closestIdx1;
                        result.closest = closest1;
                        result.faceIdx = faceIdx1;
                        result.faceNormal = normal1;
                    } else {
                        result.facePoly = bodyB;
                        result.vertPoly = bodyA;
                        result.minDist = min;
                        result.closestIdx = closestIdx;
                        result.closest = closest;
                        result.faceIdx = faceIdx;
                        result.faceNormal = normal;
                    }
                    break;
                }

                min1 = min;
                closestIdx1 = closestIdx;
                closest1 = closest;
                faceIdx1 = faceIdx;
                normal1 = normal;


                facePoly = bodyB;
                vertPoly = bodyA;

                faceLen ^= vertLen;
                vertLen ^= faceLen;
                faceLen ^= vertLen;

                faceNormals = facePoly.normals;
                vertVertices = vertPoly.vertices;

                first = false;
            };

            return result;
        },


    }

    exports.CollideManager = CollideManager;
}(this));