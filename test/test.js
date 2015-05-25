'use strict';

var assert = require('assert');

module.exports = {
  testMissing: function(test) {
    assert.fail('Missing test');
    test.done();
  }
};
