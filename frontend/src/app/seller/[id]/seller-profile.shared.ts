export const GET_SELLER_PROFILE_QUERY = `
  query GetSellerProfile($id: String!) {
    sellerProfile(id: $id) {
      id
      nombre
      apellido
      createdAt
      totalVentas
      nivelVendedor
      isVerified
      raffles {
        id
        titulo
        descripcion
        totalTickets
        ticketsVendidos
        precioPorTicket
        estado
        fechaLimiteSorteo
        lastPriceDropAt
        product {
          nombre
          imagenes
          condicion
        }
        seller {
          nombre
          apellido
        }
      }
    }
  }
`;

export interface SellerRaffle {
  id: string;
  titulo: string;
  descripcion: string;
  totalTickets: number;
  ticketsVendidos: number;
  precioPorTicket: number;
  estado: string;
  fechaLimiteSorteo: string;
  lastPriceDropAt?: string;
  product?: {
    nombre: string;
    imagenes: string[];
    condicion: string;
  } | null;
  seller?: {
    nombre: string;
    apellido: string;
  } | null;
}

export interface PublicSellerProfile {
  id: string;
  nombre: string;
  apellido: string;
  createdAt: string;
  totalVentas: number;
  nivelVendedor: string;
  isVerified: boolean;
  raffles: SellerRaffle[];
}

export interface SellerProfileQueryData {
  sellerProfile: PublicSellerProfile | null;
}
