package runner

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// K8sExecutor creates K8s Jobs for code execution and collects results via Redis pub/sub.
type K8sExecutor struct {
	kubeClient   kubernetes.Interface
	redisClient  *redis.Client
	namespace    string
	jailImage string
	cfg          Config
}

// jailResult is the JSON structure published by the jail entrypoint.
type jailResult struct {
	ExecutionID     string `json:"execution_id"`
	StatusID        int    `json:"status_id"`
	StatusDesc      string `json:"status_desc"`
	StdoutB64       string `json:"stdout_b64"`
	StderrB64       string `json:"stderr_b64"`
	Message         string `json:"message"`
	ExitCode        int    `json:"exit_code"`
	ExecutionTimeMs int64  `json:"execution_time_ms"`
}

func NewK8sExecutor(kubeClient kubernetes.Interface, redisClient *redis.Client, namespace, jailImage string, cfg Config) *K8sExecutor {
	return &K8sExecutor{
		kubeClient:   kubeClient,
		redisClient:  redisClient,
		namespace:    namespace,
		jailImage: jailImage,
		cfg:          cfg,
	}
}

func (e *K8sExecutor) Execute(ctx context.Context, lang Language, req ExecuteRequest, timeoutMs int) ExecuteResult {
	execID := uuid.New().String()
	channel := "exec:" + execID

	// Subscribe to Redis BEFORE creating the Job to avoid race conditions.
	sub := e.redisClient.Subscribe(ctx, channel)
	defer sub.Close()

	// Wait for subscription to be confirmed.
	_, err := sub.Receive(ctx)
	if err != nil {
		log.Printf("redis subscribe failed: %v", err)
		return ExecuteResult{
			Token:   "ws-exec",
			Status:  ExecuteStatus{ID: StatusRuntimeError, Description: "Runtime Error"},
			Message: "result channel unavailable",
		}
	}

	// Create the K8s Job.
	jobName := fmt.Sprintf("exec-%s", execID[:8])
	job := e.buildJobSpec(jobName, execID, lang, req, timeoutMs)

	_, err = e.kubeClient.BatchV1().Jobs(e.namespace).Create(ctx, job, metav1.CreateOptions{})
	if err != nil {
		log.Printf("k8s job create failed: %v", err)
		return ExecuteResult{
			Token:   "ws-exec",
			Status:  ExecuteStatus{ID: StatusRuntimeError, Description: "Runtime Error"},
			Message: "execution backend unavailable",
		}
	}

	// Wait for result from Redis with timeout.
	// Total wait = execution timeout + 8s buffer for Job scheduling + pod startup.
	waitTimeout := time.Duration(timeoutMs)*time.Millisecond + 8*time.Second
	waitCtx, waitCancel := context.WithTimeout(ctx, waitTimeout)
	defer waitCancel()

	msgCh := sub.Channel()
	select {
	case msg := <-msgCh:
		return e.parseResult(msg.Payload)
	case <-waitCtx.Done():
		// Timeout — try to determine if OOM or generic timeout.
		result := e.handleTimeout(execID)
		// Background cleanup.
		go e.deleteJob(jobName)
		return result
	}
}

func (e *K8sExecutor) buildJobSpec(jobName, execID string, lang Language, req ExecuteRequest, timeoutMs int) *batchv1.Job {
	// activeDeadlineSeconds = execution timeout + 5s buffer for startup.
	deadlineSec := int64(math.Ceil(float64(timeoutMs)/1000.0)) + 5
	ttlSec := int32(60)
	backoffLimit := int32(0)

	sourceB64 := base64.StdEncoding.EncodeToString([]byte(req.SourceCode))
	stdinB64 := ""
	if req.Stdin != "" {
		stdinB64 = base64.StdEncoding.EncodeToString([]byte(req.Stdin))
	}

	// Resource limits per language.
	memLimit := "128Mi"
	if lang.ID == 63 { // JavaScript/Node needs more memory
		memLimit = "256Mi"
	}

	return &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      jobName,
			Namespace: e.namespace,
			Labels: map[string]string{
				"app":     "donfra-jail",
				"exec-id": execID[:8],
			},
		},
		Spec: batchv1.JobSpec{
			ActiveDeadlineSeconds:   &deadlineSec,
			TTLSecondsAfterFinished: &ttlSec,
			BackoffLimit:            &backoffLimit,
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels: map[string]string{
						"app":     "donfra-jail",
						"exec-id": execID[:8],
					},
				},
				Spec: corev1.PodSpec{
					RestartPolicy: corev1.RestartPolicyNever,
					Containers: []corev1.Container{
						{
							Name:  "codejail",
							Image: e.jailImage,
							Env: []corev1.EnvVar{
								{Name: "EXEC_ID", Value: execID},
								{Name: "SOURCE_CODE", Value: sourceB64},
								{Name: "LANGUAGE_ID", Value: fmt.Sprintf("%d", req.LanguageID)},
								{Name: "STDIN_DATA", Value: stdinB64},
								{Name: "REDIS_HOST", Value: "redis"},
								{Name: "REDIS_PORT", Value: "6379"},
								{Name: "TIMEOUT_MS", Value: fmt.Sprintf("%d", timeoutMs)},
								{Name: "MAX_OUTPUT_BYTES", Value: fmt.Sprintf("%d", e.cfg.MaxOutputBytes)},
							},
							Resources: corev1.ResourceRequirements{
								Requests: corev1.ResourceList{
									corev1.ResourceCPU:    resource.MustParse("100m"),
									corev1.ResourceMemory: resource.MustParse("64Mi"),
								},
								Limits: corev1.ResourceList{
									corev1.ResourceCPU:    resource.MustParse("500m"),
									corev1.ResourceMemory: resource.MustParse(memLimit),
								},
							},
						},
					},
				},
			},
		},
	}
}

func (e *K8sExecutor) parseResult(payload string) ExecuteResult {
	var sr jailResult
	if err := json.Unmarshal([]byte(payload), &sr); err != nil {
		log.Printf("failed to parse jail result: %v", err)
		return ExecuteResult{
			Token:   "ws-exec",
			Status:  ExecuteStatus{ID: StatusRuntimeError, Description: "Runtime Error"},
			Message: "failed to parse execution result",
		}
	}

	stdout, _ := base64.StdEncoding.DecodeString(sr.StdoutB64)
	stderr, _ := base64.StdEncoding.DecodeString(sr.StderrB64)

	return ExecuteResult{
		Token:           "ws-exec",
		Status:          ExecuteStatus{ID: sr.StatusID, Description: sr.StatusDesc},
		Stdout:          string(stdout),
		Stderr:          string(stderr),
		Message:         sr.Message,
		ExecutionTimeMs: sr.ExecutionTimeMs,
	}
}

// handleTimeout checks the Job/Pod status to distinguish OOM from generic timeout.
func (e *K8sExecutor) handleTimeout(execID string) ExecuteResult {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	// Check pod status for OOM kill.
	pods, err := e.kubeClient.CoreV1().Pods(e.namespace).List(ctx, metav1.ListOptions{
		LabelSelector: fmt.Sprintf("exec-id=%s", execID[:8]),
	})
	if err == nil && len(pods.Items) > 0 {
		for _, cs := range pods.Items[0].Status.ContainerStatuses {
			if cs.State.Terminated != nil && cs.State.Terminated.Reason == "OOMKilled" {
				return ExecuteResult{
					Token:   "ws-exec",
					Status:  ExecuteStatus{ID: StatusMemoryLimit, Description: "Memory Limit Exceeded"},
					Message: "process was killed due to memory limit",
				}
			}
		}
	}

	return ExecuteResult{
		Token:   "ws-exec",
		Status:  ExecuteStatus{ID: StatusTimeLimitExceeded, Description: "Time Limit Exceeded"},
		Message: "execution timed out",
	}
}

func (e *K8sExecutor) deleteJob(jobName string) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	propagation := metav1.DeletePropagationBackground
	err := e.kubeClient.BatchV1().Jobs(e.namespace).Delete(ctx, jobName, metav1.DeleteOptions{
		PropagationPolicy: &propagation,
	})
	if err != nil {
		log.Printf("failed to delete job %s: %v", jobName, err)
	}
}
