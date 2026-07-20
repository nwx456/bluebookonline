import type { CompareSide, CoreFeature, TeamPhoto } from "../types";

export type PresentationContent = {
  slideOneLiner: string;
  slideOneTagline: string;
  slideTwoSentence: {
    pitchLabel: string;
    base: string;
    sentence1Template: string;
    sentence2: string;
    institutionalHighlight: string;
    statsUpdating: string;
  };
  slideProblem: {
    headline: string;
    statement: string;
    schoolPainLine: string;
    costs: { label: string; detail: string }[];
  };
  slideSolution: {
    headline: string;
    institutionalCallout: string;
    interfaceImage: string;
    interfaceImageAlt: string;
    oldWay: CompareSide;
    newWay: CompareSide;
    coreFeatures: CoreFeature[];
    teacherBadge: string;
    formatBadgeLabels: (apMcqCount: number, frqCount: number) => string[];
  };
  slideTeam: {
    headline: string;
    name: string;
    role: string;
    website: string;
    websiteUrl: string;
  };
  teamCollagePhotos: TeamPhoto[];
  ui: {
    back: string;
    next: string;
    backToAdmin: string;
    prevSlide: string;
    nextSlide: string;
    regionLabel: string;
    loading: string;
    slideProgress: (current: number, total: number) => string;
  };
  formatPitchSentence1: (users: number, attempts: number, pdfs: number) => string;
};
