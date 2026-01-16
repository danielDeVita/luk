// Raffle detail page load test
// Simulates users viewing raffle details and incrementing view count
import { check, sleep } from 'k6';
import { graphqlQuery, QUERIES, MUTATIONS } from '../helpers/graphql.js';
import { thresholds, randomThinkTime } from '../config/options.js';

export const options = {
  vus: 80,
  duration: '2m',
  thresholds: thresholds,
};

// Fetch raffle IDs during setup
let raffleIds = [];

export function setup() {
  // Get a list of active raffles to use in tests
  const result = graphqlQuery('setup_raffles', QUERIES.rafflesPaginated, {
    filters: { estado: 'ACTIVA' },
    pagination: { page: 1, limit: 50 },
  });

  if (result?.data?.rafflesPaginated?.items) {
    raffleIds = result.data.rafflesPaginated.items.map((r) => r.id);
  }

  if (raffleIds.length === 0) {
    console.log('Warning: No active raffles found. Tests may fail.');
  }

  return { raffleIds };
}

export default function (data) {
  const { raffleIds } = data;

  if (raffleIds.length === 0) {
    console.log('No raffles to test');
    sleep(1);
    return;
  }

  // Pick a random raffle
  const raffleId = raffleIds[Math.floor(Math.random() * raffleIds.length)];

  // Fetch raffle detail
  const detailResult = graphqlQuery('raffle_detail', QUERIES.raffle, {
    id: raffleId,
  });

  check(detailResult, {
    'detail: has data': (r) => r && r.data && r.data.raffle,
    'detail: has title': (r) => r?.data?.raffle?.titulo,
    'detail: has price': (r) => typeof r?.data?.raffle?.precioPorTicket === 'number',
    'detail: has product': (r) => r?.data?.raffle?.product,
    'detail: has seller': (r) => r?.data?.raffle?.seller,
  });

  // User reads the raffle details (5-15 seconds)
  sleep(randomThinkTime(5, 15) / 1000);

  // Increment view count (simulates sessionStorage check passing)
  // In real app, this only fires once per session, but we test it for load
  if (Math.random() > 0.5) {
    const viewResult = graphqlQuery('increment_views', MUTATIONS.incrementRaffleViews, {
      raffleId: raffleId,
    });

    check(viewResult, {
      'views: no errors': (r) => !r?.errors,
    });
  }

  // Some users also check seller profile
  if (Math.random() > 0.7 && detailResult?.data?.raffle?.seller?.id) {
    const sellerId = detailResult.data.raffle.seller.id;
    const sellerResult = graphqlQuery('seller_profile', QUERIES.sellerProfile, {
      id: sellerId,
    });

    check(sellerResult, {
      'seller: has data': (r) => r && r.data && r.data.sellerProfile,
      'seller: has name': (r) => r?.data?.sellerProfile?.nombre,
    });

    sleep(randomThinkTime(3, 8) / 1000);
  }
}
