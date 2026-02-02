"use client";

import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";

type FormErrors = {
  email?: string;
  password?: string;
};

const ORBS = [
  { size: 420, top: "-10%", left: "-6%", color: "rgba(91, 73, 255, 0.55)" },
  { size: 360, top: "10%", right: "-8%", color: "rgba(124, 92, 255, 0.35)" },
  { size: 260, bottom: "8%", left: "8%", color: "rgba(22, 163, 255, 0.35)" },
  { size: 300, bottom: "-12%", right: "18%", color: "rgba(77, 176, 255, 0.25)" },
];

export default function LoginClient() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const orbOuterRefs = useRef<HTMLDivElement[]>([]);
  const orbInnerRefs = useRef<HTMLDivElement[]>([]);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Respect prefers-reduced-motion to disable all animation work.
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = () => setReduceMotion(mediaQuery.matches);
    handleChange();

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;

    const ctx = gsap.context(() => {
      const outerOrbs = orbOuterRefs.current;
      const innerOrbs = orbInnerRefs.current;
      if (!outerOrbs.length || !innerOrbs.length) return;

      // Base drift + subtle scale/rotation for each orb.
      outerOrbs.forEach((orb, index) => {
        gsap.to(orb, {
          x: (index % 2 === 0 ? 1 : -1) * (24 + index * 6),
          y: (index % 2 === 0 ? -1 : 1) * (18 + index * 8),
          scale: 1.08,
          rotate: index % 2 === 0 ? 6 : -6,
          duration: 14 + index * 2,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        });
      });

      // Gentle opacity pulse (kept subtle for readability).
      gsap.to(innerOrbs, {
        opacity: 0.35,
        duration: 10,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
        stagger: 1.6,
      });

      // Pointer parallax (disabled on coarse pointers).
      const isCoarse = window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
      if (isCoarse) return;

      const pointer = { x: 0, y: 0 };
      const pos = { x: 0, y: 0 };
      const strengths = [0.3, 0.22, 0.16, 0.12];

      const handleMove = (event: MouseEvent) => {
        const x = event.clientX / window.innerWidth - 0.5;
        const y = event.clientY / window.innerHeight - 0.5;
        pointer.x = x * 80;
        pointer.y = y * 60;
      };

      const tick = () => {
        pos.x += (pointer.x - pos.x) * 0.06;
        pos.y += (pointer.y - pos.y) * 0.06;
        innerOrbs.forEach((orb, index) => {
          gsap.set(orb, {
            x: pos.x * strengths[index],
            y: pos.y * strengths[index],
          });
        });
      };

      window.addEventListener("mousemove", handleMove, { passive: true });
      gsap.ticker.add(tick);

      return () => {
        window.removeEventListener("mousemove", handleMove);
        gsap.ticker.remove(tick);
      };
    }, containerRef);

    return () => ctx.revert();
  }, [reduceMotion]);

  const validate = () => {
    const nextErrors: FormErrors = {};
    if (!email.trim()) nextErrors.email = "Email gerekli.";
    if (!password.trim()) nextErrors.password = "Sifre gerekli.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) return;

    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    setLoading(false);
  };

  return (
    <div
      ref={containerRef}
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0b0b14] px-6 py-16 text-white"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(84,84,255,0.35),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(0,173,255,0.2),transparent_45%),linear-gradient(135deg,#0b0b14_0%,#0c1024_45%,#130b24_100%)]" />
      <div className="noise-overlay pointer-events-none absolute inset-0 opacity-30" />

      <div className="absolute inset-0 -z-0">
        {ORBS.map((orb, index) => (
          <div
            key={index}
            ref={(el) => {
              if (el) orbOuterRefs.current[index] = el;
            }}
            className="absolute"
            style={{
              width: orb.size,
              height: orb.size,
              top: orb.top,
              left: orb.left,
              right: orb.right,
              bottom: orb.bottom,
            }}
          >
            <div
              ref={(el) => {
                if (el) orbInnerRefs.current[index] = el;
              }}
              className="h-full w-full rounded-full blur-3xl opacity-60 mix-blend-screen"
              style={{
                background: `radial-gradient(circle, ${orb.color} 0%, transparent 65%)`,
              }}
            />
          </div>
        ))}
      </div>

      <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-white/10 p-8 shadow-[0_30px_70px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
        <div className="mb-8 space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-lg font-semibold">
            KP
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Kumasci Panel</h1>
          <p className="text-sm text-white/70">Operasyonunuza guvenli giris</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/80">Email</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white outline-none transition focus:border-white/40"
              placeholder="email@firma.com"
            />
            {errors.email ? <p className="text-xs text-rose-200">{errors.email}</p> : null}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white/80">Sifre</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white outline-none transition focus:border-white/40"
              placeholder="••••••••"
            />
            {errors.password ? <p className="text-xs text-rose-200">{errors.password}</p> : null}
          </div>

          <div className="flex items-center justify-between text-sm text-white/70">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-transparent"
              />
              Beni hatirla
            </label>
            <button type="button" className="text-sm text-white/80 hover:text-white">
              Sifremi unuttum
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#0b0b14] shadow-[0_16px_30px_rgba(0,0,0,0.35)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Giris yapiliyor..." : "Giris Yap"}
          </button>
        </form>
      </div>
    </div>
  );
}
