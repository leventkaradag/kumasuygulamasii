'use client'

import Link from 'next/link'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [errorText, setErrorText] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setErrorText('')
    setMessage('')

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      setLoading(false)
      setErrorText(error.message)
      return
    }

    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: data.user.id,
        email: data.user.email,
        role: 'user',
        status: 'pending',
      })

      if (profileError) {
        setLoading(false)
        setErrorText(profileError.message)
        return
      }
    }

    setLoading(false)
    setMessage('Kayit alindi. Hesabiniz admin onayi bekliyor.')
  }

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-10">
      <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-neutral-900">Kayit Ol</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Yeni kullanici olusturun. Hesap once onay bekleyecek.
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

          {message ? (
            <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {message}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-neutral-900 px-4 py-2 text-white transition hover:bg-neutral-800 disabled:opacity-60"
          >
            {loading ? 'Kayit olusturuluyor...' : 'Kayit Ol'}
          </button>
        </form>

        <p className="mt-4 text-sm text-neutral-600">
          Zaten hesabiniz var mi?{' '}
          <Link href="/login" className="font-medium text-neutral-900 underline">
            Giris yap
          </Link>
        </p>
      </div>
    </main>
  )
}
