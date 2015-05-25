'use strict';

var assert = require('assert');
var babel = require('babel-core');
var globalsPlugin = require('../index');
var path = require('path');

module.exports = {
  testPluginExistence: function(test) {
    assert.doesNotThrow(function() {
      babel.transform('var a = 2;', {plugins: [globalsPlugin(babel)]});
    });
    test.done();
  },

  testWrapWithClosure: function(test) {
    var result = babel.transform('var a = 2;', {plugins: globalsPlugin(babel)});
    var expectedResult = '"use strict";\n\n(function () {\n  var a = 2;\n}).call(this);';
    assert.strictEqual(expectedResult, result.code);
    test.done();
  },

  testNoFilenameImport: function(test) {
    assert.throws(function() {
      babel.transform('import foo from "./foo"', getBabelOptions());
    });
    test.done();
  },

  testDefaultImport: function(test) {
    var babelOptions = getBabelOptions(path.resolve('foo/bar.js'));
    var result = babel.transform('import foo from "./foo"', babelOptions);

    var expectedResult = '"use strict";\n\n(function () {\n' +
      '  var foo = this.myGlobal.foo;\n' +
      '}).call(this);';
    assert.strictEqual(expectedResult, result.code);

    test.done();
  },

  testWildcardImport: function(test) {
    var babelOptions = getBabelOptions(path.resolve('foo/bar.js'));
    var result = babel.transform('import * as foo from "./foo"', babelOptions);

    var expectedResult = '"use strict";\n\n(function () {\n' +
      '  var foo = this.myGlobalNamed.foo;\n' +
      '}).call(this);';
    assert.strictEqual(expectedResult, result.code);

    test.done();
  },

  testNamedImport: function(test) {
    var babelOptions = getBabelOptions(path.resolve('foo/bar.js'));
    var result = babel.transform('import {foo, bar} from "./foo"', babelOptions);

    var expectedResult = '"use strict";\n\n(function () {\n' +
      '  var foo = this.myGlobalNamed.foo.foo;\n' +
      '  var bar = this.myGlobalNamed.foo.bar;\n' +
      '}).call(this);';
    assert.strictEqual(expectedResult, result.code);

    test.done();
  },

  testAnonymousImport: function(test) {
    var babelOptions = getBabelOptions(path.resolve('foo/bar.js'));
    var result = babel.transform('import "./foo"', babelOptions);

    var expectedResult = '"use strict";\n\n(function () {}).call(this);';
    assert.strictEqual(expectedResult, result.code);

    test.done();
  },

  testNoFilenameExport: function(test) {
    assert.throws(function() {
      babel.transform('export default foo', getBabelOptions());
    });
    test.done();
  },

  testDefaultExport: function(test) {
    var babelOptions = getBabelOptions(path.resolve('foo/bar.js'));
    var result = babel.transform('export default foo', babelOptions);

    var expectedResult = '"use strict";\n\n(function () {\n' +
      '  this.myGlobal.bar = foo;\n' +
      '}).call(this);';
    assert.strictEqual(expectedResult, result.code);

    test.done();
  },

  testDefaultAssignmentExport: function(test) {
    var babelOptions = getBabelOptions(path.resolve('foo/bar.js'));
    var result = babel.transform('export default "foo"', babelOptions);

    var expectedResult = '"use strict";\n\n(function () {\n' +
      '  this.myGlobal.bar = "foo";\n' +
      '}).call(this);';
    assert.strictEqual(expectedResult, result.code);

    test.done();
  },

  testNamedExport: function(test) {
    var babelOptions = getBabelOptions(path.resolve('foo/bar.js'));
    var result = babel.transform('export {foo, bar}', babelOptions);

    var expectedResult = '"use strict";\n\n(function () {\n' +
      '  this.myGlobalNamed.bar = {};\n' +
      '  this.myGlobalNamed.bar.foo = foo;\n' +
      '  this.myGlobalNamed.bar.bar = bar;\n' +
      '}).call(this);';
    assert.strictEqual(expectedResult, result.code);

    test.done();
  },

  testNamedAssignmentExport: function(test) {
    var babelOptions = getBabelOptions(path.resolve('foo/bar.js'));
    var result = babel.transform('export var foo, bar = "foo"', babelOptions);

    var expectedResult = '"use strict";\n\n(function () {\n' +
      '  var foo,\n      bar = "foo";\n' +
      '  this.myGlobalNamed.bar = {};\n' +
      '  this.myGlobalNamed.bar.foo = foo;\n' +
      '  this.myGlobalNamed.bar.bar = bar;\n' +
      '}).call(this);';
    assert.strictEqual(expectedResult, result.code);

    test.done();
  },

  testNamedFunctionDeclarationExport: function(test) {
    var babelOptions = getBabelOptions(path.resolve('foo/bar.js'));
    var result = babel.transform('export function foo() {}', babelOptions);

    var expectedResult = '"use strict";\n\n(function () {\n' +
      '  function foo() {}\n' +
      '  this.myGlobalNamed.bar = {};\n' +
      '  this.myGlobalNamed.bar.foo = foo;\n' +
      '}).call(this);';
    assert.strictEqual(expectedResult, result.code);

    test.done();
  },

  testNamedSourceExport: function(test) {
    var babelOptions = getBabelOptions(path.resolve('foo/bar.js'));
    var result = babel.transform('export {foo, bar} from "./foo"', babelOptions);

    var expectedResult = '"use strict";\n\n(function () {\n' +
      '  this.myGlobalNamed.bar = {};\n' +
      '  this.myGlobalNamed.bar.foo = this.myGlobalNamed.foo.foo;\n' +
      '  this.myGlobalNamed.bar.bar = this.myGlobalNamed.foo.bar;\n' +
      '}).call(this);';
    assert.strictEqual(expectedResult, result.code);
    test.done();
  },

  testDefaultSourceExport: function(test) {
    var babelOptions = getBabelOptions(path.resolve('foo/bar.js'));
    var result = babel.transform('export foo from "./foo"', babelOptions);

    var expectedResult = '"use strict";\n\n(function () {\n' +
      '  this.myGlobalNamed.bar = {};\n' +
      '  this.myGlobalNamed.bar.foo = this.myGlobal.foo;\n' +
      '}).call(this);';
    assert.strictEqual(expectedResult, result.code);
    test.done();
  },

  testWildcardSourceExport: function(test) {
    var babelOptions = getBabelOptions(path.resolve('foo/bar.js'));
    var result = babel.transform('export * from "foo"', babelOptions);

    var expectedResult = '"use strict";\n\n(function () {}).call(this);';
    assert.strictEqual(expectedResult, result.code);
    test.done();
  }
};

function getBabelOptions(filename) {
  return {
    _globalName: 'myGlobal',
    blacklist: 'es6.modules',
    filename: filename,
    plugins: globalsPlugin(babel)
  };
}
