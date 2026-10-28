module github.com/uter-ai/uter/tokenkit

// 与根模块 / relaykit 保持一致：go 1.26 的标准库带多个已公布漏洞
// （net/http、net/url、crypto/x509、encoding/asn1、archive/tar），
// 全部在 go1.27.2 / go1.27.3 修复。独立构建 tokenkit 时也必须落到
// 修好标准库的工具链上，否则 Dependabot 会按 go 指令的版本继续报 stdlib 告警。
go 1.27.3

require (
	github.com/stretchr/testify v1.11.1
	github.com/tiktoken-go/tokenizer v0.8.1
)

require (
	github.com/davecgh/go-spew v1.1.1 // indirect
	github.com/dlclark/regexp2/v2 v2.5.1 // indirect
	github.com/pmezard/go-difflib v1.0.0 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
)
