# PDF extraction – teknik notlar

Bu dokümanda PDF’ten soru ayıklama (parsing) için kullanılacak teknikler ve ortam değişkenleri özetleniyor.

---

## 1. Ortam değişkeni (.env)

PDF analizi için **Google Gemini API** kullanılacak. `.env` dosyasına ekleyin:

```env
# Google AI – PDF soru ayıklama (Gemini 1.5 Flash)
GEMINI_API_KEY=your_gemini_api_key_here
```

API anahtarını [Google AI Studio](https://aistudio.google.com/apikey) üzerinden alabilirsiniz.

---

## 2. Kullanılacak model ve kütüphane

- **Model:** Gemini 1.5 Flash (PDF ve uzun metin için uygun, hızlı).
- **Node.js SDK:** `@google/generative-ai` (npm).

Kurulum:

```bash
npm install @google/generative-ai
```

---

## 3. Gemini’ye gönderilecek talimat (parsing stratejisi)

PDF yüklendikten sonra Gemini’ye şu yapıda bir prompt gönderilecek:

**Görev:** PDF’i analiz et; çoktan seçmeli soruları aşağıdaki JSON formatında çıkar.

**Çıktı formatı (her soru için):**

```json
{
  "type": "code" | "image" | "text",
  "content": "soru metni veya kod bloğu",
  "image_description": "grafik varsa detaylı betimlemesi (yoksa null)",
  "options": ["A", "B", "C", "D"],
  "correct": "A"
}
```

**Kurallar:**

- **AP CSA (Computer Science):** Kod içeren kısımlar mutlaka `type: "code"` ve `content` içinde kod metni olarak verilecek.
- **AP Micro/Macroeconomics:** Grafik/diyagram içeren sorular `type: "image"`; grafiğin detaylı açıklaması `image_description` alanında metin olarak verilecek (SVG veya çok detaylı markdown tablo da talep edilebilir).
- Diğer dersler: Ağırlıklı olarak `type: "text"`; gerektiğinde `image` veya `code`.

**Not:** Gemini PDF’teki grafiği piksel olarak “kırpıp” kaydedemez; bu yüzden grafikler için ya **detaylı metin betimi** ya da Gemini’den ürettirilecek **SVG / markdown tablo** kullanılacak; böylece Bluebook tarzı arayüzde tutarlı görüntüleme sağlanacak.

---

## 4. Akış (planlanan)

1. Kullanıcı dashboard’da PDF seçer, ders tipini ve (isteğe bağlı) soru sayısını girer.
2. PDF dosyası sunucuya yüklenir (ileride Supabase Storage’a da yüklenebilir).
3. Sunucu tarafında PDF, base64 veya buffer olarak Gemini’ye gider (satır içi veya File API ile; bkz. Gemini dokümantasyonu).
4. Yukarıdaki prompt ile “soruları bu JSON formatında çıkar” isteği yapılır.
5. Dönen JSON parse edilir; sorular veritabanına (ör. `questions` tablosu, `pdf_uploads` ile ilişkili) kaydedilir.
6. Sınav görüntüleyici (`/exam/[id]`) ders tipine göre (AP CSA vs Economics) farklı layout kullanır:
   - **AP CSA:** Sol tarafta kod bloğu (Monaco veya syntax highlighting), sağda soru ve şıklar.
   - **AP Micro/Macro:** Sol tarafta grafik betimi/SVG/tablo, sağda soru ve şıklar.

---

## 5. Referanslar

- [Gemini API – Document understanding](https://ai.google.dev/gemini-api/docs/document-processing)
- [Gemini – PDF inline / File API](https://ai.google.dev/gemini-api/docs/document-processing?lang=node&hl=tr)
- PDF sayfa sınırı: örn. 50 MB veya 1.000 sayfa (Gemini kısıtlarına göre güncellenebilir).

Bu doküman, `.env` dosyasına `GEMINI_API_KEY` ekledikten ve backend’de Gemini entegrasyonu yazıldığında kullanılacak teknikleri tanımlar.
