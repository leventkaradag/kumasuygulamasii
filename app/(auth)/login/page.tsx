'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAuthenticatedRedirectPath, normalizeProfileStatus } from '@/lib/supabase/profile-access'

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorText, setErrorText] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setErrorText('')

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setLoading(false)
      setErrorText(error.message)
      return
    }

    const profileResult = data.user
      ? await supabase
          .from('profiles')
          .select('status')
          .eq('id', data.user.id)
          .maybeSingle()
      : null

    setLoading(false)

    const nextPath =
      profileResult?.data && !profileResult.error
        ? getAuthenticatedRedirectPath(normalizeProfileStatus(profileResult.data.status))
        : '/pending'

    router.replace(nextPath)
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-10">
      <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-neutral-900">Giris Yap</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Kumasci Panel hesabinizla giris yapin.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">
              E-posta
            </label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-500"
              placeholder="ornek@mail.com"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">
              Sifre
            </label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-500"
              placeholder="Sifreniz"
              required
            />
          </div>

          {errorText ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorText}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-neutral-900 px-4 py-2 text-white transition hover:bg-neutral-800 disabled:opacity-60"
          >
            {loading ? 'Giris yapiliyor...' : 'Giris Yap'}
          </button>
        </form>

        <p className="mt-4 text-sm text-neutral-600">
          Hesabiniz yok mu?{' '}
          <Link href="/register" className="font-medium text-neutral-900 underline">
            Kayit ol
          </Link>
        </p>
      </div>
    </main>
  )
}
