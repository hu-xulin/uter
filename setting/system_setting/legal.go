package system_setting

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/uter-ai/uter/setting/config"
)

type LegalSettings struct {
	UserAgreement     string `json:"user_agreement"`
	PrivacyPolicy     string `json:"privacy_policy"`
	RechargeAgreement string `json:"recharge_agreement"`
}

// 内置默认协议：当系统设置中的对应项为空时，前端"留空使用默认内置协议"
// 的逻辑依赖这些默认值——保证用户协议与隐私政策始终存在，从而注册/登录的
// 同意勾选不会被静默关闭。
//
// 说明：默认部署通过站内文档站（docs-web）渲染完整多语种协议
// （docs-web/content/legal/<lang>/*.md），以下内置文本仅作为系统设置未配置
// 时的兜底（例如 docs_link 指向外部知识库、走 /api/<doc> 配置模式的场景）。
const defaultUserAgreement = `# 优特智能大模型服务平台用户协议

欢迎使用优特智能大模型服务平台（以下简称"本平台"）。在使用本平台提供的智能模型 API、路由及相关服务（以下统称"本服务"）之前，请您仔细阅读并充分理解本协议的全部内容。

## 一、协议的接受
1. 当您完成注册、登录或以其他方式使用本服务，即表示您已阅读、理解并同意接受本协议的全部内容。
2. 如您不同意本协议的任何条款，请勿使用本服务。

## 二、账户注册与管理
1. 您应提供真实、准确、完整的注册信息，并及时更新。
2. 您须妥善保管账户凭证，因保管不善导致的损失由您自行承担。
3. 您不得以任何方式转让、出借或共享您的账户。

## 三、服务使用规范
1. 您承诺不利用本服务从事任何违反法律法规、危害国家安全、侵害他人合法权益的活动。
2. 您不得对模型输出进行篡改、冒用或用于欺骗性用途。
3. 您应合理使用服务资源，不得进行恶意刷量、攻击或干扰平台正常运行。

## 四、知识产权
1. 本平台及相关软件的著作权、商标权等知识产权均归深圳优特网络有限公司所有。
2. 您使用本服务所生成内容的知识产权归属，依据您与平台之间的另行约定或相关法律规定确定。

## 五、费用与充值
1. 本服务按照公开费率进行计费，具体标准以平台公示为准。
2. 充值一经完成，除法律法规另有规定或平台另有明确承诺外，原则上不予退款。

## 六、免责声明
1. 本服务按"现状"提供，平台不保证服务不间断、无错误。
2. 模型生成内容由人工智能自动产生，平台不对内容的准确性、完整性作保证，您应自行判断并承担使用风险。

## 七、协议变更
平台有权根据业务需要适时修订本协议，修订后的协议将在平台公示后生效。

## 八、法律适用
本协议的订立、执行、解释及争议解决均适用中华人民共和国法律。

如您对本协议有任何疑问，可联系 support@uter.ai。`

const defaultPrivacyPolicy = `# 优特智能大模型服务平台隐私政策

保护用户隐私是深圳优特网络有限公司（以下简称"我们"）的基本原则。本政策说明我们在您使用优特智能大模型服务平台（以下简称"本平台"）时如何收集、使用、存储和保护您的信息。

## 一、我们收集的信息
1. 账户信息：您注册时提供的邮箱、手机号及必要的身份资料。
2. 使用数据：您调用模型 API 的请求内容、用量及日志。
3. 设备与网络信息：访问本平台所使用的设备类型、IP 地址等。

## 二、信息的使用
1. 为您提供、维护并改进本服务。
2. 进行身份认证、安全风控与计费结算。
3. 在法律要求或为您提供服务所必需的范围内处理您的数据。

## 三、信息的存储与安全
1. 我们采取合理的技术与管理措施保护您的信息安全。
2. 您的数据存储于中华人民共和国境内的服务器，存储期限为实现服务目的所必需的最短时间。

## 四、信息的共享
除以下情形外，我们不会向第三方提供您的个人信息：
1. 获得您的明确同意；
2. 依据法律法规或监管要求的强制披露；
3. 为完成您所请求的服务而必须进行的必要共享。

## 五、您的权利
您有权查询、更正或删除您的个人信息，并可联系我们撤回部分授权。

## 六、未成年人保护
我们重视未成年人个人信息保护，不主动向未成年人收集信息。

## 七、联系我们
如您对本政策有任何疑问，可联系 privacy@uter.ai。

本政策将随法律法规及业务调整而更新，更新后以平台公示版本为准。`

const defaultRechargeAgreement = `# 优特智能大模型服务平台充值协议

1. 您通过本平台进行的每一次充值，均为预付费性质，充值金额用于抵扣您使用本服务产生的算力消耗。
2. 充值完成后，对应额度将实时计入您的账户余额，您可在账户中心查询。
3. 除法律法规另有规定或平台另有明确承诺外，充值款项一经到账原则上不予退款。
4. 如发生重复充值、系统故障导致的误充等异常情况，请联系 support@uter.ai 处理。
5. 本平台保留在法律允许范围内对充值及退款规则进行调整的权利，调整后将通过平台公示。`

var defaultLegalSettings = LegalSettings{
	UserAgreement:     "",
	PrivacyPolicy:     "",
	RechargeAgreement: "",
}

func init() {
	config.GlobalConfig.Register("legal", &defaultLegalSettings)
}

func GetLegalSettings() *LegalSettings {
	return &defaultLegalSettings
}

// GetUserAgreement 返回配置的用户协议；未配置时返回内置默认协议。
func (s *LegalSettings) GetUserAgreement() string {
	if s.UserAgreement != "" {
		return s.UserAgreement
	}
	return defaultUserAgreement
}

// GetPrivacyPolicy 返回配置的隐私政策；未配置时返回内置默认政策。
func (s *LegalSettings) GetPrivacyPolicy() string {
	if s.PrivacyPolicy != "" {
		return s.PrivacyPolicy
	}
	return defaultPrivacyPolicy
}

// GetRechargeAgreement 返回配置的充值协议；未配置时返回内置默认协议。
func (s *LegalSettings) GetRechargeAgreement() string {
	if s.RechargeAgreement != "" {
		return s.RechargeAgreement
	}
	return defaultRechargeAgreement
}

// ResolveUserAgreement 将系统设置值解析为可展示内容：
//   - 空字符串 → 内置默认协议（保证留空也有内容，注册/登录同意勾选不被关闭）；
//   - 完整 URL（http/https）→ 原样返回，由前端作为外部链接处理；
//   - 本地 Markdown 文件路径 → 读取文件内容返回；
//   - 其他（如直接粘贴的 Markdown/HTML）→ 原样返回，保持向后兼容。
func (s *LegalSettings) ResolveUserAgreement() string {
	return resolveLegalRef(s.UserAgreement, defaultUserAgreement)
}

// ResolvePrivacyPolicy 同 ResolveUserAgreement，作用于隐私政策。
func (s *LegalSettings) ResolvePrivacyPolicy() string {
	return resolveLegalRef(s.PrivacyPolicy, defaultPrivacyPolicy)
}

// ResolveRechargeAgreement 同 ResolveUserAgreement，作用于充值协议。
func (s *LegalSettings) ResolveRechargeAgreement() string {
	return resolveLegalRef(s.RechargeAgreement, defaultRechargeAgreement)
}

func resolveLegalRef(ref, fallback string) string {
	ref = strings.TrimSpace(ref)
	if ref == "" {
		return fallback
	}
	if isHTTPURL(ref) {
		return ref
	}
	if isLocalDocPath(ref) {
		content, err := readLegalDocFile(ref)
		if err == nil {
			return content
		}
		// 读取失败（文件缺失 / 越权路径等）回退默认，保证页面始终有合法内容。
		fmt.Printf("[legal] failed to read legal doc %q, falling back to built-in default: %v\n", ref, err)
		return fallback
	}
	return ref
}

func isHTTPURL(s string) bool {
	return strings.HasPrefix(s, "http://") || strings.HasPrefix(s, "https://")
}

// isLocalDocPath 判断是否为本地文档路径引用（而非 URL 或直接粘贴的内容）。
// 拒绝包含 ".." 的越权路径；以 .md/.markdown 结尾或含路径分隔符即视为路径引用。
func isLocalDocPath(s string) bool {
	if strings.Contains(s, "..") {
		return false
	}
	return strings.HasSuffix(s, ".md") ||
		strings.HasSuffix(s, ".markdown") ||
		(strings.Contains(s, "/") && !isHTTPURL(s))
}

// readLegalDocFile 从可配置根目录读取文档内容。
// 根目录取环境变量 UTER_LEGAL_DOCS_ROOT，缺省为进程当前工作目录（即仓库根）。
// 解析后的绝对路径必须位于根目录之内，防止路径穿越。
func readLegalDocFile(ref string) (string, error) {
	root := os.Getenv("UTER_LEGAL_DOCS_ROOT")
	if root == "" {
		wd, err := os.Getwd()
		if err != nil {
			return "", err
		}
		root = wd
	}
	target := filepath.Clean(filepath.Join(root, ref))
	absRoot, err := filepath.Abs(root)
	if err != nil {
		return "", err
	}
	if target != absRoot && !strings.HasPrefix(target, absRoot+string(os.PathSeparator)) {
		return "", fmt.Errorf("path escapes docs root")
	}
	data, err := os.ReadFile(target)
	if err != nil {
		return "", err
	}
	return string(data), nil
}
