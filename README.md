# Kumasci Panel

Kumasci Panel; desen, depo, dokuma ve boyahane akislari icin hazirlanmis, Next.js App Router tabanli bir kontrol paneli iskeletidir.
Modern ve sade bir arayuzle temel sayfa rotalari, demo auth akisi ve premium gorunumlu giris ekrani sunar.

## Teknoloji

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS
- GSAP (animasyonlar)

## Kurulum

```bash
npm install
```

## Gelistirme

```bash
npm run dev
```

Tarayicida ac:

```
http://localhost:3000
```

## Uretim Build

```bash
npm run build
npm run start
```

Not: Windows + OneDrive kullaniyorsaniz `.next` klasoru kilitlenebilir. Bu durumda build oncesi:

```bash
cmd /c rmdir /s /q .next
```

## Proje Yapisi

```
app/                 # Next.js App Router
app/(auth)/login     # GSAP animasyonlu login sayfasi
components/          # UI bileenleri
spa-pages/           # Icerik sayfalari (Layout ile gosterim)
auth/                # Demo auth yardimcilari
config/              # UI sabitleri / mock veriler
mock/                # Ornek veri setleri
```

## Rotalar

- /dashboard
- /desenler
- /depo
- /dokuma
- /boyahane
- /raporlar
- /ayarlar
- /notlar
- /siparis
- /login
- /register
- /superadmin/users

## Login Ekrani

Login ekrani tamamen client-side calisir ve GSAP ile animasyonlu arka plan icerir.
`prefers-reduced-motion` ayarini destekler; hareket azaltildiysa animasyon devre disi kalir.

## Ortam Degiskenleri

`.env` icinde:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Supabase simdilik demo icin yer tutucu olarak eklenmistir.

## Notlar

- Demo auth verileri localStorage icinde tutulur.
- Tasarim iskeleti moduler sekilde genisletilebilir.

