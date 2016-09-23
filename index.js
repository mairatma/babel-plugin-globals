'use strict';

var path = require('path');

module.exports = function(babel) {
  var t = babel.types;
  var createdGlobals = {};
  var filenameNoExtCache;

  /**
   * Throws error if filename is unknown.
   * @param {string} filename
   */
  function assertFilenameRequired(filename) {
    if (filename === 'unknown') {
      throw new Error('The babel  requires that filename be given');
    }
  }

  /**
   * Assigns the given declaration to the appropriate global variable.
   * @param {!Object} state
   * @param {!Array} nodes
   * @param {!Declaration} declaration
   */
  function assignDeclarationToGlobal(state, nodes, declaration) {
    var filenameNoExt = getFilenameNoExt(state.file.opts.filename);
    var expr = getGlobalExpression(state, filenameNoExt, declaration.id.name);
    assignToGlobal(expr, nodes, declaration.id);
  }

  /**
   * Assigns the given expression to a global with the given id.
   * @param {!MemberExpression} expr
   * @param {!Array} nodes
   * @param {!Expression} expression
   */
  function assignToGlobal(expr, nodes, expression) {
    createGlobal(expr, nodes);
    if (!t.isExpression(expression)) {
      expression = t.toExpression(expression);
    }
    nodes.push(t.expressionStatement(t.assignmentExpression('=', expr, expression)));
  }

  /**
   * Creates the global for the given name, if it hasn't been created yet.
   * @param {!MemberExpression} expr
   * @param {!Array} nodes Array to add the global creation assignments to.
   */
  function createGlobal(expr, nodes, opt_namedPartial) {
    var exprs = [];
    while (t.isMemberExpression(expr)) {
      exprs.push(expr);
      expr = expr.object;
    }

    var currGlobalName = '';
    for (var i = exprs.length - 2; opt_namedPartial ? i >= 0 : i > 0; i--) {
      currGlobalName += '.' + exprs[i].property.value;
      if (!createdGlobals[currGlobalName]) {
        createdGlobals[currGlobalName] = true;
        nodes.push(t.expressionStatement(
          t.assignmentExpression('=', exprs[i], t.logicalExpression(
            '||',
            exprs[i],
            t.objectExpression([])
          ))
        ));
      }
    }
  }

  /**
   * Gets the name of the current file without extension.
   * @param {string} filename
   * @return {string}
   */
  function getFilenameNoExt(filename) {
    if (!filenameNoExtCache) {
      assertFilenameRequired(filename);
      filenameNoExtCache = removeExtensions(filename);
    }
    return filenameNoExtCache;
  }

  /**
   * Gets the global identifier for the given information.
   * @param {!Object} state This plugin's current state object.
   * @param {string} filePath The path of the module.
   * @param {?string} name The name of the variable being imported or exported from
   *   the module.
   * @param {boolean=} opt_isWildcard If the import or export declaration is using a wildcard.
   * @return {!MemberExpression}
   */
  function getGlobalExpression(state, filePath, name, opt_isWildcard) {
    assertFilenameRequired(state.file.opts.filename);
    var globalName = state.opts.globalName;
    var id;
    if (typeof globalName === 'function') {
        id = globalName(state, filePath, name, opt_isWildcard);
    }
    else {
      if (name || opt_isWildcard) {
        globalName += 'Named';
      }

      filePath = path.resolve(path.dirname(state.file.opts.filename), filePath);
      var splitPath = filePath.split(path.sep);
      var moduleName = splitPath[splitPath.length - 1];

      id = 'this.' + globalName + '.' + moduleName + (name && name !== true ? '.' + name : '');
    }

    var parts = id.split('.');
    var expr = t.identifier(parts[0]);
    for (var i = 1; i < parts.length; i++) {
      expr = t.memberExpression(expr, t.stringLiteral(parts[i]), true);
    }
    return expr;
  }

  /**
   * Removes all extensions from the given filename.
   * @param {string} filename
   * @return {string}
   */
  function removeExtensions(filename) {
    var extension = path.extname(filename);
    while (extension !== '') {
      filename = path.basename(filename, extension);
      extension = path.extname(filename);
    }
    return filename;
  }

  return {
    visitor: {
      /**
       * Wraps the program body in a closure, protecting local variables.
       * @param {!NodePath} nodePath
       */
      Program: function(nodePath) {
        createdGlobals = {};
        filenameNoExtCache = null;

        var node = nodePath.node;
        var contents = node.body;
        node.body = [t.expressionStatement(t.callExpression(
          t.memberExpression(
            t.functionExpression(null, [], t.blockStatement(contents)),
            t.identifier('call'),
            false
          ),
          [t.identifier('this')]
        ))];
      },

      /**
       * Replaces import declarations with assignments from global to local variables.
       * @param {!NodePath} nodePath
       * @param {!Object} state
       */
      ImportDeclaration: function(nodePath, state) {
        var replacements = [];
        nodePath.node.specifiers.forEach(function(specifier) {
          var expr = getGlobalExpression(
            state,
            removeExtensions(nodePath.node.source.value),
            specifier.imported ? specifier.imported.name : null,
            t.isImportNamespaceSpecifier(specifier)
          );
          replacements.push(t.variableDeclaration('var', [
            t.variableDeclarator(specifier.local, expr)
          ]));
        });
        nodePath.replaceWithMultiple(replacements);
      },

      /**
       * Replaces export all declarations with code that copies all named
       * exports from the imported file into the named exports of the current
       * file. The final generated code will be something like this:
       *     Object.keys(importedGlobal).forEach(function (key) {
       *         currGlobal[key] = importedGlobal[key];
       *     });
       * @param {!NodePath} nodePath
       */
      ExportAllDeclaration: function(nodePath, state) {
        var replacements = [];
        var expr = getGlobalExpression(state, getFilenameNoExt(state.file.opts.filename), true);
        createGlobal(expr, replacements, true);
        var originalGlobal = getGlobalExpression(state, nodePath.node.source.value, true);
        replacements.push(t.expressionStatement(t.callExpression(
          t.memberExpression(
            t.callExpression(
              t.memberExpression(t.identifier('Object'), t.identifier('keys')),
              [originalGlobal]
            ),
            t.identifier('forEach')
          ),
          [t.functionExpression(
            null,
            [t.identifier('key')],
            t.blockStatement(
              [t.expressionStatement(t.assignmentExpression(
                '=',
                t.memberExpression(expr, t.identifier('key'), true),
                t.memberExpression(originalGlobal, t.identifier('key'), true)
              ))]
            )
          )]
        )));
        nodePath.replaceWithMultiple(replacements);
      },

      /**
       * Replaces default export declarations with assignments to global variables.
       * @param {!NodePath} nodePath
       * @param {!Object} state
       */
      ExportDefaultDeclaration: function(nodePath, state) {
        var replacements = [];
        var expr = getGlobalExpression(state, getFilenameNoExt(state.file.opts.filename));
        var expression = nodePath.node.declaration;
        if (expression.id &&
          (t.isFunctionDeclaration(expression) || t.isClassDeclaration(expression))) {
          replacements.push(expression);
          expression = expression.id;
        }
        assignToGlobal(expr, replacements, expression);
        nodePath.replaceWithMultiple(replacements);
      },

      /**
       * Replaces named export declarations with assignments to global variables.
       * @param {!NodePath} nodePath
       * @param {!Object} state
       */
      ExportNamedDeclaration: function(nodePath, state) {
        var replacements = [];
        var node = nodePath.node;
        if (node.declaration) {
          replacements.push(node.declaration);
          if (t.isVariableDeclaration(node.declaration)) {
            node.declaration.declarations.forEach(assignDeclarationToGlobal.bind(null, state, replacements));
          } else {
            assignDeclarationToGlobal(state, replacements, node.declaration);
          }
        } else {
          node.specifiers.forEach(function(specifier) {
            var exprToAssign = specifier.local;
            if (node.source) {
              var specifierName = specifier.local ? specifier.local.name : null;
              exprToAssign = getGlobalExpression(state, node.source.value, specifierName);
            }

            var filenameNoExt = getFilenameNoExt(state.file.opts.filename);
            var expr = getGlobalExpression(state, filenameNoExt, specifier.exported.name);
            assignToGlobal(expr, replacements, exprToAssign);
          });
        }

        nodePath.replaceWithMultiple(replacements);
      }
    }
  };
};
