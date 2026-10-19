package common

import (
	"regexp"
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

// linkStyleRe 匹配正文里的 <a> 标签，用于统一去掉邮件客户端默认给链接加的下划线。
var linkStyleRe = regexp.MustCompile(`(?i)<a\b[^>]*>`)

// ensureLinkNoUnderline 保证正文里每个 <a> 链接都不带下划线：
// 邮件客户端（Gmail/Outlook 等）默认会给 <a> 加下划线，这里强制内联
// text-decoration:none 以去除，并对链接统一着色；若调用方已自行控制则跳过。
func ensureLinkNoUnderline(html string) string {
	return linkStyleRe.ReplaceAllStringFunc(html, func(tag string) string {
		lower := strings.ToLower(tag)
		// 调用方已处理（例如已显式设置 text-decoration），不再覆盖，避免重复 style 属性
		if strings.Contains(lower, "text-decoration") {
			return tag
		}
		closeIdx := strings.LastIndex(tag, ">")
		style := ` style="text-decoration:none;color:#1a73e8;"`
		return tag[:closeIdx] + style + tag[closeIdx:]
	})
}

// brandEmailLogoBase64 是品牌头部 logo，取 web/public/logo.png 同源的
// Uter-180px.png（180x180 记号+字标合成图），base64 内嵌按 64x64 显示；
// 不依赖远程图片，避免被邮件客户端拦截或替换。换 logo 时必须同步替换这里：
// 它与 web/public/logo.png 不联动，站点换了 logo 而邮件不换会显示旧图。
const brandEmailLogoBase64 = "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"

// BuildBrandEmailHTML 生成 Google 风格的品牌邮件 HTML：
// 白色圆角卡片 + 居中品牌 logo 图（记号+字标一体） + 居中大标题 + 细分隔线 + 左对齐正文 +
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
	b.WriteString(`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style type="text/css">a{color:#1a73e8;text-decoration:none!important;}</style></head>`)
	b.WriteString(`<body style="margin:0;padding:0;background:#ffffff;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;"><tr><td align="center" style="padding:32px 16px;font-family:` + brandEmailFont + `;">`)
	// 卡片
	b.WriteString(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #dadce0;border-radius:8px;"><tr><td style="padding:40px 48px 36px;">`)
	// 品牌头部：记号 + Uter.ai 字标合成的单张 logo 图（base64 内嵌，不依赖远程图片）
	b.WriteString(`<p style="margin:0;text-align:center;font-family:` + brandEmailFont + `;"><img src="data:image/png;base64,` + brandEmailLogoBase64 + `" width="64" height="64" alt="Uter.ai" style="display:inline-block;border:0;outline:none;vertical-align:bottom;"/></p>`)
	// 大标题
	b.WriteString(`<h1 style="margin:24px 0 0;text-align:center;font-size:26px;font-weight:400;line-height:1.4;color:#202124;">` + email.Heading + `</h1>`)
	// 细分隔线
	b.WriteString(`<div style="margin-top:28px;border-top:1px solid #e8eaed;"></div>`)
	// 正文区：统一去除链接下划线（兼容各邮件客户端）
	b.WriteString(`<div style="padding-top:28px;">` + ensureLinkNoUnderline(body.String()+codeBlock+noteBlock) + `</div>`)
	b.WriteString(`</td></tr></table>`)
	// 页脚
	b.WriteString(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;"><tr><td style="padding-top:24px;">`)
	b.WriteString(`<p style="margin:0;font-size:12px;line-height:1.7;color:#80868b;text-align:center;">我们向您发送这封电子邮件，目的是让您了解关于您的 Uter.ai 帐号和服务的重要信息。</p>`)
	b.WriteString(`<p style="margin:4px 0 0;font-size:12px;line-height:1.7;color:#80868b;text-align:center;">© 2026 深圳优特网络有限公司</p>`)
	b.WriteString(`</td></tr></table>`)
	b.WriteString(`</td></tr></table></body></html>`)
	return b.String()
}
