package mobiletunnel

import (
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"
)

const maxDiagnosticsLogLines = 400

var diagnosticsLog = struct {
	mu    sync.Mutex
	lines []string
}{}

// TakeDiagnosticsLog returns buffered mobile tunnel diagnostics and clears the buffer.
func TakeDiagnosticsLog() string {
	diagnosticsLog.mu.Lock()
	defer diagnosticsLog.mu.Unlock()

	if len(diagnosticsLog.lines) == 0 {
		return ""
	}
	snapshot := strings.Join(diagnosticsLog.lines, "\n")
	diagnosticsLog.lines = nil
	return snapshot
}

func tunnelInfo(msg string, args ...any) {
	slog.Info(msg, args...)
	recordDiagnosticsLog("INFO", msg, args...)
}

func tunnelWarn(msg string, args ...any) {
	slog.Warn(msg, args...)
	recordDiagnosticsLog("WARN", msg, args...)
}

func tunnelError(msg string, args ...any) {
	slog.Error(msg, args...)
	recordDiagnosticsLog("ERROR", msg, args...)
}

func recordDiagnosticsLog(level string, msg string, args ...any) {
	line := fmt.Sprintf(
		"time=%s level=%s msg=%s",
		time.Now().UTC().Format(time.RFC3339Nano),
		level,
		quoteDiagnosticsValue(msg),
	)
	for i := 0; i < len(args); i += 2 {
		key, ok := args[i].(string)
		if !ok || key == "" {
			key = fmt.Sprintf("arg%d", i)
		}
		value := "<missing>"
		if i+1 < len(args) {
			value = fmt.Sprint(args[i+1])
		}
		line += " " + key + "=" + quoteDiagnosticsValue(value)
	}

	diagnosticsLog.mu.Lock()
	diagnosticsLog.lines = append(diagnosticsLog.lines, line)
	if len(diagnosticsLog.lines) > maxDiagnosticsLogLines {
		diagnosticsLog.lines = diagnosticsLog.lines[len(diagnosticsLog.lines)-maxDiagnosticsLogLines:]
	}
	diagnosticsLog.mu.Unlock()
}

func quoteDiagnosticsValue(value string) string {
	return fmt.Sprintf("%q", value)
}
