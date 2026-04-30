import { gql } from '@apollo/client/core';

export const VERIFY_EMAIL_MUTATION = gql`
  mutation VerifyEmail($userId: String!, $code: String!, $promotionToken: String) {
    verifyEmail(userId: $userId, code: $code, promotionToken: $promotionToken) {
      token
      user {
        id
        email
        nombre
        apellido
        role
        emailVerified
      }
    }
  }
`;

export const RESEND_VERIFICATION_CODE_MUTATION = gql`
  mutation ResendVerificationCode($userId: String!) {
    resendVerificationCode(userId: $userId)
  }
`;

export interface VerifyEmailResult {
  verifyEmail: {
    token: string;
    user: {
      id: string;
      email: string;
      nombre: string;
      apellido: string;
      role: 'USER' | 'ADMIN' | 'BANNED';
      emailVerified: boolean;
    };
  };
}

export interface ResendVerificationCodeResult {
  resendVerificationCode: boolean;
}
