# Desenler → Supabase Migration — Uygulama Notu

Tamamlanan işlemler ve sonraki adımlar burada listelenmiştir.

---

## ✅ Değişen Dosyalar

| Dosya | Değişiklik |
|---|---|
| `lib/repos/patternsSupabaseRepo.ts` | **YENİ** — Async Supabase CRUD |
| `spa-pages/Desenler.tsx` | Async load, `isLoading` state, `refreshPatterns` async |
| `components/desen/PatternModal.tsx` | Async submit, `isSaving` state, hata yakalama |
| `components/PatternDetailPanel.tsx` | Tüm yazma işlemleri async `.then()` ile |
| `app/(panel)/desenler/[id]/page.tsx` | `get()` ve `handleSaved` async |

**Dokunulmayan dosyalar:** `patternsLocalRepo.ts`, `patternsRepo.ts`, `mock/patterns.ts`, diğer tüm modüller.

---

## 🗄️ Çalıştırman Gereken SQL

Önce Supabase Dashboard → SQL Editor'e gir, aşağıdaki SQL'i çalıştır:

```sql
-- Patterns tablosu
CREATE TABLE IF NOT EXISTS public.patterns (
  id                    text        PRIMARY KEY,
  created_at            timestamptz NOT NULL DEFAULT now(),
  fabric_code           text        NOT NULL UNIQUE,
  fabric_name           text        NOT NULL,
  weave_type            text        NOT NULL,
  warp_count            text        NOT NULL,
  weft_count            text        NOT NULL,
  total_ends            text        NOT NULL,
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

-- Row Level Security
ALTER TABLE public.patterns ENABLE ROW LEVEL SECURITY;

-- Giriş yapmış olan herkes okuyabilir
CREATE POLICY "authenticated_read" ON public.patterns
  FOR SELECT TO authenticated USING (true);

-- Giriş yapmış olan herkes yazabilir
CREATE POLICY "authenticated_write" ON public.patterns
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

> **Not:** RLS politikaları projenin kendi auth yapısına göre sıkılaştırılabilir.

---

## 🚚 Migration Adımları (Tek Seferlik)

Mevcut localStorage verisi varsa aşağıdaki adımları izle:

### 1. Tarayıcı konsolundan veriyi al

Desenler sayfası açıkken F12 → Console:
```js
copy(JSON.stringify(JSON.parse(localStorage.getItem('patterns:overrides') ?? '{}')))
```

### 2. Verileri SQL'e dönüştür

Aldığın JSON'u inceleyip çakışma olmayan kayıtları bir `INSERT` bloğuna dönüştür.
Alternatif: aşağıdaki basit migration script'ini geliştirici konsolunda çalıştır (Supabase URL ve anon key'ini gir):

```js
// patterns:overrides içindeki tüm tam pattern'leri Supabase'e yaz
const overrides = JSON.parse(localStorage.getItem('patterns:overrides') ?? '{}');
const SUPABASE_URL = 'https://XXXX.supabase.co';
const ANON_KEY = 'eyJ...';

const rows = Object.entries(overrides)
  .filter(([, v]) => !v.__deleted && v.fabricCode && v.fabricName)
  .map(([, v]) => ({
    id: v.id || v.fabricCode,
    fabric_code: v.fabricCode,
    fabric_name: v.fabricName,
    weave_type: v.weaveType || '',
    warp_count: v.warpCount || '',
    weft_count: v.weftCount || '',
    total_ends: v.totalEnds || '',
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

### 3. Mock seed verilerini de eklemek istersen

`mock/patterns.ts` dosyasındaki sabit verileri de aynı şekilde Supabase'e ekleyebilirsin.
Yukarıdaki script'i `PATTERNS` array'ine uyarlayarak çalıştır.

---

## 🧪 Test Adımları

### Temel CRUD
1. Uygulamayı aç → Desenler sayfası "Yükleniyor..." göstermeli, ardından Supabase'den gelen list yüklenmeli
2. Yeni desen ekle → Kaydet butonuna bas → "Kaydediliyor..." animasyonu görünmeli → desen listede çıkmalı
3. Bir desen seç → notunu değiştir, kaydet → "Kaydedildi ✅" görmeli
4. Desen düzenle → metre güncelle, lojistik güncelle → her biri "Kaydedildi ✅" göstermeli
5. Arşivle → desen ARCHIVE sekmesine geçmeli
6. Arşivden geri al → ACTIVE sekmesine dönmeli
7. Kalıcı sil → desen listeden kalkmalı

### Supabase Dashboard doğrulaması
- Table Editor → Patterns tablosunu aç
- Yukarıdaki işlemler sonrası kayıtların oluştuğunu / güncellendiğini / silindiğini görsel olarak doğrula

### Sayfa router test
- `/desenler/[id]` URL'ini doğrudan aç → pattern yüklenmeli

---

## ⏪ Geri Alma Planı

Eğer Supabase bağlantısı bir sorun çıkarırsa:

### Hızlı geri alma (import değiştir)
Her değiştirilen dosyada sadece şu 2 satırı eski haline getir:

```diff
- import { patternsSupabaseRepo } from "@/lib/repos/patternsSupabaseRepo";
+ import { patternsLocalRepo } from "@/lib/repos/patternsLocalRepo";
```

Ve tüm `patternsSupabaseRepo.*` çağrılarını `patternsLocalRepo.*` olarak değiştir (sync hale getir).

### Git ile geri alma
```bash
git reset --hard HEAD
```

> `patternsLocalRepo.ts`, `patternsRepo.ts` ve `mock/patterns.ts` hiç değiştirilmediğinden
> git reset ile herşey tamamen eski haline döner.
> `lib/repos/patternsSupabaseRepo.ts` untracked dosya olarak kalır, silinebilir.
