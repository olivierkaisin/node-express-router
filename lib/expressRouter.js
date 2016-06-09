'use strict';


const fs        = require('fs');
const path      = require('path');
const util      = require('util');
const _         = require('lodash');
const bluebird  = require('bluebird');


let DEBUG = false;
let DEBUG_TARGET = console;


// 
// ---- Conditional routing ----
//

let conditionals = {};

function createConditional(name, func)
{
  if (!name || typeof name !== 'string') {
    throw new Error('name argument invalid or missing');
  }
  if (!func || typeof func !== 'function') {
    throw new Error('func argument invalid or missing');
  }
  if (conditionals[name]) {
    throw new Error('Trying to create a duplicate conditional \'' + name + '\'');
  }

  conditionals[name] = func;
}


function _checkConditionals(route, req, res)
{
  let conds = route.conditions || [];
  let shouldRunRoute = true;

  conds.forEach(function (conditionalName) {
    if (!shouldRunRoute) return;

    if (!conditionals[conditionalName]) {
      throw new Error('Unexisting conditional \'' + conditionalName + '\'');
    }

    shouldRunRoute = conditionals[conditionalName](req, res);
  });

  return shouldRunRoute;
}


// 
// ---- Preloading ----
//

let preloaders = {};

function createPreloader(name, func)
{
  if (!name || typeof name !== 'string') {
    throw new Error('name argument invalid or missing');
  }
  if (!func || typeof func !== 'function') {
    throw new Error('func argument invalid or missing');
  }
  if (preloaders[name]) {
    throw new Error('Trying to create a duplicate preloader \'' + name + '\'');
  }

  preloaders[name] = bluebird.promisify(func);
}


let PRELOAD_PARALLEL = true;


/*
 * 0    ->    Parallel
 * 1    ->    Sequential
 */
function setPreloadingMode(mode)
{
  if (!_.isNumber(mode)) {
    throw new Error('mode should be a number');
  }

  switch (mode) {
    case 0: 
      PRELOAD_PARALLEL = true;
      break;
    
    case 1:
      PRELOAD_PARALLEL = false;
      break;

    default: 
      throw new Error('invalid value for mode');
  }
}


function _getPreloaderFuncs(preloaderNames)
{
  return preloaderNames.map(function (preloaderName) {
    var func = preloaders[preloaderName];
    if (!func) {
      throw new Error('Unexisting preloader \'' + preloaderName + '\'');
    }
    return [preloaderName, func];
  });
}


function _preloadParallel(preloaderNames, req)
{
  return bluebird.all(_getPreloaderFuncs(preloaderNames).map(function (preloader) {
    return bluebird.all([preloader[0], preloader[1](req)]);
  })).reduce(function (preloadedData, result) {
    preloadedData[result[0]] = result[1];
    
    return preloadedData;
  }, {});
}


function _preloadSequentially(preloaderNames, req)
{
  var funcs = _getPreloaderFuncs(preloaderNames);

  var results = {};
  var chain   = bluebird.resolve(results);

  funcs.forEach(function (preloader) {
    var name = preloader[0];
    var func = preloader[1];

    if (!chain) {
      chain = func(req);
    } else {
      chain = chain.then(function () {
        return func(req);
      });
    }
    
    chain = chain.then(function (value) {
      results[name] = value;
      return results;
    });
  });

  return chain;
}


function _preloadRoute (route, req)
{
  var preloaderNames = route.preload || [];

  var preload;
  if (PRELOAD_PARALLEL) {
    preload = _preloadParallel(preloaderNames, req);
  } else {
    preload = _preloadSequentially(preloaderNames, req);
  }

  return preload.then(function (preloadedData) {
    req.preloadedData = preloadedData;

    return req;
  });
}



//
// ---- Core builders ----
//

function validateRequiredParameters (route)
{
  if (!route.path) {
    throw new Error('Missing path');
  }
  if (!route.method) {
    throw new Error('Missing method');
  }
  if (!route.respond) {
    throw new Error('Missing reponder');
  }
}



var HTTP_METHODS = [
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'HEAD',
  'OPTIONS',
  'PATCH',
  'ALL',
];

function validateMethod (method)
{
  if (HTTP_METHODS.indexOf(method) === -1)
    throw new Error('Invalid method ' + method);
}


function DEFAULT_VALIDATOR (req)
{
  // Do nothing
}


function buildHandler (route)
{
  var validate = route.validate || DEFAULT_VALIDATOR;

  return function routeHandler(req, res, next) {
    let shouldRun = _checkConditionals(route, req, res);
    
    if (!shouldRun) {
      return next();
    }

    if (DEBUG) {
      DEBUG_TARGET.info('Responding with route  =>  %s %s', route.method.toUpperCase(), route.path);
    }

    // Validate
    bluebird.try(function () {
      return validate(req);
    }).then(function requestValid() { 
        return _preloadRoute(route, req, res);  
    }, function requestInvalid(err) {
      // Add an error code and rethrow
      err.code = 'InvalidParameters';
      throw err;
    }).then(function () {
      return route.respond(req, res, next);
    }).catch(function (error) {
      if (DEBUG) {
        DEBUG_TARGET.error(error);
      }

      next(error);
    });    
  };
}


function _buildRoute (app, definition)
{
  var methods;
  if (Array.isArray(definition.method)) {
    methods = definition.method;
  } else {
    methods = [ definition.method ];
  }

  methods.forEach(function (method) {
    var methodName = method.toLowerCase();

    app[methodName].apply(
      app, [definition.path, buildHandler(definition)]
    );

    if (DEBUG) {
      DEBUG_TARGET.info('Created route  =>  %s %s', definition.method, definition.path);
    }
  });
}


function _validateRoute (definition)
{
  validateRequiredParameters(definition);
  validateMethod(definition.method);
}


function createRoutes (app, directory)
{
  let parentDir = path.dirname(module.parent.filename);
  directory = path.resolve(parentDir, directory);

  if (!directory) {
    throw new Error('Cannot resolve routes path');
  }

  let files = fs.readdirSync(directory);
  let excludes = ['index.js'];
  let definitions = [];

  files.forEach(function (file) {
    if (excludes.indexOf(file) !== -1)
      return;

    if (file.length > 0 && (file[0] === '_' || file[0] === '.'))
      return;

    let realPath = path.resolve(directory, file);

    try {
      if (fs.statSync(realPath).isDirectory()) {
        createRoutes(app, realPath);
      } else {
        let definition = require(realPath);

        _validateRoute(definition);

        definitions.push(definition);
      }
    }
    catch (error) {
      // Make error more tracable
      error.message = error.message + util.format(' in \'%s\', realPath');
      error.code = 'InvalidRoute';
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


function enableDebug (options)
{
  DEBUG = true;

  if (options.bunyanClient) {
    DEBUG_TARGET = options.bunyanClient;
  }
}



module.exports = {
  create             : createRoutes,
  createConditional  : createConditional,
  createPreloader    : createPreloader,
  setPreloadingMode  : setPreloadingMode,
  enableDebug        : enableDebug,
  _buildRoute        : _buildRoute,
  _checkConditionals : _checkConditionals,
  _conditionals      : conditionals,
  _validateRoute     : _validateRoute,
  _preloaders        : preloaders,
  _preloadRoute      : _preloadRoute
};
