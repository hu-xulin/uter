package controller

import (
	"crypto/subtle"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/i18n"
	"github.com/uter-ai/uter/middleware"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/service"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type wechatLoginResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    string `json:"data"`
}

func getWeChatIdByCode(code string) (string, error) {
	if code == "" {
		return "", common.NewMessage("Invalid parameters")
	}
	req, err := http.NewRequest("GET", fmt.Sprintf("%s/api/wechat/user?code=%s", common.WeChatServerAddress, url.QueryEscape(code)), nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", common.WeChatServerToken)
	client := http.Client{
		Timeout: 5 * time.Second,
	}
	httpResponse, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer httpResponse.Body.Close()
	var res wechatLoginResponse
	err = common.DecodeJson(httpResponse.Body, &res)
	if err != nil {
		return "", err
	}
	if !res.Success {
		return "", errors.New(res.Message)
	}
	if res.Data == "" {
		return "", common.NewMessage("Verification code is incorrect or has expired")
	}
	return res.Data, nil
}

func WeChatAuth(c *gin.Context) {
	if !common.WeChatAuthEnabled {
		common.ApiErrorT(c, "{{provider}} login and registration has not been enabled by administrator", providerParams("WeChat"))
		return
	}
	// CSRF protection: the login must be tied to a state token issued to this
	// browser (the oauth_login_nonce cookie) when the flow started. Without it
	// an attacker could force a victim's browser into an attacker-controlled
	// WeChat login.
	state := c.Query("state")
	pendingFlow, err := model.GetAuthFlow(state, model.AuthFlowMatch{
		Purpose:  model.AuthFlowPurposeOAuth,
		Provider: "wechat",
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
		Provider: "wechat",
		Intent:   model.AuthFlowIntentLogin,
	}); err != nil {
		common.ApiErrorT(c, "Invalid or expired login session")
		return
	}
	code := c.Query("code")
	wechatId, err := getWeChatIdByCode(code)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	user := model.User{
		WeChatId: wechatId,
	}
	if model.IsWeChatIdAlreadyTaken(wechatId) {
		err := user.FillUserByWeChatId()
		if err != nil {
			common.ApiError(c, err)
			return
		}
		if user.Id == 0 {
			common.ApiErrorT(c, "User has been deleted")
			return
		}
	} else {
		if common.RegisterEnabled {
			user.Username = "wechat_" + strconv.Itoa(model.GetMaxUserId()+1)
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

type wechatBindRequest struct {
	Code  string `json:"code"`
	State string `json:"state"`
}

func WeChatBind(c *gin.Context) {
	identity, ok := middleware.GetStepUpIdentity(c)
	if !ok {
		writeSecurityOperationError(c, service.ErrAuthTokenInvalid)
		return
	}
	// Bind callbacks must be pinned to the authenticated session that started
	// the flow, so a state token cannot be replayed against another session
	// (cross-session binding CSRF).
	sessionIdentity, ok := middleware.GetSessionAuthIdentity(c)
	if !ok || sessionIdentity.UserID != identity.UserID || sessionIdentity.SessionID != identity.SessionID {
		common.ApiErrorT(c, "Invalid or expired binding session")
		return
	}
	succeeded, notificationFailed := false, false
	defer func() {
		recordUserSecurityAudit(c, identity.UserID, "user.binding_bind", map[string]any{"provider": "wechat", "success": succeeded, "notification_failed": notificationFailed})
	}()
	if !common.WeChatAuthEnabled {
		common.ApiErrorT(c, "{{provider}} login and registration has not been enabled by administrator", providerParams("WeChat"))
		return
	}
	var req wechatBindRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorT(c, "Invalid request")
		return
	}
	state := strings.TrimSpace(req.State)
	if _, err := model.GetAuthFlow(state, model.AuthFlowMatch{
		Purpose:   model.AuthFlowPurposeOAuth,
		Provider:  "wechat",
		Intent:    model.AuthFlowIntentBind,
		UserId:    sessionIdentity.UserID,
		SessionId: sessionIdentity.SessionID,
	}); err != nil {
		common.ApiErrorT(c, "Invalid or expired binding session")
		return
	}
	if _, err := model.ConsumeAuthFlow(state, model.AuthFlowMatch{
		Purpose:   model.AuthFlowPurposeOAuth,
		Provider:  "wechat",
		Intent:    model.AuthFlowIntentBind,
		UserId:    sessionIdentity.UserID,
		SessionId: sessionIdentity.SessionID,
	}); err != nil {
		common.ApiErrorT(c, "Invalid or expired binding session")
		return
	}
	code := strings.TrimSpace(req.Code)
	context, err := common.Marshal(service.AccountBindingContext{Provider: "wechat", Code: code})
	if err != nil {
		writeSecurityOperationError(c, err)
		return
	}
	if middleware.RequireSecurityProof(c, service.VerificationOperation{Scope: service.VerificationScopeAccountBind, Context: context}) == nil {
		return
	}
	wechatId, err := getWeChatIdByCode(code)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if model.IsWeChatIdAlreadyTaken(wechatId) {
		common.ApiErrorT(c, "This {{provider}} account has already been bound", providerParams("WeChat"))
		return
	}
	// 只更新绑定列，避免完整用户快照覆盖并发的封禁、降权或分组变更。
	if err := model.DB.Transaction(func(tx *gorm.DB) error {
		return model.UpdateUserBindColumnForSessionWithTx(tx, identity, "wechat_id", wechatId)
	}); err != nil {
		writeSecurityOperationError(c, err)
		return
	}
	succeeded = true
	user, err := model.GetUserById(identity.UserID, false)
	if err != nil {
		writeSecurityOperationError(c, err)
		return
	}
	notificationFailed = service.NotifyAccountSecurityChange(service.AccountMailLanguage(c, user.Id), user.Email, i18n.MsgSecurityEventWeChatLinked) != nil
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    gin.H{"notification_warning": notificationFailed},
	})
	return
}

// wechatStateRequest selects the WeChat auth intent for which a state token is
// being minted. Origin 仅微信网站应用方案使用：记录登录发起页 origin 供
// 回调页跳回主站（controller/wechat_web.go 校验白名单后写入 flow）。
type wechatStateRequest struct {
	Intent string `json:"intent"`
	Origin string `json:"origin,omitempty"`
}

// GenerateWeChatCode issues a CSRF-bound state token for WeChat login or binding,
// mirroring GenerateOAuthCode. Login tokens set the oauth_login_nonce cookie so
// the callback can prove it originated from the browser that started the flow;
// bind tokens are pinned to the authenticated session that requested them, which
// WeChatBind later re-checks to prevent cross-session binding replay.
func GenerateWeChatCode(c *gin.Context) {
	var req wechatStateRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	req.Intent = strings.TrimSpace(req.Intent)
	if req.Intent != model.AuthFlowIntentLogin && req.Intent != model.AuthFlowIntentBind {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}

	payload := oauthFlowPayload{}
	match := model.AuthFlowMatch{
		Purpose:  model.AuthFlowPurposeOAuth,
		Provider: "wechat",
		Intent:   req.Intent,
	}
	expiresAt := time.Now().Add(oauthAuthFlowTTL)

	if req.Intent == model.AuthFlowIntentLogin {
		loginNonce, err := generateOAuthLoginNonce()
		if err != nil {
			writeSecurityOperationError(c, err)
			return
		}
		payload.LoginNonce = loginNonce
	} else {
		identity, ok := middleware.GetSessionAuthIdentity(c)
		if !ok {
			writeAccountStatusError(c, http.StatusUnauthorized, "Sign in to bind an account")
			return
		}
		match.UserId = identity.UserID
		match.SessionId = identity.SessionID
	}

	payloadBytes, err := common.Marshal(payload)
	if err != nil {
		writeSecurityOperationError(c, err)
		return
	}
	state, _, err := model.CreateAuthFlow(model.AuthFlowCreate{
		Purpose:   model.AuthFlowPurposeOAuth,
		Provider:  "wechat",
		Intent:    req.Intent,
		UserId:    match.UserId,
		SessionId: match.SessionId,
		Payload:   string(payloadBytes),
		ExpiresAt: expiresAt,
	})
	if err != nil {
		writeSecurityOperationError(c, err)
		return
	}
	if req.Intent == model.AuthFlowIntentLogin {
		setOAuthLoginNonceCookie(c, payload.LoginNonce)
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    gin.H{"flow_token": state, "expires_at": expiresAt.Unix()},
	})
}
