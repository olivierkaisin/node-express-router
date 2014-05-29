Express.js Router [![Build Status](https://travis-ci.org/olivierkaisin/node-express-router.svg?branch=master)](https://travis-ci.org/olivierkaisin/node-express-router)
=================

Structured routing for **Express.JS**


## Example


Project structure: 

```
.
+-- routes
|   +-- getStatus.js
+-- models
|   +-- MyModel.js
+-- app.js
```

### Route definition `getStatus.js`

```javascript
// File: ./routes/getStatus.js

"use strict";


var MyModel = require("../models/MyModel");



// The synchronous validate function is executed before the responder, allowing
// to easily check for the existence of parameters and their format.
// 
// If a parameter doesn't follow the specification, the router will automatically
// respond with an HTTP 400 status and output validation errors in a JSON.
function validate(req, res) {
  req.assert("id")
    .notEmpty().isInt();
}



// The respond method is the actual implementation of our route
function respond(req, res, next) {
  var id = req.param("id");
  
  MyModel.findById(id, function (error, instance) {
    if (error) {
      return req.json(500, { error: error.message });
    }
    else {
      res.json({ 
        status: "OK",
        data: instance,
        stocks: req.preloadedData.stocks 
      });
    }
  });
}



// The exports describe the route definition.
// .path, .method and .respond are required
// 
// Conditions are checked to define wether the route should be
// executed or not. You can define as many conditions as you want.
module.exports = {
  path: "/status/:id",
  method: "GET",

  validate   : validate,
  respond    : respond,
  conditions : ["loginRequired"],
  preload    : ["stocks"]
};
```

### Express `app.js`

```javascript
// File: ./app.js


"use strict";


var express = require("express");
var expressRouter = require("expressjs-router");


var app = express();


// By enabling debug mode, routes will be logged to stdout
expressRouter.enableDebug();

// This conditional will allow us to require login on routes
expressRouter.createConditional("loginRequired", function (req, res) {
  return !!req.user;
});

// This preloader will make available resources on any route that asks for it
expressRouter.createPreloader("stocks", function (req, callback) {
  StockModel.findForUser(req.user._id).then(function (stocks) {
    callback(stocks);
  });
});


// You can decide if either you want to preload resources sequentially or in parallel
//
// 0 -> parallel (default)
// 1 -> sequential
//
expressRouter.setPreloadingMode(1);


// We finally create our routes by giving the path where they are stored
expressRouter.create(app, "./path/to/routes");


app.listen(80);
```


### Remarks:

1. Routes prefixed by `_` **won't be included** 
2. You can enable debug mode by calling `expressRouter.enableDebug();`


### License:

MIT
