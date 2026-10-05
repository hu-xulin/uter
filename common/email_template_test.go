package common

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestBrandEmailSubject(t *testing.T) {
	require.Equal(t, "安全提醒-Uter.ai 优特智能", BrandEmailSubject("安全提醒"))
	require.Equal(t, "电子邮件验证码： 282150-Uter.ai 优特智能", BrandEmailSubject("电子邮件验证码： 282150"))
}

func TestBuildBrandEmailHTML(t *testing.T) {
	html := BuildBrandEmailHTML(BrandEmail{
		Heading: "请验证您的邮箱地址",
		Paragraphs: []string{
			"Uter.ai 优特智能 收到了将 <strong>user@example.com</strong> 用作账号的请求。",
			"请使用此验证码完成邮箱验证：",
			"   ",
		},
		Code: "282150",
		Note: "此验证码将在 10 分钟后失效。",
	})

	require.Contains(t, html, "请验证您的邮箱地址")
	require.Contains(t, html, "<strong>user@example.com</strong>")
	require.Contains(t, html, ">282150</p>")
	require.Contains(t, html, "此验证码将在 10 分钟后失效。")
	// 品牌头部 logo（base64 内嵌 PNG，记号+字标一体）与页脚落款
	require.Contains(t, html, `src="data:image/png;base64,`)
	require.Contains(t, html, `width="61" height="64" alt="Uter.ai"`)
	require.Contains(t, html, "深圳优特网络有限公司")
	// 空段落被跳过，不会产生空 <p>
	require.NotContains(t, html, "<p style=\"margin:0 0 16px;font-size:14px;line-height:1.7;color:#3c4043;\">   </p>")
	// 结构约束：内联样式、圆角卡片
	require.Contains(t, html, "border-radius:8px")
	require.True(t, strings.HasPrefix(html, "<!DOCTYPE html>"))
}

func TestBuildBrandEmailHTMLWithoutOptionalBlocks(t *testing.T) {
	html := BuildBrandEmailHTML(BrandEmail{
		Heading:    "安全提醒",
		Paragraphs: []string{"您的帐号安全设置发生了变更。"},
	})
	require.NotContains(t, html, "font-size:40px")
	require.Contains(t, html, "您的帐号安全设置发生了变更。")
}

func TestBuildBrandEmailHTMLStripsLinkUnderline(t *testing.T) {
	// 调用方未设置 text-decoration 的链接，应被强制注入 text-decoration:none
	html := BuildBrandEmailHTML(BrandEmail{
		Heading: "充值提醒",
		Paragraphs: []string{
			`请点击 <a href='https://uter.cc/wallet'>此处</a> 完成充值。`,
		},
	})
	require.Contains(t, html, `<a href='https://uter.cc/wallet' style="text-decoration:none;color:#1a73e8;">此处</a>`)

	// 调用方已自行控制 text-decoration 的链接，不应被覆盖（避免重复 style 属性）
	html2 := BuildBrandEmailHTML(BrandEmail{
		Heading: "重置密码",
		Paragraphs: []string{
			`<a href='https://uter.ai/reset' style="color:#1a73e8;text-decoration:none;">此处</a>`,
		},
	})
	require.Contains(t, html2, `<a href='https://uter.ai/reset' style="color:#1a73e8;text-decoration:none;">此处</a>`)
	// 不应出现两个 style 属性
	require.Equal(t, 1, strings.Count(html2, `style="color:#1a73e8;text-decoration:none;"`))
}
