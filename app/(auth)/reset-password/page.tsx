'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const MIN_PASSWORD_LENGTH = 8

function getRecoveryErrorFromUrl() {
  if (typeof window === 'undefined') {
    return ''
  }

  const searchParams = new URLSearchParams(window.location.search)
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))

  return (
    searchParams.get('error_description') ??
    searchParams.get('error') ??
    hashParams.get('error_description') ??
    hashParams.get('error') ??
    ''
  )
}

function getRecoveryTokens() {
  if (typeof window === 'undefined') {
    return {
      accessToken: '',
      refreshToken: '',
      code: '',
    }
  }

  const searchParams = new URLSearchParams(window.location.search)
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))

  return {
    accessToken: hashParams.get('access_token') ?? '',
    refreshToken: hashParams.get('refresh_token') ?? '',
    code: searchParams.get('code') ?? '',
  }
}

export default function ResetPasswordPage() {
  const router = useRouter()
  const [initialRecoveryError] = useState(() => getRecoveryErrorFromUrl())
  const [initialRecoveryTokens] = useState(() => getRecoveryTokens())
  const [supabase] = useState(() => createClient())
  const recoveryEventDetectedRef = useRef(false)

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingSession, setLoadingSession] = useState(true)
  const [recoveryReady, setRecoveryReady] = useState(false)
  const [errorText, setErrorText] = useState('')
  const [successText, setSuccessText] = useState('')

  useEffect(() => {
    let active = true

    async function ensureRecoverySession() {
      if (initialRecoveryError) {
        if (active) {
          setErrorText(decodeURIComponent(initialRecoveryError))
          setLoadingSession(false)
        }
        return
      }

      const hasRecoveryParams = Boolean(
        initialRecoveryTokens.code ||
          (initialRecoveryTokens.accessToken && initialRecoveryTokens.refreshToken)
      )

      const applyReadyState = () => {
        if (!active) {
          return
        }

        setRecoveryReady(true)
        setLoadingSession(false)
      }

      const failState = (message: string) => {
        if (!active) {
          return
        }

        setErrorText(message)
        setLoadingSession(false)
      }

      await new Promise((resolve) => window.setTimeout(resolve, 220))

      if (recoveryEventDetectedRef.current) {
        applyReadyState()
        return
      }

      const retrySession = await supabase.auth.getSession()

      if (hasRecoveryParams && retrySession.data.session) {
        applyReadyState()
        return
      }

      const {
        accessToken,
        refreshToken,
        code,
      } = initialRecoveryTokens

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)

        if (error) {
          failState('Sifre yenileme baglantisi gecersiz veya suresi dolmus olabilir.')
          return
        }

        applyReadyState()
        return
      }

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })

        if (error) {
          failState('Sifre yenileme baglantisi gecersiz veya suresi dolmus olabilir.')
          return
        }

        applyReadyState()
        return
      }

      failState('Sifre yenileme baglantisi gecersiz veya suresi dolmus olabilir.')
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (!active) {
        return
      }

      if (event === 'PASSWORD_RECOVERY') {
        recoveryEventDetectedRef.current = true
        setRecoveryReady(true)
        setLoadingSession(false)
      }
    })

    void ensureRecoverySession()

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [initialRecoveryError, initialRecoveryTokens, supabase])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrorText(`Sifre en az ${MIN_PASSWORD_LENGTH} karakter olmali.`)
      return
    }

    if (password !== confirmPassword) {
      setErrorText('Sifre tekrar alani eslesmiyor.')
      return
    }

    setLoading(true)
    setErrorText('')
    setSuccessText('')

    const { error } = await supabase.auth.updateUser({
      password,
    })

    if (error) {
      setLoading(false)
      setErrorText(error.message)
      return
    }

    await supabase.auth.signOut()

    setLoading(false)
    setSuccessText('Sifreniz guncellendi. Giris ekranina yonlendiriliyorsunuz.')

    window.setTimeout(() => {
      router.replace('/login?reset=success')
      router.refresh()
    }, 1200)
  }

  return (
    <main className="min-h-screen bg-[#f4efe8] p-4 sm:p-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-3xl items-center justify-center">
        <div className="w-full max-w-xl rounded-[32px] border border-[#e4d9cd] bg-white/95 p-6 shadow-[0_24px_60px_rgba(80,58,41,0.10)] sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#ece1d6] bg-[#fbf8f4] px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-[#7a6350]">
            <ShieldCheck className="h-4 w-4" />
            Yeni sifre
          </div>

          <h1 className="mt-5 text-3xl font-semibold text-[#2f2925]">Yeni Sifre Olustur</h1>
          <p className="mt-3 text-sm leading-6 text-[#6f655d]">
            Hesabiniz icin yeni sifrenizi belirleyin.
          </p>

          {loadingSession ? (
            <div className="mt-6 rounded-2xl border border-[#eadfce] bg-[#faf6f0] px-4 py-3 text-sm text-[#6f655d]">
              Sifre yenileme baglantisi dogrulaniyor...
            </div>
          ) : null}

          {errorText ? (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorText}
            </div>
          ) : null}

          {successText ? (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {successText}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium text-[#4e433b]"
              >
                Yeni sifre
              </label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8d7b6c]" />
                <input
                  id="password"
                  type={passwordVisible ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-2xl border border-[#dfd3c7] bg-[#fcfaf7] py-3 pl-12 pr-12 text-[#2f2925] outline-none transition focus:border-[#8c6f5c] focus:bg-white focus:ring-4 focus:ring-[#c9b19c]/20 disabled:cursor-not-allowed disabled:opacity-70"
                  placeholder="En az 8 karakter"
                  autoComplete="new-password"
                  required
                  disabled={!recoveryReady || loadingSession || loading}
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

            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-2 block text-sm font-medium text-[#4e433b]"
              >
                Yeni sifre tekrar
              </label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8d7b6c]" />
                <input
                  id="confirmPassword"
                  type={confirmPasswordVisible ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full rounded-2xl border border-[#dfd3c7] bg-[#fcfaf7] py-3 pl-12 pr-12 text-[#2f2925] outline-none transition focus:border-[#8c6f5c] focus:bg-white focus:ring-4 focus:ring-[#c9b19c]/20 disabled:cursor-not-allowed disabled:opacity-70"
                  placeholder="Yeni sifrenizi tekrar girin"
                  autoComplete="new-password"
                  required
                  disabled={!recoveryReady || loadingSession || loading}
                />
                <button
                  type="button"
                  onClick={() => setConfirmPasswordVisible((current) => !current)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#7f6d61] transition hover:text-[#3d2e25]"
                  aria-label={confirmPasswordVisible ? 'Sifreyi gizle' : 'Sifreyi goster'}
                >
                  {confirmPasswordVisible ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={!recoveryReady || loadingSession || loading}
              className="w-full rounded-2xl bg-[#3f3026] px-4 py-3 text-sm font-semibold text-[#fffaf5] transition duration-200 hover:bg-[#2f241d] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Sifre guncelleniyor...' : 'Sifreyi Guncelle'}
            </button>
          </form>

          <div className="mt-6 space-y-3 text-sm text-[#6f655d]">
            <p>Baglanti gecersiz veya suresi dolmussa yeni bir sifre sifirlama talebi olusturun.</p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/forgot-password"
                className="font-medium text-[#5d493c] underline transition hover:text-[#2f241d]"
              >
                Yeni sifirlama baglantisi isteyin
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 font-medium text-[#5d493c] transition hover:text-[#2f241d]"
              >
                <ArrowLeft className="h-4 w-4" />
                Giris ekranina don
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
