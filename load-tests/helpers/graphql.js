// GraphQL request helper for k6
import http from 'k6/http';
import { check } from 'k6';
import { GRAPHQL_URL } from '../config/options.js';

/**
 * Execute a GraphQL request
 * @param {string} query - GraphQL query or mutation
 * @param {object} variables - Query variables
 * @param {string|null} token - Optional JWT token for authenticated requests
 * @returns {object} k6 http response
 */
export function graphqlRequest(query, variables = {}, token = null) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const payload = JSON.stringify({
    query,
    variables,
  });

  const response = http.post(GRAPHQL_URL, payload, { headers });

  return response;
}

/**
 * Execute GraphQL and check for success
 * @param {string} name - Check name for reporting
 * @param {string} query - GraphQL query or mutation
 * @param {object} variables - Query variables
 * @param {string|null} token - Optional JWT token
 * @returns {object} Parsed response body
 */
export function graphqlQuery(name, query, variables = {}, token = null) {
  const response = graphqlRequest(query, variables, token);

  const success = check(response, {
    [`${name}: status is 200`]: (r) => r.status === 200,
    [`${name}: no errors`]: (r) => {
      try {
        const body = JSON.parse(r.body);
        return !body.errors || body.errors.length === 0;
      } catch {
        return false;
      }
    },
  });

  if (!success) {
    console.log(`GraphQL Error in ${name}:`, response.body);
  }

  try {
    return JSON.parse(response.body);
  } catch {
    return null;
  }
}

// Common GraphQL queries

export const QUERIES = {
  // Public queries
  rafflesPaginated: `
    query rafflesPaginated($filters: RaffleFiltersInput, $pagination: PaginationInput) {
      rafflesPaginated(filters: $filters, pagination: $pagination) {
        items {
          id
          titulo
          precioPorTicket
          totalTickets
          ticketsDisponibles
          estado
          fechaLimiteSorteo
        }
        meta {
          total
          page
          totalPages
          hasNext
        }
      }
    }
  `,

  raffle: `
    query raffle($id: String!) {
      raffle(id: $id) {
        id
        titulo
        descripcion
        precioPorTicket
        totalTickets
        ticketsDisponibles
        ticketsVendidos
        estado
        fechaLimiteSorteo
        product {
          nombre
          descripcionDetallada
          imagenes
        }
        seller {
          id
          nombre
          apellido
        }
      }
    }
  `,

  categories: `
    query categories {
      categories {
        id
        nombre
        descripcion
      }
    }
  `,

  sellerProfile: `
    query sellerProfile($id: String!) {
      sellerProfile(id: $id) {
        id
        nombre
        apellido
        totalSalesCount
        avgRating
      }
    }
  `,

  // Authenticated queries
  me: `
    query me {
      me {
        id
        email
        nombre
        apellido
        role
      }
    }
  `,

  myTickets: `
    query myTickets {
      myTickets {
        id
        numeroTicket
        estado
        raffle {
          id
          titulo
        }
      }
    }
  `,

  buyerStats: `
    query buyerStats {
      buyerStats {
        totalTicketsPurchased
        winRate
        totalSpent
      }
    }
  `,
};

export const MUTATIONS = {
  login: `
    mutation login($input: LoginInput!) {
      login(input: $input) {
        access_token
        refresh_token
        user {
          id
          email
          nombre
        }
      }
    }
  `,

  register: `
    mutation register($input: RegisterInput!) {
      register(input: $input) {
        access_token
        refresh_token
        user {
          id
          email
        }
      }
    }
  `,

  incrementRaffleViews: `
    mutation incrementRaffleViews($raffleId: String!) {
      incrementRaffleViews(raffleId: $raffleId)
    }
  `,

  buyTickets: `
    mutation buyTickets($raffleId: String!, $cantidad: Int!) {
      buyTickets(raffleId: $raffleId, cantidad: $cantidad) {
        preferenceId
        initPoint
        tickets {
          id
          numeroTicket
        }
      }
    }
  `,

  addFavorite: `
    mutation addFavorite($raffleId: String!) {
      addFavorite(raffleId: $raffleId) {
        id
        raffleId
      }
    }
  `,
};
