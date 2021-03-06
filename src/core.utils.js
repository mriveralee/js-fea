/*global require*/

// var _ = require('highland');
var _ = require('lodash');
_.assign(exports, _);

exports.Bimap = require('./core.bimap').Bimap;

/**
 * @module utils
 */

/**
 * @callback module:utils.array1dGenerator
 * @param {Number} i - index, starts from 0.
 * @returns {Any}
 */

/**
 * Returns a 1d js array by given dimension and generating function.
 * @function
 * @param {Number} m - length.
 * @param {module:utils.array1dGenerator|Any} fn - Generation function or constant value.
 * @returns {Array}
 */
exports.array1d = function array1d(m, fn) {
  if (typeof fn === 'function') {
    return Array.apply(null, Array(m)).map(function(x, i) { return fn(i); });
  } else {
    return Array.apply(null, Array(m)).map(function() { return fn; });
  }
};

var array1d = exports.array1d;

/**
 * @callback module:utils.array2dGenerator
 * @param {Number} i - row index, starts from 0.
 * @param {Number} j - column index, starts from 1.
 * @returns {Any}
 */

/**
 * Returns a 2d js array by given dimension and generating function.
 * @param {Number} m - number of rows.
 * @param {Number} n - number of columns.
 * @param {module:utils.array2dGenerator|Any} fn - Generation function or constant value.
 * @returns {Array}
 */
exports.array2d = function array2d(m, n, fn) {
  if (typeof fn === 'function') {
    return array1d(m, function(i) {
      return array1d(n, function(j) {
        return fn(i, j);
      });
    });
  } else {
    return array1d(m, function(i) {
      return array1d(n, fn);
    });
  }
};
var array2d = exports.array2d;

/**
 * Return a new vector that embeded in new dimension.
 * @example [1,2], 3 -> [1,2,0]
 * @example [0], 3 -> [0,0,0]
 * @param {Array} vec
 * @param {Number} dim
 * @returns {Array}
 */
exports.embed = function embed(vec, dim) {
  var i, len, out;
  if (_.isArray(vec) && typeof dim === 'number') {
    out = array1d(dim, 0.0);
    for (i = 0, len = vec.length < dim ? vec.length : dim; i < len; ++i) out[i] = vec[i];
    return out;
  }
  throw new Error('embed(vec, dim): vec must be a Javascript array.');
};

/**
 * Compare two array lexically.
 * @param {Array} a - first array.
 * @param {Array} b - second array.
 * @returns {Number}
 */
exports.byLexical = function byLexical(a, b) {
  var i = 0, l = a.length, res;
  while (i < l) {
    res = a[i] - b[i];
    if (res !== 0) return res;
    ++i;
  }
  return res;
};

/**
 * Returns a new array that roated by towards left by given offset.
 * @param {Array} arr
 * @param {Integer} offset
 * @returns {Array} - new rotated array.
 */
exports.rotateLeft = function rotateLeft(arr, offset) {
  if (typeof offset === 'undefined')
    throw new Error('rotateLeft(): no offset specified.');

  var len = arr.length;
  var out = new Array(len);
  var i = (len + (offset % len)) % len, j = 0;
  while (j < len) {
    out[j] = arr[(i+j) % len];
    ++j;
  }
  return out;
};
var rotateLeft = exports.rotateLeft;

/**
 * Returns a new array that roated by towards right by given offset.
 * @param {Array} arr
 * @param {Integer} offset
 * @returns {Array} - new rotated array.
 */
exports.rotateRight = function rotateRight(arr, offset) {
  return rotateLeft(arr, -offset);
};
var rotateRight = exports.rotateRight;

/**
 * Returns the index of the smallest value.
 * @param {Array} vec
 * @param {CompareFn|undefined} cmp
 * @returns {Index}
 */
exports.minIndex = function minIndex(vec, cmp) {
  if (typeof cmp === 'function') {
    return _.reduce(vec, function(sofar, x, i) {
      if (cmp(x, sofar.value) < 0) {
        sofar.value = x;
        sofar.index = i;
      }
      return sofar;
    }, {
      value: Infinity,
      index: -1
    }).index;
  } else {
    return _.reduce(vec, function(sofar, x, i) {
      if (x < sofar.value) {
        sofar.value = x;
        sofar.index = i;
      }
      return sofar;
    }, {
      value: Infinity,
      index: -1
    }).index;
  }
};
var minIndex = exports.minIndex;

/**
 * Check whether an object is an iterator. An iterator must implement
 * both hasNext() and next() method.
 * @param {Any} obj
 * @returns {Boolean}
 */
exports.isIterator = function isIterator(obj) {
  return obj && typeof obj.hasNext === 'function' &&
    typeof obj.next === 'function';
};
var isIterator = exports.isIterator;

exports.noopIterator = {
  hasNext: function() { return false; },
  next: function() { return null; }
};

/**
 * Construct an js array from iterator.
 * @param {Iterator} iter
 * @returns {Array}
 */
exports.listFromIterator = function listFromIterator(iter) {
  var out = [];
  while (iter.hasNext()) out.push(iter.next());
  return out;
};
var listFromIterator = exports.listFromIterator;

/**
 * Return a iterator of the list.
 * @param {Array} lst
 * @returns {Iterator}
 */
exports.iteratorFromList = function iteratorFromList(lst) {
  if (!_.isArray(lst)) {
    throw new Error('iteratorFromList(lst): lst must be an array.');
  }

  var i = 0, len = lst.length;
  return {
    hasNext: function() { return i < len; },
    next: function() { return lst[i++]; }
  };
};
var iteratorFromList = exports.iteratorFromList;

/**
 * Returns a unique identifier.
 * @returns {String}
 */
exports.uuid = function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
};
var uuid = exports.uuid;

/**
 * Return a normalized connectivity list by rotating the original one
 * so that the smallest index is the first element. Useful when check
 * whether two cells are the same.
 * @function utils.normalizedCell
 * @param {ConnectivityList} conn - Connectivity list of cell.
 * @returns {ConnectivityList}
 */
exports.normalizedCell = function normalizedCell(conn) {
  var offset = minIndex(conn);
  return rotateLeft(conn, offset);
};
var normalizedCell = exports.normalizedCell;

// Type checking & contracts:
var check = require('check-types');
var assert = require('assert');

exports._env = 'dev';

function noop() {}
exports.noop = noop;

exports.defineContract = function defineContract(c, whatsWrong) {
  if (exports._env === 'dev') {
    return function() {
      try {
        c.apply(null, arguments);
      } catch(err) {
        if (typeof whatsWrong === 'function')
          err.message = whatsWrong.apply(null, arguments) + '\n' + err.message;

        if (whatsWrong)
          err.message = whatsWrong + '\n' + err.message;

        throw err;
      }
    };
  } else {
    return noop;
  }
};
var defineContract = exports.defineContract;

assert.string = check.assert.string;
assert.unemptyString = check.assert.unemptyString;
assert.webUrl = check.assert.webUrl;
assert.length = check.assert.length;
assert.number = check.assert.number;
assert.positive = check.assert.positive;
assert.negative = check.assert.negative;
assert.odd = check.assert.odd;
assert.even = check.assert.even;
assert.integer = check.assert.integer;
assert.function = check.assert.function;
assert.array = check.assert.array;
assert.length = check.assert.length;
assert.date = check.assert.date;
assert.object = check.assert.object;
assert.emptyObject = check.assert.emptyObject;
assert.instance = check.assert.instance;
assert.like = check.assert.like;
assert.null = check.assert.null;
assert.undefined = check.assert.undefined;
assert.assigned = check.assert.assigned;
assert.boolean = check.assert.boolean;

exports.check = check;
exports.assert = assert;

/**
 * Returns a contract of m by n matrix.
 * @param {Number} m
 * @param {Number} n
 * @param {String} msg
 * @returns {Contract}
 */
exports.ensureMatrixOfDimension = function ensureMatrixOfDimension(m, n, msg) {
  if (m !== '*') assert.positive(m);
  if (n !== '*') assert.positive(n);

  if (!msg) msg = 'input is not a matrix of ' + m + ' x ' + n + '.';
  return defineContract(function(mat) {
    assert.array(mat, 'mat is not a JS array');

    if (m === '*') m = mat.length;
    assert(mat.length === m, 'mat length ' + mat.length + ' is not '+ m);

    var i, j;
    for (i = 0; i < m; ++i) {
      assert.array(mat[i], 'row ' + i + ' is not a JS array');
      if (n === '*') n = mat[i].length;
      assert(mat[i].length === n, 'row ' + i + ' has ' + mat[i].length + ' elements' +
             ' instead of ' + n);
      for (j = 0; j < n; ++j) {
        assert.number(mat[i][j], 'mat(' + [i,j] + ') is not a number.');
      }
    }
  }, msg);
};
var ensureMatrixOfDimension =
      assert.ensureMatrixOfDimension =
      exports.ensureMatrixOfDimension;

/**
 * Check whether an object is a matrix of m by n.
 * @param {Any} mat
 * @param {Number} m
 * @param {Number} n
 * @returns {Boolean}
 */
exports.isMatrixOfDimension = function isMatrixOfDimension(mat, m, n) {
  try {
    ensureMatrixOfDimension(m, n)(mat);
  } catch(err) {
    return false;
  }
  return true;
};
var isMatrixOfDimension =
      check.isMatrixOfDimension =
      exports.isMatrixOfDimension;

/**
 * Returns a contract of m-D vector
 * @param {Number} m
 * @param {String} msg
 * @returns {Contract}
 */
exports.ensureVectorOfDimension = function ensureVectorOfDimension(n, msg) {
  if (n !== '*') assert.positive(n);
  if (!msg) msg = 'input is not a vector of ' + n + ' dimension.';
  return defineContract(function(vec) {
    assert.array(vec, 'vec is not a JS array');
    if (n === '*') n = vec.length;
    assert(vec.length === n, 'vec length ' + vec.length + ' is not ' + n);

    var i;
    for (i = 0; i < n; ++i)
      assert.number(vec[i], 'vec(' + i + '): ' + vec[i] + ' is not a number.');

  }, msg);
};

var ensureVectorOfDimension =
      assert.ensureVectorOfDimension =
      exports.ensureVectorOfDimension;

/**
 * Check whether an object is a vector of length m.
 * @param {Any} vec
 * @param {Number} m
 * @returns {Boolean}
 */
exports.isVectorOfDimension = function isVectorOfDimension(vector, n) {
  try {
    ensureVectorOfDimension(n)(vector);
  } catch(err) {
    return false;
  }
  return true;
};
var isVectorOfDimension =
      check.isVectorOfDimension =
      exports.isVectorOfDimension;
