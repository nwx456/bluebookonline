import type { PresentationContent } from "./types";

const SLIDE_TWO_SENTENCE_EN = {
  pitchLabel: "Pitch",
  base: "We give students a real test-day experience while helping AP schools digitize their resources and prepare students as well as possible.",
  sentence1Template:
    "We digitize AP and Digital SAT practice in the Bluebook interface; schools upload PDFs and assign them to classes. The platform is live today with {users} registered users, {attempts} completed attempts, and {pdfs} uploaded PDFs.",
  sentence2:
    "Our goal is clear: every student practices in the real exam interface; every AP school moves resources online and prepares students for test day as well as possible.",
  institutionalHighlight:
    "AP schools can digitize practice resources and assign them to classes; teachers can track completion analytics and prepare students for test day as well as possible.",
  statsUpdating: "(updating…)",
};

export const PRESENTATION_CONTENT_EN: PresentationContent = {
  slideOneLiner: "Experience test day before it happens.",
  slideOneTagline: "AP Practice Exam Online — AP and Digital SAT practice in the Bluebook experience",
  slideTwoSentence: SLIDE_TWO_SENTENCE_EN,
  slideProblem: {
    headline: "The Problem",
    statement:
      "Students prepare with static PDFs; schools cannot move resources into a digital Bluebook environment — on test day, both students and institutions lose time, money, and peace of mind.",
    schoolPainLine:
      "AP schools cannot deliver their PDF and practice resources to students in a digital, measurable way.",
    costs: [
      {
        label: "Time",
        detail: "Hours lost while students adapt to the interface and schools distribute materials manually",
      },
      {
        label: "Money",
        detail: "Expensive prep tools plus schools lacking digital infrastructure",
      },
      {
        label: "Stress",
        detail: "Students face surprises on test day; schools cannot prepare them well enough",
      },
    ],
  },
  slideSolution: {
    headline: "Solution & Product",
    institutionalCallout:
      "For AP schools: digitize your resources and prepare students in the Bluebook experience.",
    interfaceImage: "/presentation/interface/ap-statistics.png",
    interfaceImageAlt: "AP Statistics exam interface in Bluebook style",
    oldWay: {
      title: "The Old Way",
      items: [
        "Download static PDFs and solve on paper",
        "Simple quiz sites that do not reflect the real Bluebook interface",
        "Expensive tutoring centers and prep books",
      ],
    },
    newWay: {
      title: "The New Way",
      items: [
        "Upload PDF → extract questions with Gemini 2.5 Flash",
        "Practice in the Bluebook split-panel interface",
        "Instant AI scoring, explanations, and cached answer keys",
        "AP schools: upload PDFs, share class codes, assign work, track completion analytics",
      ],
    },
    coreFeatures: [
      {
        title: "Bluebook Experience",
        description: "Split-panel MCQ, SAT adaptive modules, Desmos calculator",
        detail: "24 AP + 3 Digital SAT formats",
      },
      {
        title: "AI PDF Pipeline",
        description: "Gemini 2.5 Flash primary; Claude fallback; persistent answer-key cache",
        detail: "Next.js 16 API routes + Supabase Storage",
      },
      {
        title: "School & Teacher Panel",
        description:
          "Create classes, assign MCQ/FRQ, roster and completion analytics — digitizes school resources",
        detail: "/teacher · class code · assignment panel",
      },
    ],
    teacherBadge: "Teacher class panel",
    formatBadgeLabels: (apMcqCount, frqCount) => [
      `${apMcqCount} AP MCQ subjects`,
      "3 Digital SAT formats",
      `${frqCount} digital FRQ courses`,
      "Teacher class panel",
    ],
  },
  slideTeam: {
    headline: "Team",
    name: "Ayberk Tanrıverdi",
    role: "Founder / Full-Stack Developer",
    website: "ayberktanriverdi.com",
    websiteUrl: "https://ayberktanriverdi.com",
  },
  teamCollagePhotos: [
    { src: "/presentation/team/school-campus.png", alt: "School campus", rotate: -4 },
    {
      src: "/presentation/team/tennis-racket.png",
      alt: "Tennis racket",
      rotate: 5,
      objectPosition: "center center",
    },
    { src: "/presentation/team/rubik-cube.png", alt: "Rubik's cube", rotate: -5 },
    { src: "/presentation/team/piano.png", alt: "Playing piano", rotate: 4 },
    { src: "/presentation/team/whiteboard-presentation.png", alt: "Whiteboard presentation", rotate: 3 },
    {
      src: "/presentation/team/ayberk-suit.png",
      alt: "Formal portrait",
      rotate: -3,
      objectPosition: "center 15%",
    },
    { src: "/presentation/team/tedx-youth.png", alt: "TEDx Youth @ TEVITOL", rotate: -4 },
    { src: "/presentation/team/camera-ice.png", alt: "Camera", rotate: 5 },
    { src: "/presentation/team/robotics-duo.png", alt: "Robotics competition", rotate: 6 },
    {
      src: "/presentation/team/robotics-group-selfie.png",
      alt: "FIRST robotics team selfie",
      rotate: -5,
    },
    {
      src: "/presentation/team/ayberk-profile-tevitOL.png",
      alt: "Ayberk Tanrıverdi",
      rotate: 4,
      objectPosition: "center 20%",
    },
    { src: "/presentation/team/robotics-team-banner.png", alt: "Robotics team group", rotate: -4 },
  ],
  ui: {
    back: "Back",
    next: "Next",
    backToAdmin: "Return to admin panel",
    prevSlide: "Previous slide",
    nextSlide: "Next slide",
    regionLabel: "Investor presentation",
    loading: "Loading",
    slideProgress: (current, total) => `Slide ${current} / ${total}`,
  },
  formatPitchSentence1: (users, attempts, pdfs) =>
    SLIDE_TWO_SENTENCE_EN.sentence1Template
      .replace("{users}", users.toLocaleString("en-US"))
      .replace("{attempts}", attempts.toLocaleString("en-US"))
      .replace("{pdfs}", pdfs.toLocaleString("en-US")),
};
