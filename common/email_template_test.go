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
			"Uter.ai 收到了将 <strong>user@example.com</strong> 用作 Uter.ai 帐号的请求。",
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
	// 品牌记号（base64 内嵌 PNG）与橙色 Uter.ai 字标、页脚落款
	require.Contains(t, html, `src="data:image/png;base64,`)
	require.Contains(t, html, `color:#FF6600;letter-spacing:-0.5px;">Uter.ai</span>`)
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
