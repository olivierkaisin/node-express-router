Express Router
==============

Structured routing for **Express.JS**


### Example

```javascript
"use strict";


var MyModel = require("./models/MyModel");



function validate(req, res, next) {
  req.assert("id")
    .notEmpty().isInt();

  next(req, res, next);
}


function respond(req, res, next) {
  var id = req.param("id");
  
  MyModel.findById(id, function (error, instance) {
    if (error) {
      return req.json(500, { error: error.message });
    }
    else {
      res.json({ status: "OK", data: instance });
    }
  });
}



module.exports = {
  path: "/status/:id",
  method: "GET",

  validate : validate,
  respond  : respond
};
```
