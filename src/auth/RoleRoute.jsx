import { Navigate, Outlet } from "react-router-dom";
import { getUser } from "./auth";

export default function RoleRoute({ allow = [] }) {
  const user = getUser();
  if (!user) return <Navigate to="/login" replace />;
  if (!allow.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
