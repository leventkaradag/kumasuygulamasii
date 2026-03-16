'use client'

import Link from 'next/link'
import { ArrowLeft, Mail, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

function getResetRedirectUrl() {
  if (typeof window === 'undefined') {
    return '/reset-password'
  }

  return new URL('/reset-password', window.location.origin).toString()
}

export default function ForgotPasswordPage() {
  const [supabase] = useState(() => createClient())

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorText, setErrorText] = useState('')
  const [successText, setSuccessText] = useState('')

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setErrorText('')
    setSuccessText('')

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getResetRedirectUrl(),
    })

    setLoading(false)

    if (error) {
      setErrorText(error.message)
      return
    }

    setSuccessText(
      'Eger bu e-posta adresi sistemde kayitliysa, sifre yenileme baglantisi gonderildi.'
    )
  }

  return (
    <main className="min-h-screen bg-[#f4efe8] p-4 sm:p-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-3xl items-center justify-center">
        <div className="w-full max-w-xl rounded-[32px] border border-[#e4d9cd] bg-white/95 p-6 shadow-[0_24px_60px_rgba(80,58,41,0.10)] sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#ece1d6] bg-[#fbf8f4] px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-[#7a6350]">
            <ShieldCheck className="h-4 w-4" />
            Sifre sifirlama
          </div>

          <h1 className="mt-5 text-3xl font-semibold text-[#2f2925]">Sifrenizi Yenileyin</h1>
          <p className="mt-3 text-sm leading-6 text-[#6f655d]">
            Kayitli e-posta adresinizi girin, size sifre sifirlama baglantisi gonderelim.
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

            {errorText ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorText}
              </div>
            ) : null}

            {successText ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {successText}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-[#3f3026] px-4 py-3 text-sm font-semibold text-[#fffaf5] transition duration-200 hover:bg-[#2f241d] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Baglanti gonderiliyor...' : 'Sifirlama Baglantisi Gonder'}
            </button>
          </form>

          <p className="mt-6 text-sm text-[#6f655d]">
            Guvenlik nedeniyle kullanici varligi acik edilmez; uygun durumda ayni mesaj gosterilir.
          </p>

          <Link
            href="/login"
            className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[#5d493c] transition hover:text-[#2f241d]"
          >
            <ArrowLeft className="h-4 w-4" />
            Giris ekranina don
          </Link>
        </div>
      </div>
    </main>
  )
}
