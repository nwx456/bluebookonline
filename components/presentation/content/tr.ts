import type { CompareSide, CoreFeature, TeamPhoto } from "../types";

export const SLIDE_COUNT = 5;

export const SLIDE_ONE_LINER = "Sınav gününüzü, gerçekleşmeden önce yaşayın.";

export const SLIDE_TWO_SENTENCE = {
  base: "Öğrencilere gerçek test günü deneyimi sunarken, AP okullarının kaynaklarını dijitalleştirmesine ve öğrencilerini en iyi şekilde hazırlamasına da yardımcı oluyoruz.",
  sentence1Template:
    "Bluebook arayüzünde AP ve Digital SAT pratiğini dijitalleştiriyoruz; okullar PDF'lerini yükleyip sınıflarına atayabiliyor. Platformumuz şu an {users} kayıtlı kullanıcı, {attempts} tamamlanan deneme ve {pdfs} yüklenen PDF ile canlıda.",
  sentence2:
    "Hedefimiz net: Her öğrenci gerçek sınav arayüzünde pratik yapsın; her AP okulu da kaynaklarını dijital ortama taşıyıp öğrencilerini sınav gününe en iyi şekilde hazırlasın.",
  institutionalHighlight:
    "AP okulları deneme kaynaklarını dijitalleştirip sınıflarına atayabilir; öğretmenler tamamlanma analitiğiyle öğrencilerini sınav gününe en iyi şekilde hazırlayabilir.",
};

export const SLIDE_PROBLEM = {
  headline: "Sorun",
  statement:
    "Öğrenciler statik PDF'lerle hazırlanıyor; okullar ise kaynaklarını dijital Bluebook ortamına taşıyamıyor — sınav günü hem öğrenci hem kurum zaman, para ve stres kaybediyor.",
  schoolPainLine:
    "AP okulları, elindeki PDF ve deneme kaynaklarını öğrencilerine dijital ve ölçülebilir şekilde ulaştıramıyor.",
  costs: [
    {
      label: "Zaman",
      detail:
        "Öğrenci arayüze alışırken; okul materyalleri elle dağıtırken kaybedilen saatler",
    },
    {
      label: "Para",
      detail: "Pahalı prep araçları + okulun dijital altyapı eksikliği",
    },
    {
      label: "Stres",
      detail: "Öğrenci sınav günü sürpriz yaşar; okul öğrencilerini yeterince hazırlayamaz",
    },
  ],
};

export const SLIDE_SOLUTION = {
  headline: "Çözüm ve Ürün",
  institutionalCallout:
    "AP okullarına: Kaynaklarınızı dijitalleştirin, öğrencilerinizi Bluebook deneyiminde en iyi şekilde hazırlayın.",
  interfaceImage: "/presentation/interface/ap-statistics.png",
  oldWay: {
    title: "Eski Yol",
    items: [
      "Statik PDF indirip kağıt üzerinde çözme",
      "Gerçek Bluebook arayüzünü yansıtmayan basit quiz siteleri",
      "Pahalı tutoring merkezleri ve prep kitapları",
    ],
  } satisfies CompareSide,
  newWay: {
    title: "Yeni Yol",
    items: [
      "PDF yükle → Gemini 2.5 Flash ile soru çıkarma",
      "Bluebook split-panel arayüzünde pratik",
      "Anında AI puanlama, açıklama ve cache'li cevap anahtarı",
      "AP okulları: PDF yükle, sınıf kodu paylaş, atama ver, tamamlanma analitiğini izle",
    ],
  } satisfies CompareSide,
  coreFeatures: [
    {
      title: "Bluebook Deneyimi",
      description: "Split-panel MCQ, SAT adaptive modüller, Desmos hesap makinesi",
      detail: "24 AP + 3 Digital SAT formatı",
    },
    {
      title: "AI PDF Pipeline",
      description: "Gemini 2.5 Flash birincil; Claude yedek; cevap anahtarı kalıcı cache",
      detail: "Next.js 16 API routes + Supabase Storage",
    },
    {
      title: "Okul ve Öğretmen Paneli",
      description:
        "Sınıf oluşturma, MCQ/FRQ atama, roster ve tamamlanma analitiği — okul kaynaklarını dijitalleştirir",
      detail: "/teacher · sınıf kodu · atama paneli",
    },
  ] satisfies CoreFeature[],
  teacherBadge: "Öğretmen sınıf paneli",
};

export const SLIDE_TEAM = {
  headline: "Ekip",
  name: "Ayberk Tanrıverdi",
  role: "Kurucu / Full-Stack Geliştirici",
  website: "ayberktanriverdi.com",
  websiteUrl: "https://ayberktanriverdi.com",
};

/** 4×3 grid — full coverage, light tilt per photo, no overlap. */
export const TEAM_COLLAGE_PHOTOS: TeamPhoto[] = [
  { src: "/presentation/team/school-campus.png", alt: "Okul kampüsü", rotate: -4 },
  { src: "/presentation/team/tennis-racket.png", alt: "Tenis raketi", rotate: 5, objectPosition: "center center" },
  { src: "/presentation/team/rubik-cube.png", alt: "Rubik küp", rotate: -5 },
  { src: "/presentation/team/piano.png", alt: "Piyano çalarken", rotate: 4 },
  { src: "/presentation/team/whiteboard-presentation.png", alt: "Tahtada sunum", rotate: 3 },
  {
    src: "/presentation/team/ayberk-suit.png",
    alt: "Resmi portre",
    rotate: -3,
    objectPosition: "center 15%",
  },
  { src: "/presentation/team/tedx-youth.png", alt: "TEDx Youth @ TEVITOL", rotate: -4 },
  { src: "/presentation/team/camera-ice.png", alt: "Fotoğraf makinesi", rotate: 5 },
  { src: "/presentation/team/robotics-duo.png", alt: "Robotik yarışması", rotate: 6 },
  { src: "/presentation/team/robotics-group-selfie.png", alt: "FIRST robotik takım selfie", rotate: -5 },
  {
    src: "/presentation/team/ayberk-profile-tevitOL.png",
    alt: "Ayberk Tanrıverdi",
    rotate: 4,
    objectPosition: "center 20%",
  },
  { src: "/presentation/team/robotics-team-banner.png", alt: "Robotik takım grubu", rotate: -4 },
];

export function formatPitchSentence1(users: number, attempts: number, pdfs: number): string {
  return SLIDE_TWO_SENTENCE.sentence1Template
    .replace("{users}", users.toLocaleString("tr-TR"))
    .replace("{attempts}", attempts.toLocaleString("tr-TR"))
    .replace("{pdfs}", pdfs.toLocaleString("tr-TR"));
}
