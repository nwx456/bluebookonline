# Bluebook Online — Proje Dökümantasyonu

## Genel Bakış

**Bluebook Online**, College Board'un resmi "Bluebook" dijital sınav deneyimini simüle eden, AP (Advanced Placement) sınavlarına yönelik bir online pratik platformudur. Kullanıcılar kendi PDF soru kitapçıklarını yükleyebilir; yapay zeka bu PDF'leri soruya dönüştürür, öğrenci sınavı çözer, anında puanlama alır ve yanlış yaptığı soruları AI ile açıklatabilir.

**Canlı adres:** https://apbluebookonline.com

---

## Mimari

```
Next.js 16 (App Router)
├── Frontend:  React 19 (Client Components ağırlıklı)
├── Backend:   Next.js API Routes (server-side, all /api/*)
├── Database:  Supabase (PostgreSQL + Auth + Storage)
└── AI:        Google Gemini 2.5 Flash (+ opsiyonel Anthropic Claude)
```

### İletişim Akışı

```
Kullanıcı (Tarayıcı)
    ↓ HTTP / Supabase anon client
Next.js API Routes
    ├── Supabase DB  (service_role)
    ├── Supabase Auth (admin SDK)
    ├── Supabase Storage (upload / signed URL)
    ├── Google Gemini 2.5 Flash (PDF + prompt)
    └── Anthropic Claude Sonnet (opsiyonel fallback)
```

### E-posta (transactional + admin toplu)

- **Kod:** `lib/mail` birleşik gönderim; `lib/nodemailer.ts` OTP ve kişisel broadcast şablonlarını dışa aktarır.
- **Sağlayıcı:** `MAIL_PROVIDER` ile `resend` | `smtp` | `gmail` veya otomatik seçim (önce `RESEND_API_KEY`, sonra `SMTP_HOST`, sonra Gmail).
- **Kimden adres:** `MAIL_FROM` (tam RFC), veya `MAIL_FROM_NAME` + `MAIL_FROM_EMAIL` / `GMAIL_USER`.
- **Resend:** `RESEND_API_KEY` + panelde domain doğrulama; `MAIL_FROM_EMAIL` doğrulanmış domainden olmalı.
- **SMTP:** `SMTP_HOST`, `SMTP_PORT` (varsayılan 587), `SMTP_USER`, `SMTP_PASS`, isteğe bağlı `SMTP_SECURE=true` (465).
- **Admin toplu gönderim:** `docs/schema_mail_ops.sql` ile `admin_mail_log` ve `outbound_email_jobs` tablolarını oluşturun.
- **Hız limiti (isteğe bağlı):** `ADMIN_MAIL_DAILY_RECIPIENT_CAP`, `ADMIN_MAIL_HOURLY_RECIPIENT_CAP` (0 = kapalı).
- **Kuyruk:** `ADMIN_MAIL_JOB_THRESHOLD` (varsayılan 50) üzeri alıcıda job kuyruğu + `202`; worker: `POST /api/internal/mail-worker` header `x-mail-worker-secret: MAIL_WORKER_SECRET`. Üretimde `NEXT_PUBLIC_BASE_URL` ve `MAIL_WORKER_SECRET` ile `after()` kısmi işler; uzun kuyruk için periyodik Cron ile aynı endpoint çağrılabilir.
- **Env özeti:** `RESEND_API_KEY`, `SMTP_*`, `GMAIL_*`, `MAIL_PROVIDER`, `MAIL_FROM*`, `ADMIN_MAIL_*`, `MAIL_WORKER_SECRET`, `MAIL_WORKER_BATCH_SIZE`.

---

## Desteklenen AP Dersleri (24 ders)

| Kod | Ders |
|-----|------|
| `AP_CSA` | AP Computer Science A |
| `AP_CSP` | AP Computer Science Principles |
| `AP_MICROECONOMICS` | AP Microeconomics |
| `AP_MACROECONOMICS` | AP Macroeconomics |
| `AP_CALCULUS_AB` | AP Calculus AB |
| `AP_CALCULUS_BC` | AP Calculus BC |
| `AP_PRECALCULUS` | AP Precalculus |
| `AP_STATISTICS` | AP Statistics |
| `AP_PHYSICS_1` | AP Physics 1 |
| `AP_PHYSICS_2` | AP Physics 2 |
| `AP_PHYSICS_C_MECH` | AP Physics C: Mechanics |
| `AP_PHYSICS_C_EM` | AP Physics C: E&M |
| `AP_CHEMISTRY` | AP Chemistry |
| `AP_BIOLOGY` | AP Biology |
| `AP_ENGLISH_LANG` | AP English Language |
| `AP_ENGLISH_LIT` | AP English Literature |
| `AP_US_HISTORY` | AP US History |
| `AP_WORLD_HISTORY` | AP World History |
| `AP_EURO_HISTORY` | AP European History |
| `AP_GOV_US` | AP US Government |
| `AP_GOV_COMP` | AP Comparative Government |
| `AP_HUMAN_GEO` | AP Human Geography |
| `AP_PSYCH` | AP Psychology |
| `AP_SPANISH` | AP Spanish Language |

> Kaynak: `lib/gemini-prompts.ts` → `SUBJECT_KEYS`, `SUBJECT_LABELS`, `SUBJECT_DEFAULT_HAS_VISUALS`

---

## Proje Yapısı

```
app/
├── (auth)/
│   ├── login/           # Giriş sayfası + layout
│   ├── signup/          # Kayıt sayfası + layout
│   └── verify-otp/      # OTP doğrulama sayfası
├── api/
│   ├── auth/
│   │   ├── login/       # POST — oturum aç
│   │   ├── signup/      # POST — kayıt + OTP gönder
│   │   ├── verify-otp/  # POST — OTP doğrula + user oluştur
│   │   └── clean-email/ # POST — e-posta temizle (geliştirici)
│   ├── upload/
│   │   ├── analyze/     # POST — PDF → AI → sorular
│   │   └── [id]/
│   │       ├── route.ts        # GET signed URL / DELETE sınav
│   │       ├── publish/        # PATCH — yayın durumu
│   │       ├── save-graph/     # POST — grafik PNG kaydet
│   │       └── save-table/     # POST — tablo PNG kaydet
│   ├── exam/
│   │   ├── start/       # POST — deneme başlat
│   │   ├── answer/      # POST — cevap kaydet (upsert)
│   │   ├── complete/    # POST — sınavı bitir + puanlama
│   │   ├── explain/     # POST — AI soru açıklama
│   │   └── attempt/[attemptId]/  # GET detay / DELETE sil
│   ├── exams/
│   │   ├── published/   # GET — herkese açık sınavlar
│   │   ├── recent/      # GET — son 3 deneme
│   │   └── wrong-answers/  # GET — yanlış cevaplar (reserved)
│   └── admin/
│       └── clear-graphs/  # POST — grafik cache'i temizle
├── dashboard/           # Dashboard sayfası (korumalı)
├── exam/[id]/           # Sınav alma sayfası
│   ├── page.tsx
│   ├── FullPageModal.tsx
│   ├── PdfPageView.tsx
│   ├── TableImageView.tsx
│   └── ZoomableImagePanel.tsx
├── about/               # Hakkında sayfası
├── icon.png             # Favicon (Next.js file convention)
├── globals.css          # Tailwind v4 global stiller
└── layout.tsx           # Root layout + metadata + JSON-LD

lib/
├── gemini-prompts.ts    # AI prompt'lar + subject tanımları
├── ai-solve-prompts.ts  # Cevap anahtarı batch prompt'ları
├── otp-store.ts         # OTP üretimi
├── supabase/            # Client / server / admin factory'ler
└── utils.ts             # cn() utility (clsx + tailwind-merge)

components/
├── HeaderNav.tsx        # Global navigasyon
└── ui/
    └── OtpInput.tsx     # 4 haneli OTP input bileşeni

public/
├── appicon.png          # Logo kaynağı
└── og-image.png         # Open Graph görseli (1200×630)

docs/
├── schema_page_number.sql   # questions.page_number migrasyonu
└── schema_precondition.sql  # questions.precondition_text migrasyonu
```

---

## Veritabanı Şeması (Supabase PostgreSQL)

### `usertable`
| Kolon | Tip | Açıklama |
|-------|-----|----------|
| `email` | text (PK) | Kullanıcı e-posta adresi |
| `password` | text | bcrypt hash |
| `username` | text (unique) | Görünen kullanıcı adı |

### `pending_registrations`
| Kolon | Tip | Açıklama |
|-------|-----|----------|
| `email` | text | Kayıt bekleyen kullanıcı |
| `password_hash` | text | Geçici parola |
| `username` | text | Kullanıcı adı |
| `code` | text | 4 haneli OTP |
| `expires_at` | timestamp | 10 dakika TTL |

### `pdf_uploads`
| Kolon | Tip | Açıklama |
|-------|-----|----------|
| `id` | uuid (PK) | Upload ID |
| `user_email` | text | Sahibi |
| `filename` | text | Orijinal dosya adı |
| `storage_path` | text | Supabase Storage yolu |
| `subject` | text | AP ders kodu |
| `original_text` | text | AI ham çıktısı (kırpılmış) |
| `is_published` | boolean | Herkese açık mı? |
| `created_at` | timestamp | Yükleme zamanı |

### `questions`
| Kolon | Tip | Açıklama |
|-------|-----|----------|
| `id` | uuid (PK) | Soru ID |
| `upload_id` | uuid (FK) | `pdf_uploads.id` |
| `question_number` | int | Soru sırası |
| `question_text` | text | Soru metni |
| `passage_text` | text | Okuma parçası (varsa) |
| `precondition_text` | text | Ön koşul metin |
| `option_a`…`option_e` | text | Çoktan seçmeli şıklar |
| `correct_answer` | text | Doğru şık (AI veya PDF'den) |
| `image_url` | text | Grafik/tablo PNG URL'i |
| `has_graph` | boolean | Görsel var mı? |
| `page_number` | int | PDF sayfa numarası |
| `bbox` | jsonb | Görsel koordinatı `{x, y, w, h}` |

### `attempts`
| Kolon | Tip | Açıklama |
|-------|-----|----------|
| `id` | uuid (PK) | Deneme ID |
| `user_email` | text | Sahibi |
| `upload_id` | uuid (FK) | `pdf_uploads.id` |
| `total_questions` | int | Toplam soru sayısı |
| `started_at` | timestamp | Başlama zamanı |
| `completed_at` | timestamp | Bitiş zamanı (null = devam ediyor) |
| `time_spent_seconds` | int | Harcanan süre |
| `correct_count` | int | Doğru sayısı |
| `incorrect_count` | int | Yanlış sayısı |
| `unanswered_count` | int | Boş sayısı |

### `attempt_answers`
| Kolon | Tip | Açıklama |
|-------|-----|----------|
| `attempt_id` | uuid (FK) | `attempts.id` |
| `question_id` | uuid (FK) | `questions.id` |
| `user_answer` | text | Kullanıcının seçtiği şık (A-E) |
| `is_flagged` | boolean | Gözden geçirmek üzere işaretli |
| `is_correct` | boolean | Doğru mu? |
| `ai_answer` | text | AI'nin o run için kullandığı cevap |
| `answered_at` | timestamp | Yanıt zamanı |

### Supabase Storage Bucket'ları
| Bucket | Yol | Açıklama |
|--------|-----|----------|
| `pdf_uploads` | `{uploadId}.pdf` | Sınav PDF dosyaları |
| `exam-graphs` | `{uploadId}/{questionId}.png` | Kesilen grafik/tablo PNG'leri |

---

## Kimlik Doğrulama (Auth) Akışı

```
1. Kayıt (POST /api/auth/signup)
   ├── usertable'da e-posta + username çakışması kontrolü
   ├── pending_registrations INSERT (4 hane OTP, 10 dk TTL)
   └── Gmail → Nodemailer ile OTP e-postası

2. OTP Doğrulama (POST /api/auth/verify-otp)
   ├── pending_registrations'da kod + süre kontrolü
   ├── supabase.auth.admin.createUser (email confirmed: true)
   ├── usertable INSERT (bcrypt hash)
   └── pending_registrations DELETE

3. Giriş (POST /api/auth/login)
   ├── supabase.auth.signInWithPassword
   └── access_token + refresh_token → client setSession

4. Oturum Kullanımı
   ├── API route'larında: Authorization: Bearer <access_token>
   └── Client: supabase.auth.getSession() → email + token
```

**Çift kullanıcı katmanı tasarım kararı:** Supabase Auth kullanıcı adı ve bcrypt hash saklamaz. `usertable` bu eksiklikleri kapatır. `/api/upload/analyze`, `usertable`'da kaydı olmayan kullanıcılara 403 döner — böylece yalnızca tam kayıt tamamlanmış kullanıcılar sınav yükleyebilir.

---

## PDF → Soru Dönüşüm Akışı (AI Pipeline)

```
PDF dosyası (max 50 MB)
    ↓ POST /api/upload/analyze
    ↓ usertable kontrolü (403 yoksa)
    ↓ Gemini 2.5 Flash
        ├── PDF inline base64 olarak gönderilir
        ├── System prompt: lib/gemini-prompts.ts → getSystemPrompt(subject, hasVisuals)
        │   ├── AP_CSA / AP_CSP: kod bloğu + CSA-specific JSON şeması
        │   └── Diğer dersler: standart MCQ JSON şeması
        └── Çıktı: JSON array (question_number, question_text, passage_text,
                              option_a..e, correct_answer, has_graph, page_number, bbox)
    ↓ Normalize + validate
    ↓ Supabase
        ├── pdf_uploads INSERT
        ├── Storage: {uploadId}.pdf yükle
        └── questions INSERT (toplu)
```

**Görsel İşleme:**
1. `has_graph: true` olan sorular için client, `page_number` + `bbox`'tan PDF bölgesini hesaplar
2. `html2canvas` ile DOM'dan PNG kesimi alınır
3. `POST /api/upload/[id]/save-graph` ile Storage'a yüklenir
4. `questions.image_url` güncellenir

**Claude Fallback:** `aiProvider=claude` gönderilirse Anthropic `claude-sonnet-4-20250514` kullanılır (aynı JSON şeması).

---

## Sınav Alma Akışı (End-to-End)

```
1. Sayfa Yüklenme — /exam/[id]
   ├── Supabase anon client: pdf_uploads + questions çek
   ├── Owner veya is_published kontrolü
   └── GET /api/upload/[id] → signed PDF URL (1 saat geçerli)

2. Sınav Başlatma
   └── POST /api/exam/start → attemptId döner

3. Soru Çözme (loop)
   ├── Cevap seç → POST /api/exam/answer (upsert, debounced)
   ├── İşaretle (flag for review) → is_flagged: true
   ├── Şık silme (eliminate) → client state
   ├── Highlight + not alma → client state
   └── Client-side sayaç (setInterval)

4. Tamamlama
   └── POST /api/exam/complete
       ├── Cevap anahtarı eksik sorular varsa → Gemini batch solve
       │   ├── buildSolvePromptWithOptionalPdf (lib/ai-solve-prompts.ts)
       │   ├── has_graph olan sorular için PDF attachment (max 20 MB)
       │   └── AI cevapları questions.correct_answer'a yazılır (kalıcı)
       ├── attempt_answers.is_correct yeniden hesaplanır
       ├── Yanıtsız sorular için attempt_answers INSERT
       └── attempts UPDATE (correct_count, incorrect_count, unanswered_count, time_spent_seconds)

5. Sonuç Ekranı
   ├── Yüzde, doğru/yanlış/boş breakdown
   ├── Her soru için kullanıcı/doğru cevap karşılaştırması
   └── POST /api/exam/explain → AI açıklama (soru başına)
```

**Hesap Makinesi:** `CALCULATOR_ALLOWED_SUBJECTS` listesindeki derslerde (Calculus, Statistics, Physics vb.) sınav sırasında ekran hesap makinesi açılır.

**Review Modu:** Tamamlanmış deneme `?reviewAttemptId=<id>` ile tekrar açılabilir; `GET /api/exam/attempt/[id]` tüm cevap detayını döner.

---

## AI Özellikleri

| Özellik | Model | Endpoint | Açıklama |
|---------|-------|----------|----------|
| PDF → Soru çıkarma | Gemini 2.5 Flash | `POST /api/upload/analyze` | PDF'i okuyup MCQ JSON üretir |
| Cevap anahtarı üretme | Gemini 2.5 Flash | `POST /api/exam/complete` | Eksik correct_answer'ları batch doldurur |
| Soru açıklama (tutor) | Gemini 2.5 Flash | `POST /api/exam/explain` | Neden o şık doğru, detaylı açıklama |
| Fallback analiz | Claude Sonnet | `POST /api/upload/analyze` | Gemini başarısız olursa devreye girer |

**Cevap Anahtarı Persistence Avantajı:**
Gemini'nin ürettiği doğru cevaplar `questions.correct_answer` kolonuna kalıcı olarak yazılır. Aynı sınavı çözen sonraki kullanıcılar veya aynı kullanıcının ikinci denemesi için AI maliyeti sıfırdır; cevap zaten veritabanında mevcuttur.

---

## Dashboard Özellikleri

### Son Denemeler (Recent Exams)
- `GET /api/exams/recent` → son **3** tamamlanmış deneme (limit sabit)
- Kompakt kart: yüzde skoru, doğru/toplam, ders adı, tarih
- Karta tıklayınca **Yanlış Cevaplar** paneli grid'in altında genişler
- Her yanlış soru için: kullanıcı cevabı vs doğru cevap tablosu
- **AI Açıklama** butonu → `POST /api/exam/explain` ile anlık açıklama
- **Sil** (çöp kutusu) → `DELETE /api/exam/attempt/[id]` — sadece `attempts` + `attempt_answers` silinir, PDF ve sorular korunur

### Sınavlarım (My Exams)
- Kullanıcının tüm yüklediği PDF'lerin listesi
- Ders filtresine göre filtreleme
- **Yayınla / Özel** toggle → `PATCH /api/upload/[id]/publish`
- **Sınava Başla** linki → `/exam/[id]`
- **Sil** → `DELETE /api/upload/[id]` (PDF + tüm ilişkili veri cascade)

### PDF Yükleme
- Drag & drop veya dosya seçici; max **50 MB**
- Ders seçimi (24 AP dersi dropdown)
- Soru sayısı girişi
- `hasVisuals` checkbox — kod dersleri (CSA, CSP) için gizlenir
- `AI Provider` seçimi (UI şu an Gemini sabitliyor)

---

## Herkese Açık Ana Sayfa

- `GET /api/exams/published` → is_published=true olan tüm sınavlar
- Ders filtreleme
- "Çöz" butonu: giriş yapılmamışsa `/login`'e yönlendir
- Collapsible bölümler: Nasıl Çalışır, Uyarılar, Dersler, SSS

---

## Arayüz Tasarımı (UI)

### Teknoloji Seçimleri
- **Tailwind CSS v4** — `@import "tailwindcss"` ile, `@theme inline` ile özel tokenlar
- **Next.js App Router** — her sayfa kendi layout'una sahip
- **Lucide React** — tüm ikonlar
- **`cn()` utility** — `clsx` + `tailwind-merge` birleşimi (`lib/utils.ts`)
- **`next/font/google`** — Inter font, CSS değişkeni `--font-inter`

### Tasarım Prensipleri

**Bluebook Benzeri Deneyim:**
Gerçek College Board Bluebook arayüzünü taklit eder. Sınav ekranında sol panel (PDF/passage) + sağ panel (sorular) split layout; `leftPanelPercent` state ile sürüklenebilir bölücü.

**Sınav Sırasında Minimal Dikkat Dağıtıcı:**
Sticky header sadece gerekli bilgileri gösterir (soru sayacı, bayraklı sorular, süre, tamamla butonu). Gereksiz nav/menü yok.

**Client-Side State Yönetimi:**
Büyük ölçüde `"use client"` — sınav sayfası 200+ satır state barındırır. SSR bu use case için avantaj sağlamadığından CSR tercih edildi.

**PDF Render:**
`pdfjs-dist` + `dynamic(..., { ssr: false })` — Node.js'te `canvas` modülü gereksiz; sadece client'ta yüklenir.

**Grafik Yakalama:**
`html2canvas` → DOM üzerindeki PDF render alanından canvas → base64 PNG → Storage.

### Renk Sistemi
| Kullanım | Tailwind sınıfı |
|----------|-----------------|
| Primary (buton, link) | `blue-600` / `blue-700` |
| Nötr arka plan | `gray-50` / `gray-100` |
| Doğru cevap | `green-600` / `green-50` |
| Yanlış cevap | `red-600` / `red-50` |
| İşaretli soru | `yellow-400` / `amber-50` |
| Border default | `gray-200` |

---

## API Rotaları Tam Listesi

### Auth
| Method | Route | Auth | Açıklama |
|--------|-------|------|----------|
| `POST` | `/api/auth/signup` | — | E-posta + username + şifre; OTP gönder |
| `POST` | `/api/auth/verify-otp` | — | OTP doğrula; Supabase user + usertable oluştur |
| `POST` | `/api/auth/login` | — | signInWithPassword; token döndür |
| `POST` | `/api/auth/clean-email` | — | E-posta ile ilgili tüm veriyi sil (geliştirici) |

### Upload
| Method | Route | Auth | Açıklama |
|--------|-------|------|----------|
| `POST` | `/api/upload/analyze` | usertable | PDF → AI → sorular; Storage PDF yükle |
| `GET` | `/api/upload/[id]` | Bearer | Signed PDF URL (1 saat) |
| `DELETE` | `/api/upload/[id]` | Bearer (owner) | Sınav + tüm ilişkili veri sil |
| `PATCH` | `/api/upload/[id]/publish` | Bearer (owner) | is_published güncelle |
| `POST` | `/api/upload/[id]/save-graph` | Bearer | Grafik PNG kaydet → image_url güncelle |
| `POST` | `/api/upload/[id]/save-table` | Bearer | Tablo PNG kaydet → image_url güncelle |

### Exam Lifecycle
| Method | Route | Auth | Açıklama |
|--------|-------|------|----------|
| `POST` | `/api/exam/start` | — | Attempt row oluştur; attemptId döndür |
| `POST` | `/api/exam/answer` | — | attempt_answers upsert; is_correct hesapla |
| `POST` | `/api/exam/complete` | — | Eksik cevapları AI ile doldur; skoru kaydet |
| `POST` | `/api/exam/explain` | — | Gemini tutor: cevabı açıkla |
| `GET` | `/api/exam/attempt/[id]` | Bearer (owner) | Completed attempt detayı |
| `DELETE` | `/api/exam/attempt/[id]` | Bearer (owner) | Attempt + cevaplar sil |

### Listeler
| Method | Route | Auth | Açıklama |
|--------|-------|------|----------|
| `GET` | `/api/exams/published` | — | Herkese açık sınavlar (subject filtresi) |
| `GET` | `/api/exams/recent` | Bearer | Son 3 completed attempt |
| `GET` | `/api/exams/wrong-answers` | Bearer | Yanlış cevaplar (reserved — UI'da henüz kullanılmıyor) |

### Admin
| Method | Route | Auth | Açıklama |
|--------|-------|------|----------|
| `POST` | `/api/admin/clear-graphs` | Secret header | exam-graphs bucket'ını temizle |

---

## Ortam Değişkenleri

| Değişken | Kullanım | Zorunlu |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client-side anon key | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin işlemler | ✅ |
| `GEMINI_API_KEY` | Google Gemini API | ✅ |
| `GEMINI_MODELS` | Fallback zinciri (CSV, örn. `gemini-2.5-flash,gemini-1.5-flash,gemini-1.5-pro`) | Opsiyonel |
| `GEMINI_MODEL` | Tek model zorunlu (fallback devre dışı) | Opsiyonel |
| `ANTHROPIC_API_KEY` | Claude Sonnet fallback | Opsiyonel |
| `GMAIL_USER` | OTP e-posta gönderimi | ✅ |
| `GMAIL_APP_PASSWORD` | Gmail uygulama şifresi | ✅ |
| `NEXT_PUBLIC_BASE_URL` | SEO / sitemap base URL | ✅ |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | Search Console doğrulama | Opsiyonel |
| `CLEAR_GRAPHS_SECRET` | Admin endpoint güvenliği | Opsiyonel |

---

## Güvenlik

- **Bearer token doğrulaması:** Kullanıcıya özel tüm API route'larında `Authorization: Bearer <access_token>` kontrolü
- **Sahiplik kontrolü:** Kritik endpoint'lerde `user_email === attempt.user_email / upload.user_email` eşleşmesi
- **Yayın kapısı:** `is_published=false` sınav sadece sahibi tarafından erişilebilir (PDF URL, start, graph)
- **Middleware yok:** Koruma API katmanında + client-side redirect ile sağlanıyor
- **Supabase RLS:** Supabase Dashboard'da tanımlanmalı (repo içinde migration dosyası yok)
- **Boyut limitleri:** Analiz için max 50 MB PDF; Gemini attachment için max 20 MB

---

## Temel Teknik Kararlar

| Karar | Neden |
|-------|-------|
| Gemini model fallback zinciri | 429/500/timeout alındığında otomatik olarak bir sonraki modele geçer (`2.5-flash → 2.5-flash-lite → 1.5-flash → 1.5-pro`). Ortak helper `lib/gemini-client.ts` üzerinden çağrılır; `GEMINI_MODELS` env ile özelleştirilebilir |
| Dual user store (Auth + `usertable`) | Supabase Auth kullanıcı adı ve bcrypt hash saklayamaz; `usertable` bu eksikliği kapatır |
| Service role in API routes | RLS karmaşıklığından kaçınmak; server route'ların tamamı güvenilir servis rolüyle çalışır |
| AI cevap persistence (`questions.correct_answer`) | Bir kez çözülen sorular kalıcı olarak yazılır; sonraki denemeler sıfır AI maliyeti öder |
| CSR ağırlıklı mimari | Sınav sayfası 200+ satır state yönetiyor; SSR bu case için anlamlı avantaj sağlamıyor |
| `pdfjs-dist` + `ssr: false` | Node.js ortamında canvas bağımlılığı gereksiz; client-only yükleme daha temiz |
| Subject-aware prompts (`lib/gemini-prompts.ts`) | Tek kaynak: prompt, UI etiketi, görsel bayrağı hepsi aynı dosyada; tutarsızlık riski yok |
| Answer key önce `questions`'da yaz | Hem maliyet optimizasyonu hem de farklı kullanıcıların aynı sınavı tekrar AI'a sormasını önler |

---

## Key Dependencies

| Paket | Versiyon | Kullanım |
|-------|----------|----------|
| `next` | 16.1.6 | Framework |
| `react` | 19.2.3 | UI |
| `typescript` | 5 | Tip güvenliği |
| `@supabase/supabase-js` | latest | Database + Auth + Storage |
| `@google/generative-ai` | latest | Gemini API |
| `@anthropic-ai/sdk` | latest | Claude API |
| `bcryptjs` | latest | Parola hash |
| `nodemailer` | latest | OTP e-posta |
| `pdfjs-dist` | latest | PDF render |
| `html2canvas` | latest | DOM → PNG |
| `lucide-react` | latest | İkon seti |
| `clsx` | latest | Conditional class |
| `tailwind-merge` | latest | Class merge |
| `tailwindcss` | 4 | CSS framework |

---

## Sınırlamalar ve Bilinen Notlar

- `GET /api/exams/wrong-answers` endpoint'i implement edilmiş ancak mevcut UI'da kullanılmıyor; dashboard kendi wrong-answer listesini `GET /api/exam/attempt/[id]` üzerinden oluşturuyor.
- Supabase RLS politikaları kaynak kodda yer almıyor; Supabase Dashboard'da ayrıca yapılandırılmalı.
- Sınav süresi client-side `setInterval` ile tutulur; sekme kapatılıp açılırsa sayaç sıfırlanabilir.
- `pending_registrations`'da `password_hash` kolonu adına rağmen OTP süresi içinde plaintext parola da tutulur (Supabase Auth `createUser` için kullanılıyor); OTP doğrulandıktan sonra bu row silinir.

---

*Bu döküman `app/`, `lib/`, `components/`, `public/` dizinleri ve tüm API route'ları analiz edilerek oluşturulmuştur. Son güncelleme: Nisan 2026.*
