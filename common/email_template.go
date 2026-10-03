package common

import (
	"strings"
)

// EmailBrandName 是品牌邮件（标题与落款）使用的品牌名。
const EmailBrandName = "Uter.ai 优特智能"

// BrandEmailSubject 按「目的-Uter.ai 优特智能」规则生成邮件标题，
// 例如 BrandEmailSubject("安全提醒") => "安全提醒-Uter.ai 优特智能"；
// 带验证码的目的写作 "电子邮件验证码： 282150"。
func BrandEmailSubject(purpose string) string {
	return purpose + "-" + EmailBrandName
}

// BrandEmail 描述一封品牌通知邮件的卡片内容。
type BrandEmail struct {
	Heading    string   // 卡片居中大标题
	Paragraphs []string // 正文段落，可含内联 HTML（动态值由调用方转义）
	Code       string   // 可选：居中大号验证码
	Note       string   // 可选：时效/忽略提示等补充段落
}

const brandEmailFont = "Roboto,'Helvetica Neue',Arial,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif"

// BuildBrandEmailHTML 生成 Google 风格的品牌邮件 HTML：
// 白色圆角卡片 + 居中字标 + 居中大标题 + 细分隔线 + 左对齐正文 +
// 可选大号验证码，卡片外是灰色小字页脚。全部内联样式、table 布局，
// 以兼容 Gmail/Outlook 等客户端。
func BuildBrandEmailHTML(email BrandEmail) string {
	var body strings.Builder
	for _, paragraph := range email.Paragraphs {
		if strings.TrimSpace(paragraph) == "" {
			continue
		}
		body.WriteString(`<p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#3c4043;">` + paragraph + `</p>`)
	}
	codeBlock := ""
	if email.Code != "" {
		codeBlock = `<p style="margin:8px 0 24px;text-align:center;font-size:40px;line-height:1.3;color:#202124;">` + email.Code + `</p>`
	}
	noteBlock := ""
	if email.Note != "" {
		noteBlock = `<p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#3c4043;">` + email.Note + `</p>`
	}

	var b strings.Builder
	b.WriteString(`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>`)
	b.WriteString(`<body style="margin:0;padding:0;background:#ffffff;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;"><tr><td align="center" style="padding:32px 16px;font-family:` + brandEmailFont + `;">`)
	// 卡片
	b.WriteString(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #dadce0;border-radius:8px;"><tr><td style="padding:40px 48px 36px;">`)
	// 字标 logo
	b.WriteString(`<p style="margin:0;text-align:center;font-family:` + brandEmailFont + `;"><span style="font-size:26px;font-weight:700;color:#070C17;letter-spacing:-0.5px;">Uter</span><span style="font-size:26px;font-weight:700;color:#0EA5E9;letter-spacing:-0.5px;">.ai</span><span style="font-size:15px;font-weight:400;color:#5f6368;margin-left:10px;">优特智能</span></p>`)
	// 大标题
	b.WriteString(`<h1 style="margin:24px 0 0;text-align:center;font-size:26px;font-weight:400;line-height:1.4;color:#202124;">` + email.Heading + `</h1>`)
	// 细分隔线
	b.WriteString(`<div style="margin-top:28px;border-top:1px solid #e8eaed;"></div>`)
	// 正文区
	b.WriteString(`<div style="padding-top:28px;">` + body.String() + codeBlock + noteBlock + `</div>`)
	b.WriteString(`</td></tr></table>`)
	// 页脚
	b.WriteString(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;"><tr><td style="padding-top:24px;">`)
	b.WriteString(`<p style="margin:0;font-size:12px;line-height:1.7;color:#80868b;text-align:center;">我们向您发送这封电子邮件，目的是让您了解关于您的 Uter.ai 帐号和服务的重要信息。</p>`)
	b.WriteString(`<p style="margin:4px 0 0;font-size:12px;line-height:1.7;color:#80868b;text-align:center;">© 2026 深圳优特网络有限公司</p>`)
	b.WriteString(`</td></tr></table>`)
	b.WriteString(`</td></tr></table></body></html>`)
	return b.String()
}
