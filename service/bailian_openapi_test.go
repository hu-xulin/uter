package service

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/url"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// These values are intentionally synthetic: they satisfy the shape checks
// without resembling a real Alibaba Cloud AccessKey.
const (
	testBailianAKID     = "UTERFAKEID0000001"
	testBailianAKSecret = "UTERFAKESECRET0001"
)

func TestValidateBailianAccessKeyFailsClosed(t *testing.T) {
	tests := []struct {
		name   string
		id     string
		secret string
	}{
		{name: "empty", id: "", secret: ""},
		{name: "missing secret", id: testBailianAKID, secret: ""},
		{name: "placeholder", id: "YOUR_ACCESS_KEY_ID", secret: testBailianAKSecret},
		{name: "too short", id: "SHORT", secret: "abc"},
		{name: "no entropy", id: "aaaaaaaaaaaa", secret: "bbbbbbbbbbbbbbbb"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := ValidateBailianAccessKey(test.id, test.secret)
			require.Error(t, err)
			if test.id != "" {
				assert.NotContains(t, err.Error(), test.id)
			}
			if test.secret != "" {
				assert.NotContains(t, err.Error(), test.secret)
			}
		})
	}
	err := ValidateBailianAccessKey(testBailianAKID, testBailianAKSecret)
	require.NoError(t, err)
}

func TestBailianRegionFromConsoleURL(t *testing.T) {
	assert.Equal(t, BailianRegionBeijing, BailianRegionFromConsoleURL(
		"https://bailian.console.aliyun.com/cn-beijing/model/market",
	))
	assert.Equal(t, BailianRegionSingapore, BailianRegionFromConsoleURL(
		"https://bailian.console.aliyun.com/ap-southeast-1/model/market",
	))
	assert.Equal(t, BailianRegionUnspecified, BailianRegionFromConsoleURL(
		"https://bailian.console.aliyun.com/model/market",
	))
	assert.Equal(t, BailianRegionUnspecified, BailianRegionFromConsoleURL(""))
}

func TestBuildBailianROARequestSignsCanonicalRequest(t *testing.T) {
	query := url.Values{}
	query.Set("language", "zh-CN")
	query.Set("maxResults", "200")
	requestURL, headers, err := buildBailianROARequest(
		"GET", "modelstudio.cn-beijing.aliyuncs.com", bailianOpenAPIPathModels,
		query, bailianOpenAPIActionModels, testBailianAKID, testBailianAKSecret,
	)
	require.NoError(t, err)
	assert.True(t, strings.HasPrefix(requestURL, "https://modelstudio.cn-beijing.aliyuncs.com/modelstudio/models?"))
	assert.Contains(t, requestURL, "language=zh-CN")
	assert.Contains(t, requestURL, "maxResults=200")
	assert.Equal(t, bailianOpenAPIActionModels, headers["x-acs-action"])
	assert.Equal(t, bailianOpenAPIVersion, headers["x-acs-version"])
	assert.Equal(t, sha256Hex(""), headers["x-acs-content-sha256"])

	authorization := headers["Authorization"]
	assert.True(t, strings.HasPrefix(authorization, bailianOpenAPIAlgorithm+" Credential="+testBailianAKID+","))
	assert.Contains(t, authorization, "SignedHeaders=host;x-acs-action;x-acs-content-sha256;x-acs-date;x-acs-signature-nonce;x-acs-version,")
	assert.Contains(t, authorization, "Signature=")
	assert.NotContains(t, authorization, testBailianAKSecret)
}

// TestBailianROASignatureMatchesAlibabaCloudV3 recomputes the signature from
// the headers produced by buildBailianROARequest using an INDEPENDENT
// implementation of the published Alibaba Cloud V3 (ACS3-HMAC-SHA256) spec.
// It exists to catch canonical-request construction mistakes (wrong segment
// order, missing blank line between canonical headers and signed headers,
// wrong stringToSign) that prefix-only assertions cannot detect.
//
// Spec: CanonicalRequest = METHOD\nURI\nCanonicalQuery\nCanonicalHeaders\n
// SignedHeaders\nPayloadHash; StringToSign = "ACS3-HMAC-SHA256\n" +
// SHA256(CanonicalRequest); Signature = HMAC-SHA256(AccessKeySecret,
// StringToSign). CanonicalHeaders already ends with '\n', so joining with
// '\n' yields exactly one blank line before SignedHeaders.
func TestBailianROASignatureMatchesAlibabaCloudV3(t *testing.T) {
	host := "modelstudio.cn-beijing.aliyuncs.com"
	query := url.Values{}
	query.Set("language", "zh-CN")
	query.Set("maxResults", "200")

	requestURL, headers, err := buildBailianROARequest(
		"GET", host, bailianOpenAPIPathModels, query,
		bailianOpenAPIActionModels, testBailianAKID, testBailianAKSecret,
	)
	require.NoError(t, err)

	date := headers["x-acs-date"]
	nonce := headers["x-acs-signature-nonce"]
	payloadHash := headers["x-acs-content-sha256"]
	require.NotEmpty(t, date)
	require.NotEmpty(t, nonce)
	assert.Equal(t, sha256Hex(""), payloadHash)

	// Independent canonical query: keys sorted, RFC3986 encoded.
	canonicalQuery := "language=zh-CN&maxResults=200"
	assert.Contains(t, requestURL, canonicalQuery)

	// Independent canonical headers: lowercase, trimmed, name-sorted, each
	// entry terminated by '\n'.
	canonicalHeaders := strings.Join([]string{
		"host:" + host,
		"x-acs-action:" + bailianOpenAPIActionModels,
		"x-acs-content-sha256:" + payloadHash,
		"x-acs-date:" + date,
		"x-acs-signature-nonce:" + nonce,
		"x-acs-version:" + bailianOpenAPIVersion,
	}, "\n") + "\n"
	signedHeaders := "host;x-acs-action;x-acs-content-sha256;x-acs-date;x-acs-signature-nonce;x-acs-version"

	canonicalRequest := strings.Join([]string{
		"GET",
		bailianOpenAPIPathModels,
		canonicalQuery,
		canonicalHeaders,
		signedHeaders,
		payloadHash,
	}, "\n")
	canonicalDigest := sha256.Sum256([]byte(canonicalRequest))
	stringToSign := bailianOpenAPIAlgorithm + "\n" + hex.EncodeToString(canonicalDigest[:])
	mac := hmac.New(sha256.New, []byte(testBailianAKSecret))
	_, err = mac.Write([]byte(stringToSign))
	require.NoError(t, err)
	wantSignature := hex.EncodeToString(mac.Sum(nil))

	authorization := headers["Authorization"]
	assert.Contains(t, authorization,
		"Credential="+testBailianAKID+",SignedHeaders="+signedHeaders+",Signature="+wantSignature,
		"signature must match an independent ACS3-HMAC-SHA256 computation")
}

func TestBailianOpenAPIModelNameReadsKnownShapes(t *testing.T) {
	cases := []struct {
		name string
		item map[string]any
		want string
	}{
		{name: "model", item: map[string]any{"model": "qwen-plus"}, want: "qwen-plus"},
		{name: "modelName", item: map[string]any{"modelName": "qwen-max"}, want: "qwen-max"},
		{name: "nested", item: map[string]any{"modelInfo": map[string]any{"modelId": "deepseek-v3"}}, want: "deepseek-v3"},
		{name: "unknown", item: map[string]any{"id": 42}, want: ""},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			assert.Equal(t, test.want, bailianOpenAPIModelName(test.item))
		})
	}
}
