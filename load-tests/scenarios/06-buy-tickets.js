// Buy tickets flow load test
// Simulates authenticated users purchasing raffle tickets
// NOTE: This creates MP preferences but doesn't complete payment
import { check, sleep } from 'k6';
import { graphqlQuery, QUERIES, MUTATIONS } from '../helpers/graphql.js';
import { getTestUserToken } from '../helpers/auth.js';
import { randomTicketQuantity } from '../helpers/data.js';
import { authThresholds, randomThinkTime } from '../config/options.js';

export const options = {
  // Moderate VU count - this creates real preferences in MP
  vus: 20,
  duration: '2m',
  thresholds: authThresholds,
};

let buyerToken = null;
let activeRaffles = [];

export function setup() {
  // Login as buyer
  buyerToken = getTestUserToken('buyer');

  if (!buyerToken) {
    console.log('Warning: Could not login as buyer. Using test user from seed.');
  }

  // Get active raffles with available tickets
  const result = graphqlQuery('setup_raffles', QUERIES.rafflesPaginated, {
    filters: { estado: 'ACTIVA' },
    pagination: { page: 1, limit: 20 },
  });

  if (result?.data?.rafflesPaginated?.items) {
    activeRaffles = result.data.rafflesPaginated.items.filter(
      (r) => r.ticketsDisponibles > 0
    );
  }

  if (activeRaffles.length === 0) {
    console.log('Warning: No raffles with available tickets found.');
  }

  return { buyerToken, activeRaffles };
}

export default function (data) {
  const { buyerToken, activeRaffles } = data;

  if (!buyerToken) {
    console.log('No buyer token available');
    sleep(5);
    return;
  }

  if (activeRaffles.length === 0) {
    console.log('No active raffles with tickets');
    sleep(5);
    return;
  }

  // Pick a random raffle
  const raffle = activeRaffles[Math.floor(Math.random() * activeRaffles.length)];
  const quantity = Math.min(randomTicketQuantity(), raffle.ticketsDisponibles);

  if (quantity === 0) {
    sleep(2);
    return;
  }

  // User views raffle first
  const detailResult = graphqlQuery(
    'view_raffle',
    QUERIES.raffle,
    { id: raffle.id },
    buyerToken
  );

  check(detailResult, {
    'view: has raffle': (r) => r?.data?.raffle,
  });

  // Think time - user decides to buy
  sleep(randomThinkTime(5, 10) / 1000);

  // Attempt to buy tickets
  const buyResult = graphqlQuery(
    'buy_tickets',
    MUTATIONS.buyTickets,
    {
      raffleId: raffle.id,
      cantidad: quantity,
    },
    buyerToken
  );

  check(buyResult, {
    'buy: no server error': (r) => r !== null,
    'buy: has response': (r) => {
      // Either success (preferenceId) or expected business error
      return (
        r?.data?.buyTickets?.preferenceId ||
        r?.errors?.[0]?.message // Business logic error is still a valid response
      );
    },
  });

  // If successful, we got a preference
  if (buyResult?.data?.buyTickets?.preferenceId) {
    check(buyResult, {
      'buy: has preferenceId': (r) => r.data.buyTickets.preferenceId.length > 0,
      'buy: has initPoint': (r) => r.data.buyTickets.initPoint?.includes('mercadopago'),
      'buy: has tickets': (r) => Array.isArray(r.data.buyTickets.tickets),
    });

    // Log for debugging
    console.log(
      `Created preference for ${quantity} tickets on raffle ${raffle.id}`
    );
  }

  // Post-purchase check (user might check their tickets)
  if (Math.random() > 0.7) {
    sleep(randomThinkTime(2, 4) / 1000);

    const ticketsResult = graphqlQuery('my_tickets', QUERIES.myTickets, {}, buyerToken);

    check(ticketsResult, {
      'tickets: has data': (r) => r && r.data,
    });
  }

  // Longer pause between purchase attempts
  sleep(randomThinkTime(5, 10) / 1000);
}
