package controller

import (
	"crypto/subtle"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/setting/system_setting"

	"github.com/gin-gonic/gin"
)

// 微信开放平台「网站应用」登录（PC 网页扫码登录）。
//
// 微信登录唯一方案：走标准 OAuth2 授权码流程——前端重定向到
// open.weixin.qq.com/connect/qrconnect，用户扫码后微信携带 code 回跳到后端
// /api/oauth/wechat-web，本文件用 AppSecret 换 openid（或 unionid），再复用
// oauth-flow 的 CSRF 校验与 setupLogin 完成登录/注册。
//
// 身份标识：默认用网站应用 openid；当 WeChatWebUseUnionId 开启且微信返回 unionid
// 时，改用 unionid，以便与同开放平台下的公众号/小程序/移动应用打通同一用户。

type wechatWebTokenResponse struct {
	AccessToken  string `json:"access_token"`
	ExpiresIn    int    `json:"expires_in"`
	RefreshToken string `json:"refresh_token"`
	OpenId       string `json:"openid"`
	Scope        string `json:"scope"`
	UnionId      string `json:"unionid"`
	ErrCode      int    `json:"errcode"`
	ErrMsg       string `json:"errmsg"`
}

// getWeChatWebOpenId 用授权码向微信换取 openid / unionid。
func getWeChatWebOpenId(code string) (string, string, error) {
	if code == "" {
		return "", "", common.NewMessage("Invalid parameters")
	}
	if common.WeChatWebAppId == "" || common.WeChatWebAppSecret == "" {
		return "", "", common.NewMessage("WeChat website app is not configured")
	}
	endpoint := fmt.Sprintf(
		"https://api.weixin.qq.com/sns/oauth2/access_token?appid=%s&secret=%s&code=%s&grant_type=authorization_code",
		url.QueryEscape(common.WeChatWebAppId),
		url.QueryEscape(common.WeChatWebAppSecret),
		url.QueryEscape(code),
	)
	req, err := http.NewRequest("GET", endpoint, nil)
	if err != nil {
		return "", "", err
	}
	client := http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()
	var tokenResp wechatWebTokenResponse
	if err := common.DecodeJson(resp.Body, &tokenResp); err != nil {
		return "", "", err
	}
	if tokenResp.ErrCode != 0 {
		return "", "", common.NewMessage(
			fmt.Sprintf("WeChat error %d: %s", tokenResp.ErrCode, tokenResp.ErrMsg),
		)
	}
	if tokenResp.OpenId == "" {
		return "", "", common.NewMessage("WeChat did not return an openid")
	}
	return tokenResp.OpenId, tokenResp.UnionId, nil
}

func isWeChatWebIdTaken(identity string) bool {
	var count int64
	model.DB.Unscoped().Model(&model.User{}).Where("wechat_web_id = ?", identity).Count(&count)
	return count == 1
}

func fillUserByWeChatWebId(user *model.User) error {
	return model.DB.Where("wechat_web_id = ?", user.WeChatWebId).First(user).Error
}

// wechatWebReturnOriginAllowed 校验发起 origin 的 host 是否在白名单内：
// 仅允许当前请求 Host、站点 ServerAddress 与微信授权回调域三者，防止
// flow 被用来向任意外部域转发 code/state（open-redirect）。
func wechatWebReturnOriginAllowed(origin string, requestHost string) bool {
	parsed, err := url.Parse(origin)
	if err != nil || parsed.Host == "" || parsed.Scheme != "https" {
		return false
	}
	if parsed.Path != "" && parsed.Path != "/" {
		return false
	}
	if parsed.RawQuery != "" || parsed.Fragment != "" {
		return false
	}
	candidates := map[string]struct{}{}
	for _, candidate := range []string{
		requestHost,
		system_setting.ServerAddress,
		common.WeChatWebCallbackDomain,
	} {
		candidate = strings.TrimSpace(candidate)
		if candidate == "" {
			continue
		}
		if host := hostFromSiteAddress(candidate); host != "" {
			candidates[strings.ToLower(host)] = struct{}{}
		}
	}
	_, ok := candidates[strings.ToLower(parsed.Host)]
	return ok
}

// hostFromSiteAddress 从「origin 或裸域名」里取出 host：既能处理
// https://uter.ai，也能处理 uter.cc / wx.uter.cc。
func hostFromSiteAddress(address string) string {
	address = strings.TrimSpace(address)
	if address == "" {
		return ""
	}
	if !strings.Contains(address, "://") {
		return strings.TrimSuffix(strings.SplitN(address, "/", 2)[0], "/")
	}
	if parsed, err := url.Parse(address); err == nil {
		return parsed.Host
	}
	return ""
}

// wechatStateRequest is the request body for minting a WeChat website-app
// state token. Origin 记录登录发起页 origin，供回调页跳回主站
// （wechatWebReturnOriginAllowed 校验白名单后写入 flow）。
type wechatStateRequest struct {
	Intent string `json:"intent"`
	Origin string `json:"origin,omitempty"`
}

// GenerateWeChatWebCode issues a CSRF-bound state token for WeChat website-app
// login. Login tokens set the oauth_login_nonce
// cookie so the callback can prove it originated from the browser that started
// the flow. The request may carry the browser origin where login was started;
// after the provider redirects to the registered callback domain (an ICP-filed
// domain that is not the main site), the callback page hops back to this origin
// so the session cookie lands on the main-site domain.
func GenerateWeChatWebCode(c *gin.Context) {
	var req wechatStateRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	req.Intent = strings.TrimSpace(req.Intent)
	if req.Intent != model.AuthFlowIntentLogin {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}

	payload := oauthFlowPayload{}
	expiresAt := time.Now().Add(oauthAuthFlowTTL)

	if req.Origin != "" {
		if !wechatWebReturnOriginAllowed(req.Origin, c.Request.Host) {
			common.ApiErrorT(c, "Invalid parameters")
			return
		}
		payload.ReturnOrigin = strings.TrimSuffix(req.Origin, "/")
	}

	loginNonce, err := generateOAuthLoginNonce()
	if err != nil {
		writeSecurityOperationError(c, err)
		return
	}
	payload.LoginNonce = loginNonce

	payloadBytes, err := common.Marshal(payload)
	if err != nil {
		writeSecurityOperationError(c, err)
		return
	}
	state, _, err := model.CreateAuthFlow(model.AuthFlowCreate{
		Purpose:   model.AuthFlowPurposeOAuth,
		Provider:  "wechat_web",
		Intent:    req.Intent,
		Payload:   string(payloadBytes),
		ExpiresAt: expiresAt,
	})
	if err != nil {
		writeSecurityOperationError(c, err)
		return
	}
	setOAuthLoginNonceCookie(c, payload.LoginNonce)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    gin.H{"flow_token": state, "expires_at": expiresAt.Unix()},
	})
}

// GetWeChatWebFlowOrigin returns (without consuming) the browser origin a
// WeChat website-app login was started from, so the callback page hosted on
// the registered callback domain can hop back to the main-site domain before
// the login is performed there (where the oauth_login_nonce cookie lives).
func GetWeChatWebFlowOrigin(c *gin.Context) {
	state := strings.TrimSpace(c.Query("state"))
	if state == "" {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	pendingFlow, err := model.GetAuthFlow(state, model.AuthFlowMatch{
		Purpose:  model.AuthFlowPurposeOAuth,
		Provider: "wechat_web",
		Intent:   model.AuthFlowIntentLogin,
	})
	if err != nil {
		common.ApiErrorT(c, "Invalid or expired login session")
		return
	}
	var loginPayload oauthFlowPayload
	if err := common.UnmarshalJsonStr(pendingFlow.Payload, &loginPayload); err != nil {
		common.ApiErrorT(c, "Invalid or expired login session")
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    gin.H{"origin": loginPayload.ReturnOrigin},
	})
}

// WeChatWebAuth handles the WeChat website-app redirect callback: verifies the
// CSRF-bound state token + login nonce, exchanges the code for an openid/unionid,
// then logs in or registers the user.
func WeChatWebAuth(c *gin.Context) {
	if !common.WeChatWebAuthEnabled {
		common.ApiErrorT(c, "{{provider}} login and registration has not been enabled by administrator", providerParams("WeChat"))
		return
	}
	// CSRF protection: the login must be tied to a state token issued to this
	// browser (the oauth_login_nonce cookie) when the flow started.
	state := c.Query("state")
	pendingFlow, err := model.GetAuthFlow(state, model.AuthFlowMatch{
		Purpose:  model.AuthFlowPurposeOAuth,
		Provider: "wechat_web",
		Intent:   model.AuthFlowIntentLogin,
	})
	if err != nil {
		common.ApiErrorT(c, "Invalid or expired login session")
		return
	}
	var loginPayload oauthFlowPayload
	if err := common.UnmarshalJsonStr(pendingFlow.Payload, &loginPayload); err != nil || loginPayload.LoginNonce == "" {
		common.ApiErrorT(c, "Invalid or expired login session")
		return
	}
	cookieNonce, err := c.Cookie(oauthLoginNonceCookie)
	if err != nil || subtle.ConstantTimeCompare([]byte(cookieNonce), []byte(loginPayload.LoginNonce)) != 1 {
		common.ApiErrorT(c, "Invalid or expired login session")
		return
	}
	if _, err := model.ConsumeAuthFlow(state, model.AuthFlowMatch{
		Purpose:  model.AuthFlowPurposeOAuth,
		Provider: "wechat_web",
		Intent:   model.AuthFlowIntentLogin,
	}); err != nil {
		common.ApiErrorT(c, "Invalid or expired login session")
		return
	}
	code := c.Query("code")
	openid, unionid, err := getWeChatWebOpenId(code)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	identity := openid
	if common.WeChatWebUseUnionId && unionid != "" {
		identity = unionid
	}
	user := model.User{
		WeChatWebId: identity,
	}
	if isWeChatWebIdTaken(identity) {
		if err := fillUserByWeChatWebId(&user); err != nil {
			common.ApiError(c, err)
			return
		}
		if user.Id == 0 {
			common.ApiErrorT(c, "User has been deleted")
			return
		}
	} else {
		if common.RegisterEnabled {
			user.Username = "wechat_web_" + strconv.Itoa(model.GetMaxUserId()+1)
			user.DisplayName = "WeChat User"
			user.Role = common.RoleCommonUser
			user.Status = common.UserStatusEnabled

			if err := user.Insert(0); err != nil {
				common.ApiError(c, err)
				return
			}
		} else {
			common.ApiErrorT(c, "New user registration has been disabled by administrator")
			return
		}
	}

	if user.Status != common.UserStatusEnabled {
		common.ApiErrorT(c, "User has been banned")
		return
	}
	setupLogin(&user, nil, c)
}
