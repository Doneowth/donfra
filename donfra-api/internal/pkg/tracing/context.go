package tracing

import (
	"context"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

const tracerName = "donfra-api"

// StartSpan creates a new span for the given operation.
// Usage:
//
//	ctx, span := tracing.StartSpan(ctx, "operation-name")
//	defer span.End()
func StartSpan(ctx context.Context, spanName string, attrs ...attribute.KeyValue) (context.Context, trace.Span) {
	tracer := otel.Tracer(tracerName)
	ctx, span := tracer.Start(ctx, spanName)

	if len(attrs) > 0 {
		span.SetAttributes(attrs...)
	}

	return ctx, span
}

// RecordError records an error on the span and sets the status to error.
func RecordError(span trace.Span, err error) {
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
	}
}

// SetAttributes adds attributes to the current span.
func SetAttributes(span trace.Span, attrs ...attribute.KeyValue) {
	span.SetAttributes(attrs...)
}

// Common attribute keys for consistency
var (
	// Database attributes
	AttrDBOperation = attribute.Key("db.operation")
	AttrDBTable     = attribute.Key("db.table")
	AttrDBQuery     = attribute.Key("db.query")

	// User/Auth attributes
	AttrUserID     = attribute.Key("user.id")
	AttrIsAdmin    = attribute.Key("auth.is_admin")
	AttrAuthResult = attribute.Key("auth.result")

	// Lesson attributes
	AttrLessonSlug         = attribute.Key("lesson.slug")
	AttrLessonIsPublished  = attribute.Key("lesson.is_published")
	AttrLessonReviewStatus = attribute.Key("lesson.review_status")

	// Room attributes
	AttrRoomID = attribute.Key("room.id")

	// HTTP/Handler attributes
	AttrResponseCount = attribute.Key("response.count")
	AttrRequestBody   = attribute.Key("request.body_size")
	AttrResponseBody  = attribute.Key("response.body_size")
)
