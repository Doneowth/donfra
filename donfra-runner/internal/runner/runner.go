package runner

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"time"
)

const (
	StatusAccepted          = 3
	StatusTimeLimitExceeded = 5
	StatusMemoryLimit       = 7
	StatusRuntimeError      = 11
)

// JailMode controls how code is executed.
//   - "direct": timeout command + context cancel (local dev)
//   - "k8s": K8s Job per execution (production)
type JailMode string

const (
	JailDirect JailMode = "direct"
	JailK8sJob JailMode = "k8s"
)

type Config struct {
	JailMode       JailMode
	MaxTimeoutMs   int
	DefaultTimeout int
	MaxOutputBytes int
}

type ExecuteRequest struct {
	SourceCode string `json:"source_code"`
	LanguageID int    `json:"language_id"`
	Stdin      string `json:"stdin"`
	TimeoutMs  int    `json:"timeout_ms"`
}

type ExecuteStatus struct {
	ID          int    `json:"id"`
	Description string `json:"description"`
}

type ExecuteResult struct {
	Token           string        `json:"token"`
	Status          ExecuteStatus `json:"status"`
	Stdout          string        `json:"stdout,omitempty"`
	Stderr          string        `json:"stderr,omitempty"`
	Message         string        `json:"message,omitempty"`
	ExecutionTimeMs int64         `json:"execution_time_ms"`
}

type Runner struct {
	cfg         Config
	limiter     *Limiter
	k8sExecutor *K8sExecutor
}

func New(cfg Config, limiter *Limiter, k8sExecutor *K8sExecutor) *Runner {
	return &Runner{cfg: cfg, limiter: limiter, k8sExecutor: k8sExecutor}
}

func (r *Runner) Execute(ctx context.Context, req ExecuteRequest) ExecuteResult {
	if req.SourceCode == "" {
		return errorResult("source_code is required")
	}

	lang, err := GetLanguage(req.LanguageID)
	if err != nil {
		return errorResult(err.Error())
	}

	// Resolve timeout
	timeout := r.cfg.DefaultTimeout
	if req.TimeoutMs > 0 {
		timeout = req.TimeoutMs
	}
	if timeout > r.cfg.MaxTimeoutMs {
		timeout = r.cfg.MaxTimeoutMs
	}

	// Acquire execution slot
	acquireCtx, acquireCancel := context.WithTimeout(ctx, 5*time.Second)
	defer acquireCancel()

	if err := r.limiter.Acquire(acquireCtx); err != nil {
		return ExecuteResult{
			Token:   "ws-exec",
			Status:  ExecuteStatus{ID: StatusRuntimeError, Description: "Queue Full"},
			Message: "too many concurrent executions, try again later",
		}
	}
	defer r.limiter.Release()

	// Write source code to temp file
	tmpFile, err := writeTempFile(req.SourceCode, lang.Extension)
	if err != nil {
		log.Printf("failed to write temp file: %v", err)
		return errorResult("internal error: failed to prepare execution")
	}
	defer os.Remove(tmpFile)

	// K8s mode skips temp file — source code is passed via env var.
	if r.cfg.JailMode == JailK8sJob {
		if r.k8sExecutor == nil {
			return errorResult("k8s executor not initialized")
		}
		os.Remove(tmpFile)
		return r.k8sExecutor.Execute(ctx, lang, req, timeout)
	}

	start := time.Now()
	result := r.executeDirect(ctx, lang, tmpFile, req.Stdin, timeout)
	result.ExecutionTimeMs = time.Since(start).Milliseconds()
	return result
}

// executeDirect runs code with context timeout only (local dev).
func (r *Runner) executeDirect(ctx context.Context, lang Language, codePath string, stdin string, timeoutMs int) ExecuteResult {
	execCtx, cancel := context.WithTimeout(ctx, time.Duration(timeoutMs)*time.Millisecond)
	defer cancel()

	cmd := exec.CommandContext(execCtx, lang.Interpreter, codePath)
	return r.runCmd(execCtx, cmd, stdin)
}

// runCmd executes a command and maps the result to ExecuteResult.
func (r *Runner) runCmd(ctx context.Context, cmd *exec.Cmd, stdin string) ExecuteResult {
	var stdoutBuf, stderrBuf bytes.Buffer
	cmd.Stdout = &limitedWriter{w: &stdoutBuf, limit: r.cfg.MaxOutputBytes}
	cmd.Stderr = &limitedWriter{w: &stderrBuf, limit: r.cfg.MaxOutputBytes}

	if stdin != "" {
		cmd.Stdin = bytes.NewReader([]byte(stdin))
	}

	err := cmd.Run()

	stdout := stdoutBuf.String()
	stderr := stderrBuf.String()

	if errors.Is(ctx.Err(), context.DeadlineExceeded) {
		return ExecuteResult{
			Token:  "ws-exec",
			Status: ExecuteStatus{ID: StatusTimeLimitExceeded, Description: "Time Limit Exceeded"},
			Stdout: stdout,
			Stderr: stderr,
		}
	}

	if err != nil {
		var exitErr *exec.ExitError
		if errors.As(err, &exitErr) {
			exitCode := exitErr.ExitCode()

			// OOM kill: exit code 137 (128 + SIGKILL)
			if exitCode == 137 {
				return ExecuteResult{
					Token:  "ws-exec",
					Status: ExecuteStatus{ID: StatusMemoryLimit, Description: "Memory Limit Exceeded"},
					Stdout: stdout,
					Stderr: stderr,
				}
			}

			return ExecuteResult{
				Token:   "ws-exec",
				Status:  ExecuteStatus{ID: StatusRuntimeError, Description: "Runtime Error"},
				Stdout:  stdout,
				Stderr:  stderr,
				Message: fmt.Sprintf("Process exited with code %d", exitCode),
			}
		}

		return ExecuteResult{
			Token:   "ws-exec",
			Status:  ExecuteStatus{ID: StatusRuntimeError, Description: "Runtime Error"},
			Message: "execution failed",
		}
	}

	return ExecuteResult{
		Token:  "ws-exec",
		Status: ExecuteStatus{ID: StatusAccepted, Description: "Accepted"},
		Stdout: stdout,
		Stderr: stderr,
	}
}

func writeTempFile(content string, ext string) (string, error) {
	f, err := os.CreateTemp("", "runner-*"+ext)
	if err != nil {
		return "", err
	}
	defer f.Close()

	if _, err := f.WriteString(content); err != nil {
		os.Remove(f.Name())
		return "", err
	}

	if err := os.Chmod(f.Name(), 0644); err != nil {
		os.Remove(f.Name())
		return "", err
	}

	return f.Name(), nil
}

func errorResult(msg string) ExecuteResult {
	return ExecuteResult{
		Token:   "ws-exec",
		Status:  ExecuteStatus{ID: StatusRuntimeError, Description: "Runtime Error"},
		Message: msg,
	}
}

// limitedWriter wraps a writer and stops writing after limit bytes.
type limitedWriter struct {
	w       io.Writer
	limit   int
	written int
}

func (lw *limitedWriter) Write(p []byte) (int, error) {
	if lw.written >= lw.limit {
		return len(p), nil
	}

	remaining := lw.limit - lw.written
	if len(p) > remaining {
		p = p[:remaining]
	}

	n, err := lw.w.Write(p)
	lw.written += n
	return n, err
}
