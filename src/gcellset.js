/*global require*/
// dependenices
var _ = require('./core.utils');
var uuid = _.uuid;
var cloneDeep = _.cloneDeep;
var noop = _.noop;
var defineContract = _.defineContract;
var assert = _.assert;
var check = _.check;
var isAssigned = check.assigned;
var isObject = check.object;
var isArray = check.array;
var isa = check.instance;
var isNumber = check.number;
var isFunction = check.function;
var matrixOfDimension = assert.matrixOfDimension;
var vectorOfDimension = assert.vectorOfDimension;

var numeric = require('./core.numeric');
var size = numeric.size;
var norm = numeric.norm;
var nthColumn = numeric.nthColumn;
var dot = numeric.dot;
var mul = numeric.mul;
var inv = numeric.inv;
var det = numeric.det;
var transpose = numeric.transpose;

var feutils = require('./feutils');
var skewmat = feutils.skewmat;
var isXyzInsideBox = feutils.isXyzInsideBox;

var topology = require('./geometry.topology');
var Topology = topology.Topology;
var hypercube = topology.hypercube;
var hypercubeBoundary = topology.hypercubeBoundary;

var fens = require('./fens');
var FeNodeSet = fens.FeNodeSet;

/**
 * @module gcellset
 */

/**
 * @typedef module:gcellset.GCellSetInitOption
 * @property {Topology} topology - required.
 * @property {Number} otherDimension - optional. default is 1.0.
 * @property {Boolean} axisSymm - optional. default is false.
 */

/**
 * Geometry cell set.
 * @class
 * @param {module:gcellset.GCellSetInitOption} options
 */
// TODO: support lookup by label.
exports.GCellSet = function GCellSet(options) {
  if (!isObject(options) || !isa(options.topology, Topology))
    throw new Error('GCellSet#constructor(options): options' +
                    ' is not a valid GCellSetInitOption.');

  this._axisSymm = null;
  this._otherDimension = null;
  this._id = null;
  this._topology = null;

  if (isNumber(options.otherDimension) || isFunction(options.otherDimension)) {
    this._otherDimension = options.otherDimension;
  } else {
    this._otherDimension = 1.0;
  }

  if (isAssigned(options.axisSymm))
    this._axisSymm = !!(options.axisSymm);
  else
    this._axisSymm = false;

  var topology = options.topology;
  var cellSizeFromTopology = topology.getCellSizeInDim(topology.getDim());
  var cellSizeShouldBe = this.cellSize();
  if (cellSizeFromTopology !== cellSizeShouldBe)
    throw new Error('GCellSet(): cellSize of the topology dismatch.');

  var dimFromTopology = topology.getDim();
  var dimShouldBe = this.dim();
  if (dimFromTopology !== dimShouldBe)
    throw new Error('GCellSet(): dim of the topology dismatch.');

  this._id = uuid();
  this._topology = topology;
};
var GCellSet = exports.GCellSet;

/**
 * Returns the full topology of gcellset. Mainly used for
 * visualization.
 * @returns {module:topology.Topology}
 */
exports.GCellSet.prototype.topology = function() {
  return this._topology;
};

/**
 * Return true if two gcellset is same.
 * @returns {Boolean}
 */
exports.GCellSet.prototype.equals = function(other) {
  if (!isa(other, GCellSet)) return false;

  if (this.type() !== other.type() ||
      this.cellSize() !== other.cellSize())
    return false;

  if (this.axisSymm() !== other.axisSymm() ||
      this.otherDimension() !== other.otherDimension())
    return false;

  if (!this._topology.normalized().equals(other._topology.normalized()))
    return false;

  return true;
};

/**
 * Evaluate the other dimension (area, thickness) of the element at
 * given parametric coordinates, or at any given spatial
 * coordinate.
 * @param {module:types.Connectivity} conn - connectivity of a single
 * cell.
 * @param {module:types.Matrix} N - values of the basic functions.
 * @param {module:types.Matrix} x - spatial coordinates.
 * @returns {Number}
 */
exports.GCellSet.prototype.otherDimension = function(conn, N, x) {
  if (typeof this._otherDimension === 'function')
    return this._otherDimension(conn, N, x);
  return this._otherDimension;
};

/**
 * Returns whether it is axis symmetric.
 * @returns {Boolean}
 */
exports.GCellSet.prototype.axisSymm = function() { return this._axisSymm; };

/**
 * Returns a vector of vertices ids. Mainly used for visualization.
 * @returns {module:types.Vector}
 */
exports.GCellSet.prototype.vertices = function() {
  return this._topology.getPointIndices();
};

/**
 * Returns a list of L2 cells. Mainly used for visualization.
 * @returns {module:types.ConnectivityList}
 */
exports.GCellSet.prototype.edges = function() {
  return this._topology.getCellsInDim(1);
};

/**
 * Returns a list of T3 cells. Mainly used for visualization.
 * @returns {module:types.ConnectivityList}
 */
exports.GCellSet.prototype.triangles = function() {
  return this._topology.getCellsInDim(2);
};

/**
 * Returns a unique type string of this gcellset.
 * @abstract
 * @returns {String} the type string of this gcellset.
 */
exports.GCellSet.prototype.type = function() {
  throw new Error('GCellSet::type(): is not implemented.');
};

/**
 * Returns the constructor of boundary gcellset. For example, Q4
 * should return L2 as its boundary cell constructor, while L2 should retrun P1.
 * @abstract
 * @returns {Function} the constructor of boundary gcellset.
 */
exports.GCellSet.prototype.boundaryGCellSetConstructor = function() {
  throw new Error('GCellSet::getBoundaryGCellSetConstructor(): is not implemented.');
};

/**
 * Return the type of boundary gcellset.
 * @returns {String} type of boundary gcellset.
 */
exports.GCellSet.prototype.boundaryCellType = function() {
  var C = this.boundaryGCellSetConstructor();
  return C.prototype.type.call(null);
};

/**
 * Returns the connectivity list of the boundary. Override by
 * subclasses.
 * @abstract
 * @returns {module:types.ConnectivityList}
 */
exports.GCellSet.prototype.boundaryConn = function() {
  return this._topology.boundaryConn();
};

/**
 * Return the boundary of this gcellset.
 * @returns {module:gcellset.GCellSet} the boundary gcellset.
 */
exports.GCellSet.prototype.boundary = function() {
  var C = this.boundaryGCellSetConstructor();
  var conn = this.boundaryConn();
  return new C({ conn: conn });
};


/**
 * Returns the constructor of extruded gcellset. For example, Q4
 * should return H8, L2 should return Q4.
 * @abstract
 * @returns {Function} the constructor of boundary gcellset.
 */
exports.GCellSet.prototype.extrudedGCellSetConstructor = function() {
  var family = this._topology.getFamilyType();
  var cellTypes = Topology.FAMILY[family].cellTypes;
  var type = this.type();
  var idx = cellTypes.indexOf(type);
  if (idx < 0)
    throw new Error('GCellSet::extrudedGCellSetConstructor(): unknow type ' +
                    type);
  var idxNext = idx + 1;
  if (idxNext >= cellTypes.length)
    throw new Error('GCellSet::extrudedGCellSetConstructor(): unknow extruded type ' +
                    'for ' + type);
  var nextType = cellTypes[idxNext];
  return exports[nextType];
};

/**
 * Set the topological family for gcellset.
 * @param {String} name - name of the family: 'P1L2T3T4', 'P1L3T6T10',
 * 'P1L2Q4H8', 'P1L3Q8H20'
 */
exports.GCellSet.prototype.setFamily_ = function(name) {
  if (name === 'P1L2T3T4' || name === 'P1L3T6T10' ||
      name === 'P1L2Q4H8' || name === 'P1L3Q8H20')
    this._topology._family = name;
};

/**
 * Return extruded gcellset.
 * @param {Array} flags - A list of flags, falsy value means skip this layer.
 * @returns {module:gcellset.GCellSet} - extruded gcellset
 */
exports.GCellSet.prototype.extrude = function(flags) {
  var C = this.extrudedGCellSetConstructor();
  return new C({
    topology: this._topology.extrude(flags),
    axisSymm: this._axisSymm,
    otherDimension: this._otherDimension
  });
};

/**
 * @typedef module:gcellset.boxSelectOption
 * @property {Array} bounds - [xmin, xmax, ymin, ymax, zmin, zmax]
 * @property {Number} inflate - the amount to increase or decrease the
 * extent of the box.
 * @property {Boolean} any - require any or all nodes is inside the
 * box. Default is false, means only all nodes fall inside the box
 * will be considered.
 */

/**
 *
 * Return the indices of the cells that all (or any if options.any is
 * true) of its nodes are inside the given box.
 * @param {module:fens.FeNodeSet}
 * @param {module:gcellset.boxSelectOption}
 * @returns {module:gcellset.GCellSet} the boundary gcellset.
 */
exports.GCellSet.prototype.boxSelect = function(fens, options) {
  if (!isa(fens, FeNodeSet))
    throw new Error('GCellSet#boxSelect(fens, options): ' +
                    'fens must be a FeNodeSet instance.');

  if (!isObject(options) || !isArray(options.bounds))
    throw new Error('GCellSet#boxSelect(fens, options): ' +
                    'options is not valid boxSelectOption.');

  var bounds = options.bounds;
  if (isNumber(options.inflate))
    bounds = bounds.map(function(x, i) {
      if (i % 2 === 0) return x - options.inflate;
      return x + options.inflate;
    });

  var any = false, isCellInBox;
  if (isAssigned(options.any)) any = !!(options.any);

  if (any) isCellInBox = anyNodesInBox;
  else isCellInBox = allNodesInBox;

  var conn = this.conn(), res = [];
  conn.forEach(function(cell, idx) {
    if (isCellInBox(fens, cell, bounds)) res.push(idx);
  });
  return res;
};

function allNodesInBox(fens, cell, bounds) {
  return cell.every(function(idx) {
    var xyz = fens.xyzAt(idx);
    return isXyzInsideBox(xyz, bounds);
  });
}

function anyNodesInBox(fens, cell, bounds) {
  return cell.some(function(idx) {
    var xyz = fens.xyzAt(idx);
    return isXyzInsideBox(xyz, bounds);
  });
}

/**
 * Returns the dimension of this geometry cell set.
 * @abstract
 * @returns {Int} dimension.
 */
exports.GCellSet.prototype.dim = function() {
  throw new Error('GCellSet::dim(): is not implemented.');
};

/**
 * Returns the cell size.
 * @abstract
 * @returns {Int} number of nodes per cell.
 */
exports.GCellSet.prototype.cellSize = function() {
  throw new Error('GCellSet::cellSize(): is not implemented.');
};

/**
 * Returns the unique id of this geometry cell set.
 * @returns {String} unique id.
 */
exports.GCellSet.prototype.id = function() {
  return this._id;
};

/**
 * Returns the connectiviy list.
 * @returns {module:types.ConnectivityList} connectivity list of length
 * this.count().
 */
exports.GCellSet.prototype.conn = function() {
  return this._topology.getMaxCells();
};

/**
 * Evaluate the Jacob matrix.
 * @param {module:types.Matrix} nder - Nodal derivatives in parametric domain.
 * @param {module:types.Matrix} x - Nodal coordinates in spatial domain.
 * @returns {module:types.Matrix} Jacob matrix.
 */
exports.GCellSet.prototype.jacobianMatrix = function(nder, x) {
  return dot(transpose(x), nder);
};

/**
 * Evaluate the basis function matrix.
 * @abstract
 * @param {module:types.Matrix} paramCoords - Coordinates in parametric domain.
 * @returns {module:types.Matrix} Nodal contributions. (cellSize by 1).
 */
exports.GCellSet.prototype.bfun = function(paramCoords) {
  throw new Error('GCellSet::bfun(): is not implemented.');
};

/**
 * Evaluate the derivatives of the basis function matrix.
 * @abstract
 * @param {module:types.Matrix} paramCoords - Coordinates in parametric domain.
 * @returns {module:types.Matrix} Nodal contribution derivatives. (cellSize by dim).
 */
exports.GCellSet.prototype.bfundpar = function(paramCoords) {
  throw new Error('GCellSet::bfundpar(): is not implemented.');
};

/**
 * Returns derivatives of the basis functions in spatical domain.
 * @param {module:types.Matrix} nder - Nodal derivatives in parametric
 * domain.
 * @param {module:types.Matrix} x - Nodal coordinates in spatial domain.
 * @returns {module:types.Matrix} Derivatives of the basis functions in
 * spatical domain.
 */
exports.GCellSet.prototype.bfundsp = function(nder, x) {
  var J = mul(transpose(x), nder);
  var res = dot(nder, inv(J));
  return res;
};

// TODO:
// GCellSet.prototype.cat = function() {
//   throw new Error('GCellSet::cat(): is not implemented.');
// };

/**
 * Return the number of cells.
 * @returns {Int}
 */
exports.GCellSet.prototype.count = function() {
  return this._topology.getNumOfCellsInDim(this._topology.getDim());
};

/**
 * Return the number of nodes this gcellset connect
 * @returns {Int}
 */
exports.GCellSet.prototype.nfens = function() {
  return this._topology.getNumOfCellsInDim(0);
};

// TODO:
// GCellSet.prototype.isInParametric = function(paramCoords) {
//   throw new Error('GCellSet::isInParametric(): is not implemented.');
// };

// TODO:
// GCellSet.prototype.map2parametric = function(x, c) {
//   throw new Error('GCellSet::map2parametric(): is not implemented.');
// };

function subset(conn, indices) {
  var newConn = [];
  indices.forEach(function(idx) {
    return newConn.push(cloneDeep(conn[idx]));
  });
  return newConn;
}

/**
 * Returns a new GCellSet of same type which is a subset of self by
 * given indices.
 * @param {Array} indices - indices of selected cell, starts from 0.
 * @returns {module:gcellset.GCellSet}
 */
exports.GCellSet.prototype.subset = function(indices) {
  var conn = subset(this.conn(), indices);
  var C = this.constructor;
  return new C({
    conn: conn,
    axisSymm: this._axisSymm,
    otherDimension: this._otherDimension
  });
};

/**
 * Returns a clone of self.
 * @returns {module:gcellset.GCellSet}
 */
exports.GCellSet.prototype.clone = function() {
  var C = this.constructor;
  return new C({
    topology: this._topology.clone(),
    axisSymm: this._axisSymm,
    otherDimension: this._otherDimension
  });
};

// TODO:
// GCellSet.prototype.updateConnectivity = function() {
//   throw new Error('GCellSet::updateConnectivity(): is not implemented.');
// };

/**
 * Geometry cell set of mainfold 0.
 * @class
 * @extends module:gcellset.GCellSet
 */
exports.GCellSetManifold0 = function GCellSetManifold0(options) {
  GCellSet.call(this, options);
};
var GCellSetManifold0 = exports.GCellSetManifold0;

GCellSetManifold0.prototype = Object.create(GCellSet.prototype);
GCellSetManifold0.prototype.constructor = GCellSetManifold0;

/**
 * @override
 * @returns {Int}
 */
exports.GCellSetManifold0.prototype.dim = function() { return 0; };

/**
 * Evaluate the manifold Jacobian.
 * @param {module:types.Connectivity} conn - Connectivity of a single cell.
 * @param {module:types.Matrix} N - Values of the basis functions. (cellSize by 1).
 * @param {module:types.Matrix} J - Jacobian matrix.
 * @param {module:types.Matrix} x - Spatial coordinates. (cellSize by dim).
 * @returns {Number}
 */
exports.GCellSetManifold0.prototype.jacobian = function(conn, N, J, x) {
  var jac = 1;
  return jac;
};

/**
 * Evaluate the curve Jacobian.
 * @param {module:types.Connectivity} conn - Connectivity of a single cell.
 * @param {module:types.Matrix} N - Values of the basis functions. (cellSize by 1).
 * @param {module:types.Matrix} J - Jacobian matrix.
 * @param {module:types.Matrix} x - Spatial coordinates. (cellSize by dim).
 * @returns {Number}
 */
exports.GCellSetManifold0.prototype.jacobianCurve = function(conn, N, J, x) {
  var jac, xyz;
  if (this.axisSymm()) {
    xyz = dot(transpose(N), x)[0];
    jac = 1*2*Math.PI*xyz[0];
  } else {
    jac = 1*this.otherDimension(conn, N, x);
  }
  return jac;
};

/**
 * Evaluate the surface Jacobian.
 * @param {module:types.Connectivity} conn - Connectivity of a single cell.
 * @param {module:types.Matrix} N - Values of the basis functions. (cellSize by 1).
 * @param {module:types.Matrix} J - Jacobian matrix.
 * @param {module:types.Matrix} x - Spatial coordinates. (cellSize by dim).
 * @returns {Number}
 */
exports.GCellSetManifold0.prototype.jacobianSurface = function(conn, N, J, x) {
  var jac, xyz;
  if (this.axisSymm()) {
    xyz = dot(transpose(N), x)[0];
    jac = 1*2*Math.PI*xyz[0]*this.otherDimension(conn, N, x);
  } else {
    jac = 1*this.otherDimension(conn, N, x);
  }
  return jac;
};

/**
 * Evaluate the volumn Jacobian.
 * @param {module:types.Connectivity} conn - Connectivity of a single cell.
 * @param {module:types.Matrix} N - Values of the basis functions. (cellSize by 1).
 * @param {module:types.Matrix} J - Jacobian matrix.
 * @param {module:types.Matrix} x - Spatial coordinates. (cellSize by dim).
 * @returns {Number}
 */
exports.GCellSetManifold0.prototype.jacobianVolumn = function(conn, N, J, x) {
  var jac;
  if (this.axisSymm()) {
    var xyz = mul(transpose(N), x)[0];
    jac = this.jacobianCurve(conn, N, J, x) * 2 * Math.PI * xyz[0] * this.otherDimension(conn, N, x);
  } else {
    jac = this.jacobianCurve(conn, N, J, x) * this.otherDimension(conn, N, x);
  }
  return jac;
};

/**
 * A convinient wrapper for jacobianCurve, jacobianSurface,
 * jacobianVolumn
 * @param {module:types.Connectivity} conn - Connectivity of a single cell.
 * @param {module:types.Matrix} N - Values of the basis functions. (cellSize by 1).
 * @param {module:types.Matrix} J - Jacobian matrix.
 * @param {module:types.Matrix} x - Spatial coordinates. (cellSize by dim).
 * @param {Int} dim - 1 (curve), 2 (surface) or 3 (volumn).
 * @returns {Number}
 */
exports.GCellSetManifold0.prototype.jacobianInDim = function(conn, N, J, x, dim) {
  var jac;
  switch (dim) {
  case 3:
    jac = this.jacobianVolumn(conn, N, J, x);
    break;
  case 2:
    jac = this.jacobianSurface(conn, N, J, x);
    break;
  case 1:
    jac = this.jacobianCurve(conn, N, J, x);
    break;
  default:
    throw new Error('GCellSetManifold0::jacobianInDim(): wrong dimension ' + dim);
  }
  return jac;
};

/**
 * Geometry cell set of mainfold 1.
 * @class
 * @extends module:gcellset.GCellSet
 */
exports.GCellSetManifold1 = function GCellSetManifold1(options) {
  GCellSet.call(this, options);
};
var GCellSetManifold1 = exports.GCellSetManifold1;

GCellSetManifold1.prototype = Object.create(GCellSet.prototype);
GCellSetManifold1.prototype.constructor = GCellSetManifold1;

/**
 * @override
 * @returns {Int}
 */
exports.GCellSetManifold1.prototype.dim = function() { return 1; };

/**
 * Evaluate the manifold Jacobian.
 * @param {module:types.Connectivity} conn - Connectivity of a single cell.
 * @param {module:types.Matrix} N - Values of the basis functions. (cellSize by 1).
 * @param {module:types.Matrix} J - Jacobian matrix.
 * @param {module:types.Matrix} x - Spatial coordinates. (cellSize by dim).
 * @returns {Number}
 */
exports.GCellSetManifold1.prototype.jacobian = function(conn, N, J, x) {
  var jac = this.jacobianCurve(conn, N, J, x);
  return jac;
};

/**
 * Evaluate the curve Jacobian.
 * @param {module:types.Connectivity} conn - Connectivity of a single cell.
 * @param {module:types.Matrix} N - Values of the basis functions. (cellSize by 1).
 * @param {module:types.Matrix} J - Jacobian matrix.
 * @param {module:types.Matrix} x - Spatial coordinates. (cellSize by dim).
 * @returns {Number}
 */
exports.GCellSetManifold1.prototype.jacobianCurve = function(conn, N, J, x) {
  var vec = transpose(J)[0];
  var jac = norm(vec);
  return jac;
};

/**
 * Evaluate the surface Jacobian.
 * @param {module:types.Connectivity} conn - Connectivity of a single cell.
 * @param {module:types.Matrix} N - Values of the basis functions. (cellSize by 1).
 * @param {module:types.Matrix} J - Jacobian matrix.
 * @param {module:types.Matrix} x - Spatial coordinates. (cellSize by dim).
 * @returns {Number}
 */
exports.GCellSetManifold1.prototype.jacobianSurface = function(conn, N, J, x) {
  var jac, xyz;
  if (this.axisSymm()) {
    xyz = dot(transpose(N), x)[0];
    jac = this.jacobianCurve(conn, N, J, x) * 2 * Math.PI * xyz[0];
  } else {
    jac = this.jacobianCurve(conn, N, J, x) * this.otherDimension(conn, N, x);
  }
  return jac;
};

/**
 * Evaluate the volumn Jacobian.
 * @param {module:types.Connectivity} conn - Connectivity of a single cell.
 * @param {module:types.Matrix} N - Values of the basis functions. (cellSize by 1).
 * @param {module:types.Matrix} J - Jacobian matrix.
 * @param {module:types.Matrix} x - Spatial coordinates. (cellSize by dim).
 * @returns {Number}
 */
exports.GCellSetManifold1.prototype.jacobianVolumn = function(conn, N, J, x) {
  var jac, xyz;
  if (this.axisSymm()) {
    xyz = dot(transpose(N), x)[0];
    jac = this.jacobianCurve(conn, N, J, x) * 2 * Math.PI * xyz[0] * this.otherDimension(conn, N, x);
  } else {
    jac = this.jacobianCurve(conn, N, J, x) * this.otherDimension(conn, N, x);
  }
  return jac;
};

/**
 * A convinient wrapper for jacobianCurve, jacobianSurface,
 * jacobianVolumn
 * @param {module:types.Connectivity} conn - Connectivity of a single cell.
 * @param {module:types.Matrix} N - Values of the basis functions. (cellSize by 1).
 * @param {module:types.Matrix} J - Jacobian matrix.
 * @param {module:types.Matrix} x - Spatial coordinates. (cellSize by dim).
 * @param {Int} dim - 1 (curve), 2 (surface) or 3 (volumn).
 * @returns {Number}
 */
exports.GCellSetManifold1.prototype.jacobianInDim = function(conn, N, J, x, dim) {
  var jac;
  switch (dim) {
  case 3:
    jac = this.jacobianVolumn(conn, N, J, x);
    break;
  case 2:
    jac = this.jacobianSurface(conn, N, J, x);
    break;
  case 1:
    jac = this.jacobianCurve(conn, N, J, x);
    break;
  default:
    throw new Error('GCellSetManifold1::jacobianInDim(): wrong dimension ' + dim);
  }
  return jac;
};

/**
 * Geometry cell set of mainfold 2.
 * @class
 * @extends module:gcellset.GCellSet
 */
exports.GCellSetManifold2 = function GCellSetManifold2(options) {
  GCellSet.call(this, options);
};
var GCellSetManifold2 = exports.GCellSetManifold2;
GCellSetManifold2.prototype = Object.create(GCellSet.prototype);
GCellSetManifold2.prototype.constructor = GCellSetManifold2;

/**
 * @override
 * @returns {Int}
 */
exports.GCellSetManifold2.prototype.dim = function() { return 2; };

/**
 * Evaluate the manifold Jacobian.
 * @param {module:types.Connectivity} conn - Connectivity of a single cell.
 * @param {module:types.Matrix} N - Values of the basis functions. (cellSize by 1).
 * @param {module:types.Matrix} J - Jacobian matrix.
 * @param {module:types.Matrix} x - Spatial coordinates. (cellSize by dim).
 * @returns {Number}
 */
exports.GCellSetManifold2.prototype.jacobian = function(conn, N, J, x) {
  return this.jacobianSurface(conn, N, J, x);
};

/**
 * Evaluate the surface Jacobian.
 * @param {module:types.Connectivity} conn - Connectivity of a single cell.
 * @param {module:types.Matrix} N - Values of the basis functions. (cellSize by 1).
 * @param {module:types.Matrix} J - Jacobian matrix.
 * @param {module:types.Matrix} x - Spatial coordinates. (cellSize by dim).
 * @returns {Number}
 */
exports.GCellSetManifold2.prototype.jacobianSurface = function(conn, N, J, x) {
  var tmp = size(J), sdim = tmp[0], ntan = tmp[1];
  var jac;
  if (ntan === 2) {
    if (sdim === ntan) {
      jac = J[0][0]*J[1][1] - J[1][0]*J[0][1];
    } else {
      jac = skewmat(nthColumn(J, 0));
      jac = dot(jac, nthColumn(J, 1));
      jac = norm(jac);
    }
  } else {
    throw new Error('GCellSetManifold2::jacobianSurface(): is not implemented when ntan is not 2');
  }
  return jac;
};

/**
 * Evaluate the volumn Jacobian.
 * @param {module:types.Connectivity} conn - Connectivity of a single cell.
 * @param {module:types.Matrix} N - Values of the basis functions. (cellSize by 1).
 * @param {module:types.Matrix} J - Jacobian matrix.
 * @param {module:types.Matrix} x - Spatial coordinates. (cellSize by dim).
 * @returns {Number}
 */
exports.GCellSetManifold2.prototype.jacobianVolumn = function(conn, N, J, x) {
  var xyz, jac;
  if (this.axisSymm()) {
    xyz = dot(transpose(N), x)[0];
    jac = this.jacobianSurface(conn, N, J, x)*2*Math.PI*xyz[0];
  } else {
    jac = this.jacobianSurface(conn, N, J, x)*this.otherDimension(conn, N, x);
  }
  return jac;
};

/**
 * A convinient wrapper for jacobianCurve, jacobianSurface,
 * jacobianVolumn
 * @param {module:types.Connectivity} conn - Connectivity of a single cell.
 * @param {module:types.Matrix} N - Values of the basis functions. (cellSize by 1).
 * @param {module:types.Matrix} J - Jacobian matrix.
 * @param {module:types.Matrix} x - Spatial coordinates. (cellSize by dim).
 * @param {Int} dim - 2 (surface) or 3 (volumn).
 * @returns {Number}
 */
exports.GCellSetManifold2.prototype.jacobianInDim = function(conn, N, J, x, dim) {
  switch (dim) {
  case 3:
    return this.jacobianVolumn(conn, N, J, x);
  case 2:
    return this.jacobianSurface(conn, N, J, x);
  default:
    throw new Error('GCellSetManifold2::jacobianInDim(): unsupported dim ' + dim);
  }
};


/**
 * Geometry cell set of mainfold 3.
 * @class
 * @extends module:gcellset.GCellSet
 */
exports.GCellSetManifold3 = function GCellSetManifold3(options) {
  GCellSet.call(this, options);
};
var GCellSetManifold3 = exports.GCellSetManifold3;
GCellSetManifold3.prototype = Object.create(GCellSet.prototype);
GCellSetManifold3.prototype.constructor = GCellSetManifold3;

/**
 * @override
 * @returns {Int}
 */
exports.GCellSetManifold3.prototype.dim = function() { return 3; };

/**
 * Evaluate the manifold Jacobian.
 * @param {module:types.Connectivity} conn - Connectivity of a single cell.
 * @param {module:types.Matrix} N - Values of the basis functions. (cellSize by 1).
 * @param {module:types.Matrix} J - Jacobian matrix.
 * @param {module:types.Matrix} x - Spatial coordinates. (cellSize by dim).
 * @returns {Number}
 */
exports.GCellSetManifold3.prototype.jacobian = function(conn, N, J, x) {
  var jac = this.jacobianVolumn(conn, N, J, x);
  return jac;
};

/**
 * Evaluate the volumn Jacobian.
 * @param {module:types.Connectivity} conn - Connectivity of a single cell.
 * @param {module:types.Matrix} N - Values of the basis functions. (cellSize by 1).
 * @param {module:types.Matrix} J - Jacobian matrix.
 * @param {module:types.Matrix} x - Spatial coordinates. (cellSize by dim).
 * @returns {Number}
 */
exports.GCellSetManifold3.prototype.jacobianVolumn = function(conn, N, J, x) {
  var tmp = size(J), sdim = tmp[0], ntan = tmp[0];
  var jac;
  if (ntan === 3) {
    jac = det(J);
  } else {
    throw new Error('GCellSetManifold3#jacobianVolumn(): incorrect' +
                    ' size of tangents.');
  }
  return jac;
};

/**
 * A convinient wrapper for jacobianVolumn.
 * @param {module:types.Connectivity} conn - Connectivity of a single cell.
 * @param {module:types.Matrix} N - Values of the basis functions. (cellSize by 1).
 * @param {module:types.Matrix} J - Jacobian matrix.
 * @param {module:types.Matrix} x - Spatial coordinates. (cellSize by dim).
 * @param {Int} dim - 3 (volumn).
 * @returns {Number}
 */
exports.GCellSetManifold3.prototype.jacobianInDim = function(conn, N, J, x, dim) {
  switch (dim) {
  case 3:
    return this.jacobianVolumn(conn, N, J, x);
  default:
    throw new Error('GCellSetManifold3::jacobianInDim(): unsupported dim ' + dim);
  }
};

/**
 * One-node point geometric cell set.
 * @class
 * @extends module:gcellset.GCellSetManifold0
 * @param {module:gcellset.P1InitOption} options
 */
exports.P1 = function P1(options) {
  if (!options || !(options.conn || options.topology))
    throw new Error('P1#constructor(options): options is not a valid' +
                    ' P1InitOption');

  if (options.conn) options.topology = hypercube(options.conn, 0);

  GCellSetManifold0.call(this, options);
};
var P1 = exports.P1;

P1.prototype = Object.create(GCellSetManifold0.prototype);
P1.prototype.constructor = P1;

/**
 * {@link module:gcellset.GCellSet#boundaryGCellSetConstructor}
 * @override
 */
exports.P1.prototype.boundaryGCellSetConstructor = function() { return null; };

/**
 * {@link module:gcellset.GCellSet#edges}
 * @override
 */
exports.P1.prototype.edges = function() { return []; };

/**
 * {@link module:gcellset.GCellSet#triangles}
 * @override
 */
exports.P1.prototype.triangles = function() { return []; };

/**
 * {@link module:gcellset.GCellSet#cellSize}
 * @override
 */
exports.P1.prototype.cellSize = function() { return 1; };

/**
 * {@link module:gcellset.GCellSet#type}
 * @override
 */
exports.P1.prototype.type = function() { return 'P1'; };

/**
 * {@link module:gcellset.GCellSet#bfun}
 * @override
 */
exports.P1.prototype.bfun = function(paramCoords) {
  return [
    [1]
  ];
};

/**
 * {@link module:gcellset.GCellSet#bfundpar}
 * @override
 */
exports.P1.prototype.bfundpar = function(paramCoords) {
  return [
    [0]
  ];
};

/**
 * Two-node curve geometric cell set.
 * @class
 * @extends module:gcellset.GCellSetManifold1
 * @param {module:gcellset.L2InitOption} options
 */
exports.L2 = function L2(options) {
  if (!options || !(options.conn || options.topology))
    throw new Error('L2#constructor(options): options is not a valid' +
                    ' L2InitOption');

  if (options.conn) options.topology = hypercube(options.conn, 1);

  GCellSetManifold1.call(this, options);
};
var L2 = exports.L2;

L2.prototype = Object.create(GCellSetManifold1.prototype);
L2.prototype.constructor = L2;

/**
 * {@link module:gcellset.GCellSet#boundaryGCellSetConstructor}
 * @override
 */
exports.L2.prototype.boundaryGCellSetConstructor = function() {
  return P1;
};

/**
 * {@link module:gcellset.GCellSet#triangles}
 * @override
 */
exports.L2.prototype.triangles = function() { return []; };

/**
 * {@link module:gcellset.GCellSet#cellSize}
 * @override
 */
exports.L2.prototype.cellSize = function() { return 2; };

/**
 * {@link module:gcellset.GCellSet#type}
 * @override
 */
exports.L2.prototype.type = function() { return 'L2'; };

/**
 * {@link module:gcellset.GCellSet#bfun}
 * @override
 */
exports.L2.prototype.bfun = function(paramCoords) {
  var x = paramCoords[0];
  var out = [
    [ 0.5 * (1 - x) ],
    [ 0.5 * (1 + x) ]
  ];
  return out;
};

/**
 * {@link module:gcellset.GCellSet#bfundpar}
 * @override
 */
exports.L2.prototype.bfundpar = function(paramCoords) {
  return [
    [ -0.5 ],
    [ +0.5 ]
  ];
};

/**
 * Four-node quad geometric cell set.
 * @class
 * @extends module:gcellset.GCellSetManifold2
 * @param {module:types.Q4InitOption} options
 */
exports.Q4 = function Q4(options) {
  if (!options || !(options.conn || options.topology))
    throw new Error('Q4#constructor(options): options is not a valid' +
                    ' Q4InitOption');

  if (options.conn) options.topology = hypercube(options.conn, 2);
  GCellSetManifold2.call(this, options);
};

var Q4 = exports.Q4;
Q4.prototype = Object.create(GCellSetManifold2.prototype);
Q4.prototype.constructor = Q4;

/**
 * {@link module:gcellset.GCellSet#cellSize}
 * @override
 */
exports.Q4.prototype.cellSize = function() { return 4; };

/**
 * {@link module:gcellset.GCellSet#type}
 * @override
 */
exports.Q4.prototype.type = function() { return 'Q4'; };

/**
 * {@link module:gcellset.GCellSet#boundaryGCellSetConstructor}
 * @override
 */
exports.Q4.prototype.boundaryGCellSetConstructor = function() { return L2; };

/**
 * {@link module:gcellset.GCellSet#triangles}
 * @override
 */
exports.Q4.prototype.triangles = function() {
  var quads = this._topology.getCellsInDim(2);
  var triangles = [];

  quads.forEach(function(quad) {
    var t1 = [quad[0], quad[1], quad[2]];
    var t2 = [quad[2], quad[3], quad[0]];
    triangles.push(t1, t2);
  });

  return triangles;
};

/**
 * {@link module:gcellset.GCellSet#bfun}
 * @override
 */
exports.Q4.prototype.bfun = function(paramCoords) {
  var one_minus_xi = (1 - paramCoords[0]);
  var one_plus_xi  = (1 + paramCoords[0]);
  var one_minus_eta = (1 - paramCoords[1]);
  var one_plus_eta  = (1 + paramCoords[1]);

  var val = [
    [0.25 * one_minus_xi * one_minus_eta],
    [0.25 * one_plus_xi  * one_minus_eta],
    [0.25 * one_plus_xi  * one_plus_eta],
    [0.25 * one_minus_xi * one_plus_eta]
  ];
  return val;
};

/**
 * {@link module:gcellset.GCellSet#bfundpar}
 * @override
 */
exports.Q4.prototype.bfundpar = function(paramCoords) {
  var xi = paramCoords[0], eta = paramCoords[1];
  var val = [
    [-(1. - eta) * 0.25, -(1. - xi) * 0.25],
    [(1. - eta) * 0.25, -(1. + xi) * 0.25],
    [(1. + eta) * 0.25, (1. + xi) * 0.25],
    [-(1. + eta) * 0.25, (1. - xi) * 0.25]
  ];
  return val;
};


/**
 * Eight-node brick geometric cell set.
 * @class
 * @extends module:gcellset.GCellSetManifold3
 * @param {module:types.H8InitOption} options
 */
exports.H8 = function H8(options) {
  if (!options || !(options.conn || options.topology))
    throw new Error('H8#constructor(options): options is not a valid' +
                    ' H8InitOption');

  if (options.conn) options.topology = hypercube(options.conn, 3);
  GCellSetManifold3.call(this, options);
};

var H8 = exports.H8;
H8.prototype = Object.create(GCellSetManifold3.prototype);
H8.prototype.constructor = H8;

/**
 * {@link module:gcellset.GCellSet#cellSize}
 * @override
 */
exports.H8.prototype.cellSize = function() { return 8; };

/**
 * {@link module:gcellset.GCellSet#type}
 * @override
 */
exports.H8.prototype.type = function() { return 'H8'; };

/**
 * {@link module:gcellset.GCellSet#boundaryGCellSetConstructor}
 * @override
 */
exports.H8.prototype.boundaryGCellSetConstructor = function() { return Q4; };

/**
 * {@link module:gcellset.GCellSet#triangles}
 * @override
 */
exports.H8.prototype.triangles = function() {
  var bricks = this._topology.getCellsInDim(3);
  var triangles = [];

  bricks.forEach(function(brick) {
    // quad 0 1 2 3
    var t1 = [brick[0], brick[3], brick[1]];
    var t2 = [brick[1], brick[3], brick[2]];

    // quad 0 1 5 4
    var t3 = [brick[0], brick[1], brick[4]];
    var t4 = [brick[1], brick[5], brick[4]];

    // quad 1 2 6 5
    var t5 = [brick[1], brick[2], brick[5]];
    var t6 = [brick[6], brick[5], brick[2]];

    // quad 2 3 7 6
    var t7 = [brick[2], brick[3], brick[7]];
    var t8 = [brick[7], brick[6], brick[2]];

    // quad 0 4 7 3
    var t9 = [brick[0], brick[4], brick[7]];
    var t10 = [brick[4], brick[7], brick[3]];

    // quad 4 5 6 7
    var t11 = [brick[4], brick[5], brick[6]];
    var t12 = [brick[6], brick[7], brick[4]];

    triangles.push(t1, t2, t3, t4, t5, t6);
    triangles.push(t7, t8, t9, t10, t11, t12);
  });

  return triangles;
};

/**
 * Basis function evaluate to a 8 by 1 matrix.
 * {@link module:gcellset.GCellSet#bfun}
 * @override
 */
exports.H8.prototype.bfun = function(paramCoords) {
  var one_minus_xi = (1 - paramCoords[0]);
  var one_minus_eta = (1 - paramCoords[1]);
  var one_minus_theta = (1 - paramCoords[2]);

  var one_plus_xi  = (1 + paramCoords[0]);
  var one_plus_eta  = (1 + paramCoords[1]);
  var one_plus_theta = (1 + paramCoords[2]);

  var val = [
    [ 0.125 * one_minus_xi * one_minus_eta * one_minus_theta ],
    [ 0.125 * one_plus_xi * one_minus_eta * one_minus_theta ],
    [ 0.125 * one_plus_xi * one_plus_eta * one_minus_theta ],
    [ 0.125 * one_minus_xi * one_plus_eta * one_minus_theta ],
    [ 0.125 * one_minus_xi * one_minus_eta * one_plus_theta ],
    [ 0.125 * one_plus_xi * one_minus_eta * one_plus_theta ],
    [ 0.125 * one_plus_xi * one_plus_eta * one_plus_theta ],
    [ 0.125 * one_minus_xi * one_plus_eta * one_plus_theta ]
  ];
  return val;
};

/**
 * Basis function derivatives evaluate to a 8 by 3 matrix.
 * {@link module:gcellset.GCellSet#bfundpar}
 * @override
 */
exports.H8.prototype.bfundpar = function(paramCoords) {
  var one_minus_xi = (1 - paramCoords[0]);
  var one_minus_eta = (1 - paramCoords[1]);
  var one_minus_theta = (1 - paramCoords[2]);

  var one_plus_xi  = (1 + paramCoords[0]);
  var one_plus_eta  = (1 + paramCoords[1]);
  var one_plus_theta = (1 + paramCoords[2]);

  var val = [
    [
        -one_minus_eta*one_minus_theta,
      one_minus_eta*one_minus_theta,
      one_plus_eta*one_minus_theta,
        -one_plus_eta*one_minus_theta,
        -one_minus_eta*one_plus_theta,
      one_minus_eta*one_plus_theta,
      one_plus_eta*one_plus_theta,
        -one_plus_eta*one_plus_theta
    ],
    [
        -one_minus_xi*one_minus_theta,
        -one_plus_xi*one_minus_theta,
      one_plus_xi*one_minus_theta,
      one_minus_xi*one_minus_theta,
        -one_minus_xi*one_plus_theta,
        -one_plus_xi*one_plus_theta,
      one_plus_xi*one_plus_theta,
      one_minus_xi*one_plus_theta
    ],
    [
        -one_minus_xi*one_minus_eta,
        -one_plus_xi*one_minus_eta,
        -one_plus_xi*one_plus_eta,
        -one_minus_xi*one_plus_eta,
      one_minus_xi*one_minus_eta,
      one_plus_xi*one_minus_eta,
      one_plus_xi*one_plus_eta,
      one_minus_xi*one_plus_eta
    ]
  ];

  val = mul(transpose(val), 0.125);
  return val;
};
