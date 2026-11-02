/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@uter.ai
*/
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from '@tanstack/react-router'
import { Loader2, LogIn, KeyRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { z } from 'zod'

import { PasswordInput } from '@/components/password-input'
import { Turnstile } from '@/components/turnstile'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  login,
  loginByEmailCode,
  requestLoginEmailCode,
} from '@/features/auth/api'
import { LegalConsent } from '@/features/auth/components/legal-consent'
import { OAuthProviders } from '@/features/auth/components/oauth-providers'
import { loginFormSchema } from '@/features/auth/constants'
import { useAuthRedirect } from '@/features/auth/hooks/use-auth-redirect'
import { useTurnstile } from '@/features/auth/hooks/use-turnstile'
import { beginPasskeyLogin, finishPasskeyLogin } from '@/features/auth/passkey'
import {
  requestPasskeyAssertion,
  rememberPasskeyRPID,
  type PasskeyDomains,
} from '@/features/auth/passkey/assertion'
import { PasskeyDomainSelector } from '@/features/auth/passkey/components/passkey-domain-selector'
import type { AuthFormProps } from '@/features/auth/types'
import { useStatus } from '@/hooks/use-status'
import { handleServerError } from '@/lib/handle-server-error'
import { isPasskeySupported as detectPasskeySupport } from '@/lib/passkey'
import { AuthOperationError } from '@/lib/secure-verification'
import { createServerError } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

export function UserAuthForm({
  className,
  redirectTo,
  ...props
}: AuthFormProps) {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)
  const [agreedToLegal, setAgreedToLegal] = useState(false)
  const [passkeySupported, setPasskeySupported] = useState(false)
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false)
  const [passkeyDomains, setPasskeyDomains] = useState<PasskeyDomains | null>(
    null
  )
  const [passkeyRPID, setPasskeyRPID] = useState<string>()
  const passkeyOperation = useRef<AbortController | null>(null)
  useEffect(() => () => passkeyOperation.current?.abort(), [])
  const [turnstileWidgetKey, setTurnstileWidgetKey] = useState(0)
  // ── 邮箱验证码登录 ─────────────────────────────────────────────
  // 与密码登录共用同一个 Turnstile 挂件：发送与提交各自消耗一枚 token，
  // 每次用掉后立刻重置挂件（同 onSubmit 的做法），下次操作重新过人机校验。
  const [loginMode, setLoginMode] = useState<'password' | 'email-code'>(
    'password'
  )
  const [codeEmail, setCodeEmail] = useState('')
  const [codeValue, setCodeValue] = useState('')
  const [isSendingCode, setIsSendingCode] = useState(false)
  const [isCodeLoginLoading, setIsCodeLoginLoading] = useState(false)
  const [codeResendSeconds, setCodeResendSeconds] = useState(0)
  const legalConsentErrorMessage = t('Please agree to the legal terms first')
  const loginFailedMessage = t('Login failed')

  const { status } = useStatus()
  const passkeyLoginEnabled = Boolean(
    status?.passkey_login ?? status?.data?.passkey_login
  )
  const passwordLoginEnabled =
    (status?.password_login_enabled ??
      status?.data?.password_login_enabled ??
      true) !== false
  const passwordLoginEncryptionEnabled =
    (status?.password_login_encryption_enabled ??
      status?.data?.password_login_encryption_enabled ??
      false) === true
  const emailCodeLoginEnabled = Boolean(
    status?.email_code_login ?? status?.data?.email_code_login
  )
  const {
    isTurnstileEnabled,
    turnstileSiteKey,
    turnstileToken,
    setTurnstileToken,
    validateTurnstile,
  } = useTurnstile()
  const { handleLoginResult } = useAuthRedirect()

  const hasUserAgreement = Boolean(status?.user_agreement_enabled)
  const hasPrivacyPolicy = Boolean(status?.privacy_policy_enabled)
  const requiresLegalConsent = hasUserAgreement || hasPrivacyPolicy
  const passkeyButtonDisabled =
    isPasskeyLoading ||
    !passkeySupported ||
    (requiresLegalConsent && !agreedToLegal)
  const hasOAuthLogin = Boolean(
    status?.github_oauth ||
    status?.discord_oauth ||
    status?.oidc_enabled ||
    status?.linuxdo_oauth ||
    status?.telegram_oauth ||
    (status?.custom_oauth_providers?.length ?? 0) > 0
  )
  const hasAlternativeLogin = passkeyLoginEnabled || hasOAuthLogin

  // 密码登录关闭时，验证码视图的入口按钮（在密码块内部）也随之消失，
  // 必须自动切到邮箱验证码视图，否则登录表单整块不可见。
  useEffect(() => {
    if (!passwordLoginEnabled && emailCodeLoginEnabled) {
      setLoginMode('email-code')
    }
  }, [passwordLoginEnabled, emailCodeLoginEnabled])

  useEffect(() => {
    if (requiresLegalConsent) {
      setAgreedToLegal(false)
    } else {
      setAgreedToLegal(true)
    }
  }, [requiresLegalConsent])

  useEffect(() => {
    detectPasskeySupport()
      .then(setPasskeySupported)
      .catch(() => setPasskeySupported(false))
  }, [])

  // 发送验证码后的重发倒计时。
  useEffect(() => {
    if (codeResendSeconds <= 0) return
    const timer = setTimeout(() => setCodeResendSeconds((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [codeResendSeconds])

  const resetTurnstileForNextUse = () => {
    if (isTurnstileEnabled) {
      setTurnstileToken('')
      setTurnstileWidgetKey((current) => current + 1)
    }
  }

  async function handleSendLoginCode() {
    if (requiresLegalConsent && !agreedToLegal) {
      toast.error(legalConsentErrorMessage)
      return
    }
    if (!codeEmail.trim()) {
      toast.error(t('Enter your email'))
      return
    }
    if (!validateTurnstile()) return

    const submittedTurnstileToken = turnstileToken
    resetTurnstileForNextUse()
    setIsSendingCode(true)
    try {
      const res = await requestLoginEmailCode(
        codeEmail.trim(),
        submittedTurnstileToken
      )
      if (res.success) {
        // 后端对未注册邮箱返回同样的成功响应（防枚举），前端不区分，
        // 只提示「已发送，请查收」。
        setCodeResendSeconds(60)
        toast.success(t('Email code sent. Please check your inbox.'))
      } else {
        handleServerError(
          createServerError(res, t('Failed to send verification code'))
        )
      }
    } catch (error: unknown) {
      handleServerError(
        AuthOperationError.from(error, t('Failed to send verification code'))
      )
    } finally {
      setIsSendingCode(false)
    }
  }

  async function onEmailCodeSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (requiresLegalConsent && !agreedToLegal) {
      toast.error(legalConsentErrorMessage)
      return
    }
    if (!codeEmail.trim() || !codeValue.trim()) {
      if (!codeEmail.trim()) toast.error(t('Enter your email'))
      else toast.error(t('Enter the verification code'))
      return
    }
    if (!validateTurnstile()) return

    const submittedTurnstileToken = turnstileToken
    resetTurnstileForNextUse()
    setIsCodeLoginLoading(true)
    try {
      const res = await loginByEmailCode(
        codeEmail.trim(),
        codeValue.trim(),
        submittedTurnstileToken
      )
      if (res.success) {
        setCodeValue('')
        if (await handleLoginResult(res.data, redirectTo)) {
          toast.success(t('Welcome back!'))
        }
      } else {
        handleServerError(createServerError(res, loginFailedMessage))
      }
    } catch (error: unknown) {
      handleServerError(AuthOperationError.from(error, loginFailedMessage))
    } finally {
      setIsCodeLoginLoading(false)
    }
  }

  const form = useForm<z.infer<typeof loginFormSchema>>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  })

  async function onSubmit(data: z.infer<typeof loginFormSchema>) {
    if (requiresLegalConsent && !agreedToLegal) {
      toast.error(legalConsentErrorMessage)
      return
    }

    if (!validateTurnstile()) return

    const submittedTurnstileToken = turnstileToken
    if (isTurnstileEnabled) {
      setTurnstileToken('')
      setTurnstileWidgetKey((current) => current + 1)
    }

    setIsLoading(true)
    try {
      const res = await login({
        username: data.username,
        password: data.password,
        turnstile: submittedTurnstileToken,
        passwordEncryptionEnabled: passwordLoginEncryptionEnabled,
      })

      if (res.success) {
        form.setValue('password', '')
        if (await handleLoginResult(res.data, redirectTo)) {
          toast.success(t('Welcome back!'))
        }
      } else {
        handleServerError(createServerError(res, loginFailedMessage))
      }
    } catch (error: unknown) {
      handleServerError(AuthOperationError.from(error, loginFailedMessage))
    } finally {
      setIsLoading(false)
    }
  }

  async function handlePasskeyLogin() {
    if (requiresLegalConsent && !agreedToLegal) {
      toast.error(legalConsentErrorMessage)
      return
    }

    if (!passkeySupported) {
      toast.error(t('Passkey is not supported on this device'))
      return
    }

    if (!navigator?.credentials) {
      toast.error(t('Passkey is not available in this browser'))
      return
    }

    if (passkeyOperation.current) return
    const controller = new AbortController()
    passkeyOperation.current = controller
    setIsPasskeyLoading(true)
    try {
      const passkey = await requestPasskeyAssertion(
        (rpID) => beginPasskeyLogin(rpID, controller.signal),
        controller.signal,
        { rpID: passkeyRPID, onDomains: setPasskeyDomains }
      )
      const finish = await finishPasskeyLogin(
        passkey.flowToken,
        passkey.assertion,
        controller.signal
      )
      controller.signal.throwIfAborted()
      if (!finish.success) {
        throw createServerError(finish, t('Failed to complete Passkey login'))
      }

      rememberPasskeyRPID(passkey.rpID)
      if (await handleLoginResult(finish.data, redirectTo)) {
        toast.success(t('Signed in with Passkey'))
      }
    } catch (error: unknown) {
      if (controller.signal.aborted) return
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        toast.info(t('Passkey login was cancelled or timed out'))
      } else if (error instanceof Error) {
        handleServerError(AuthOperationError.from(error))
      } else {
        handleServerError(
          AuthOperationError.from(error, t('Passkey login failed'))
        )
      }
    } finally {
      if (passkeyOperation.current === controller) {
        passkeyOperation.current = null
      }
      setIsPasskeyLoading(false)
    }
  }

  const alternativeLoginMethods = (
    <>
      {passkeyLoginEnabled && (
        <div className='mt-2 space-y-1'>
          <Button
            type='button'
            variant='outline'
            disabled={passkeyButtonDisabled}
            onClick={handlePasskeyLogin}
            className='hover:bg-primary hover:text-primary-foreground dark:hover:bg-primary dark:hover:text-primary-foreground hover:[&_svg]:text-primary-foreground dark:hover:[&_svg]:text-primary-foreground h-(--ds-control-height-md) w-full justify-center gap-2 hover:border-transparent dark:hover:border-transparent'
          >
            {isPasskeyLoading ? (
              <Loader2 className='h-4.5 w-4.5 animate-spin' />
            ) : (
              <KeyRound className='h-4.5 w-4.5' />
            )}
            {t('Sign in with Passkey')}
          </Button>
          <PasskeyDomainSelector
            domains={passkeyDomains}
            value={passkeyRPID}
            onChange={setPasskeyRPID}
            disabled={passkeyButtonDisabled}
          />
          {!passkeySupported && (
            <p className='text-muted-foreground text-sm'>
              {t('Passkey is not supported on this device.')}
            </p>
          )}
        </div>
      )}

      {/* OAuth Providers */}
      <OAuthProviders
        status={status}
        redirectTo={redirectTo}
        disabled={isLoading}
        consentRequired={requiresLegalConsent && !agreedToLegal}
        consentRequiredMessage={legalConsentErrorMessage}
      />
    </>
  )

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-4', className)}
        {...props}
      >
        {hasAlternativeLogin && alternativeLoginMethods}

        {passwordLoginEnabled && loginMode === 'password' && (
          <>
            {/* Username Field */}
            <FormField
              control={form.control}
              name='username'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Username or Email')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('Enter your username or email')}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Password Field */}
            <FormField
              control={form.control}
              name='password'
              render={({ field }) => (
                <FormItem className='relative'>
                  <FormLabel>{t('Password')}</FormLabel>
                  <FormControl>
                    <PasswordInput
                      placeholder={t('Enter password')}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                  <Link
                    to='/forgot-password'
                    className='text-muted-foreground absolute end-0 -top-0.5 z-10 text-sm font-medium hover:opacity-75'
                  >
                    {t('Forgot password?')}
                  </Link>
                </FormItem>
              )}
            />

            {/* Submit Button */}
            {/* 主按钮高度对齐输入框（含 1px 边线）：Button 默认档是
                --ds-button-height-md（36px），Input 是 --ds-control-height-md
                （40px），两者上下相邻时按钮会窄出一圈。 */}
            <Button
              type='submit'
              className='mt-2 h-(--ds-control-height-md) w-full justify-center gap-2'
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className='animate-spin' /> : <LogIn />}
              {t('Sign in')}
            </Button>

            {/* Turnstile */}
            {isTurnstileEnabled && (
              <div className='mt-2'>
                <Turnstile
                  key={turnstileWidgetKey}
                  siteKey={turnstileSiteKey}
                  onVerify={setTurnstileToken}
                  onExpire={() => setTurnstileToken('')}
                />
              </div>
            )}

            {emailCodeLoginEnabled && (
              <button
                type='button'
                onClick={() => setLoginMode('email-code')}
                className='text-muted-foreground hover:text-foreground w-full text-center text-sm font-medium transition-colors'
              >
                {t('Sign in with email code')}
              </button>
            )}
          </>
        )}

        {emailCodeLoginEnabled && loginMode === 'email-code' && (
          <>
            <div className='grid gap-2'>
              <Label htmlFor='email-code-login-email'>
                {t('Email Address')}
              </Label>
              <Input
                id='email-code-login-email'
                type='email'
                autoComplete='email'
                placeholder={t('Enter your email')}
                value={codeEmail}
                onChange={(event) => setCodeEmail(event.target.value)}
              />
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='email-code-login-code'>
                {t('Verification code')}
              </Label>
              <div className='flex gap-2'>
                <Input
                  id='email-code-login-code'
                  inputMode='numeric'
                  autoComplete='one-time-code'
                  maxLength={6}
                  placeholder={t('Enter the verification code')}
                  value={codeValue}
                  onChange={(event) =>
                    setCodeValue(event.target.value.replaceAll(/\D/g, ''))
                  }
                />
                <Button
                  type='button'
                  variant='outline'
                  className='h-(--ds-control-height-md) shrink-0'
                  disabled={
                    isSendingCode || codeResendSeconds > 0 || !codeEmail.trim()
                  }
                  onClick={handleSendLoginCode}
                >
                  {(() => {
                    if (isSendingCode) {
                      return <Loader2 className='h-4.5 w-4.5 animate-spin' />
                    }
                    if (codeResendSeconds > 0) {
                      return t('Resend in {{seconds}}s', {
                        seconds: codeResendSeconds,
                      })
                    }
                    return t('Send code')
                  })()}
                </Button>
              </div>
            </div>

            {/* type='button'：外层 <form> 挂的是密码登录的 handleSubmit，
                验证码视图的提交不能走那条 zod 校验链。 */}
            <Button
              type='button'
              onClick={onEmailCodeSubmit}
              className='mt-2 h-(--ds-control-height-md) w-full justify-center gap-2'
              disabled={isCodeLoginLoading}
            >
              {isCodeLoginLoading ? (
                <Loader2 className='animate-spin' />
              ) : (
                <LogIn />
              )}
              {t('Sign in')}
            </Button>

            {isTurnstileEnabled && (
              <div className='mt-2'>
                <Turnstile
                  key={turnstileWidgetKey}
                  siteKey={turnstileSiteKey}
                  onVerify={setTurnstileToken}
                  onExpire={() => setTurnstileToken('')}
                />
              </div>
            )}

            {passwordLoginEnabled && (
              <button
                type='button'
                onClick={() => setLoginMode('password')}
                className='text-muted-foreground hover:text-foreground w-full text-center text-sm font-medium transition-colors'
              >
                {t('Back to password sign in')}
              </button>
            )}
          </>
        )}

        <LegalConsent
          status={status}
          checked={agreedToLegal}
          onCheckedChange={setAgreedToLegal}
          className='mt-1'
        />

        {!hasAlternativeLogin && alternativeLoginMethods}
      </form>
    </Form>
  )
}
