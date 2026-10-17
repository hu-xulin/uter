package middleware

import (
	"strings"
	"testing"

	"github.com/uter-ai/uter/common"
)

func TestReadAnonymousRequestBodyAtLimit(t *testing.T) {
	got, err := readAnonymousRequestBody(strings.NewReader("1234"), 4)
	if err != nil {
		t.Fatalf("readAnonymousRequestBody returned error at limit: %v", err)
	}
	if string(got) != "1234" {
		t.Fatalf("readAnonymousRequestBody = %q, want %q", got, "1234")
	}
}

func TestReadAnonymousRequestBodyRejectsLimitPlusOne(t *testing.T) {
	_, err := readAnonymousRequestBody(strings.NewReader("12345"), 4)
	if !common.IsRequestBodyTooLargeError(err) {
		t.Fatalf("readAnonymousRequestBody error = %v, want request-body-too-large error", err)
	}
}
