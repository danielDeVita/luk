// Authentication flow load test
// Tests login and registration with LOW VU count to respect throttling
import { check, sleep } from 'k6';
import { graphqlQuery, QUERIES, MUTATIONS } from '../helpers/graphql.js';
import { login, TEST_USERS } from '../helpers/auth.js';
import { randomUserData } from '../helpers/data.js';
import { authThresholds, randomThinkTime } from '../config/options.js';

export const options = {
  // LOW VU count - login is throttled per IP
  vus: 5,
  duration: '1m',
  thresholds: authThresholds,
};

export default function () {
  const scenario = Math.random();

  if (scenario < 0.6) {
    // 60% - Login with existing user
    testLogin();
  } else if (scenario < 0.9) {
    // 30% - Register new user
    testRegister();
  } else {
    // 10% - Login and fetch profile
    testLoginAndProfile();
  }

  // Longer think time to avoid rate limiting
  sleep(randomThinkTime(8, 12) / 1000);
}

function testLogin() {
  const user = TEST_USERS.buyer;
  const token = login(user.email, user.password);

  check(token, {
    'login: got token': (t) => t && t.length > 0,
  });
}

function testRegister() {
  const userData = randomUserData();

  const result = graphqlQuery('register', MUTATIONS.register, {
    input: userData,
  });

  // Registration may fail if email already exists (from previous runs)
  // We still check the response structure
  check(result, {
    'register: no server error': (r) => r !== null,
    'register: response received': (r) => {
      // Either success or expected validation error
      return (
        (r?.data?.register?.access_token) ||
        (r?.errors?.[0]?.message?.includes('email') || r?.errors?.[0]?.extensions?.code === 'BAD_USER_INPUT')
      );
    },
  });
}

function testLoginAndProfile() {
  const user = TEST_USERS.seller;
  const token = login(user.email, user.password);

  check(token, {
    'login_profile: got token': (t) => t && t.length > 0,
  });

  if (token) {
    // Fetch user profile
    const meResult = graphqlQuery('me', QUERIES.me, {}, token);

    check(meResult, {
      'me: has data': (r) => r && r.data && r.data.me,
      'me: has email': (r) => r?.data?.me?.email === user.email,
    });

    sleep(randomThinkTime(2, 4) / 1000);

    // Buyer stats (for buyer user)
    if (Math.random() > 0.5) {
      const statsResult = graphqlQuery('buyer_stats', QUERIES.buyerStats, {}, token);

      check(statsResult, {
        'stats: has data': (r) => r && r.data,
      });
    }
  }
}
