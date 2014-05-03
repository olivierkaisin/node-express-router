"use strict";


/* global describe, it */


var assert = require("chai").assert;

var expressRouter = require("../");
var express = require("express");


describe("expressRouter", function () {

  it("should have a create function", function () {
    assert.isFunction(expressRouter.create);
  });

  it("should throw", function () {
    assert.throws(function () {
      expressRouter.create(null);
      expressRouter.create(null, null);
    });
  });


  var app = express();

  it("shouldn't accept non-http methods", function () {
    assert.throws(function () {
      var definition = {
        path: "/",
        respond: function () {},
        method: 'NONHTTPMETHOD'
      };

      expressRouter._validateRoute(definition);
    });
  });

  it("shouldn't accept a route without responder", function () {
    assert.throws(function () {
      var definition = {
        path: "/",
        method: 'GET'
      };

      expressRouter._validateRoute(definition);
    });
  });

  it("should accept a route without validator", function () {
    assert.doesNotThrow(function () {
      var definition = {
        path: "/",
        respond: function () {},
        method: 'GET'
      };

      expressRouter._validateRoute(definition);
    });
  });

  it("should create conditionals as expected", function () {
    var conditional = function (req, res) {
      return !!req.user;
    };

    expressRouter.createConditional("requireSession", conditional);

    assert.isDefined(expressRouter._conditionals.requireSession);
    assert.strictEqual(conditional, expressRouter._conditionals.requireSession);

    var shouldntRun = expressRouter._checkConditionals({ conditions: ["requireSession"] }, {}, {});
    var shouldRun = expressRouter._checkConditionals({ conditions: ["requireSession"] }, { user: {} }, {});

    assert.strictEqual(shouldntRun, false);
    assert.strictEqual(shouldRun, true);
  });

  it("should preload sequentially", function (done) {
    expressRouter.setPreloadingMode(1);

    expressRouter.createPreloader("test0", function (req, callback) {
      setTimeout(function () {
        return callback(null, "data0");
      }, 1000);    
    });    
    expressRouter.createPreloader("test1", function (req, callback) {
      setTimeout(function () {
        return callback(null, "data1");
      }, 200);      
    });    

    var definition = {
      preload: ["test0", "test1"]
    };
    var req = {};

    expressRouter._preloadRoute(definition, req).then(function () {
      assert.deepEqual(req.preloadedData, {
        test0: "data0",
        test1: "data1"
      });

      done();
    }).done();
  });
});
