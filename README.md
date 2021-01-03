## Usage
```
// keystone.js
const { MicroGraphQLApp } = require("keystone-micro");

// Other keystone setting

module.exports = {
  keystone,
  apps: [
    new MicroGraphQLApp(),
  ],
};
``````

``````
// micro.js
const { keystone, apps } = require("./keystone");

let connectPromise;
const connectOnce = () => {
  let state = 'disconnected';
  if (!connectPromise) {
    connectPromise = keystone.connect();
  }

  return async () => {
    if (state === 'connected') {
      return Promise.resolve();
    }

    if (state === 'disconnected') {
      isConnected = 'connecting';
      await connectPromise;
      isConnected = 'connected';
      return connectPromise;
    }

    if (state === 'connecting') {
      return connectPromise
    }

  }
}

module.exports = async (req, res) => {
  const { middlewares } = await keystone.prepare({
    apps,
    distDir: './dist',
    dev: true,
    pinoOptions: {}
  });
  await (connectOnce());
  const app = apps[0].server;
  return app.createHandler({ path: '/admin/api' })(req, res);
};

```

## Run the app
```
micro micro.js
```
