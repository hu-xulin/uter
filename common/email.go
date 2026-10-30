package common

import (
	"crypto/tls"
	"encoding/base64"
	"fmt"
	"net/smtp"
	"slices"
	"strings"
	"time"
)

func generateMessageID(from string) (string, error) {
	split := strings.Split(from, "@")
	if len(split) < 2 {
		return "", fmt.Errorf("invalid SMTP account")
	}
	domain := strings.Split(from, "@")[1]
	return fmt.Sprintf("<%d.%s@%s>", time.Now().UnixNano(), GetRandomString(12), domain), nil
}

func shouldUseSMTPLoginAuth(account string) bool {
	if SMTPForceAuthLogin {
		return true
	}
	return isOutlookServer(account) || slices.Contains(EmailLoginAuthServerList, SMTPServer)
}

func getSMTPAuth(account string, token string) smtp.Auth {
	return AutoSMTPAuth(account, token)
}

func shouldAuthenticateSMTP(account string, token string) bool {
	return account != "" && token != ""
}

func smtpTLSConfig() *tls.Config {
	return &tls.Config{
		ServerName:         SMTPServer,
		InsecureSkipVerify: SMTPInsecureSkipVerify, // #nosec G402 -- admin-controlled SMTP compatibility option.
	}
}

func newSMTPClient(addr string) (*smtp.Client, error) {
	if SMTPSSLEnabled || (SMTPPort == 465 && !SMTPStartTLSEnabled) {
		conn, err := tls.Dial("tcp", addr, smtpTLSConfig())
		if err != nil {
			return nil, err
		}
		client, err := smtp.NewClient(conn, SMTPServer)
		if err != nil {
			_ = conn.Close()
			return nil, err
		}
		return client, nil
	}

	client, err := smtp.Dial(addr)
	if err != nil {
		return nil, err
	}

	if SMTPStartTLSEnabled {
		startTLSSupported, _ := client.Extension("STARTTLS")
		if !startTLSSupported {
			_ = client.Close()
			return nil, fmt.Errorf("SMTP server does not support STARTTLS")
		}
		if err := client.StartTLS(smtpTLSConfig()); err != nil {
			_ = client.Close()
			return nil, err
		}
	}

	return client, nil
}

// resolveSMTPSender 决定本次发信使用的账号。SMTPSenderProvider（多账号
// 轮换）返回空 Account 表示回退旧的单账号配置；返回 error（如全部邮箱
// 当日配额用完）直接终止发送。
func resolveSMTPSender() (account string, from string, token string, err error) {
	account, from, token = SMTPAccount, SMTPFrom, SMTPToken
	if SMTPSenderProvider == nil {
		return account, from, token, nil
	}
	creds, providerErr := SMTPSenderProvider()
	if providerErr != nil {
		return "", "", "", providerErr
	}
	if creds.Account != "" {
		account, from, token = creds.Account, creds.From, creds.Token
	}
	return account, from, token, nil
}

func SendEmail(subject string, receiver string, content string) error {
	OptionMapRWMutex.RLock()
	provider := OptionMap["EmailProvider"]
	resendKey := OptionMap["ResendApiKey"]
	resendFrom := OptionMap["ResendFrom"]
	OptionMapRWMutex.RUnlock()
	// One selector controls delivery. Never fall back to a second provider:
	// a failed response does not prove that the first provider did not send.
	switch provider {
	case "resend":
		return sendResendEmail(resendKey, resendFrom, subject, receiver, content)
	case "", "smtp": // Preserve existing installations without a selector.
	default:
		return NewMessage("Email sending method must be SMTP or Resend")
	}
	account, smtpFrom, token, err := resolveSMTPSender()
	if err != nil {
		return err
	}
	if smtpFrom == "" { // for compatibility
		smtpFrom = account
	}
	id, err2 := generateMessageID(smtpFrom)
	if err2 != nil {
		return err2
	}
	if SMTPServer == "" && account == "" {
		return NewMessage("SMTP server is not configured")
	}
	encodedSubject := fmt.Sprintf("=?UTF-8?B?%s?=", base64.StdEncoding.EncodeToString([]byte(subject)))
	mail := []byte(fmt.Sprintf("To: %s\r\n"+
		"From: %s <%s>\r\n"+
		"Subject: %s\r\n"+
		"Date: %s\r\n"+
		"Message-ID: %s\r\n"+ // 添加 Message-ID 头
		"Content-Type: text/html; charset=UTF-8\r\n\r\n%s\r\n",
		receiver, SystemName, smtpFrom, encodedSubject, time.Now().Format(time.RFC1123Z), id, content))
	auth := getSMTPAuth(account, token)
	addr := fmt.Sprintf("%s:%d", SMTPServer, SMTPPort)
	to := strings.Split(receiver, ";")
	client, err := newSMTPClient(addr)
	if err != nil {
		return err
	}
	defer client.Close()
	if shouldAuthenticateSMTP(account, token) {
		if err = client.Auth(auth); err != nil {
			return err
		}
	}
	if err = client.Mail(smtpFrom); err != nil {
		return err
	}
	for _, receiver := range to {
		if err = client.Rcpt(receiver); err != nil {
			return err
		}
	}
	w, err := client.Data()
	if err != nil {
		return err
	}
	_, err = w.Write(mail)
	if err != nil {
		return err
	}
	err = w.Close()
	if err != nil {
		return err
	}
	// DATA 阶段完成即视为已提交（此后 Quit 失败不代表邮件没发出），
	// 在此按账号累计当日用量，供多账号配额轮换使用。
	if account != "" && SMTPSentRecorder != nil {
		SMTPSentRecorder(account)
	}
	err = client.Quit()
	if err != nil {
		SysError(LogText("failed to send email to %s: %v", receiver, err))
	}
	return err
}
