// Test data generators for k6 load tests

/**
 * Generate a random email address
 * @param {string} prefix - Email prefix
 * @returns {string} Random email
 */
export function randomEmail(prefix = 'loadtest') {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `${prefix}_${timestamp}_${random}@test.com`;
}

/**
 * Generate random user registration data
 * @returns {object} User registration input
 */
export function randomUserData() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);

  return {
    email: `loadtest_${timestamp}_${random}@test.com`,
    password: 'Password123!',
    nombre: `Test${random}`,
    apellido: `User${timestamp}`,
    fechaNacimiento: '1990-01-15',
    acceptTerms: true,
  };
}

/**
 * Get random search terms for testing search functionality
 * @returns {string} Random search term
 */
export function randomSearchTerm() {
  const terms = [
    'iphone',
    'samsung',
    'playstation',
    'xbox',
    'macbook',
    'airpods',
    'watch',
    'tablet',
    'laptop',
    'auriculares',
    'celular',
    'consola',
    'televisor',
    'camara',
  ];
  return terms[Math.floor(Math.random() * terms.length)];
}

/**
 * Get random category for filtering
 * @returns {string} Random category name
 */
export function randomCategory() {
  const categories = [
    'Electrónica',
    'Hogar',
    'Deportes',
    'Moda',
    'Juguetes',
  ];
  return categories[Math.floor(Math.random() * categories.length)];
}

/**
 * Get random price range for filtering
 * @returns {object} { precioMin, precioMax }
 */
export function randomPriceRange() {
  const ranges = [
    { precioMin: 0, precioMax: 100 },
    { precioMin: 100, precioMax: 500 },
    { precioMin: 500, precioMax: 1000 },
    { precioMin: 1000, precioMax: 5000 },
    { precioMin: 5000, precioMax: 10000 },
  ];
  return ranges[Math.floor(Math.random() * ranges.length)];
}

/**
 * Get random sort option
 * @returns {string} Sort option
 */
export function randomSortBy() {
  const options = ['NEWEST', 'PRICE_ASC', 'PRICE_DESC', 'ENDING_SOON', 'POPULAR'];
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * Get random pagination values
 * @returns {object} { page, limit }
 */
export function randomPagination() {
  return {
    page: Math.floor(Math.random() * 5) + 1, // 1-5
    limit: [10, 20, 50][Math.floor(Math.random() * 3)],
  };
}

/**
 * Get random ticket quantity (1-10)
 * @returns {number} Ticket quantity
 */
export function randomTicketQuantity() {
  return Math.floor(Math.random() * 10) + 1;
}
