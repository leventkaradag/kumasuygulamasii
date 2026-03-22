# Kumaşcı Panel — Supabase Migration Proje Durumu

Bu belge yapay zekaya bağlam sağlamak için hazırlanmıştır.
Tüm analiz, kod değişiklikleri ve planlama bilgilerini içerir.

---

## Proje Genel Bilgisi

- **Proje adı:** kumasci-panel
- **Framework:** Next.js (App Router), TypeScript, React
- **Amaç:** Kumaş / depo / dokuma / boyahane yönetim paneli
- **Mevcut veri katmanı:** localStorage + LocalRepo soyutlaması
- **Hedef:** İş verilerini Supabase'e taşımak

### Supabase Bağlantısı (.env.local'da mevcut)
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### Mevcut Supabase Client Dosyaları
- `lib/supabase/client.ts` → `createBrowserClient()` (browser-side)
- `lib/supabase/server.ts` → server-side client
- `lib/supabase/middleware.ts` → auth middleware (aktif, oturum korumalı)
- Panel Supabase Auth ile korunmuş — tüm sayfalar `authenticated` kullanıcı gerektirir

---

## Mevcut localStorage Yapısı (Tüm Modüller)

| localStorage Key | Repo Dosyası | Durum |
|---|---|---|
| `patterns:overrides` | `patternsLocalRepo.ts` | ✅ **Supabase'e taşındı** |
| `depo:rolls` | `depoLocalRepo.ts` | ⏳ Beklemede |
| `depo:transactions` | `depoTransactionsLocalRepo.ts` | ⏳ Beklemede |
| `depo:transaction-lines` | `depoTransactionsLocalRepo.ts` | ⏳ Beklemede |
| `movements:{patternId}` | `movementsLocalRepo.ts` | ⏳ Beklemede |
| weaving (4 key) | `weavingLocalRepo.ts` | ⏳ Beklemede |
| orders (3 key) | `ordersLocalRepo.ts` | ⏳ Beklemede |
| dyehouse (3 key) | `dyehouseLocalRepo.ts` | ⏳ Beklemede |
| customers | `customersLocalRepo.ts` | ⏳ Beklemede |

---

## Tamamlanan İşler

### ✅ Faz 1 — Desenler (Patterns) Modülü → Supabase

#### Oluşturulan / Değiştirilen Dosyalar

**YENİ:** `lib/repos/patternsSupabaseRepo.ts`
- Supabase `patterns` tablosu için async CRUD
- `list()`, `get(id)`, `update(id, patch)`, `upsertPatternFromForm(payload)`, `archivePattern()`, `restorePattern()`, `remove()`
- snake_case ↔ camelCase mapper'lar (`mapDbToPattern`, `mapPatternToDb`)
- `upsertPatternFromForm`: fabric_code çakışması kontrol eder, mevcut id'yi korur

**DEĞİŞTİ:** `spa-pages/Desenler.tsx`
- `patternsLocalRepo` / `patternsRepo` → `patternsSupabaseRepo`
- `useEffect` içinde async `list()` çağrısı
- `isLoading` state eklendi ("Yükleniyor..." göstergesi)
- `fetchError` state eklendi (kırmızı banner ile hata gösterimi)
- `refreshPatterns()` async Promise zincirine dönüştürüldü

**DEĞİŞTİ:** `components/desen/PatternModal.tsx`
- `upsertPatternFromForm()` async'e alındı
- `isSaving` state eklendi (çift submit koruması)
- Kaydet butonu "Kaydediliyor..." gösteriyor
- catch bloğu form içinde hata mesajı gösteriyor

**DEĞİŞTİ:** `components/PatternDetailPanel.tsx`
- Tüm 8 yazma işlemi async `.then()` + `.catch()` yapısına alındı:
  - Not kaydet, görsel kaydet, metre güncelle, varyantlar kaydet, lojistik kaydet, arşivle, arşivden çıkar, sil
- `asyncError` state eklendi → hata action button bar'ında kırmızı pill olarak görünür
- Her işlem başında error sıfırlanıyor

**DEĞİŞTİ:** `app/(panel)/desenler/[id]/page.tsx`
- `get(id)` async çağrıya dönüştürüldü
- `isLoading` ve `fetchError` state eklendi
- Yükleme sırasında spinner, hata durumunda kırmızı kart + **Tekrar dene** butonu

#### Dokunulmayan Dosyalar
- `patternsLocalRepo.ts` — silinmedi, diğer modüller okuyabilir
- `patternsRepo.ts` — silinmedi
- `mock/patterns.ts` — silinmedi (migration seed kaynağı)
- Diğer tüm modüller

---

## Çalıştırılması Gereken SQL (Desenler)

```sql
CREATE TABLE IF NOT EXISTS public.patterns (
  id                    text        PRIMARY KEY,
  created_at            timestamptz NOT NULL DEFAULT now(),
  fabric_code           text        NOT NULL UNIQUE,
  fabric_name           text        NOT NULL,
  weave_type            text,
  warp_count            text,
  weft_count            text,
  total_ends            text,
  current_stage         text        NOT NULL DEFAULT 'DEPO',
  total_produced_meters numeric     NOT NULL DEFAULT 0,
  stock_meters          numeric     NOT NULL DEFAULT 0,
  defect_meters         numeric     NOT NULL DEFAULT 0,
  in_dyehouse_meters    numeric     NOT NULL DEFAULT 0,
  variants              jsonb       NOT NULL DEFAULT '[]',
  parti_nos             jsonb       NOT NULL DEFAULT '[]',
  gramaj_gm2            numeric,
  fire_orani            numeric,
  musteri               text,
  depo_no               text,
  kg                    numeric,
  eni_cm                numeric,
  tarak_eni_cm          numeric,
  color                 text,
  image_digital         text,
  image_final           text,
  note                  text,
  archived              boolean     NOT NULL DEFAULT false
);

ALTER TABLE public.patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read" ON public.patterns
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_write" ON public.patterns
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

#### Mevcut localStorage Verilerini Taşıma (Tek Seferlik)
F12 Console'dan çalıştır:
```js
const overrides = JSON.parse(localStorage.getItem('patterns:overrides') ?? '{}');
const SUPABASE_URL = 'https://XXXX.supabase.co';
const ANON_KEY = 'eyJ...';

const rows = Object.entries(overrides)
  .filter(([, v]) => !v.__deleted && v.fabricCode && v.fabricName)
  .map(([, v]) => ({
    id: v.id || v.fabricCode,
    fabric_code: v.fabricCode,
    fabric_name: v.fabricName,
    weave_type: v.weaveType || null,
    warp_count: v.warpCount || null,
    weft_count: v.weftCount || null,
    total_ends: v.totalEnds || null,
    current_stage: v.currentStage || 'DEPO',
    total_produced_meters: v.totalProducedMeters ?? 0,
    stock_meters: v.stockMeters ?? 0,
    defect_meters: v.defectMeters ?? 0,
    in_dyehouse_meters: v.inDyehouseMeters ?? 0,
    variants: v.variants ?? [],
    parti_nos: v.partiNos ?? [],
    gramaj_gm2: v.gramajGm2 ?? null,
    fire_orani: v.fireOrani ?? null,
    musteri: v.musteri ?? null,
    depo_no: v.depoNo ?? null,
    kg: v.kg ?? null,
    eni_cm: v.eniCm ?? null,
    tarak_eni_cm: v.tarakEniCm ?? null,
    color: v.color ?? null,
    image_digital: v.imageDigital ?? null,
    image_final: v.imageFinal ?? null,
    note: v.note ?? null,
    archived: v.archived ?? false,
    created_at: v.createdAt ?? new Date().toISOString(),
  }));

fetch(`${SUPABASE_URL}/rest/v1/patterns`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${ANON_KEY}`,
    'Prefer': 'resolution=merge-duplicates',
  },
  body: JSON.stringify(rows),
}).then(r => r.text()).then(console.log);
```

---

## Analiz Edildi — Henüz Taşınmadı: Depo Modülü

### Depo Veri Akışı

```
patternsLocalRepo.list()         ← ⚠️ Hâlâ patternsLocalRepo kullanıyor!
depoLocalRepo.listRolls()        ← localStorage "depo:rolls"
depoTransactionsLocalRepo        ← localStorage "depo:transactions" + "depo:transaction-lines"
customersLocalRepo.list()        ← localStorage
weavingLocalRepo.list*()         ← localStorage (sadece Notlar sekmesi)
           ↓
spa-pages/Depo.tsx (refreshData)   ← 2880 satır!
           ↓
├── Stok sekmesi   → top listesi, rezerv/sevk/iade formları
├── İşlem sekmesi  → transaction geçmişi, iptal
└── Notlar sekmesi → cross-module pattern geçmişi
```

### Depo Taşıma Önekinde Yapılması Gereken 1 Kritik Değişiklik

`spa-pages/Depo.tsx` satır ~581'de:
```ts
// MEVCUT (bozuk):
const nextPatterns = sortPatterns(patternsLocalRepo.list().filter(isPatternVisible));

// OLMASI GEREKEN:
// patternsSupabaseRepo.list() ile async çekilmeli
```
Bu değişiklik yapılmadan Depo sayfasında desen listesi boş görünür çünkü patterns artık Supabase'de.

### Depo için Gerekli Yeni Tablolar (SQL Taslağı)

```sql
-- Kumaş topları
CREATE TABLE IF NOT EXISTS public.fabric_rolls (
  id           text        PRIMARY KEY,
  pattern_id   text        NOT NULL,
  variant_id   text,
  color_name   text,
  meters       numeric     NOT NULL CHECK (meters >= 0),
  roll_no      text,
  status       text        NOT NULL DEFAULT 'IN_STOCK',
  in_at        timestamptz NOT NULL,
  out_at       timestamptz,
  reserved_at  timestamptz,
  reserved_for text,
  counterparty text,
  note         text
);

-- Depo işlem başlıkları
CREATE TABLE IF NOT EXISTS public.depo_transactions (
  id                         text        PRIMARY KEY,
  type                       text        NOT NULL,
  status                     text        NOT NULL DEFAULT 'ACTIVE',
  created_at                 timestamptz NOT NULL DEFAULT now(),
  customer_id                text,
  customer_name_snapshot     text,
  note                       text,
  total_tops                 integer,
  total_metres               numeric,
  pattern_count              integer,
  target_transaction_id      text,
  reversed_at                timestamptz,
  reversed_by_transaction_id text
);

-- Depo işlem satırları
CREATE TABLE IF NOT EXISTS public.depo_transaction_lines (
  id                    text        PRIMARY KEY,
  transaction_id        text        NOT NULL REFERENCES public.depo_transactions(id),
  pattern_id            text        NOT NULL,
  pattern_no_snapshot   text        NOT NULL,
  pattern_name_snapshot text        NOT NULL,
  color                 text        NOT NULL,
  metre_per_top         numeric     NOT NULL,
  top_count             integer     NOT NULL,
  total_metres          numeric     NOT NULL,
  roll_ids              jsonb
);
```

### Depo Taşıma Riskleri

| Risk | Seviye | Açıklama |
|---|---|---|
| `refreshData()` 7 kaynak, tümü sync | 🔴 Yüksek | `Promise.all` ile async dönüşüm gerekiyor |
| Patterns hâlâ `patternsLocalRepo`'dan çekiliyor | 🔴 Yüksek | Önce bu 1 satır düzeltilmeli |
| `createTransaction` atomicity | 🔴 Yüksek | 2 INSERT'i Supabase ile atomic yapmak gerekiyor |
| `rollIds` jsonb referansları | 🟡 Orta | FK değil uygulama katmanı sağlamalı |
| Büyük roll listesi → server-side filter | 🟡 Orta | Pagination düşünülmeli |

### Depo Önerilen Geçiş Sırası

```
Faz 0 (1 satır)  → Depo.tsx'te patternsLocalRepo → patternsSupabaseRepo
Faz 1            → fabric_rolls Supabase + depoSupabaseRepo.ts
Faz 2            → depo_transactions + depo_transaction_lines
Faz 3            → refreshData() tam Promise.all dönüşümü
```

---

## Tüm Modüller İçin Önerilen Migration Sırası

```
✅ Faz 1: Desenler (patterns)          → TAMAMLANDI
⏳ Faz 2: Depo (fabric_rolls + tx)     → Analiz tamamlandı, kod bekleniyor
⏳ Faz 3: Movements (hareketler)       → Pattern'e bağımlı, küçük modül
⏳ Faz 4: Customers                    → Bağımsız, istenen zaman
⏳ Faz 5: Orders                       → Customer + pattern bağımlı
⏳ Faz 6: Dyehouse + Weaving          → En karmaşık (~44KB), en sona
```

---

## Aktif Geliştirme Kuralları

1. Her fazda **sadece 1 modülü** taşı
2. `patternsLocalRepo.ts`, `patternsRepo.ts`, `mock/patterns.ts` **silme** — diğer modüller okuyabilir
3. Mevcut auth yapısını bozma
4. UI görünümünü gereksiz değiştirme
5. Başka modüllere dokunma
6. ID değerlerini birebir koru (FK bağlantıları için kritik)
7. `imageDigital/imageFinal` → şimdilik `text` olarak sakla, Supabase Storage daha sonra

---

## Domain Modelleri (TypeScript)

### Pattern (`lib/domain/pattern.ts`)
```ts
type Pattern = {
  id: string;
  createdAt: string;
  fabricCode: string;       // UNIQUE
  fabricName: string;
  weaveType: string;
  warpCount: string;
  weftCount: string;
  totalEnds: string;
  variants: Variant[];
  partiNos: string[];
  gramajGm2?: number;
  fireOrani?: number;
  musteri?: string;
  depoNo?: string;
  kg?: number;
  eniCm?: number;
  tarakEniCm?: number | null;
  color?: string;
  currentStage: Stage;       // DOKUMA | BOYAHANE | DEPO
  totalProducedMeters: number;
  stockMeters: number;
  defectMeters: number;
  inDyehouseMeters: number;
  imageDigital?: string | null;
  imageFinal?: string | null;
  note?: string;
  archived?: boolean;
}
```

### FabricRoll (`lib/domain/depo.ts`)
```ts
type FabricRollStatus = "IN_STOCK" | "RESERVED" | "SHIPPED" | "RETURNED" | "VOIDED" | "SCRAP";

type FabricRoll = {
  id: string;
  patternId: string;     // → patterns.id
  variantId?: string;
  colorName?: string;
  meters: number;
  rollNo?: string;
  status: FabricRollStatus;
  inAt: string;
  outAt?: string;
  reservedAt?: string;
  reservedFor?: string;
  counterparty?: string;
  note?: string;
}
```

### DepoTransaction (`lib/domain/depoTransaction.ts`)
```ts
type DepoTransactionType = "ENTRY" | "SHIPMENT" | "RESERVATION" | "RETURN" | "REVERSAL" | "ADJUSTMENT";
type DepoTransactionStatus = "ACTIVE" | "REVERSED";

type DepoTransaction = {
  id: string;
  type: DepoTransactionType;
  status: DepoTransactionStatus;
  createdAt: string;
  customerId?: string;
  customerNameSnapshot?: string;
  note?: string;
  totals?: { totalTops: number; totalMetres: number; patternCount: number };
  targetTransactionId?: string;
  reversedAt?: string;
  reversedByTransactionId?: string;
}

type DepoTransactionLine = {
  id: string;
  transactionId: string;   // → depo_transactions.id
  patternId: string;       // → patterns.id
  patternNoSnapshot: string;
  patternNameSnapshot: string;
  color: string;
  metrePerTop: number;
  topCount: number;
  totalMetres: number;
  rollIds?: string[];      // → fabric_rolls.id[]
}
```
