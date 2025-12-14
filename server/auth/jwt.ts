import { requireAuth } from "../auth";

// Minimal compatibility shim for overlay routes that expect `requireAtLeast` from ../auth/jwt
// This uses the existing Passport-based req.isAuthenticated() and req.user.role.

const ROLE_ORDER = ["staff", "manager", "admin"] as const;
type Role = (typeof ROLE_ORDER)[number] | string;

export function requireAtLeast(minRole: Role) {
  const minIndex = ROLE_ORDER.indexOf(minRole as any);

  return (req: any, res: any, next: any) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const role: string = req.user?.role || "staff";

    // If we don't recognise the role or minRole, fall back to simple auth check
    const currentIndex = ROLE_ORDER.indexOf(role as any);
    if (minIndex === -1 || currentIndex === -1) {
      return requireAuth(req, res, next);
    }

    // Allow if user role >= required role, or user is admin
    if (role === "admin" || currentIndex >= minIndex) {
      return next();
    }

    return res.status(403).json({ message: "Forbidden" });
  };
}
