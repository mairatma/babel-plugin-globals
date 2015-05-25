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
   * @param {!Object} options
   * @param {!Array} nodes
   * @param {!Declaration} declaration
   */
  function assignDeclarationToGlobal(options, nodes, declaration) {
    var filenameNoExt = getFilenameNoExt(options.filename);
    var id = getGlobalIdentifier(options, filenameNoExt, declaration.id.name);
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
      filenameNoExtCache = filename.substr(0, filename.length - 3);
    }
    return filenameNoExtCache;
  }

  /**
   * Gets the global identifier for the given information.
   * @param {!Object} options Options object passed to babel.
   * @param {string} filePath The path of the module.
   * @param {?string} name The name of the variable being imported or exported from
   *   the module.
   * @param {boolean=} opt_isWildcard If the import or export declaration is using a wildcard.
   * @return {!Specifier}
   */
  function getGlobalIdentifier(options, filePath, name, opt_isWildcard) {
    var globalName = options._globalName;
    if (name || opt_isWildcard) {
      globalName += 'Named';
    }

    assertFilenameRequired(options.filename);
    filePath = path.resolve(path.dirname(options.filename), filePath);
    var splitPath = filePath.split(path.sep);
    var moduleName = splitPath[splitPath.length - 1];

    var id = 'this.' + globalName + '.' + moduleName + (name ? '.' + name : '');

    return t.identifier(id);
  }

  return new babel.Transformer('globals', {
    /**
     * Wraps the program body in a closure, protecting local variables.
     * @param {Program} node
     */
    Program: function(node) {
      createdGlobals = {};
      filenameNoExtCache = null;

      var contents = node.body;
      node.body = [t.expressionStatement(t.callExpression(
        t.memberExpression(
          t.functionExpression(null, [], t.blockStatement(contents)),
          t.identifier('call'),
          false
        ),
        [t.identifier('this')]
      ))];
      return node;
    },

    /**
     * Replaces import declarations with assignments from global to local variables.
     * @param {ImportDeclaration} node
     */
    ImportDeclaration: function(node) {
      var self = this;
      var replacements = [];
      node.specifiers.forEach(function(specifier) {
        var id = getGlobalIdentifier(
          self.state.opts,
          node.source.value,
          specifier.imported ? specifier.imported.name : null,
          t.isImportNamespaceSpecifier(specifier)
        );
        replacements.push(t.variableDeclaration('var', [
          t.variableDeclarator(specifier.local, id)
        ]));
      });
      return replacements;
    },

    /**
     * Removes export all declarations.
     */
    ExportAllDeclaration: function() {
      return [];
    },

    /**
     * Replaces default export declarations with assignments to global variables.
     * @param {ExportDefaultDeclaration} node
     */
    ExportDefaultDeclaration: function(node) {
      var replacements = [];
      var id = getGlobalIdentifier(this.state.opts, getFilenameNoExt(this.state.opts.filename));
      assignToGlobal(id, replacements, node.declaration);
      return replacements;
    },

    /**
     * Replaces named export declarations with assignments to global variables.
     * @param {ExportNamedDeclaration} node
     */
    ExportNamedDeclaration: function(node) {
      var replacements = [];
      if (node.declaration) {
        replacements.push(node.declaration);
        if (t.isVariableDeclaration(node.declaration)) {
          node.declaration.declarations.forEach(assignDeclarationToGlobal.bind(null, this.state.opts, replacements));
        } else {
          assignDeclarationToGlobal(this.state.opts, replacements, node.declaration);
        }
      } else {
        var self = this;
        node.specifiers.forEach(function(specifier) {
          var idToAssign = specifier.exported;
          if (node.source) {
            var specifierName = specifier.local ? specifier.local.name : null;
            idToAssign = getGlobalIdentifier(self.state.opts, node.source.value, specifierName);
          }

          var filenameNoExt = getFilenameNoExt(self.state.opts.filename);
          var id = getGlobalIdentifier(self.state.opts, filenameNoExt, specifier.exported.name);
          assignToGlobal(id, replacements, idToAssign);
        });
      }

      return replacements;
    }
  });
};
