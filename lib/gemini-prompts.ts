/**
 * Ders bazlı Gemini system prompt'ları.
 * PDF analizinde kullanılacak; her ders için çıktı formatı ve talimatlar farklı.
 */

export const SUBJECT_KEYS = [
  "AP_CSA",
  "AP_MICROECONOMICS",
  "AP_MACROECONOMICS",
  "AP_PSYCHOLOGY",
  "AP_STATISTICS",
] as const;

export type SubjectKey = (typeof SUBJECT_KEYS)[number];

const OUTPUT_SCHEMA = `
Her soru için şu JSON nesnesini üret:
{
  "type": "code" | "image" | "text",
  "content": "SADECE soru kökü (stem): soruyu soran cümle. Uzun passage, liste (I. II. III.) veya tablo content'e YAZMA; bunlar image_description'da.",
  "image_description": "grafik/tablo varsa SVG veya tablo; passage/liste varsa referans metni (yoksa null)",
  "options": ["A", "B", "C", "D"],
  "correct": "A"
}
content = SADECE soru kökü; passage/liste/tablo image_description'da. Boş bırakma. Tüm soruları bir JSON dizisi olarak döndür: [ { ... }, { ... } ]
`;

const OUTPUT_SCHEMA_ECONOMICS = `
Her soru için şu JSON nesnesini üret (grafikli sorularda sayfa numarası zorunlu):
{
  "type": "code" | "image" | "text",
  "content": "SADECE soru kökü (stem): soruyu soran cümle, örn. 'Which of the following constitute the fundamental questions every economic system must answer?' Liste (I. II. III. IV. V.) veya tablo verisi content'e YAZMA.",
  "image_description": "grafik (SVG), tablo (HTML veya pipe | col | formatında) veya referans listesi (I. What goods... II. How... vb.). Soruya referans veren tüm malzeme burada.",
  "page_number": 1,
  "options": ["A", "B", "C", "D"],
  "correct": "A"
}
content = SADECE soru kökü cümlesi (stem); maddeler/liste/tablo image_description'da olmalı. Boş bırakma.
page_number: Grafik veya tablo içeren her soruda zorunlu. 1-based PDF sayfa numarası: ilgili grafik veya tablo görselinin bulunduğu sayfa.
Tüm soruları bir JSON dizisi olarak döndür: [ { ... }, { ... } ]
`;

const OUTPUT_SCHEMA_CSA = `
Kod içeren her MSQ için şu JSON nesnesini üret:
{
  "type": "code",
  "code": "sadece sorunun referans aldığı Java kodu (sınıf tanımı vb.; girintiler korunmuş)",
  "question": "sadece çoktan seçmeli soru cümlesi (soru numarası + soru metni + 'Which replacement...' gibi)",
  "precondition": "optional; Precondition: ... ve Javadoc (/** ... @param ... @return ... */) metni. PDF'te kod bloğunun üstünde veya altında görünen, çoktan seçmeli soru kökü olmayan metin. Soru kökünü buraya koyma.",
  "content": "optional; use only if duplicating question for compatibility; otherwise omit or leave empty",
  "image_description": "optional; şıklar I, II, III'e referans veriyorsa (ör. (A) I only, (B) II only) öncül listesini buraya: I. İlk ifade. II. İkinci ifade. III. Üçüncü ifade. Kod yoksa null.",
  "options": ["(A) seçenek metni", "(B) ..."],
  "correct": "A"
}
Tüm soruları bir JSON dizisi olarak döndür: [ { ... }, { ... } ]
`;

const CSA_CODE_QUESTION_RULES = `
**code** alanı – SADECE:
- Sorunun referans aldığı Java kodu (ör. public class SalesRep { ... } veya ilgili sınıf/metot tanımı).
- Girintileri (indentation) koru.

**code** alanına ASLA EKLEME:
- Soru numarası ("4."), "Questions 4-5 refer to..." cümlesi.
- Soru cümlesi, Javadoc (soruyla ilgili metodun), "Which replacement for /* missing code */ is correct?" metni. Javadoc ve Precondition metnini **precondition** alanına koy.
- Şıklar (A-E) metni veya /* missing code */ içeren imza.
- code, sınıf/metot kapanan süslü parantez (}) ile bitmeli; ardına "Which...?", "What...?" veya soru cümlesi ekleme. Soru metni yalnızca **question** alanında olmalı.

**precondition** alanı (isteğe bağlı):
- "Precondition: ..." cümlesi ve metodun Javadoc'u (/** ... @param ... @return ... */). PDF'te kodun üstünde/altında görünüp soru kökü olmayan metin.

**question** alanı – SADECE:
- Çoktan seçmeli soru cümlesi (ör. "4. A client method, computeBonus, will return a salesRep bonus computed by multiplying his ytdSales by a percentage. Which replacement for /* missing code */ is correct?"). question alanını asla boş bırakma.

**question** alanına ASLA EKLEME:
- Sınıf kodunun tekrarı, "Questions 4-5 refer to the class X." cümlesi.
- Şık metinleri (A-E).

**options** dizisi:
- Her eleman sadece o şıkkın metni (ör. "(A) return s.getYtdSales() * percentage;").
- Şık kod içeriyorsa satır sonlarını ve girintileri koru (string içinde \\n kullan).
- Referans sınıf kodunu veya soru metnini options içine koyma; sadece seçenek metni.

**image_description** alanı (I, II, III referanslı sorularda ZORUNLU):
- Şıklar "(A) I only", "(B) II only", "(C) I and II only" gibi I, II, III'e referans veriyorsa, **image_description** alanına öncül listesini mutlaka yaz: "I. Birinci ifade veya açıklama. II. İkinci ifade. III. Üçüncü ifade."
- Bu listeyi question veya code alanına koyma; sadece image_description'a yaz.
- Kod varsa image_description öncül listesi, code Java kodu ile birlikte sol panelde gösterilir.
`;

const CSA_ONE_SHOT_EXAMPLE = `
Örnek (tam kopyalama değil, format referansı):
- "code": sadece "public class SalesRep { private int idNum; private String Name; private int ytdSales; SalesRep(int i, String n, int ytd) { ... } public int getYtdSales() { return ytdSales; } }"
- "question": sadece "4. A client method, computeBonus, will return a salesRep bonus computed by multiplying his ytdSales by a percentage. Which replacement for /* missing code */ is correct?"
- "options": ["(A) return s.getYtdSales() * percentage;", "(B) ...", ...]
`;

const MSQ_ONLY_RULE = `
ÖNEMLİ: Sadece **çoktan seçmeli soruları (MSQ)** çıkar. **Free-response (FRQ)** sorularını ve FRQ bölümlerindeki metni dahil etme; sadece MSQ bölümlerinden çıkar.
`;

export function getSystemPrompt(subject: SubjectKey): string {
  switch (subject) {
    case "AP_MICROECONOMICS":
    case "AP_MACROECONOMICS":
      return `Sen bir AP Microeconomics/Macroeconomics sınav PDF analiz asistanısın.
${MSQ_ONLY_RULE}

GÖREV:
- Sayfadaki grafikleri (arz-talep, maliyet eğrileri, vb.) tespit et.
- Grafiği sadece metinle betimlemek yerine, Bluebook stiline uygun temiz bir **tablo** veya **SVG kodu** olarak üret. Mümkünse SVG ile eksenleri, eğrileri ve etiketleri çiz.
- Çoktan seçmeli soruları ayıkla. **content** = SADECE soru kökü (örn. "Which of the following constitute the fundamental questions...?"). Liste (I. What goods... II. How...), tablo verisi veya grafik **image_description**'a: tablo (HTML veya | col | formatında), SVG veya madde listesi. Aynı metni hem content hem image_description'a yazma.
- Grafik **veya** tablo içeren her soruda **page_number** zorunlu: ilgili grafik/tablo görselinin bulunduğu PDF sayfası (1 tabanlı). Grafik sorularda mutlaka page_number verin; vermezseniz grafik ekranda görünmez.

ÇIKTI: ${OUTPUT_SCHEMA_ECONOMICS}

KURAL: content = sadece soru kökü (stem). image_description = grafik/tablo/liste (sol panel). page_number her grafik/tablolu soruda. Layout: sol panel = image_description, sağ panel = content.`;

    case "AP_CSA":
      return `Sen bir AP Computer Science A (CSA) sınav PDF analiz asistanısın.
${MSQ_ONLY_RULE}

GÖREV:
- Sadece çoktan seçmeli (MSQ) soruları ayıkla. "Unit", "Practice Exam", "Part A/B" gibi bölüm başlıklarında bile **sadece MSQ** çıkar; talimat paragraflarını veya "Consider the following…" gibi giriş cümlelerini tek başına soru olarak yazma.
- "Questions 4–5 refer to the following class" gibi durumda **her** soru (4 ve 5) için **ayrı** bir JSON nesnesi üret; her birinde aynı referans kodu tekrarlansın, soru metni sadece o soru numarasına ait olsun (4'ün sorusu 5'e karışmasın).
- PDF'teki soru sırasını koru; sayfa veya bölüm atlama. Çıktıyı tek bir JSON dizisi olarak, sırayla ver.
- "Free-response", "FRQ", "Write your solution" gibi ifadeler gördüğün bölümleri tamamen atla; sadece (A)(B)(C)(D) [ve E] şıkları olan soruları çıkar.
- Kod içeren her MSQ için **code** ve **question** alanlarını kesinlikle ayır; aynı içeriği her iki alana yazma.
- "Questions X–Y refer to the following class" gibi durumlarda: ortak kodu **her** X…Y sorusu için ayrı ayrı nesnede tekrarla (her soru kendi code + question + options nesnesine sahip olsun). Kod birden fazla sayfadaysa tamamını birleştirip tek blok olarak code alanına yaz.
- Her çoktan seçmeli soru için tam olarak bir JSON nesnesi üret; soru atlama veya birleştirme. Çıktı sadece JSON dizi olmalı, açıklama ekleme.

${CSA_CODE_QUESTION_RULES}

${CSA_ONE_SHOT_EXAMPLE}

ÇIKTI: ${OUTPUT_SCHEMA_CSA}

KURAL: Kod içeren sorularda type: "code" kullan. **code** = sadece referans kodu (sol panel). **question** = sadece soru cümlesi (sağ panel). **options** = sadece şık metinleri; kod şıksa satır sonu (\\n) koru. Şıklar I/II/III referanslıysa **image_description** = öncül listesi (I. ... II. ... III. ...). Layout: Sol panelde öncül listesi (varsa) + kod, sağda soru metni ve şıklar.`;

    case "AP_STATISTICS":
    case "AP_PSYCHOLOGY":
      return `Sen bir AP Statistics / AP Psychology sınav PDF analiz asistanısın.
${MSQ_ONLY_RULE}

GÖREV:
- İstatistik tablolarını veya psikoloji metinlerini **yapılandırılmış veri** olarak çıkar.
- **content** = SADECE soru kökü (stem). Uzun passage, liste veya tablo **image_description**'a koy; sol panelde gösterilecek.
- Çoktan seçmeli soruları ayıkla. Passage/liste/tablo image_description'da; soru cümlesi content'te.

ÇIKTI: ${OUTPUT_SCHEMA}

KURAL: content = sadece soru kökü. image_description = passage, tablo veya liste (sol sütun). Layout: sol = image_description, sağ = content + şıklar.`;

    default:
      return `Sen bir çoktan seçmeli sınav PDF analiz asistanısın.
${MSQ_ONLY_RULE}

PDF'deki soruları yapılandırılmış JSON formatında çıkar.

ÇIKTI: ${OUTPUT_SCHEMA}

type: "text" | "code" | "image" kullan; kod varsa code, grafik/tablo varsa image (image_description ile), diğer durumda text.`;
  }
}
