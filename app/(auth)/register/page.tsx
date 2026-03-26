'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Warehouse,
  Waves,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const featureItems = [
  {
    title: 'Desen ve varyant takibi',
    description: 'Tum urun agacini tek bakista izleyin ve operasyonu hizli tutun.',
    icon: Waves,
  },
  {
    title: 'Depo ve top yonetimi',
    description: 'Stok hareketlerini, metreyi ve top bazli kayitlari ayni ekranda gorun.',
    icon: Warehouse,
  },
  {
    title: 'Sevk ve rezerv surecleri',
    description: 'Operasyon akislarini tutarli ve izlenebilir sekilde yonetin.',
    icon: Sparkles,
  },
]

export default function RegisterPage() {
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [errorText, setErrorText] = useState('')
  const [loading, setLoading] = useState(false)
  const [passwordVisible, setPasswordVisible] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setErrorText('')
    setMessage('')

    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      setLoading(false)
      setErrorText(error.message)
      return
    }

    setLoading(false)
    setMessage('Kayit alindi. Hesabiniz admin onayi bekliyor.')
    setEmail('')
    setPassword('')
  }

  return (
    <main className="min-h-screen bg-[#f4efe8] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl overflow-hidden rounded-[32px] border border-[#e3d8cb] bg-[#f7f2eb] shadow-[0_28px_80px_rgba(65,49,36,0.10)] lg:grid-cols-[1.18fr_0.92fr]">
        <section className="relative overflow-hidden bg-[linear-gradient(155deg,#8d6d57_0%,#a48269_38%,#cbb8a7_100%)] px-6 py-8 text-[#fffaf5] sm:px-10 sm:py-10 lg:px-14 lg:py-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(72,50,35,0.18),transparent_32%)]" />
          <div className="absolute -left-20 top-14 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-8 right-0 h-64 w-64 rounded-full bg-[#5e4435]/25 blur-3xl" />

          <div className="relative flex h-full flex-col">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-[#f5ddc6]" />
              Kumasci Panel
            </div>

            <div className="mt-10 max-w-xl lg:mt-16">
              <p className="text-sm uppercase tracking-[0.22em] text-[#f1e6da]">
                Tekstil Operasyon Yonetimi
              </p>
              <h1 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl">
                Ekibiniz icin kontrollu ve guvenli hesap olusturun
              </h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-[#f4ede6] sm:text-lg">
                Yeni kullanicilar kayit olabilir, hesaplar ise admin onayindan sonra
                sisteme erisim kazanir.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:mt-auto lg:grid-cols-1">
              {featureItems.map((item) => {
                const Icon = item.icon

                return (
                  <div
                    key={item.title}
                    className="rounded-[24px] border border-white/15 bg-white/10 p-5 backdrop-blur-sm"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/14 text-[#fff4e8]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-base font-semibold">{item.title}</h2>
                        <p className="mt-1 text-sm leading-6 text-[#f0e8df]">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="relative mt-8 rounded-[24px] border border-white/15 bg-[#533c2f]/20 px-5 py-4 text-sm text-[#fff4e8] backdrop-blur sm:max-w-sm">
              Kayit olan kullanicilar varsayilan olarak beklemede acilir ve admin onayi ile aktif hale gelir.
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center bg-[linear-gradient(180deg,#f7f2eb_0%,#f4eee7_100%)] px-4 py-8 sm:px-6 lg:px-10">
          <div className="w-full max-w-md rounded-[28px] border border-[#e7ddd2] bg-white/95 p-6 shadow-[0_24px_60px_rgba(80,58,41,0.10)] backdrop-blur sm:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#ece1d6] bg-[#fbf8f4] px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-[#7a6350]">
              <ShieldCheck className="h-4 w-4" />
              Guvenli kayit
            </div>

            <h2 className="mt-5 text-3xl font-semibold text-[#2f2925]">Kayit Ol</h2>
            <p className="mt-2 text-sm leading-6 text-[#6f655d]">
              Yeni kullanici hesabi olusturun. Hesabiniz admin onayi bekleyecek.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-[#4e433b]"
                >
                  E-posta
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8d7b6c]" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full rounded-2xl border border-[#dfd3c7] bg-[#fcfaf7] py-3 pl-12 pr-4 text-[#2f2925] outline-none transition focus:border-[#8c6f5c] focus:bg-white focus:ring-4 focus:ring-[#c9b19c]/20"
                    placeholder="ornek@mail.com"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium text-[#4e433b]"
                >
                  Sifre
                </label>

                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8d7b6c]" />
                  <input
                    id="password"
                    type={passwordVisible ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-2xl border border-[#dfd3c7] bg-[#fcfaf7] py-3 pl-12 pr-12 text-[#2f2925] outline-none transition focus:border-[#8c6f5c] focus:bg-white focus:ring-4 focus:ring-[#c9b19c]/20"
                    placeholder="Sifreniz"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setPasswordVisible((current) => !current)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#7f6d61] transition hover:text-[#3d2e25]"
                    aria-label={passwordVisible ? 'Sifreyi gizle' : 'Sifreyi goster'}
                  >
                    {passwordVisible ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              {errorText ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {errorText}
                </div>
              ) : null}

              {message ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {message}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#3f3026] px-4 py-3 text-sm font-semibold text-[#fffaf5] transition duration-200 hover:bg-[#2f241d] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <UserPlus className="h-4 w-4" />
                {loading ? 'Kayit olusturuluyor...' : 'Kayit Ol'}
              </button>
            </form>

            <div className="mt-6 rounded-2xl border border-[#ede3d7] bg-[#faf7f2] px-4 py-3 text-sm text-[#73675f]">
              Kayit sonrasi hesabiniz beklemeye alinir. Superadmin onayindan sonra panele erisim saglanir.
            </div>

            <p className="mt-6 text-sm text-[#6f655d]">
              Zaten hesabiniz var mi?{' '}
              <Link href="/login" className="font-semibold text-[#3f3026] underline">
                Giris yap
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
