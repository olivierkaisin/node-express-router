"use strict";


var fs        = require("fs");
var path      = require("path");
var validator = require("express-validator");
var util      = require("util");



var DEBUG = false;


var conditionals = {};

function createConditional(name, func)
{
  if (!name || typeof name !== "string") {
    throw new Error("name argument invalid or missing");
  }
  if (!func || typeof func !== "function") {
    throw new Error("func argument invalid or missing");
  }
  if (conditionals[name]) {
    throw new Error("Trying to create a duplicate conditional '" + name + "'");
  }

  conditionals[name] = func;
}



function validateRequiredParameters (route)
{
  if (!route.path) {
    throw new Error("Missing path");
  }
  if (!route.method) {
    throw new Error("Missing method");
  }
  if (!route.respond) {
    throw new Error("Missing reponder");
  }
}



var HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "HEAD",
  "OPTIONS"
];

function validateMethod (method)
{
  if (HTTP_METHODS.indexOf(method) === -1)
    throw new Error("Invalid method " + method);
}


function DEFAULT_VALIDATOR (req, res)
{
  // Do nothing
}


function checkConditionals (route, req, res)
{
  var conds = route.conditions || [];
  var shouldRunRoute = true;

  conds.forEach(function (conditionalName) {
    if (!shouldRunRoute) return;

    if (!conditionals[conditionalName]) {
      throw new Error("Unexisting conditional '" + conditionalName + "'");
    }

    shouldRunRoute = conditionals[conditionalName](req, res);
  });

  return shouldRunRoute;
}



function buildHandler (route)
{
  var validate = route.validate || DEFAULT_VALIDATOR;

  return function routeHandler(req, res, next) {

    var shouldRun = checkConditionals(route, req, res);
    if (!shouldRun) {
      return next();
    }

    validate(req, res);

    // If they are validation errors, respond with it
    var errors = req.validationErrors();
    if (errors) {
      return res.json(400, { errors: errors });
    }

    if (DEBUG) {
      console.log("Responding with route  =>  %s %s", route.method.toUpperCase(), route.path);
    }

    // Else execute the route code
    route.respond(req, res, next);
  };
}


function _buildRoute (app, definition)
{
  var methodName = definition.method.toLowerCase();

  app[methodName].apply(
    app, [definition.path, buildHandler(definition)]
  );

  if (DEBUG) {
    console.log("Created route  =>  %s %s", definition.method, definition.path);
  }
}


function _validateRoute (definition)
{
  validateRequiredParameters(definition);
  validateMethod(definition.method);
}


function createRoutes (app, directory)
{
  directory = directory || __dirname;

  app.use(validator());

  var files = fs.readdirSync(directory);
  var excludes = ["index.js"];
  var definitions = [];

  files.forEach(function (file) {

    if (excludes.indexOf(file) !== -1)
      return;

    if (file.length > 0 && file[0] === '_' && file[0] === '.')
      return;

    var realPath = path.resolve(directory, file);

    try {
      var definition = require(realPath);

      _validateRoute(definition);

      definitions.push(definition);
    }
    catch (error) {
      // Make error more tracable
      error.message = error.message + util.format(" in \"%s\"", realPath);
      throw error;
    }
  });

  definitions.sort(function (a, b) {
    return (b.conditions || []).length - (a.conditions || []).length;
  });

  definitions.forEach(function (definition) {
    _buildRoute(app, definition);
  });
}


function enableDebug ()
{
  DEBUG = true;
}



module.exports = {
  create             : createRoutes,
  createConditional  : createConditional,
  enableDebug        : enableDebug,
  _buildRoute        : _buildRoute,
  _checkConditionals : checkConditionals,
  _conditionals      : conditionals,
  _validateRoute     : _validateRoute
};
