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
      '  var foo = this.myGlobal.foo;\n' +
      '}).call(this);';
    assert.strictEqual(expectedResult, result.code);

    test.done();
  },

  testWildcardImport: function(test) {
    var babelOptions = getBabelOptions(path.resolve('foo/bar.js'));
    var result = babel.transform('import * as foo from "./foo"', babelOptions);

    var expectedResult = '(function () {\n' +
      '  var foo = this.myGlobalNamed.foo;\n' +
      '}).call(this);';
    assert.strictEqual(expectedResult, result.code);

    test.done();
  },

  testNamedImport: function(test) {
    var babelOptions = getBabelOptions(path.resolve('foo/bar.js'));
    var result = babel.transform('import {foo, bar} from "./foo"', babelOptions);

    var expectedResult = '(function () {\n' +
      '  var foo = this.myGlobalNamed.foo.foo;\n' +
      '  var bar = this.myGlobalNamed.foo.bar;\n' +
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
      '  var foo = this.myGlobal.foo;\n' +
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
      '  this.myGlobal.bar = foo;\n' +
      '}).call(this);';
    assert.strictEqual(expectedResult, result.code);

    test.done();
  },

  testDefaultAssignmentExport: function(test) {
    var babelOptions = getBabelOptions(path.resolve('foo/bar.js'));
    var result = babel.transform('export default "foo"', babelOptions);

    var expectedResult = '(function () {\n' +
      '  this.myGlobal.bar = "foo";\n' +
      '}).call(this);';
    assert.strictEqual(expectedResult, result.code);

    test.done();
  },

  testDefaultFunctionDeclarationExport: function(test) {
    var babelOptions = getBabelOptions(path.resolve('foo/bar.js'));
    var result = babel.transform('export default function foo() {}', babelOptions);

    var expectedResult = '(function () {\n' +
      '  function foo() {}\n' +
      '  this.myGlobal.bar = foo;\n' +
      '}).call(this);';
    assert.strictEqual(expectedResult, result.code);

    test.done();
  },

  testDefaultClassDeclarationExport: function(test) {
    var babelOptions = getBabelOptions(path.resolve('foo/bar.js'));
    var result = babel.transform('export default class Foo {}', babelOptions);

    var expectedResult = '(function () {\n' +
      '  class Foo {}\n' +
      '  this.myGlobal.bar = Foo;\n' +
      '}).call(this);';
    assert.strictEqual(expectedResult, result.code);

    test.done();
  },

  testNamedExport: function(test) {
    var babelOptions = getBabelOptions(path.resolve('foo/bar.js'));
    var result = babel.transform('export {foo, bar}', babelOptions);

    var expectedResult = '(function () {\n' +
      '  this.myGlobalNamed.bar = this.myGlobalNamed.bar || {};\n' +
      '  this.myGlobalNamed.bar.foo = foo;\n' +
      '  this.myGlobalNamed.bar.bar = bar;\n' +
      '}).call(this);';
    assert.strictEqual(expectedResult, result.code);

    test.done();
  },

  testNamedAssignmentExport: function(test) {
    var babelOptions = getBabelOptions(path.resolve('foo/bar.js'));
    var result = babel.transform('export var foo, bar = "foo"', babelOptions);

    var expectedResult = '(function () {\n' +
      '  var foo,\n      bar = "foo";\n' +
      '  this.myGlobalNamed.bar = this.myGlobalNamed.bar || {};\n' +
      '  this.myGlobalNamed.bar.foo = foo;\n' +
      '  this.myGlobalNamed.bar.bar = bar;\n' +
      '}).call(this);';
    assert.strictEqual(expectedResult, result.code);

    test.done();
  },

  testNamedFunctionDeclarationExport: function(test) {
    var babelOptions = getBabelOptions(path.resolve('foo/bar.js'));
    var result = babel.transform('export function foo() {}', babelOptions);

    var expectedResult = '(function () {\n' +
      '  function foo() {}\n' +
      '  this.myGlobalNamed.bar = this.myGlobalNamed.bar || {};\n' +
      '  this.myGlobalNamed.bar.foo = foo;\n' +
      '}).call(this);';
    assert.strictEqual(expectedResult, result.code);

    test.done();
  },

  testNamedSourceExport: function(test) {
    var babelOptions = getBabelOptions(path.resolve('foo/bar.js'));
    var result = babel.transform('export {foo, bar} from "./foo"', babelOptions);

    var expectedResult = '(function () {\n' +
      '  this.myGlobalNamed.bar = this.myGlobalNamed.bar || {};\n' +
      '  this.myGlobalNamed.bar.foo = this.myGlobalNamed.foo.foo;\n' +
      '  this.myGlobalNamed.bar.bar = this.myGlobalNamed.foo.bar;\n' +
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

  testMultipleExports: function(test) {
    var babelOptions = getBabelOptions(path.resolve('foo/bar.js'));
    var result = babel.transform('export default foo; export {bar};', babelOptions);

    var expectedResult = '(function () {\n' +
      '  this.myGlobal.bar = foo;\n' +
      '  this.myGlobalNamed.bar = this.myGlobalNamed.bar || {};\n' +
      '  this.myGlobalNamed.bar.bar = bar;\n' +
      '}).call(this);';
    assert.strictEqual(expectedResult, result.code);
    test.done();
  },

  testExportWithMultipleExtensionsFilename: function(test) {
    var babelOptions = getBabelOptions(path.resolve('foo/bar.soy.js'));
    var result = babel.transform('export default foo', babelOptions);

    var expectedResult = '(function () {\n' +
      '  this.myGlobal.bar = foo;\n' +
      '}).call(this);';
    assert.strictEqual(expectedResult, result.code);

    test.done();
  },

  testExportWithGlobalNameFunction: function(test) {
    var babelOptions = getBabelOptions(
      path.resolve('foo/bar.js'),
      function(state, filePath, name) {
        return 'this.Test.Exports.' + (name ? name : 'default');
      }
    );
    var result = babel.transform(
      'export default foo;\nexport {foo, bar};',
      babelOptions
    );

    var expectedResult = '(function () {\n' +
      '  this.Test.Exports = this.Test.Exports || {};\n' +
      '  this.Test.Exports.default = foo;\n' +
      '  this.Test.Exports.foo = foo;\n' +
      '  this.Test.Exports.bar = bar;\n' +
      '}).call(this);';
    assert.strictEqual(expectedResult, result.code);

    test.done();
  }
};

function getBabelOptions(filename, globalName) {
  return {
    filename: filename,
    plugins: [
      [globalsPlugin, {
        globalName: globalName || 'myGlobal'
      }]
    ]
  };
}
