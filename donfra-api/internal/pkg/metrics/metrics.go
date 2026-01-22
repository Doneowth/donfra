package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// HTTP metrics
	HTTPRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "donfra_http_requests_total",
			Help: "Total number of HTTP requests",
		},
		[]string{"method", "path", "status"},
	)

	HTTPRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "donfra_http_request_duration_seconds",
			Help:    "HTTP request duration in seconds",
			Buckets: []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10},
		},
		[]string{"method", "path"},
	)

	HTTPRequestsInFlight = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "donfra_http_requests_in_flight",
			Help: "Number of HTTP requests currently being processed",
		},
	)

	// Business metrics
	LessonsTotal = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "donfra_lessons_total",
			Help: "Total number of lessons in the database",
		},
	)

	LessonsPublished = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "donfra_lessons_published",
			Help: "Number of published lessons",
		},
	)

	UsersTotal = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "donfra_users_total",
			Help: "Total number of registered users",
		},
	)

	ActiveInterviewRooms = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "donfra_interview_rooms_active",
			Help: "Number of currently active interview rooms",
		},
	)

	// Auth metrics
	AuthLoginTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "donfra_auth_login_total",
			Help: "Total number of login attempts",
		},
		[]string{"status"}, // success, failed
	)

	AuthRegisterTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "donfra_auth_register_total",
			Help: "Total number of registration attempts",
		},
		[]string{"status"}, // success, failed
	)

	// Database metrics
	DBQueryDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "donfra_db_query_duration_seconds",
			Help:    "Database query duration in seconds",
			Buckets: []float64{.001, .005, .01, .025, .05, .1, .25, .5, 1},
		},
		[]string{"operation"}, // select, insert, update, delete
	)

	// AI metrics
	AIRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "donfra_ai_requests_total",
			Help: "Total number of AI API requests",
		},
		[]string{"type", "status"}, // type: analyze, chat; status: success, failed
	)
)

// RecordHTTPRequest records metrics for an HTTP request
func RecordHTTPRequest(method, path, status string, duration float64) {
	HTTPRequestsTotal.WithLabelValues(method, path, status).Inc()
	HTTPRequestDuration.WithLabelValues(method, path).Observe(duration)
}

// RecordLogin records a login attempt
func RecordLogin(success bool) {
	status := "success"
	if !success {
		status = "failed"
	}
	AuthLoginTotal.WithLabelValues(status).Inc()
}

// RecordRegister records a registration attempt
func RecordRegister(success bool) {
	status := "success"
	if !success {
		status = "failed"
	}
	AuthRegisterTotal.WithLabelValues(status).Inc()
}

// RecordAIRequest records an AI API request
func RecordAIRequest(requestType string, success bool) {
	status := "success"
	if !success {
		status = "failed"
	}
	AIRequestsTotal.WithLabelValues(requestType, status).Inc()
}

// UpdateLessonCounts updates the lesson gauge metrics
func UpdateLessonCounts(total, published int64) {
	LessonsTotal.Set(float64(total))
	LessonsPublished.Set(float64(published))
}

// UpdateUserCount updates the user count gauge
func UpdateUserCount(count int64) {
	UsersTotal.Set(float64(count))
}

// UpdateActiveRooms updates the active interview rooms gauge
func UpdateActiveRooms(count int64) {
	ActiveInterviewRooms.Set(float64(count))
}
