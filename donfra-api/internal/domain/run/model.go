package run

// ExecutionRequest represents a request to execute code.
type ExecutionRequest struct {
	Code string `json:"code"`
}

// ExecutionResponse represents the result of code execution.
type ExecutionResponse struct {
	Stdout string `json:"stdout"`
	Stderr string `json:"stderr"`
}

// ExecutionResult represents the internal result of code execution
// including the error if any occurred during execution.
type ExecutionResult struct {
	Stdout string
	Stderr string
	Error  error
}
