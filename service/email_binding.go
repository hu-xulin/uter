package service

import (
	"crypto/rand"
	"errors"
	"fmt"
	"html"
	"math/big"
	"slices"
	"strings"
	"time"

	"github.com/uter-ai/uter/common"

	"github.com/uter-ai/uter/model"
)

var (
	ErrAccountEmailInvalid = errors.New("Please enter a valid email address")
	// ErrAccountEmailRestricted is the umbrella the email policy rejects with.
	// Uter keeps the two more specific errors below (they have different fixes
	// to suggest, so they must not share a message), and both unwrap to this
	// one — so errors.Is(err, ErrAccountEmailRestricted) matches either way.
	ErrAccountEmailRestricted = errors.New("This email address is not allowed by the administrator's email policy.")
	// ErrAccountEmailDomainRestricted covers addresses whose domain is not on
	// the whitelist. ErrAccountEmailAliasRestricted is deliberately separate:
	// the two have different fixes for the user, so they must not share a
	// message. These strings double as i18next keys on the frontend.
	ErrAccountEmailDomainRestricted error = emailPolicyError("This email domain is not supported. Please use an email address from another domain.")
	ErrAccountEmailAliasRestricted  error = emailPolicyError("Email aliases are not supported. Please use an email address without +, -, _ or . in the part before @, then try again.")
	ErrEmailBindingDelivery         = errors.New("Verification email could not be sent. Start email verification again.")
)

// emailPolicyError is one email-policy rejection that reports its own message
// while still matching ErrAccountEmailRestricted under errors.Is.
type emailPolicyError string

func (e emailPolicyError) Error() string { return string(e) }

func (e emailPolicyError) Unwrap() error { return ErrAccountEmailRestricted }

type EmailBindingData struct {
	FlowToken           string `json:"flow_token"`
	Email               string `json:"email"`
	CurrentEmail        string `json:"current_email,omitempty"`
	OldEmailRequired    bool   `json:"old_email_required"`
	ExpiresAt           int64  `json:"expires_at"`
	ResendAt            int64  `json:"resend_at"`
	NotificationWarning bool   `json:"notification_warning"`
}

// ValidateAccountEmail is shared with registration mail delivery so binding
// cannot bypass the site's existing domain, alias and address-length rules.
func ValidateAccountEmail(email string) (string, error) {
	email = model.NormalizeEmail(email)
	if common.Validate.Var(email, "required,email,max=50") != nil {
		return "", ErrAccountEmailInvalid
	}
	parts := strings.Split(email, "@")
	if len(parts) != 2 {
		return "", ErrAccountEmailInvalid
	}
	if common.EmailDomainRestrictionEnabled {
		allowed := slices.Contains(common.EmailDomainWhitelist, parts[1])
		if !allowed {
			return "", ErrAccountEmailDomainRestricted
		}
	}
	if common.EmailAliasRestrictionEnabled && strings.ContainsAny(parts[0], "+-_.") {
		return "", ErrAccountEmailAliasRestricted
	}
	return email, nil
}

func StartEmailBinding(identity AuthIdentity, authorization *model.AuthFlowAuthorization, email string) (*EmailBindingData, error) {
	email, err := ValidateAccountEmail(email)
	if err != nil {
		return nil, err
	}
	context, err := common.Marshal(AccountBindingContext{Provider: "email", Email: email})
	if err != nil {
		return nil, err
	}
	if err := ValidateFlowAuthorization(identity, VerificationOperation{Scope: VerificationScopeAccountBind, Context: context}, authorization); err != nil {
		return nil, err
	}
	user, err := model.GetUserById(identity.UserID, false)
	if err != nil {
		return nil, err
	}
	state := model.EmailBindingState{Authorization: authorization, CurrentEmail: model.NormalizeEmail(user.Email), Email: email, ResendAt: time.Now().Add(model.EmailBindingResendDelay).Unix()}
	requireOld := state.CurrentEmail != "" && authorization.Method != VerificationMethodTwoFA && authorization.Method != VerificationMethodPasskey
	codes, err := generateEmailBindingCodes(requireOld)
	if err != nil {
		return nil, err
	}
	state.NewCodeHash, state.OldCodeHash = codes.NewHash, codes.OldHash
	token, flow, err := model.CreateEmailBinding(identity, state)
	if err != nil {
		return nil, err
	}
	if err := sendEmailBindingCodes(state, codes); err != nil {
		// A partially delivered pair must not leave a usable change request.
		_, _ = model.ConsumeAuthFlow(token, model.AuthFlowMatch{Purpose: model.AuthFlowPurposeEmailBinding, UserId: identity.UserID, SessionId: identity.SessionID})
		return nil, ErrEmailBindingDelivery
	}
	data := emailBindingData(token, flow, &state)
	if state.CurrentEmail != "" && !requireOld {
		data.NotificationWarning = NotifyAccountSecurityChange(state.CurrentEmail, "有人请求更改您帐号的邮箱地址") != nil
	}
	return data, nil
}

func ResendAccountEmailBinding(identity AuthIdentity, token string) (*EmailBindingData, error) {
	_, state, err := model.GetEmailBinding(identity, token)
	if err != nil {
		return nil, err
	}
	context, err := common.Marshal(AccountBindingContext{Provider: "email", Email: state.Email})
	if err != nil {
		return nil, err
	}
	if err := ValidateFlowAuthorization(identity, VerificationOperation{Scope: VerificationScopeAccountBind, Context: context}, state.Authorization); err != nil {
		return nil, err
	}
	if state.ResendAt > time.Now().Unix() {
		return nil, model.ErrEmailBindingResendWait
	}
	if state.FailedAttempts >= model.EmailBindingMaxAttempts {
		return nil, model.ErrEmailBindingLocked
	}
	codes, err := generateEmailBindingCodes(state.OldCodeHash != "")
	if err != nil {
		return nil, err
	}
	flow, state, err := model.ResendEmailBinding(identity, token, codes.NewHash, codes.OldHash)
	if err != nil {
		return nil, err
	}
	if err := sendEmailBindingCodes(*state, codes); err != nil {
		_, _ = model.ConsumeAuthFlow(token, model.AuthFlowMatch{Purpose: model.AuthFlowPurposeEmailBinding, UserId: identity.UserID, SessionId: identity.SessionID})
		return nil, ErrEmailBindingDelivery
	}
	return emailBindingData(token, flow, state), nil
}

func FinishEmailBinding(identity AuthIdentity, token, newCode, oldCode string) (*model.EmailBindingState, error) {
	_, state, err := model.GetEmailBinding(identity, token)
	if err != nil {
		return nil, err
	}
	context, err := common.Marshal(AccountBindingContext{Provider: "email", Email: state.Email})
	if err != nil {
		return nil, err
	}
	if err := ValidateFlowAuthorization(identity, VerificationOperation{Scope: VerificationScopeAccountBind, Context: context}, state.Authorization); err != nil {
		return nil, err
	}
	if _, err := ValidateAccountEmail(state.Email); err != nil {
		return nil, err
	}
	return model.CompleteEmailBinding(identity, token, state.Email, newCode, oldCode)
}

type emailBindingCodes struct {
	New, Old         string
	NewHash, OldHash string
}

func generateEmailBindingCodes(requireOld bool) (emailBindingCodes, error) {
	var codes emailBindingCodes
	count := 1
	if requireOld {
		count = 2
	}
	for index := 0; index < count; {
		number, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
		if err != nil {
			return codes, err
		}
		code := fmt.Sprintf("%06d", number.Int64())
		if code == codes.New {
			continue
		}
		hash, err := common.Password2Hash(code)
		if err != nil {
			return codes, err
		}
		if index == 0 {
			codes.New, codes.NewHash = code, hash
		} else {
			codes.Old, codes.OldHash = code, hash
		}
		index++
	}
	return codes, nil
}

func sendEmailBindingCodes(state model.EmailBindingState, codes emailBindingCodes) error {
	subject := common.BrandEmailSubject(fmt.Sprintf("邮箱绑定验证码： %s", codes.New))
	content := common.BuildBrandEmailHTML(common.BrandEmail{
		Heading: "确认您的邮箱地址",
		Paragraphs: []string{
			fmt.Sprintf("%s 收到了将 <strong>%s</strong> 绑定到您账号的请求。", common.EmailBrandName, html.EscapeString(state.Email)),
			"请使用此验证码完成邮箱绑定：",
		},
		Code: codes.New,
		Note: "此验证码将在 10 分钟后失效。如果这不是您发起的操作，请不要分享此验证码。",
	})
	if err := common.SendEmail(subject, state.Email, content); err != nil {
		return err
	}
	if codes.Old != "" {
		oldSubject := common.BrandEmailSubject(fmt.Sprintf("邮箱绑定验证码： %s", codes.Old))
		oldContent := common.BuildBrandEmailHTML(common.BrandEmail{
			Heading: "确认更换您的邮箱地址",
			Paragraphs: []string{
				"有人请求更换您帐号的邮箱地址，请使用此验证码确认替换当前邮箱：",
			},
			Code: codes.Old,
			Note: "此验证码将在 10 分钟后失效。如果这不是您发起的操作，请不要分享此验证码并联系管理员。",
		})
		return common.SendEmail(oldSubject, state.CurrentEmail, oldContent)
	}
	return nil
}

func emailBindingData(token string, flow *model.AuthFlow, state *model.EmailBindingState) *EmailBindingData {
	return &EmailBindingData{
		FlowToken: token, Email: state.Email, CurrentEmail: common.MaskEmail(state.CurrentEmail),
		OldEmailRequired: state.OldCodeHash != "", ExpiresAt: flow.ExpiresAt.Unix(), ResendAt: state.ResendAt,
	}
}
