"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "./auth";

export default function RoleRoute({ allow = [], children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const nextUser = getUser();
    setUser(nextUser);
    setAllowed(!!nextUser && allow.includes(nextUser.role));
  }, [allow]);

  useEffect(() => {
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!allowed) {
      router.replace("/dashboard");
    }
  }, [allowed, router, user]);

  if (!user || !allowed) return null;
  return children ?? null;
}
