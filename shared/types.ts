export interface Preferences {
  defaultStore: string;
  currency: string;
}

export interface User {
  id: string;
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  preferences: Preferences;
  createdAt: number;
  updatedAt: number;
}

export type JwtClaims = {
  sub: string;
  email: string;
  username: string;
  iat?: number;
  exp?: number;
};
