# Kumaşcı Panel — Supabase Migration Analizi

Bu belge, projenin mevcut localStorage / LocalRepo yapısını anlamak ve
Supabase'e taşıma planı çıkarmak için yapılan statik analizin sonucudur.
Kod değiştirilmemiştir.

---

## 1. Local Veri Kaynakları

### localStorage kullanan Repo dosyaları

| Dosya | localStorage Key(s) |
|---|---|
| `lib/repos/patternsLocalRepo.ts` | `patterns:overrides` |
| `lib/repos/depoLocalRepo.ts` | `STORAGE_KEY` (depo rolls) |
| `lib/repos/depoTransactionsLocalRepo.ts` | `TRANSACTIONS_STORAGE_KEY`, `TRANSACTION_LINES_STORAGE_KEY` |
| `lib/repos/movementsLocalRepo.ts` | `movements:{patternId}` (dinamik, per-pattern) |
| `lib/repos/weavingLocalRepo.ts` | `PLANS_STORAGE_KEY`, `PROGRESS_STORAGE_KEY`, `TRANSFER_STORAGE_KEY`, `DISPATCH_DOCUMENTS_STORAGE_KEY` |
| `lib/repos/ordersLocalRepo.ts` | `CUSTOMER_ORDERS_STORAGE_KEY`, `DYEHOUSE_ORDERS_STORAGE_KEY`, `ORDER_NOTES_STORAGE_KEY` |
| `lib/repos/dyehouseLocalRepo.ts` | `STORAGE_KEY`, `JOBS_STORAGE_KEY`, `PROGRESS_STORAGE_KEY` |
| `lib/repos/customersLocalRepo.ts` | `STORAGE_KEY` |

**Toplam: 8 repo dosyası, ~15 farklı localStorage key.**

### patternsLocalRepo özel mimarisi (diğerlerinden farklı)

```
mock/patterns.ts           → sabit seed verisi (read-only)
      ↓
patternsRepo.ts            → seed'i döndürür
      ↓
patternsLocalRepo.ts       → seed + localStorage "patterns:overrides" merge eder
```

Yani her `list()` çağrısı:
1. Sabit seed'i alır
2. localStorage'daki override'ları üstüne uygular
3. Merge edilmiş listeyi döner

Kullanıcı bir desen oluşturunca veya düzenleyince sadece override objesi localStorage'a yazılır.
Seed'e dokunulmaz.

---

## 2. Desenler Veri Akışı

```
mock/patterns.ts  (sabit seed)
      ↓
patternsRepo.list()
      ↓
patternsLocalRepo.list()   ← localStorage "patterns:overrides" merge
      ↓
spa-pages/Desenler.tsx     ← useEffect ile çeker, React state'e yazar
      ↓
├── components/PatternListItem.tsx         → sadece render, yazma yok
├── components/PatternDetailPanel.tsx      → patternsLocalRepo.update() çağırır
│     ├── not kaydetme
│     ├── görsel (imageDigital/imageFinal) kaydetme
│     ├── metre güncelleme
│     ├── lojistik güncelleme (kg, eni, gramaj, fire, müşteri, depoNo, createdAt)
│     ├── varyant ekleme/silme/değiştirme
│     ├── arşivleme / arşivden çıkarma
│     └── kalıcı silme
├── components/desen/PatternModal.tsx      → patternsLocalRepo.upsertPatternFromForm()
└── components/desen/MovementModal.tsx     → patternsLocalRepo bağımlısı
      ↓
app/(panel)/desenler/[id]/page.tsx         → patternsLocalRepo.get(id) ile tekil okuma
```

**Geri bildirim mekanizması:**  
`PatternDetailPanel` ve `PatternModal`, işlem sonucunu `onPatternUpdated` / `onSave`
callback'leriyle parent'a bildiriyor. `Desenler.tsx` bu callback'te `patternsLocalRepo.list()`'i
yeniden çekip state'i güncelliyor. Bu pattern async geçişe uygundur.

---

## 3. İlk Taşınacak Modül → Desenler (Patterns)

### Neden Desenler önce?

1. **Bağımsız model**: Pattern hiçbir modüle bağımlı değil.
   Depo, Dokuma, Boyahane, Orders — hepsi pattern'e bağımlı.
   Önce pattern taşınırsa diğerleri foreign key ile doğru bağlanabilir.

2. **Net veri yapısı**: `lib/domain/pattern.ts` temiz TypeScript interface'i var.
   Field mapping çıkarmak kolay.

3. **Hazır seed**: `mock/patterns.ts` one-time migration için kaynak olarak kullanılabilir.
   Supabase'e INSERT edilir, sonrasında mock'a bakılmaz.

4. **Diğerleri çok karmaşık**:
   - `weavingLocalRepo.ts` → 44 KB, 4 ayrı storage key
   - `ordersLocalRepo.ts` → 25 KB, müşteri-sipariş ilişkileri
   - `dyehouseLocalRepo.ts` → çoklu job/progress tabloları
   Bu dosyalar ikinci aşamaya bırakılmalı.

---

## 4. Değişecek Dosyalar (Desenler Modülü Migration)

| Dosya | Değişim | Açıklama |
|---|---|---|
| `lib/repos/patternsSupabaseRepo.ts` | **YENİ** | Async CRUD; Supabase client kullanır |
| `lib/repos/patternsLocalRepo.ts` | **KALDIRILIR** | Import'lar kesildikten sonra silinebilir |
| `lib/repos/patternsRepo.ts` | **KALDIRILIR** | Sadece mock seed döndürüyor, gerek kalmaz |
| `spa-pages/Desenler.tsx` | DEĞİŞİR | `list()` async, loading state eklenir |
| `components/PatternDetailPanel.tsx` | DEĞİŞİR | Tüm `update()` çağrıları async olur |
| `components/desen/PatternModal.tsx` | DEĞİŞİR | `upsertPatternFromForm()` async olur |
| `components/desen/MovementModal.tsx` | DEĞİŞİR | Pattern güncellemesi async'e alınır |
| `app/(panel)/desenler/[id]/page.tsx` | DEĞİŞİR | `get()` async olur; server component tercih edilmeli |
| `mock/patterns.ts` | **DOKUNULMAZ** | Sadece one-time migration kaynağı |

---

## 5. Riskler

### 🔴 Yüksek Risk

**R1 — Seed + Override merge mimarisi kırılabilir**  
`patternsLocalRepo` seed'i override ile merge ediyor. Supabase'e geçince artık tek kaynak
Supabase olmalı. Migration sırasında seed verisi Supabase'e bir kez insert edilmeli,
sonrasında mock'a hiç bakılmamalı.  
**Tehlike:** Yarım bırakılırsa çift kaynak (mock + Supabase) oluşur, çakışmalar olur.

**R2 — ID tutarlılığı kritik**  
`movementsLocalRepo` pattern ID'ye göre dinamik key üretiyor (`movements:{patternId}`).  
Depo, Dokuma, Boyahane modülleri taşınmadan da pattern ID'leri değişirse bu modüllerdeki
tüm veri ilişkileri kırılır.  
**Kural:** Migration sırasında mevcut `id` değerleri birebir korunmalı.

**R3 — Görseller base64 olarak localStorage / DB'de**  
`imageDigital` / `imageFinal` alanları base64 string tutuyor.  
Supabase Database'e base64 koymak performans ve maliyet açısından yanlış.  
Supabase Storage'a taşınmalı ama bu ayrı bir phase gerektiriyor.  
**Geçici çözüm:** İlk etapta `text` olarak sakla, görsel migration ikinci faza bırak.

### 🟡 Orta Risk

**R4 — PatternDetailPanel çok sayıda sync repo çağrısı içeriyor**  
Büyük bir dosya (800+ satır). Not, metre, lojistik, varyant, arşiv, silme — her biri
ayrı `patternsLocalRepo.*()` çağrısı yapıyor. Hepsinin async'e alınması ve loading/error
state eklenmesi gerekiyor. Gözden kaçan bir çağrı eski repo'dan okumaya devam edebilir.

**R5 — `app/(panel)/desenler/[id]/page.tsx` Next.js route**  
Bu sayfanın server-side mi client-side mi veri çekeceği netleştirilmeli.  
Server component ise `lib/supabase/server.ts` kullanılmalı, `client.ts` değil.

**R6 — `weavingLocalRepo.ts` patternsLocalRepo'ya bağımlı**  
`weavingLocalRepo` pattern listesi için `patternsLocalRepo.list()` çağırıyor.  
Patterns Supabase'e geçince bu çağrı async olacak ama weaving henüz taşınmayacak.  
**Geçici çözüm:** Weaving modülü için compat shim bırakılabilir veya patterns'in
sync mock versiyonu geçici olarak tutulabilir.

### 🟢 Düşük Risk

**R7 — localStorage temizliği**  
Migration tamamlandıktan sonra `patterns:overrides` key'i localStorage'da kalır.  
Uygulamayı bozmaz ama gereksiz veri bırakır. Cleanup mekanizması planlanabilir.

---

## Mevcut Supabase Altyapısı

- `lib/supabase/client.ts` → `createBrowserClient()` — browser-side
- `lib/supabase/server.ts` → server-side client
- `lib/supabase/middleware.ts` → auth middleware
- `lib/supabase/profile-access.ts` → kullanıcı profil erişimi
- `.env.local` → `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Auth altyapısı tamamen hazır. Yeni repo dosyası `createClient()` import ederek
doğrudan kullanabilir.

---

## Önerilen Migration Sırası

```
Faz 1: Desenler (patterns)          ← şu an
Faz 2: Movements (hareketler)       ← pattern'e bağımlı, sonraki
Faz 3: Depo + DepoTransactions      ← pattern ID'leri hazır olduktan sonra
Faz 4: Customers                    ← bağımsız, istenen zaman
Faz 5: Orders                       ← customer + pattern bağımlı
Faz 6: Dyehouse + Weaving          ← en karmaşık, en sona
```
