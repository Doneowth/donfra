package run

import (
	"bytes"
	"context"
	"os/exec"
)

// RunPython executes Python code in an isolated environment and returns the execution result.
// It uses Python 3 with isolated mode (-I) and unbuffered output (-u).
// The context can be used to set execution timeouts.
func RunPython(ctx context.Context, code string) ExecutionResult {
	cmd := exec.CommandContext(ctx, "python3", "-I", "-u", "-")
	var outBuf, errBuf bytes.Buffer
	cmd.Stdout, cmd.Stderr = &outBuf, &errBuf
	cmd.Stdin = bytes.NewBufferString(code)
	err := cmd.Run()
	return ExecutionResult{
		Stdout: outBuf.String(),
		Stderr: errBuf.String(),
		Error:  err,
	}
}

// Execute processes an execution request and returns the response.
// This is a higher-level function that wraps RunPython for use in handlers.
func Execute(ctx context.Context, req ExecutionRequest) ExecutionResponse {
	result := RunPython(ctx, req.Code)
	return ExecutionResponse{
		Stdout: result.Stdout,
		Stderr: result.Stderr,
	}
}
