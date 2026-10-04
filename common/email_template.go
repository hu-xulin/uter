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

// brandEmailLogoBase64 是品牌头部 logo，直接使用品牌提供的 logo.png
// （u 记号 + Uter.ai 字标合成图，126x132 原图，base64 内嵌按 61x64 显示；
// 不依赖远程图片，避免被邮件客户端拦截或替换）。
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
	b.WriteString(`<p style="margin:0;text-align:center;font-family:` + brandEmailFont + `;"><img src="data:image/png;base64,` + brandEmailLogoBase64 + `" width="61" height="64" alt="Uter.ai" style="display:inline-block;border:0;outline:none;vertical-align:bottom;"/></p>`)
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
