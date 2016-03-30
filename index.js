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
    var id = getGlobalIdentifier(state, filenameNoExt, declaration.id.name);
    assignToGlobal(id, nodes, declaration.id);
  }

  /**
   * Assigns the given expression to a global with the given id.
   * @param {string} id
   * @param {!Array} nodes
   * @param {!Expression} expression
   */
  function assignToGlobal(id, nodes, expression) {
    createGlobal(id.name, nodes);
    nodes.push(t.expressionStatement(t.assignmentExpression('=', id, expression)));
  }

  /**
   * Creates the global for the given name, if it hasn't been created yet.
   * @param {string} name Name of the global to create.
   * @param {!Array} nodes Array to add the global creation assignments to.
   */
  function createGlobal(name, nodes) {
    var keys = name.split('.');
    var currentGlobal = createdGlobals;
    var currentGlobalName = 'this.' + keys[1];
    var id;
    for (var i = 2; i < keys.length - 1; i++) {
      currentGlobalName += '.' + keys[i];
      id = t.identifier(currentGlobalName);

      if (!currentGlobal[keys[i]]) {
        currentGlobal[keys[i]] = {};
        nodes.push(t.expressionStatement(
          t.assignmentExpression('=', id, t.objectExpression([]))
        ));
      }
      currentGlobal = currentGlobal[keys[i]];
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
   * @return {!Specifier}
   */
  function getGlobalIdentifier(state, filePath, name, opt_isWildcard) {
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

      id = 'this.' + globalName + '.' + moduleName + (name ? '.' + name : '');
    }

    return t.identifier(id);
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
          var id = getGlobalIdentifier(
            state,
            removeExtensions(nodePath.node.source.value),
            specifier.imported ? specifier.imported.name : null,
            t.isImportNamespaceSpecifier(specifier)
          );
          replacements.push(t.variableDeclaration('var', [
            t.variableDeclarator(specifier.local, id)
          ]));
        });
        nodePath.replaceWithMultiple(replacements);
      },

      /**
       * Removes export all declarations.
       * @param {!NodePath} nodePath
       */
      ExportAllDeclaration: function(nodePath) {
        nodePath.replaceWithMultiple([]);
      },

      /**
       * Replaces default export declarations with assignments to global variables.
       * @param {!NodePath} nodePath
       * @param {!Object} state
       */
      ExportDefaultDeclaration: function(nodePath, state) {
        var replacements = [];
        var id = getGlobalIdentifier(state, getFilenameNoExt(state.file.opts.filename));
        assignToGlobal(id, replacements, nodePath.node.declaration);
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
            var idToAssign = specifier.exported;
            if (node.source) {
              var specifierName = specifier.local ? specifier.local.name : null;
              idToAssign = getGlobalIdentifier(state, node.source.value, specifierName);
            }

            var filenameNoExt = getFilenameNoExt(state.file.opts.filename);
            var id = getGlobalIdentifier(state, filenameNoExt, specifier.exported.name);
            assignToGlobal(id, replacements, idToAssign);
          });
        }

        nodePath.replaceWithMultiple(replacements);
      }
    }
  };
};
