"use client";

import { useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { validateQuestionReportInput } from "@/lib/question-report-reasons";
import { QuestionReportButton } from "./QuestionReportButton";
import { QuestionReportModal } from "./QuestionReportModal";
import { ExamReportToast } from "./ExamReportToast";

const SUCCESS_MESSAGE =
  "Your report has been submitted. Thank you for your feedback! Our moderators will review it as soon as possible.";

type McqReportProps = {
  examKind?: "mcq";
  questionId: string;
  uploadId: string;
  attemptId: string;
  questionNumber: number;
};

type FrqReportProps = {
  examKind: "frq";
  frqQuestionId: string;
  frqUploadId: string;
  frqAttemptId: string;
  questionNumber: number;
  partLabel?: string;
};

type QuestionReportFlowProps = (McqReportProps | FrqReportProps) & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showButton?: boolean;
};

export default function QuestionReportFlow(props: QuestionReportFlowProps) {
  const { open, onOpenChange, showButton = false } = props;
  const [toastVisible, setToastVisible] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const submitReport = useCallback(
    async (payload: { reasonCodes: string[]; customNote: string }) => {
      const validation = validateQuestionReportInput({
        reasonCodes: payload.reasonCodes,
        customNote: payload.customNote,
      });

      if (!validation.ok) {
        setValidationError(validation.error);
        return;
      }

      setValidationError(null);
      onOpenChange(false);
      setToastVisible(true);

      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return;

        const body =
          props.examKind === "frq"
            ? {
                examKind: "frq" as const,
                frqQuestionId: props.frqQuestionId,
                frqUploadId: props.frqUploadId,
                frqAttemptId: props.frqAttemptId,
                questionNumber: props.questionNumber,
                partLabel: props.partLabel,
                reasonCodes: validation.reasonCodes,
                customNote: validation.customNote,
              }
            : {
                questionId: props.questionId,
                uploadId: props.uploadId,
                attemptId: props.attemptId,
                reasonCodes: validation.reasonCodes,
                customNote: validation.customNote,
              };

        void fetch("/api/questions/report", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        }).catch((err) => {
          console.error("Report submit failed:", err);
        });
      } catch (err) {
        console.error("Report submit error:", err);
      }
    },
    [onOpenChange, props]
  );

  if (process.env.NEXT_PUBLIC_QUESTION_REPORTS === "0") {
    return null;
  }

  return (
    <>
      {showButton ? <QuestionReportButton onClick={() => onOpenChange(true)} /> : null}
      <QuestionReportModal
        open={open}
        onClose={() => {
          onOpenChange(false);
          setValidationError(null);
        }}
        onSubmit={submitReport}
        error={validationError}
      />
      <ExamReportToast
        message={SUCCESS_MESSAGE}
        visible={toastVisible}
        onDismiss={() => setToastVisible(false)}
      />
    </>
  );
}
