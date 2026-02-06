"use client";

import type { ReviewStatus } from "@/features/lessons/lessonsTypes";

const STATUS_CONFIG: Record<
  ReviewStatus,
  { label: string; className: string }
> = {
  draft: { label: "Draft", className: "review-badge review-badge--draft" },
  pending_review: {
    label: "Pending Review",
    className: "review-badge review-badge--pending",
  },
  approved: {
    label: "Approved",
    className: "review-badge review-badge--approved",
  },
  rejected: {
    label: "Rejected",
    className: "review-badge review-badge--rejected",
  },
};

interface ReviewStatusBadgeProps {
  status: ReviewStatus;
}

export default function ReviewStatusBadge({ status }: ReviewStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return <span className={config.className}>{config.label}</span>;
}
