const express = require('express');
const { ApolloServer } = require('apollo-server-micro');
const { graphqlUploadExpress } = require('graphql-upload');
const { GraphQLPlaygroundApp } = require('@keystonejs/app-graphql-playground');
const {
  formatError,
} = require('apollo-errors');
const validation = require('./validation');

class MicroGraphQLApp {
  constructor({
    apiPath = '/admin/api',
    graphiqlPath = '/admin/graphiql',
    schemaName = 'public',
    apollo = {},
  } = {}) {
    if (schemaName === 'internal') {
      throw new Error(
        "The schemaName 'internal' is a reserved name cannot be used in a GraphQLApp."
      );
    }

    this._apiPath = apiPath;
    this._graphiqlPath = graphiqlPath;
    this._apollo = apollo;
    this._schemaName = schemaName;
    this.server = null;
  }

  /**
   * @return Array<middlewares>
   */
  prepareMiddleware({ keystone, dev }) {
    const createApolloServer = ({ keystone, apolloConfig = {}, schemaName, dev }) => {
      // add the Admin GraphQL API
      const server = new ApolloServer({
        typeDefs: keystone.getTypeDefs({ schemaName }),
        resolvers: keystone.getResolvers({ schemaName }),
        context: ({ req }) => ({
          ...keystone.createContext({
            schemaName,
            authentication: { item: req.user, listKey: req.authedListKey },
            skipAccessControl: false,
          }),
          ...keystone._sessionManager.getContext(req),
          req,
        }),
        ...(process.env.engine_api_key || process.env.apollo_key
          ? {
            tracing: true,
          }
          : {
            engine: false,
            // only enable tracing in dev mode so we can get local debug info, but
            // don't bother returning that info on prod when the `engine` is
            // disabled.
            tracing: dev,
          }),
        formatError: formatError,
        ...apolloConfig,
        uploads: false, // user cannot override this as it would clash with the upload middleware
      });
      keystone._schemas[schemaName] = server.schema;

      this.server = server;

      return server;
    }

    const server = createApolloServer({
      keystone,
      apolloConfig: this._apollo,
      schemaName: this._schemaName,
      dev,
    });
    const apiPath = this._apiPath;
    const graphiqlPath = this._graphiqlPath;
    const app = express();

    if (dev && graphiqlPath) {
      // This is a convenience to make the out of the box experience slightly simpler.
      // We should reconsider support for this at some point in the future. -TL
      app.use(
        new GraphQLPlaygroundApp({ apiPath, graphiqlPath }).prepareMiddleware({ keystone, dev })
      );
    }

    const maxFileSize = (this._apollo && this._apollo.maxFileSize) || 200 * 1024 * 1024;
    const maxFiles = (this._apollo && this._apollo.maxFileSize) || 5;
    app.use(graphqlUploadExpress({ maxFileSize, maxFiles }));

    // { cors: false } - prevent ApolloServer from overriding Keystone's CORS configuration.
    // https://www.apollographql.com/docs/apollo-server/api/apollo-server.html#ApolloServer-applyMiddleware
    //
    // @NOTE: this is not the proper way to get middlewares from the micro app
    // app.use(server.getMiddleware({ path: apiPath, cors: false }));
    return app;
  }

  /**
   * @param Options { distDir }
   */
  build() {}
}

module.exports = {
  GraphQLApp,
  validation,
};
