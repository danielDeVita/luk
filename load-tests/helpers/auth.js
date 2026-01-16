// Authentication helpers for k6 load tests
import { graphqlRequest } from './graphql.js';
import { MUTATIONS } from './graphql.js';

// Cache for tokens to avoid repeated logins
const tokenCache = {};

/**
 * Login and get access token
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {string|null} Access token or null on failure
 */
export function login(email, password) {
  // Check cache first
  const cacheKey = `${email}:${password}`;
  if (tokenCache[cacheKey]) {
    return tokenCache[cacheKey];
  }

  const response = graphqlRequest(MUTATIONS.login, {
    input: {
      email,
      password,
    },
  });

  if (response.status !== 200) {
    console.log('Login failed:', response.status, response.body);
    return null;
  }

  try {
    const body = JSON.parse(response.body);
    if (body.errors) {
      console.log('Login errors:', JSON.stringify(body.errors));
      return null;
    }

    const token = body.data?.login?.access_token;
    if (token) {
      tokenCache[cacheKey] = token;
    }
    return token;
  } catch (e) {
    console.log('Login parse error:', e);
    return null;
  }
}

/**
 * Register a new user (for load testing)
 * @param {object} userData - User registration data
 * @returns {string|null} Access token or null on failure
 */
export function register(userData) {
  const response = graphqlRequest(MUTATIONS.register, {
    input: userData,
  });

  if (response.status !== 200) {
    console.log('Registration failed:', response.status);
    return null;
  }

  try {
    const body = JSON.parse(response.body);
    if (body.errors) {
      console.log('Registration errors:', JSON.stringify(body.errors));
      return null;
    }

    return body.data?.register?.access_token || null;
  } catch (e) {
    console.log('Registration parse error:', e);
    return null;
  }
}

// Test users from seed data (see CLAUDE.md)
export const TEST_USERS = {
  admin: {
    email: 'admin@rifas.com',
    password: 'Password123!',
  },
  seller: {
    email: 'vendedor@test.com',
    password: 'Password123!',
  },
  buyer: {
    email: 'comprador@test.com',
    password: 'Password123!',
  },
};

/**
 * Get a logged-in token for a test user
 * @param {'admin' | 'seller' | 'buyer'} userType - Type of test user
 * @returns {string|null} Access token
 */
export function getTestUserToken(userType) {
  const user = TEST_USERS[userType];
  if (!user) {
    console.log('Unknown user type:', userType);
    return null;
  }
  return login(user.email, user.password);
}
