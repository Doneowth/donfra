package run

import (
	"bytes"
	"context"
	"os/exec"
)

func RunPython(ctx context.Context, code string) (stdout, stderr string, err error) {
	cmd := exec.CommandContext(ctx, "python3", "-I", "-u", "-")
	var outBuf, errBuf bytes.Buffer
	cmd.Stdout, cmd.Stderr = &outBuf, &errBuf
	cmd.Stdin = bytes.NewBufferString(code)
	err = cmd.Run()
	return outBuf.String(), errBuf.String(), err
}
