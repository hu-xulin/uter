module github.com/uter-ai/uter/relaykit

// 与根模块保持一致：go 1.27.1 的标准库带 11 个已公布漏洞（net/http、
// net/http2、crypto/tls、crypto/x509、net/textproto），全部在 go1.27.3 修复。
// 独立构建 relaykit 时也必须落到修好标准库的工具链上。
go 1.27.3

require (
	github.com/google/uuid v1.6.0
	github.com/samber/lo v1.53.0
	github.com/stretchr/testify v1.11.1
	github.com/tidwall/gjson v1.19.0
	github.com/tidwall/sjson v1.2.5
)

require (
	github.com/davecgh/go-spew v1.1.2-0.20180830191138-d8f796af33cc // indirect
	github.com/kr/pretty v0.3.1 // indirect
	github.com/pmezard/go-difflib v1.0.1-0.20181226105442-5d4384ee4fb2 // indirect
	github.com/rogpeppe/go-internal v1.10.0 // indirect
	github.com/tidwall/match v1.1.1 // indirect
	github.com/tidwall/pretty v1.2.0 // indirect
	golang.org/x/text v0.43.0 // indirect
	gopkg.in/check.v1 v1.0.0-20201130134442-10cb98267c6c // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
)
