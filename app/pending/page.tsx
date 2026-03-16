import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  getProfileAccessStatus,
  isApprovedProfile,
} from '@/lib/supabase/profile-access'

async function signOutAction() {
  'use server'

  const supabase = await createClient()
  await supabase.auth.signOut()

  redirect('/login')
}

export default async function PendingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const profile = await getProfileAccessStatus(supabase, user.id)

  if (isApprovedProfile(profile.status)) {
    redirect('/dashboard')
  }

  const isRejected = profile.status === 'rejected'
  const pageTitle = isRejected
    ? 'Hesabiniz Onaylanmadi'
    : 'Hesabiniz Onay Bekliyor'
  const description = isRejected
    ? 'Hesabiniz su an onaylanmadi. Yonetici ile iletisime gecin.'
    : 'Kaydiniz alindi. Yonetici onayindan sonra sisteme erisebileceksiniz.'
  const statusLabel = isRejected ? 'Reddedildi' : 'Onay Bekliyor'

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-10">
      <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-sm">
        <div className="inline-flex rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-neutral-600">
          {statusLabel}
        </div>

        <h1 className="mt-4 text-2xl font-semibold text-neutral-900">
          {pageTitle}
        </h1>

        <p className="mt-2 text-sm leading-6 text-neutral-600">{description}</p>

        <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
          <div className="text-xs uppercase tracking-[0.16em] text-neutral-500">
            Hesap
          </div>
          <div className="mt-1 text-sm font-medium text-neutral-900">
            {profile.email ?? user.email ?? '-'}
          </div>
        </div>

        <form action={signOutAction} className="mt-6">
          <button
            type="submit"
            className="w-full rounded-xl bg-neutral-900 px-4 py-2 text-white transition hover:bg-neutral-800"
          >
            Cikis Yap
          </button>
        </form>
      </div>
    </main>
  )
}
