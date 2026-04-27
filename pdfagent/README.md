# pdfagent

Bağımsız PDF ingestion ajanı + admin paneli.
Ana siteden tamamen yalıtık çalışır; sadece `/api/upload/analyze` endpoint'ine HTTP üzerinden konuşur.

## Mimari

- **Admin paneli (Next.js)** → port `3100`
- **Worker (BullMQ)** → ayrı node process
- **Postgres** → kendi DB'si (ana site DB'sine dokunmaz)
- **Redis** → kuyruk
- Ana site (`bluebookonline`) → port `3000`, sadece dış HTTP API gibi tüketilir

## Ne Yapar

- Curated allowlist'teki domainlerden PDF link toplar (`Discover`)
- Kuyrukla indirir + güvenlik doğrulaması yapar (`Fetch`)
- Admin manuel onayla ana siteye yükler (`Upload`)
- Manuel URL girişi de destekler (panelden)

## Hızlı Başlangıç

```bash
cd pdfagent
cp .env.example .env
# .env içindeki ADMIN_INIT_*, JWT_SECRET, MAIN_APP_URL, MAIN_APP_BOT_EMAIL'i ayarla

docker compose up -d        # postgres + redis
npm install
npm run migrate
npm run seed:admin
npm run worker              # 1. terminal — kuyruk worker'ı
npm run dev                 # 2. terminal — admin panel
```

Panel: http://localhost:3100  
Login: `.env` içindeki `ADMIN_INIT_EMAIL` / `ADMIN_INIT_PASSWORD`

## Akış

1. **Sources** sayfasında `domain` ekle (örn. `openstax.org`) ve seed URL'leri yapıştır.
2. "Run Discover" butonu (veya cron) ile PDF linkleri kuyruğa düşer.
3. Fetch worker indirir → magic/mime/size/sha256 doğrular → `pending_review`.
4. **Documents** sayfasında her PDF'i incele → "Approve" → upload kuyruğuna girer.
5. Upload worker ana sitenin `/api/upload/analyze` endpoint'ine multipart upload yapar.

Manuel olarak doğrudan PDF URL'i de yapıştırılabilir (Documents → "URL Ekle").

## Güvenlik

- Sadece statik allowlist'teki domainler (`*.edu`, `*.gov`, `openstax.org`, `ocw.mit.edu` vb.) eklenebilir
- `robots.txt` saygısı (User-agent: \*) ve redirect zinciri max 3
- Magic bytes (`%PDF-`) + EOF marker + mime + max boyut (varsayılan 50MB)
- SHA256 dedup (aynı dosya 2 kez yüklenmez)
- Idempotency-key + retry/backoff + dead-letter queue
- Ana siteye dakikada en fazla `UPLOAD_RATE_PER_MIN` istek (Redis token bucket)
- Audit log her admin aksiyonunu kaydeder

## Ana Site Entegrasyonu (Bot Hesabı)

Ana sitenin upload endpoint'i `userEmail` zorunlu olduğu için, ana sitede bir kez **bot kullanıcı**
açılır ve bu email `MAIN_APP_BOT_EMAIL` olarak `.env`'e yazılır. Ana site kodunda hiçbir değişiklik yapılmaz.

İki yol var, birini seç:

### A) Normal signup ile (önerilen)

Ana siteye normal kayıt akışıyla bir hesap aç (ör. `pdf-bot@yourdomain.com`). OTP doğrulamasını yap. Sonra:

```sql
-- Ana sitenin Supabase SQL editöründe doğrulama:
SELECT email FROM usertable WHERE email = 'pdf-bot@yourdomain.com';
```

### B) Doğrudan SQL ile (Supabase Dashboard)

Ana sitenin upload endpoint'i sadece `usertable`'da satır olup olmadığına bakar:

```sql
INSERT INTO usertable (email, username)
VALUES ('pdf-bot@yourdomain.com', 'pdfbot')
ON CONFLICT (email) DO NOTHING;
```

Sonra `MAIN_APP_BOT_EMAIL=pdf-bot@yourdomain.com` olarak `.env` dosyasına yaz.

## Smoke Test

`MAIN_APP_BOT_EMAIL` ayarlandıktan ve worker + ana site çalıştıktan sonra:

```bash
# 1) panelden URL ekleyebilirsin (en kolay yol):
#    http://localhost:3100/documents → "URL Ekle"
#
# 2) ya da CLI ile:
npm run smoke -- "https://example.edu/path/to/file.pdf" AP_PSYCHOLOGY
```

Beklenen status akışı:

`discovered → downloading → pending_review → (admin onay) → queued_upload → uploading → uploaded`

`uploaded` olduğunda ana sitede yeni bir `pdf_uploads` ve ilgili `questions` satırları oluşur, ve doc satırında `exam_id` görünür.

## Dosya Yapısı

```
pdfagent/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── dashboard/page.tsx
│   ├── documents/page.tsx + DocumentsClient.tsx
│   ├── sources/page.tsx + SourcesClient.tsx
│   └── api/
│       ├── auth/login + logout
│       ├── documents (POST + [id]/{approve|reject|retry})
│       ├── sources (GET + POST + [id])
│       ├── jobs/trigger
│       └── dashboard/stats
├── components/Shell.tsx
├── lib/
│   ├── allowlist.ts        # statik allowlist + robots.txt
│   ├── audit.ts
│   ├── auth.ts             # bcrypt + JWT cookie
│   ├── db.ts               # pg pool
│   ├── logger.ts           # JSON structured log
│   ├── queue.ts            # BullMQ queues + Redis
│   ├── rateLimiter.ts
│   ├── storage.ts          # storage/pdfs/<id>.pdf
│   ├── subjects.ts         # ana site subject keys
│   ├── types.ts
│   ├── uploadClient.ts     # ana siteye multipart POST
│   └── validator.ts        # magic/mime/size/sha256
├── workers/
│   ├── discover.ts
│   ├── fetch.ts
│   ├── upload.ts
│   └── index.ts            # BullMQ worker entry + cron schedule
├── scripts/
│   ├── migrate.ts
│   ├── seed-admin.ts
│   └── smoke-test.ts
├── middleware.ts           # JWT route koruma
├── docker-compose.yml      # postgres + redis
├── Dockerfile
├── next.config.ts
├── tsconfig.json
├── package.json
└── .env.example
```

## Operasyon Notları

- Worker process'i `npm run worker` ile çalıştırılır; panelden bağımsız.
- Cron varsayılan 6 saatte 1 (her enabled source için ayrı job).
- DLQ: `removeOnFail: 1000` → BullMQ default; başarısız iş 1000 kayda kadar tutulur.
- Storage: ham PDF'ler `pdfagent/storage/pdfs/<documentId>.pdf` altında. Upload sonrası tutulur (audit ve retry için).
- Auto-approve kapalı. Açmak için `.env` içinde `AUTO_APPROVE=true`.
