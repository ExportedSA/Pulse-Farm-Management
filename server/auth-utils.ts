import type { User } from "@shared/schema";

export type SafeUser = Omit<User, "password">;

export function sanitizeUser(user: User): SafeUser {
  const { password, ...safeUser } = user;
  return safeUser;
}

export function sanitizeUsers(users: User[]): SafeUser[] {
  return users.map(sanitizeUser);
}
