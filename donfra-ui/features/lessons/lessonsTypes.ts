// Types for lessons feature

export type ReviewStatus = 'draft' | 'pending_review' | 'approved' | 'rejected';

export interface LessonSummary {
  id: number;
  slug: string;
  title: string;
  isPublished: boolean;
  isVip: boolean;
  author?: string;
  publishedDate?: string;
  reviewStatus: ReviewStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Lesson {
  slug: string;
  title: string;
  markdown: string;
  excalidraw: any;
  videoUrl?: string;
  codeTemplate?: any;
  createdAt: string;
  updatedAt: string;
  isPublished: boolean;
  isVip: boolean;
  author?: string;
  publishedDate?: string;
  reviewStatus: ReviewStatus;
  submittedBy?: number;
  reviewedBy?: number;
  submittedAt?: string;
  reviewedAt?: string;
}

export interface LessonCreateData {
  slug: string;
  title: string;
  markdown: string;
  excalidraw: any;
  videoUrl?: string;
  codeTemplate?: any;
  isPublished?: boolean;
  isVip?: boolean;
  author?: string;
  publishedDate?: string;
}

export interface LessonUpdateData {
  title?: string;
  markdown?: string;
  excalidraw?: any;
  videoUrl?: string;
  codeTemplate?: any;
  isPublished?: boolean;
  isVip?: boolean;
  author?: string;
  publishedDate?: string;
}

export interface Pagination {
  currentPage: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Filters {
  search: string;
  sortBy: string;
  sortDesc: boolean;
}

export interface LessonsState {
  // List
  items: LessonSummary[];
  pagination: Pagination;
  filters: Filters;
  listLoading: boolean;
  listError: string | null;

  // Single lesson cache
  bySlug: Record<string, Lesson>;
  detailLoading: boolean;
  detailError: string | null;

  // Operation states
  saving: boolean;
  saveError: string | null;
  deleting: string | null;
  deleteError: string | null;

  // Review workflow
  submittingForReview: boolean;
  submitReviewError: string | null;
  reviewing: boolean;
  reviewError: string | null;
  pendingReviewItems: LessonSummary[];
  pendingReviewPagination: Pagination;
  pendingReviewLoading: boolean;
  pendingReviewError: string | null;
}
