const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Marzban Dashboard API',
      version: '1.0.0',
      description: 'API documentation for Marzban Dashboard - A management interface for Marzban VPN panel',
      contact: {
        name: 'Marzban Dashboard',
      },
    },
    tags: [
      {
        name: 'Authentication',
        description: 'Authentication and user management endpoints',
      },
      {
        name: 'Marzban',
        description: 'Marzban server configuration endpoints',
      },
      {
        name: 'Users',
        description: 'VPN user management endpoints',
      },
    ],
    components: {
      securitySchemes: {
        OAuth2PasswordBearer: {
          type: 'oauth2',
          flows: {
            password: {
              tokenUrl: '/api/auth/token',
              scopes: {},
            },
          },
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'User ID',
            },
            username: {
              type: 'string',
              description: 'Username',
            },
            email: {
              type: 'string',
              description: 'Email address',
            },
            role: {
              type: 'string',
              enum: ['admin', 'user'],
              description: 'User role',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation date',
            },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: {
              type: 'string',
              description: 'Username or email',
            },
            password: {
              type: 'string',
              description: 'Password',
            },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            token: {
              type: 'string',
              description: 'JWT authentication token',
            },
            user: {
              $ref: '#/components/schemas/User',
            },
          },
        },
        MarzbanConfig: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Configuration ID',
            },
            name: {
              type: 'string',
              description: 'Configuration name',
            },
            endpointUrl: {
              type: 'string',
              description: 'Marzban endpoint URL',
            },
            username: {
              type: 'string',
              description: 'Marzban admin username',
            },
            userId: {
              type: 'string',
              description: 'Owner user ID',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation date',
            },
          },
        },
        MarzbanUser: {
          type: 'object',
          properties: {
            username: {
              type: 'string',
              description: 'VPN username',
            },
            status: {
              type: 'string',
              enum: ['active', 'disabled', 'limited', 'expired'],
              description: 'User status',
            },
            used_traffic: {
              type: 'number',
              description: 'Used traffic in bytes',
            },
            data_limit: {
              type: 'number',
              description: 'Data limit in bytes',
            },
            expire: {
              type: 'number',
              description: 'Expiration timestamp',
            },
            proxies: {
              type: 'object',
              description: 'Proxy configurations',
            },
          },
        },
        CreateMarzbanUserRequest: {
          type: 'object',
          required: ['username', 'proxies'],
          properties: {
            username: {
              type: 'string',
              description: 'VPN username',
            },
            proxies: {
              type: 'object',
              description: 'Proxy configurations',
            },
            data_limit: {
              type: 'number',
              description: 'Data limit in bytes',
            },
            expire: {
              type: 'number',
              description: 'Expiration timestamp',
            },
            status: {
              type: 'string',
              enum: ['active', 'disabled'],
              description: 'User status',
            },
          },
        },
      },
    },
    security: [
      {
        OAuth2PasswordBearer: [],
      },
    ],
  },
  apis: ['./src/routes/*.js'], // Path to the API routes
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
