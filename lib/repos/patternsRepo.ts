"use client";

import { Pattern } from "@/lib/domain/pattern";
import { PATTERNS } from "@/mock/patterns";

export const patternsRepo = {
  list(): Pattern[] {
    return PATTERNS;
  },
  get(id: string): Pattern | undefined {
    return PATTERNS.find((pattern) => pattern.id === id);
  },
};
