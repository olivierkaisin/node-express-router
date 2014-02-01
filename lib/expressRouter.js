"use strict";


var fs        = require("fs");
var path      = require("path");
var validator = require("express-validator");
var util      = require("util");



var DEBUG = false;



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


function DEFAULT_VALIDATOR (req, res, next)
{
  // Do nothing
  return next(req, res, next);
}


function buildHandler (route)
{
  var validate = route.validate || DEFAULT_VALIDATOR;

  return function routeHandler(req, res, next) {
    validate(req, res, function (req, res, next) {

      // If they are validation errors, respond with it
      var errors = req.validationErrors();
      if (errors) {
        return res.json(400, { errors: errors });
      }

      // Else execute the route code
      route.respond(req, res, next);
    });
  };
}


function _buildRoute (app, definition)
{
  validateRequiredParameters(definition);
  validateMethod(definition.method);

  var methodName = definition.method.toLowerCase();

  app[methodName].apply(
    app, [definition.path, buildHandler(definition)]
  );

  if (DEBUG) {
    console.log("Created route  =>  %s %s", definition.method, definition.path);
  }
}


function createRoutes (app, directory)
{
  directory = directory || __dirname;

  app.use(validator());

  var files = fs.readdirSync(directory);
  var excludes = ["index.js"];

  files.forEach(function (file) {

    if (excludes.indexOf(file) !== -1)
      return;

    if (file.length > 0 && file[0] === '_')
      return;

    var definition = path.resolve(directory, file);

    try {
      _buildRoute(app, require(definition));
    }
    catch (error) {
      // Make error more tracable
      error.message = error.message + util.format(" in \"%s\"", definition);
      throw error;
    }
  });
}


function enableDebug ()
{
  DEBUG = true;
}



module.exports = {
  create      : createRoutes,
  enableDebug : enableDebug,
  _buildRoute : _buildRoute
};
