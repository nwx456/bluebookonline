"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ERROR_NOTICE_MESSAGE } from "@/lib/error-notice-message";

type ErrorNoticeModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDismiss?: () => void;
  showRetry?: boolean;
  onRetry?: () => void;
};

export function ErrorNoticeModal({
  open,
  onOpenChange,
  onDismiss,
  showRetry = false,
  onRetry,
}: ErrorNoticeModalProps) {
  const handleDismiss = () => {
    onOpenChange(false);
    onDismiss?.();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Something went wrong</SheetTitle>
          <SheetDescription>{ERROR_NOTICE_MESSAGE}</SheetDescription>
        </SheetHeader>
        <SheetFooter className="flex-row gap-2 sm:justify-end">
          {showRetry && onRetry ? (
            <Button type="button" variant="outline" onClick={onRetry}>
              Try again
            </Button>
          ) : null}
          <Button type="button" onClick={handleDismiss}>
            OK
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
