package wsdial

import (
	"fmt"
	"io"
	"net/http"
	"strings"
)

const maxBodySnippet = 256

func DescribeDialFailure(err error, resp *http.Response) error {
	if err == nil {
		return nil
	}
	if resp == nil {
		return err
	}

	snippet, readErr := io.ReadAll(io.LimitReader(resp.Body, maxBodySnippet+1))
	if readErr != nil {
		return fmt.Errorf("%w (status=%s)", err, resp.Status)
	}

	body := strings.TrimSpace(string(snippet))
	if len(snippet) > maxBodySnippet {
		body = body[:maxBodySnippet] + "..."
	}
	if body == "" {
		return fmt.Errorf("%w (status=%s)", err, resp.Status)
	}
	body = strings.ReplaceAll(body, "\n", " ")
	return fmt.Errorf("%w (status=%s body=%s)", err, resp.Status, body)
}
