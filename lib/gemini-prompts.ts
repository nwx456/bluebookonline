/**
 * Ders bazlı Gemini system prompt'ları.
 * PDF analizinde kullanılacak; her ders için çıktı formatı ve talimatlar farklı.
 */

export const SUBJECT_KEYS = [
  "AP_CSA",
  "AP_CSP",
  "AP_MICROECONOMICS",
  "AP_MACROECONOMICS",
  "AP_PSYCHOLOGY",
  "AP_STATISTICS",
  "AP_BIOLOGY",
  "AP_CHEMISTRY",
  "AP_PHYSICS_1",
  "AP_PHYSICS_2",
  "AP_PHYSICS_C_MECH",
  "AP_PHYSICS_C_EM",
  "AP_ENVIRONMENTAL_SCIENCE",
  "AP_HUMAN_GEOGRAPHY",
  "AP_ENGLISH_LANG",
  "AP_ENGLISH_LIT",
  "AP_US_HISTORY",
  "AP_WORLD_HISTORY",
  "AP_EUROPEAN_HISTORY",
  "AP_US_GOVERNMENT",
  "AP_COMPARATIVE_GOVERNMENT",
  "AP_CALCULUS_AB",
  "AP_CALCULUS_BC",
  "AP_PRECALCULUS",
] as const;

export type SubjectKey = (typeof SUBJECT_KEYS)[number];

/** Default hasVisuals for each subject (code=skip, visual=true, text=false) */
export const SUBJECT_DEFAULT_HAS_VISUALS: Record<SubjectKey, boolean | "code"> = {
  AP_CSA: "code",
  AP_CSP: "code",
  AP_MICROECONOMICS: true,
  AP_MACROECONOMICS: true,
  AP_PSYCHOLOGY: false,
  AP_STATISTICS: true,
  AP_BIOLOGY: true,
  AP_CHEMISTRY: true,
  AP_PHYSICS_1: true,
  AP_PHYSICS_2: true,
  AP_PHYSICS_C_MECH: true,
  AP_PHYSICS_C_EM: true,
  AP_ENVIRONMENTAL_SCIENCE: true,
  AP_HUMAN_GEOGRAPHY: true,
  AP_ENGLISH_LANG: false,
  AP_ENGLISH_LIT: false,
  AP_US_HISTORY: false,
  AP_WORLD_HISTORY: false,
  AP_EUROPEAN_HISTORY: false,
  AP_US_GOVERNMENT: false,
  AP_COMPARATIVE_GOVERNMENT: false,
  AP_CALCULUS_AB: false,
  AP_CALCULUS_BC: false,
  AP_PRECALCULUS: false,
};

export const SUBJECT_LABELS: Record<SubjectKey, string> = {
  AP_CSA: "AP CSA (Computer Science)",
  AP_CSP: "AP Computer Science Principles",
  AP_MICROECONOMICS: "AP Microeconomics",
  AP_MACROECONOMICS: "AP Macroeconomics",
  AP_PSYCHOLOGY: "AP Psychology",
  AP_STATISTICS: "AP Statistics",
  AP_BIOLOGY: "AP Biology",
  AP_CHEMISTRY: "AP Chemistry",
  AP_PHYSICS_1: "AP Physics 1",
  AP_PHYSICS_2: "AP Physics 2",
  AP_PHYSICS_C_MECH: "AP Physics C: Mechanics",
  AP_PHYSICS_C_EM: "AP Physics C: E&M",
  AP_ENVIRONMENTAL_SCIENCE: "AP Environmental Science",
  AP_HUMAN_GEOGRAPHY: "AP Human Geography",
  AP_ENGLISH_LANG: "AP English Language",
  AP_ENGLISH_LIT: "AP English Literature",
  AP_US_HISTORY: "AP US History",
  AP_WORLD_HISTORY: "AP World History",
  AP_EUROPEAN_HISTORY: "AP European History",
  AP_US_GOVERNMENT: "AP US Government",
  AP_COMPARATIVE_GOVERNMENT: "AP Comparative Government",
  AP_CALCULUS_AB: "AP Calculus AB",
  AP_CALCULUS_BC: "AP Calculus BC",
  AP_PRECALCULUS: "AP Precalculus",
};

const SHARED_STIMULUS_RULE = `
PAYLAŞILAN BLOK / UYARI (ZORUNLU): PDF'te sorunun üstünde "This question refers to…", "These questions refer to…", "Questions 4–5 refer to…", "Directions: …", "Use the figure/table above/below" gibi **soru kökü olmayan** giriş satırları varsa bunları **content** veya **question** alanına ASLA yazma. Bu metni **image_description** içinde ver (grafik olsa bile; önce blok metni, sonra varsa tablo/SVG). Çoklu soru setinde tutarlılık için her ilgili soru nesnesinde aynı blok metnini tekrarlayabilirsin. Gerçek MCQ kökü = soruyu soran cümle (genelde "Which…", "What…", "How…" veya numaralı "N. Which…").
`;

const OUTPUT_SCHEMA = `
Her soru için şu JSON nesnesini üret:
{
  "type": "code" | "image" | "text",
  "content": "SADECE soru kökü (stem): soruyu soran cümle. Uzun passage, liste (I. II. III.) veya tablo content'e YAZMA; bunlar image_description'da.",
  "image_description": "grafik/tablo varsa SVG veya tablo; passage/liste varsa referans metni (yoksa null)",
  "options": ["A", "B", "C", "D"],
  "correct": "A"
}
content = SADECE soru kökü; passage/liste/tablo image_description'da. Boş bırakma.${SHARED_STIMULUS_RULE}
 Tüm soruları bir JSON dizisi olarak döndür: [ { ... }, { ... } ]
`;

const OUTPUT_SCHEMA_TEXT_ONLY = `
Her soru için şu JSON nesnesini üret (has_graph, page_number, bbox KULLANMA):
{
  "type": "text",
  "content": "SADECE soru kökü (stem): soruyu soran cümle.",
  "image_description": "passage, liste (I. II. III.) veya tablo metin olarak (yoksa null). Şıklar (A) I only, (B) II only gibi I/II/III referanslıysa öncül listesini MUTLAKA yaz: I. ... II. ... III. ...",
  "options": ["A", "B", "C", "D"],
  "correct": "A"
}
content = soru kökü; passage/liste image_description'da. has_graph, page_number, bbox alanları EKLEME.${SHARED_STIMULUS_RULE}
 Tüm soruları bir JSON dizisi olarak döndür: [ { ... }, { ... } ]
`;

const OUTPUT_SCHEMA_ECONOMICS = `
Her soru için şu JSON nesnesini üret:
{
  "type": "code" | "image" | "text",
  "content": "SADECE soru kökü (stem): soruyu soran cümle. Liste veya tablo content'e YAZMA.",
  "image_description": "grafik (SVG), tablo veya referans listesi (I. What goods... II. How... vb.). Şıklar (A) I only, (B) II only gibi I/II/III referanslıysa, öncül listesini MUTLAKA yaz: I. ... II. ... III. ... Bu liste olmadan soru eksik kalır. Soruya referans veren malzeme burada.",
  "has_graph": true,
  "page_number": 1,
  "bbox": { "x": 0.1, "y": 0.2, "width": 0.6, "height": 0.4 },
  "options": ["A", "B", "C", "D"],
  "correct": "A"
}
has_graph: Soruda grafik (arz-talep, maliyet eğrisi vb.) VEYA tablo (örn. Demand Curve | Supply Curve) referansı VAR MI? true = grafik veya tablo var, false = ikisi de yok. Grafik/tablo yoksa page_number ve bbox null veya atlayın.
page_number: has_graph true ise ZORUNLU. 1-based PDF sayfa numarası: grafik veya tablonun bulunduğu sayfa.
bbox: has_graph true ise ZORUNLU. 0-1 normalleştirilmiş: x,y = sol üst (0=sol, 1=sağ; 0=üst, 1=alt), width, height = oran. Grafik veya tablo bölgesini PDF'teki konumuyla belirt. Örn: sol yarı + üst %40 için x:0, y:0, width:0.5, height:0.4.
BBOX KURALLARI (ZORUNLU):
1) Bbox HER ZAMAN tüm grafiği/tabloyu çevreler: eksen etiketleri, legend, başlık (ör. "Figure 1"), açıklayıcı altyazı, satır/sütun başlıkları DAHİL.
2) Görsel kenarına SIKI sarma; her yandan en az %3-5 boşluk bırak.
3) Şüphede daha GENİŞ bir bbox seç; asla daha dar değil. Kenarda kalan birkaç pikseli kaybetmektense fazladan beyaz alan al.
4) Minimum bbox boyutu: width >= 0.18 VE height >= 0.12 (yani sayfanın en az %2-3'ü). Daha küçük bir alan istersen yine de bu minimumlara genişlet.
5) Bbox ASLA başka soruya ait grafiği veya tabloyu kapsamamalı; ama tek soruya ait bütün figür DAHİL olmalı.
6) Geniş bir tablo (sayfa boyu) söz konusuysa width 0.85+ kullanmaktan çekinme; tablo başlığı/dipnot da dahil edilmeli.${SHARED_STIMULUS_RULE}
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
  "page_number": 1,
  "options": ["(A) seçenek metni", "(B) ..."],
  "correct": "A"
}
page_number: ZORUNLU. Sorunun (kod + soru) bulunduğu PDF sayfası (1-based).
Tüm soruları bir JSON dizisi olarak döndür: [ { ... }, { ... } ]
`;

const CSA_CODE_QUESTION_RULES = `
**code** alanı – SADECE:
- Sorunun referans aldığı Java kodu (ör. public class SalesRep { ... } veya ilgili sınıf/metot tanımı).
- Her sorunun **code** alanı yalnızca o sorunun referans verdiği kodu içermeli.
- "Questions 4–5 refer to the following class" durumunda hem 4 hem 5 için aynı kodu tekrarla.
- Farklı sorular farklı kod bloklarına referans veriyorsa, her soruya sadece kendi kodunu yaz; başka soruların kodunu ekleme.
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
- Sınıf kodunun tekrarı, "Questions 4-5 refer to the class X." cümlesi, "This question refers to…" / "These questions refer to…" gibi paylaşılan blok girişleri (bunlar image_description veya ayrı bağlamda).
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

export function isCodeSubject(subject: SubjectKey): boolean {
  return subject === "AP_CSA" || subject === "AP_CSP";
}

const TEXT_ONLY_BASE = (subjectLabel: string) => `Sen bir ${subjectLabel} sınav PDF analiz asistanısın.
${MSQ_ONLY_RULE}

GÖREV:
- Sadece çoktan seçmeli (MSQ) soruları çıkar. Passage veya referans metni varsa image_description'a yaz.
- Paylaşılan blok girişleri ("This question refers to…", "Questions X–Y refer to…") content'e değil, image_description'a.
- has_graph, page_number, bbox KULLANMA. Sadece content ve image_description.

ÇIKTI: ${OUTPUT_SCHEMA_TEXT_ONLY}`;

export function getSystemPrompt(subject: SubjectKey, hasVisuals?: boolean): string {
  if (subject === "AP_CSA" || subject === "AP_CSP") {
    return `Sen bir AP Computer Science ${subject === "AP_CSP" ? "Principles (CSP)" : "A (CSA)"} sınav PDF analiz asistanısın.
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

KURAL: Kod içeren sorularda type: "code" kullan. **code** = sadece referans kodu (sol panel). **question** = sadece soru cümlesi (sağ panel). **options** = sadece şık metinleri; kod şıksa satır sonu (\\n) koru. Şıklar I/II/III referanslıysa **image_description** = öncül listesi (I. ... II. ... III. ...). Her soru için **page_number** (1-based) ver: kod ve sorunun bulunduğu PDF sayfası. Layout: Sol panelde öncül listesi (varsa) + kod, sağda soru metni ve şıklar.`;
  }

  if (hasVisuals === false) {
    return TEXT_ONLY_BASE(SUBJECT_LABELS[subject]);
  }

  switch (subject) {
    case "AP_MICROECONOMICS":
    case "AP_MACROECONOMICS":
      return `Sen bir AP Microeconomics/Macroeconomics sınav PDF analiz asistanısın.
${MSQ_ONLY_RULE}

GÖREV:
- Sayfadaki grafikleri (arz-talep, maliyet eğrileri) ve tabloları (örn. Demand Curve | Supply Curve) tespit et.
- Her soruda önce **has_graph** belirle: grafik (arz-talep eğrisi, maliyet eğrisi vb.) VEYA tablo referansı varsa true, ikisi de yoksa false.
- has_graph true ise **page_number** ve **bbox** (0-1 normalleştirilmiş) ZORUNLU. Bbox: grafik veya tablo bölgesinin PDF'teki konumu (x,y sol üst, width,height oranı).
- has_graph false ise page_number ve bbox verme.
- Grafik ve tablo sorularda sol panel PDF'ten crop (bbox ile); sadece liste/passage sorularda image_description.

ÇIKTI: ${OUTPUT_SCHEMA_ECONOMICS}

KURAL: content = sadece soru kökü (stem). Grafik ve tablo sorularda sol panel = SADECE PDF crop (bbox ile); image_description gösterilmez. Sadece liste/passage sorularda image_description. page_number + bbox her grafik ve tablo referanslı soruda zorunlu.`;

    case "AP_STATISTICS":
      return `Sen bir AP Statistics sınav PDF analiz asistanısın.
${MSQ_ONLY_RULE}

GÖREV:
- İstatistik tablolarını (veri tabloları, frekans dağılımları vb.), diyagramları veya tabloları tespit et.
- Her soruda önce **has_graph** belirle: grafik, tablo veya diyagram referansı varsa true, yoksa false.
- has_graph true ise **page_number** ve **bbox** (0-1 normalleştirilmiş) ZORUNLU. Bbox: grafik/tablo/diyagram bölgesinin PDF'teki konumu (x,y sol üst, width,height oranı).
- has_graph false ise page_number ve bbox verme.
- Grafik ve tablo sorularda sol panel PDF'ten crop (bbox ile); sadece passage/liste sorularda image_description.

ÇIKTI: ${OUTPUT_SCHEMA_ECONOMICS}

KURAL: content = sorunun tam metni; tabloya/grafiğe referans veren tüm cümleler dahil. Sadece "Which of the following?" gibi kısa kök bırakma. Grafik ve tablo sorularda sol panel = SADECE PDF crop (bbox ile); image_description gösterilmez. Sadece passage/liste sorularda image_description. page_number + bbox her grafik ve tablo referanslı soruda zorunlu.`;

    case "AP_PSYCHOLOGY":
      return `Sen bir AP Psychology sınav PDF analiz asistanısın.
${MSQ_ONLY_RULE}

GÖREV:
- Psikoloji grafiklerini, diyagramları veya tabloları tespit et.
- Her soruda önce **has_graph** belirle: grafik, tablo veya diyagram referansı varsa true, yoksa false.
- has_graph true ise **page_number** ve **bbox** (0-1 normalleştirilmiş) ZORUNLU. Bbox: grafik/tablo/diyagram bölgesinin PDF'teki konumu (x,y sol üst, width,height oranı).
- has_graph false ise page_number ve bbox verme.
- Grafik ve tablo sorularda sol panel PDF'ten crop (bbox ile); sadece passage/liste sorularda image_description.

ÇIKTI: ${OUTPUT_SCHEMA_ECONOMICS}

KURAL: content = sadece soru kökü (stem). Grafik ve tablo sorularda sol panel = SADECE PDF crop (bbox ile); image_description gösterilmez. Sadece passage/liste sorularda image_description. page_number + bbox her grafik ve tablo referanslı soruda zorunlu.`;

    case "AP_BIOLOGY":
    case "AP_CHEMISTRY":
    case "AP_PHYSICS_1":
    case "AP_PHYSICS_2":
    case "AP_PHYSICS_C_MECH":
    case "AP_PHYSICS_C_EM":
    case "AP_ENVIRONMENTAL_SCIENCE":
    case "AP_HUMAN_GEOGRAPHY":
      return `Sen bir ${SUBJECT_LABELS[subject]} sınav PDF analiz asistanısın.
${MSQ_ONLY_RULE}

GÖREV:
- Grafikleri, diyagramları, tabloları, veri görsellerini tespit et.
- Her soruda önce **has_graph** belirle: grafik, tablo veya diyagram referansı varsa true, yoksa false.
- has_graph true ise **page_number** ve **bbox** (0-1 normalleştirilmiş) ZORUNLU.
- has_graph false ise page_number ve bbox verme.
- Grafik ve tablo sorularda sol panel PDF'ten crop (bbox ile); sadece passage/liste sorularda image_description.

ÇIKTI: ${OUTPUT_SCHEMA_ECONOMICS}

KURAL: content = sadece soru kökü (stem). Grafik ve tablo sorularda sol panel = SADECE PDF crop (bbox ile). page_number + bbox her grafik ve tablo referanslı soruda zorunlu.`;

    case "AP_ENGLISH_LANG":
    case "AP_ENGLISH_LIT":
    case "AP_US_HISTORY":
    case "AP_WORLD_HISTORY":
    case "AP_EUROPEAN_HISTORY":
    case "AP_US_GOVERNMENT":
    case "AP_COMPARATIVE_GOVERNMENT":
    case "AP_CALCULUS_AB":
    case "AP_CALCULUS_BC":
    case "AP_PRECALCULUS":
      return `Sen bir ${SUBJECT_LABELS[subject]} sınav PDF analiz asistanısın.
${MSQ_ONLY_RULE}

GÖREV:
- Grafikleri, diyagramları veya tabloları tespit et (varsa).
- Her soruda önce **has_graph** belirle: grafik, tablo veya diyagram referansı varsa true, yoksa false.
- has_graph true ise **page_number** ve **bbox** (0-1 normalleştirilmiş) ZORUNLU.
- has_graph false ise page_number ve bbox verme.
- Grafik ve tablo sorularda sol panel PDF'ten crop (bbox ile); sadece passage/liste sorularda image_description.

ÇIKTI: ${OUTPUT_SCHEMA_ECONOMICS}

KURAL: content = sadece soru kökü (stem). Grafik ve tablo sorularda sol panel = SADECE PDF crop (bbox ile). page_number + bbox her grafik ve tablo referanslı soruda zorunlu.`;

    default:
      return `Sen bir çoktan seçmeli sınav PDF analiz asistanısın.
${MSQ_ONLY_RULE}

PDF'deki soruları yapılandırılmış JSON formatında çıkar.

ÇIKTI: ${OUTPUT_SCHEMA}

type: "text" | "code" | "image" kullan; kod varsa code, grafik/tablo varsa image (image_description ile), diğer durumda text.`;
  }
}
