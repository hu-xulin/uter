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

// brandEmailLogoBase64 是品牌 u 记号，直接使用品牌提供的 uter.png
// （180x180 原图，base64 内嵌按 32x32 显示；不依赖远程图片，
// 避免被邮件客户端拦截或替换）。
const brandEmailLogoBase64 = "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"

// BuildBrandEmailHTML 生成 Google 风格的品牌邮件 HTML：
// 白色圆角卡片 + 居中品牌记号与橙色 Uter.ai 字标 + 居中大标题 + 细分隔线 + 左对齐正文 +
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
	// 品牌记号 logo（渐变 u，base64 内嵌，不依赖远程图片）
	b.WriteString(`<p style="margin:0;text-align:center;font-family:` + brandEmailFont + `;"><img src="data:image/png;base64,` + brandEmailLogoBase64 + `" width="32" height="32" alt="Uter.ai" style="display:inline-block;border:0;outline:none;vertical-align:bottom;"/></p>`)
	// 字标：Uter.ai 橙色 #FF6600
	b.WriteString(`<p style="margin:10px 0 0;text-align:center;font-family:` + brandEmailFont + `;"><span style="font-size:26px;font-weight:700;color:#FF6600;letter-spacing:-0.5px;">Uter.ai</span></p>`)
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
