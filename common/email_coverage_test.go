package common

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

// 所有面向最终用户的发信点都必须走品牌模板 BuildBrandEmailHTML。
//
// 历史回归：a08cbfdf6 把验证码、密码重置、绑定、安全提醒、通用通知全部改用
// 品牌模板；随后 f0f0e4011（对齐 new-api rc.38–rc.44）把 controller/misc.go 与
// service/user_notify.go 回退成了裸 `<p>` 拼接，用户收到的邮件退回无品牌排版的
// 纯文本观感——运营看到的现象就是「邮件模板没有了」。
//
// 这条用例守住发信入口：这些文件里不允许再出现裸 `<p>` 拼接的邮件正文，
// 必须调用 BuildBrandEmailHTML。
func TestUserFacingMailTemplatesStayBranded(t *testing.T) {
	root := filepath.Join("..")
	files := []string{
		filepath.Join(root, "controller", "misc.go"),
		filepath.Join(root, "service", "user_notify.go"),
		filepath.Join(root, "service", "email_binding.go"),
		filepath.Join(root, "service", "account_security.go"),
	}
	for _, path := range files {
		source, err := os.ReadFile(path)
		require.NoError(t, err, "读取发信入口失败: %s", path)
		code := string(source)

		require.NotContains(t, code, `fmt.Sprintf("<p>`,
			"%s 出现了裸 <p> 拼接的邮件正文，必须改用 BuildBrandEmailHTML", path)

		if strings.Contains(code, "SendEmail(") {
			require.Contains(t, code, "BuildBrandEmailHTML(",
				"%s 调用了 SendEmail 却没有走品牌模板 BuildBrandEmailHTML", path)
		}
	}
}
