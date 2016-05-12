Express.js Router [![Build Status](https://travis-ci.org/olivierkaisin/node-express-router.svg?branch=master)](https://travis-ci.org/olivierkaisin/node-express-router)
=================

Structured routing for **Express.JS**

## Example

Every route is implemented in a dedicated file


Example:

```
.
+-- routes
|   +-+ todos
|     +-- create.js
|     +-- update.js
|     +-- delete.js
+-- models
|   +-- todo.js
+-- server.js
```


### Example route definition `routes/todos/create.js`

```javascript
// File: ./routes/todos/create.js

'use strict';


const Todo = require("../../models/todo");



// The validate function is executed before the responder, allowing
// to easily check for the existence of parameters and their format.
// If some parameters are not valid, the function must throw an error
// 
// Note: Can be either synchronous or asynchronous.
function validate(req) {
  if (!req.body.text) {
    throw new Error('Missing parameter "text"')
  }
}


// The respond method is the actual implementation of our route
async function respond(req, res, next) {
  let { text } = req.body;
  let user = req.preloadedData.user;
  
  let todo = new Todo({
    text,
    user,
  });
  
  await todo.validate();
  await todo.save();
  
  res.status(201);
  res.json({ todo });
}



// The exports describe the route definition.
// .path, .method and .respond are required
// 
// Conditions are checked to define wether the route should be
// executed or not. You can define as many conditions as you want.
export default {
  path: '/todos',
  method: 'POST',

  validate
  respond,
  
  conditions : [ 'isLoggedIn' ],
  preload    : [ 'user' ],
};
```

### Express app `server.js`

```javascript
// File: ./app.js

'use strict';

import express from 'express'; 
import router from 'expressjs-router';

const app = express();


// By enabling debug mode, routes will be logged to stdout
router();

// Conditionals allow us to add handy condition checks all over our app
router.createConditional('isLoggedIn', async (req) => {
  return !!req.session.user;
});

// Preloaders allow us to easily preload resources before the requests are executed
router.createPreloader('user', async (req) => {
  return await User.findById(req.session.user._id);
});


// You can decide if either you want to preload resources sequentially or in parallel
//
// 0 -> parallel (default)
// 1 -> sequential
//
router.setPreloadingMode(1);


// Finally, create routes by padding the path where they're stored
router.create(app, "./path/to/routes");


app.listen(80);
```


### Remarks:

1. Routes prefixed by `_` or named `index.js` **won't be included** 
2. You can enable debug mode by calling `router.enableDebug();`
3. Route creation is recursive.


### Changelog:

#### 2.0.0-rc

* Removed `express-validator`
* Made validate function support asynchronous execution
* Added `ALL` to match any HTTP method


### License:

MIT
