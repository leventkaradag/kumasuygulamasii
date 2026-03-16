import type { Pattern } from "@/lib/domain/pattern";

export type PatternImageFields = Partial<{
  digitalPreviewUrl: string | null;
  finalPreviewUrl: string | null;
  image: string | null;
}>;

type PatternWithImageFields = Pattern & PatternImageFields;

const hasOwn = <T extends object, K extends PropertyKey>(
  value: T | null | undefined,
  key: K
): value is T & Record<K, unknown> => Boolean(value) && Object.prototype.hasOwnProperty.call(value, key);

const resolveDigitalSource = (pattern?: PatternWithImageFields | null) => {
  if (!pattern) return null;
  if (hasOwn(pattern, "digitalPreviewUrl")) {
    return pattern.digitalPreviewUrl ?? null;
  }
  return pattern.imageDigital ?? pattern.digitalImageUrl ?? pattern.image ?? null;
};

const resolveFinalSource = (pattern?: PatternWithImageFields | null) => {
  if (!pattern) return null;
  if (hasOwn(pattern, "finalPreviewUrl")) {
    return pattern.finalPreviewUrl ?? null;
  }
  return pattern.imageFinal ?? pattern.finalImageUrl ?? pattern.image ?? null;
};

export const normalizePatternImageSrc = (value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("data:image/")) return trimmed;
  if (trimmed.startsWith("blob:")) return trimmed;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("../")) {
    return trimmed;
  }
  return `data:image/jpeg;base64,${trimmed}`;
};

export const getPatternDigitalImageSrc = (pattern?: PatternWithImageFields | null) =>
  normalizePatternImageSrc(resolveDigitalSource(pattern));

export const getPatternFinalImageSrc = (pattern?: PatternWithImageFields | null) =>
  normalizePatternImageSrc(resolveFinalSource(pattern));

export const getPatternThumbnailSrc = (pattern?: PatternWithImageFields | null) =>
  normalizePatternImageSrc(
    resolveFinalSource(pattern) ??
      resolveDigitalSource(pattern) ??
      pattern?.image ??
      null
  );
