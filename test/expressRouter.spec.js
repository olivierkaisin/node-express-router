"use strict";


/* global describe, it */


var assert = require("chai").assert;

var expressRouter = require("../").expressRouter;
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

      expressRouter._buildRoute(app, definition);
    });
  });

  it("shouldn't accept a route without responder", function () {
    assert.throws(function () {
      var definition = {
        path: "/",
        method: 'GET'
      };

      expressRouter._buildRoute(app, definition);
    });
  });

  it("should accept a route without validator", function () {
    assert.doesNotThrow(function () {
      var definition = {
        path: "/",
        respond: function () {},
        method: 'GET'
      };

      expressRouter._buildRoute(app, definition);
    });
  });
});
