'use strict';

var assert = require('assert');
var babel = require('babel-core');
var path = require('path');
var globalsPlugin = require('../index');

module.exports = {
  testPluginExistence: function(test) {
    assert.doesNotThrow(function() {
      babel.transform('var a = 2;', getBabelOptions());
    });
    test.done();
  },

  testWrapWithClosure: function(test) {
    var result = babel.transform('var a = 2;', getBabelOptions());
    var expectedResult = '(function () {\n  var a = 2;\n}).call(this);';
    assert.strictEqual(expectedResult, result.code);
    test.done();
  },

  testTransformOnlyModules: function(test) {
    var result = babel.transform('var a = 2;', getBabelOptions(undefined, true));
    var expectedResult = 'var a = 2;';
    assert.strictEqual(expectedResult, result.code);
    test.done();
  },

  testNoFilenameImport: function(test) {
    var options = getBabelOptions();
    delete options.filename;
    assert.throws(function() {
      babel.transform('import foo from "./foo"', options);
    });
    test.done();
  },

  testDefaultImport: function(test) {
    var babelOptions = getBabelOptions(path.resolve('foo/bar.js'));
    var result = babel.transform('import foo from "./foo"', babelOptions);

    var expectedResult = '(function () {\n' +
      '  var foo = this.myGlobal.foo.foo;\n' +
      '}).call(this);';
    assert.strictEqual(expectedResult, result.code);

    test.done();
  },

  testDefaultImportFromExternal: function(test) {
    var babelOptions = getBabelOptions(path.resolve('foo/bar.js'));
    var result = babel.transform('import foo from "external-module"', babelOptions);

    var expectedResult = '(function () {\n' +
      '  var foo = this.ExternalModule["default"] || this.ExternalModule;\n' +
      '}).call(this);';
    assert.strictEqual(expectedResult, result.code);

    test.done();
  },

  testWildcardImport: function(test) {
    var babelOptions = getBabelOptions(path.resolve('foo/bar.js'));
    var result = babel.transform('import * as foo from "./foo"', babelOptions);

    var expectedResult = '(function () {\n' +
      '  var foo = this.myGlobal.foo.foo;\n' +
      '}).call(this);';
    assert.strictEqual(expectedResult, result.code);

    test.done();
  },

  testNamedImport: function(test) {
    var babelOptions = getBabelOptions(path.resolve('foo/bar.js'));
    var result = babel.transform('import {foo, bar} from "./foo"', babelOptions);

    var expectedResult = '(function () {\n' +
      '  var foo = this.myGlobal.foo.foo.foo;\n' +
      '  var bar = this.myGlobal.foo.foo.bar;\n' +
      '}).call(this);';
    assert.strictEqual(expectedResult, result.code);

    test.done();
  },

  testAnonymousImport: function(test) {
    var babelOptions = getBabelOptions(path.resolve('foo/bar.js'));
    var result = babel.transform('import "./foo"', babelOptions);

    var expectedResult = '(function () {}).call(this);';
    assert.strictEqual(expectedResult, result.code);

    test.done();
  },

  testImportWithMultipleExtensionsFilename: function(test) {
    var babelOptions = getBabelOptions(path.resolve('foo/bar.js'));
    var result = babel.transform('import foo from "./foo.soy"', babelOptions);

    var expectedResult = '(function () {\n' +
      '  var foo = this.myGlobal.foo.foo;\n' +
      '}).call(this);';
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

    var expectedResult = '(function () {\n' +
      '  this.myGlobal.foo = this.myGlobal.foo || {};\n' +
      '  this.myGlobal.foo.bar = foo;\n' +
      '}).call(this);';
    assert.strictEqual(expectedResult, result.code);

    test.done();
  },

  testDefaultExportOfDeepFilePath: function(test) {
    var babelOptions = getBabelOptions(path.resolve('foo/bar/baz.js'));
    var result = babel.transform('export default foo', babelOptions);

    var expectedResult = '(function () {\n' +
      '  this.myGlobal.foo = this.myGlobal.foo || {};\n' +
      '  this.myGlobal.foo.bar = this.myGlobal.foo.bar || {};\n' +
      '  this.myGlobal.foo.bar.baz = foo;\n' +
      '}).call(this);';
    assert.strictEqual(expectedResult, result.code);

    test.done();
  },

  testDefaultAssignmentExport: function(test) {
    var babelOptions = getBabelOptions(path.resolve('foo/bar.js'));
    var result = babel.transform('export default "foo"', babelOptions);

    var expectedResult = '(function () {\n' +
      '  this.myGlobal.foo = this.myGlobal.foo || {};\n' +
      '  this.myGlobal.foo.bar = "foo";\n' +
      '}).call(this);';
    assert.strictEqual(expectedResult, result.code);

    test.done();
  },

  testNamedExport: function(test) {
    var babelOptions = getBabelOptions(path.resolve('foo/bar.js'));
    var result = babel.transform('export {foo, bar}', babelOptions);

    var expectedResult = '(function () {\n' +
      '  this.myGlobal.foo = this.myGlobal.foo || {};\n' +
      '  this.myGlobal.foo.bar = {};\n' +
      '  this.myGlobal.foo.bar.foo = foo;\n' +
      '  this.myGlobal.foo.bar.bar = bar;\n' +
      '}).call(this);';
    assert.strictEqual(expectedResult, result.code);

    test.done();
  },

  testNamedAssignmentExport: function(test) {
    var babelOptions = getBabelOptions(path.resolve('foo/bar.js'));
    var result = babel.transform('export var foo, bar = "foo"', babelOptions);

    var expectedResult = '(function () {\n' +
      '  var foo,\n      bar = "foo";\n' +
      '  this.myGlobal.foo = this.myGlobal.foo || {};\n' +
      '  this.myGlobal.foo.bar = {};\n' +
      '  this.myGlobal.foo.bar.foo = foo;\n' +
      '  this.myGlobal.foo.bar.bar = bar;\n' +
      '}).call(this);';
    assert.strictEqual(expectedResult, result.code);

    test.done();
  },

  testNamedFunctionDeclarationExport: function(test) {
    var babelOptions = getBabelOptions(path.resolve('foo/bar.js'));
    var result = babel.transform('export function foo() {}', babelOptions);

    var expectedResult = '(function () {\n' +
      '  function foo() {}\n' +
      '  this.myGlobal.foo = this.myGlobal.foo || {};\n' +
      '  this.myGlobal.foo.bar = {};\n' +
      '  this.myGlobal.foo.bar.foo = foo;\n' +
      '}).call(this);';
    assert.strictEqual(expectedResult, result.code);

    test.done();
  },

  testNamedSourceExport: function(test) {
    var babelOptions = getBabelOptions(path.resolve('foo/bar.js'));
    var result = babel.transform('export {foo, bar} from "./foo"', babelOptions);

    var expectedResult = '(function () {\n' +
      '  this.myGlobal.foo = this.myGlobal.foo || {};\n' +
      '  this.myGlobal.foo.bar = {};\n' +
      '  this.myGlobal.foo.bar.foo = this.myGlobal.foo.foo.foo;\n' +
      '  this.myGlobal.foo.bar.bar = this.myGlobal.foo.foo.bar;\n' +
      '}).call(this);';
    assert.strictEqual(expectedResult, result.code);
    test.done();
  },

  testWildcardSourceExport: function(test) {
    var babelOptions = getBabelOptions(path.resolve('foo/bar.js'));
    var result = babel.transform('export * from "foo"', babelOptions);

    var expectedResult = '(function () {}).call(this);';
    assert.strictEqual(expectedResult, result.code);
    test.done();
  },

  testDefaultAndNamedExports: function(test) {
    var babelOptions = getBabelOptions(path.resolve('foo/bar.js'));
    assert.throws(function() {
      babel.transform('export default foo; export {bar};', babelOptions);
    });
    test.done();
  },

  testNamedAndDefaultExports: function(test) {
    var babelOptions = getBabelOptions(path.resolve('foo/bar.js'));
    assert.throws(function() {
      babel.transform('export {bar}; export default foo;', babelOptions);
    });
    test.done();
  },

  testExportWithMultipleExtensionsFilename: function(test) {
    var babelOptions = getBabelOptions(path.resolve('foo/bar.soy.js'));
    var result = babel.transform('export default foo', babelOptions);

    var expectedResult = '(function () {\n' +
      '  this.myGlobal.foo = this.myGlobal.foo || {};\n' +
      '  this.myGlobal.foo.bar = foo;\n' +
      '}).call(this);';
    assert.strictEqual(expectedResult, result.code);

    test.done();
  }
};

function getBabelOptions(filename, transformOnlyModules) {
  transformOnlyModules = !!transformOnlyModules;
  return {
    filename: filename,
    plugins: [
      [globalsPlugin, {
        globalName: 'myGlobal',
        transformOnlyModules: transformOnlyModules,
        externals: {
          'external-module': 'ExternalModule'
        }
      }]
    ]
  };
}
