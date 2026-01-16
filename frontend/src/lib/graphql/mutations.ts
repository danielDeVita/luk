import { gql } from '@apollo/client';

export const REGISTER = gql`
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      token
      user {
        id
        email
        nombre
        apellido
        roles
      }
    }
  }
`;

export const LOGIN = gql`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      token
      user {
        id
        email
        nombre
        apellido
        roles
      }
    }
  }
`;

export const CREATE_RAFFLE = gql`
  mutation CreateRaffle($input: CreateRaffleInput!) {
    createRaffle(input: $input) {
      id
      titulo
      descripcion
      totalTickets
      precioPorTicket
      fechaLimiteSorteo
      estado
    }
  }
`;

export const BUY_TICKETS = gql`
  mutation BuyTickets($raffleId: String!, $cantidad: Int!) {
    buyTickets(raffleId: $raffleId, cantidad: $cantidad) {
      tickets {
        id
        numeroTicket
      }
      clientSecret
      totalAmount
      stripeFees
      cantidadComprada
      ticketsRestantesQuePuedeComprar
    }
  }
`;

export const MARK_AS_SHIPPED = gql`
  mutation MarkAsShipped($raffleId: String!, $trackingNumber: String) {
    markAsShipped(raffleId: $raffleId, trackingNumber: $trackingNumber) {
      id
      deliveryStatus
      trackingNumber
      shippedAt
    }
  }
`;

export const CONFIRM_DELIVERY = gql`
  mutation ConfirmDelivery($raffleId: String!) {
    confirmDelivery(raffleId: $raffleId) {
      id
      deliveryStatus
      confirmedAt
    }
  }
`;

export const OPEN_DISPUTE = gql`
  mutation OpenDispute($input: OpenDisputeInput!) {
    openDispute(input: $input) {
      id
      tipo
      titulo
      estado
      createdAt
    }
  }
`;

// ==================== Favorites ====================

export const ADD_FAVORITE = gql`
  mutation AddFavorite($raffleId: String!) {
    addFavorite(raffleId: $raffleId) {
      id
      raffleId
      createdAt
    }
  }
`;

export const REMOVE_FAVORITE = gql`
  mutation RemoveFavorite($raffleId: String!) {
    removeFavorite(raffleId: $raffleId)
  }
`;

// ==================== Shipping Addresses ====================

export const CREATE_SHIPPING_ADDRESS = gql`
  mutation CreateShippingAddress($input: CreateShippingAddressInput!) {
    createShippingAddress(input: $input) {
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

export const UPDATE_SHIPPING_ADDRESS = gql`
  mutation UpdateShippingAddress($id: String!, $input: UpdateShippingAddressInput!) {
    updateShippingAddress(id: $id, input: $input) {
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

export const DELETE_SHIPPING_ADDRESS = gql`
  mutation DeleteShippingAddress($id: String!) {
    deleteShippingAddress(id: $id)
  }
`;

export const SET_DEFAULT_SHIPPING_ADDRESS = gql`
  mutation SetDefaultShippingAddress($id: String!) {
    setDefaultShippingAddress(id: $id) {
      id
      isDefault
    }
  }
`;

// ==================== Messaging ====================

export const START_CONVERSATION = gql`
  mutation StartConversation($raffleId: String!) {
    startConversation(raffleId: $raffleId) {
      id
      raffleId
      isActive
    }
  }
`;

export const SEND_MESSAGE = gql`
  mutation SendMessage($conversationId: String!, $content: String!) {
    sendMessage(conversationId: $conversationId, content: $content) {
      id
      senderId
      content
      isRead
      createdAt
      senderName
    }
  }
`;

export const MARK_MESSAGE_READ = gql`
  mutation MarkMessageRead($messageId: String!) {
    markMessageRead(messageId: $messageId) {
      id
      isRead
    }
  }
`;

// ==================== Notifications ====================

export const MARK_NOTIFICATION_READ = gql`
  mutation MarkNotificationRead($id: String!) {
    markNotificationRead(id: $id) {
      id
      read
    }
  }
`;

export const MARK_ALL_NOTIFICATIONS_READ = gql`
  mutation MarkAllNotificationsRead {
    markAllNotificationsRead
  }
`;
