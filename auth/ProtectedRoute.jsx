"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthed } from "./auth";

export default function ProtectedRoute({ children }) {
  const router = useRouter();
  const [authed, setAuthed] = useState(null);

  useEffect(() => {
    setAuthed(isAuthed());
  }, []);

  useEffect(() => {
    if (authed === false) {
      router.replace("/login");
    }
  }, [authed, router]);

  if (authed !== true) return null;
  return children ?? null;
}
