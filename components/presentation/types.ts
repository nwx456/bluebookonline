export type PresentationStats = {
  registeredUsers: number;
  pendingRegistrations: number;
  pdfUploadsTotal: number;
  pdfPublished: number;
  pdfUnpublished: number;
  questionsTotal: number;
  questionsWithGraph: number;
  attemptsTotal: number;
  attemptsCompleted: number;
  attemptsInProgress: number;
  attemptAnswersTotal: number;
};

export const FALLBACK_STATS: PresentationStats = {
  registeredUsers: 323,
  pendingRegistrations: 0,
  pdfUploadsTotal: 0,
  pdfPublished: 0,
  pdfUnpublished: 0,
  questionsTotal: 0,
  questionsWithGraph: 0,
  attemptsTotal: 0,
  attemptsCompleted: 0,
  attemptsInProgress: 0,
  attemptAnswersTotal: 0,
};

export type SlideProps = {
  stats: PresentationStats;
  statsLoading: boolean;
};

export type CompareSide = {
  title: string;
  items: string[];
};

export type CoreFeature = {
  title: string;
  description: string;
  detail: string;
};

export type TeamPhoto = {
  src: string;
  alt: string;
  rotate?: number;
  objectPosition?: string;
};
