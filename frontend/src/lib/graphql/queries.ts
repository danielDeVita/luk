import { gql } from '@apollo/client';

export const GET_RAFFLES = gql`
  query GetRaffles($filters: RaffleFiltersInput, $pagination: PaginationInput) {
    raffles(filters: $filters, pagination: $pagination) {
      id
      titulo
      descripcion
      totalTickets
      precioPorTicket
      fechaLimiteSorteo
      estado
      ticketsVendidos
      ticketsDisponibles
      seller {
        id
        nombre
        apellido
      }
      product {
        id
        nombre
        imagenes
        condicion
      }
    }
  }
`;

export const GET_RAFFLE = gql`
  query GetRaffle($id: String!) {
    raffle(id: $id) {
      id
      titulo
      descripcion
      totalTickets
      precioPorTicket
      fechaLimiteSorteo
      estado
      ticketsVendidos
      ticketsDisponibles
      maxTicketsPorUsuario
      deliveryStatus
      trackingNumber
      winningTicketNumber
      seller {
        id
        nombre
        apellido
        email
      }
      winner {
        id
        nombre
        apellido
      }
      product {
        id
        nombre
        descripcionDetallada
        categoria
        condicion
        imagenes
      }
    }
  }
`;

export const GET_MY_TICKETS = gql`
  query GetMyTickets {
    myTickets {
      id
      numeroTicket
      precioPagado
      estado
      fechaCompra
      raffle {
        id
        titulo
        estado
        product {
          nombre
          imagenes
        }
      }
    }
  }
`;

export const GET_MY_RAFFLES = gql`
  query GetMyRaffles {
    myRafflesAsSeller {
      id
      titulo
      totalTickets
      precioPorTicket
      estado
      winningTicketNumber
      ticketsVendidos
      fechaLimiteSorteo
      product {
        nombre
        imagenes
      }
    }
  }
`;

export const ME = gql`
  query Me {
    me {
      id
      email
      nombre
      apellido
      roles
    }
  }
`;

// ==================== Wallet ====================

export const MY_WALLET = gql`
  query MyWallet {
    myWallet {
      id
      creditBalance
      sellerPayableBalance
    }
  }
`;

export const WALLET_LEDGER = gql`
  query WalletLedger($take: Int) {
    walletLedger(take: $take) {
      id
      type
      amount
      creditBalanceAfter
      sellerPayableBalanceAfter
      createdAt
    }
  }
`;

// ==================== Categories ====================

export const GET_CATEGORIES = gql`
  query GetCategories {
    categories {
      id
      nombre
      descripcion
      icono
      orden
    }
  }
`;

// ==================== Favorites ====================

export const GET_MY_FAVORITES = gql`
  query GetMyFavorites {
    myFavorites {
      id
      raffleId
      createdAt
      raffle {
        id
        titulo
        precioPorTicket
        estado
        ticketsVendidos
        totalTickets
        fechaLimiteSorteo
        lastPriceDropAt
        product {
          nombre
          imagenes
        }
        seller {
          id
          nombre
          apellido
        }
      }
    }
  }
`;

export const IS_FAVORITE = gql`
  query IsFavorite($raffleId: String!) {
    isFavorite(raffleId: $raffleId)
  }
`;

// ==================== Shipping Addresses ====================

export const GET_MY_SHIPPING_ADDRESSES = gql`
  query GetMyShippingAddresses {
    myShippingAddresses {
      id
      label
      recipientName
      street
      number
      apartment
      city
      province
      postalCode
      country
      phone
      instructions
      isDefault
    }
  }
`;

export const GET_DEFAULT_SHIPPING_ADDRESS = gql`
  query GetDefaultShippingAddress {
    myDefaultShippingAddress {
      id
      label
      recipientName
      street
      number
      apartment
      city
      province
      postalCode
      country
      phone
      instructions
      isDefault
    }
  }
`;

// ==================== Messaging ====================

export const GET_MY_CONVERSATIONS = gql`
  query GetMyConversations {
    myConversations {
      id
      raffleId
      isActive
      updatedAt
      raffleTitulo
      otherUserName
      lastMessage
      unreadCount
    }
  }
`;

export const GET_CONVERSATION = gql`
  query GetConversation($id: String!) {
    conversation(id: $id) {
      id
      raffleId
      isActive
      raffleTitulo
      otherUserName
      messages {
        id
        senderId
        content
        isRead
        createdAt
        senderName
      }
    }
  }
`;

// ==================== Payouts (Seller) ====================

export const GET_MY_PAYOUTS = gql`
  query GetMyPayouts {
    myPayouts {
      id
      raffleId
      grossAmount
      platformFee
      processingFee
      netAmount
      status
      scheduledFor
      processedAt
      createdAt
      raffleTitulo
    }
  }
`;

export const GET_RAFFLE_PAYOUT = gql`
  query GetRafflePayout($raffleId: String!) {
    rafflePayout(raffleId: $raffleId) {
      id
      grossAmount
      platformFee
      processingFee
      netAmount
      status
      scheduledFor
      processedAt
    }
  }
`;

// ==================== Notifications ====================

export const GET_NOTIFICATIONS = gql`
  query GetNotifications {
    myNotifications {
      id
      type
      title
      message
      read
      createdAt
    }
  }
`;
