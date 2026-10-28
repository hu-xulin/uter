/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

For commercial licensing, please contact support@uter.ai
*/
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import { CustomerServiceSection } from '../customer-service-section'

const realToken =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOjEsInVzZXJuYW1lIjoiVXRlci5haSIsInJvbGUiOiJhZG1pbiIsImV4cCI6MTc5MjA2NTcxNH0.xxxx'

const liveLLM = {
  provider: 'api',
  base: 'https://api.siliconflow.cn/v1',
  model: 'deepseek-ai/DeepSeek-V3',
  fallback_model: 'Qwen/Qwen3-8B',
  embed_model: 'BAAI/bge-m3',
  api_key: 'sk-test',
  backup_base: 'https://open.bigmodel.cn/api/paas/v4',
  backup_model: 'glm-4-flash',
  backup_api_key: 'yyy',
}

/**
 * 回归测试：智能客服配置页曾因 ModelConfigPanel 在 <Form {...form}> 的
 * FormProvider 之外渲染 FormItem/FormLabel/FormControl（shadcn 原语内部
 * useFormContext() 返回 null）导致渲染异常，被 ErrorBoundary 渲染成「500」页。
 * 修复后为整段内容套上同一个 provider。本测试断言：
 *   1) 整段正常渲染（含模型配置面板的标题与字段）；
 *   2) 控制台不出现 useFormContext / getFieldState 的解构崩溃。
 */
describe('CustomerServiceSection render regression', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the model config panel without a form-context crash', async () => {
    const errors: string[] = []
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation((...args: unknown[]) => {
        errors.push(args.map(String).join(' '))
      })

    vi.spyOn(api, 'get').mockImplementation((url: string) => {
      if (url.includes('admin-token')) {
        return Promise.resolve({
          data: { success: true, data: { token: realToken } },
        } as never)
      }
      if (url.includes('deploy/llm')) {
        return Promise.resolve({
          data: {
            success: true,
            data: { llm: liveLLM, fromCache: false },
          },
        } as never)
      }
      return Promise.resolve({ data: {} } as never)
    })

    const client = new QueryClient()

    render(
      <QueryClientProvider client={client}>
        <CustomerServiceSection
          defaultPages='home,docs'
          defaultAdminToken={realToken}
        />
      </QueryClientProvider>
    )

    // 整段（含模型配置面板）必须正常渲染出来。
    await waitFor(
      () => {
        const text = document.body.textContent ?? ''
        expect(text).toContain('Customer Service')
        expect(text).toContain('Model Configuration')
        // 模型配置面板的真实字段（shadcn FormLabel 渲染的文本）。
        expect(text).toContain('API Base URL')
        expect(text).toContain('Primary Model')
      },
      { timeout: 4000 }
    )

    consoleSpy.mockRestore()

    const formContextErrors = errors.filter(
      (e) =>
        e.includes('getFieldState') ||
        e.includes('useFormContext') ||
        e.includes('Cannot destructure') ||
        e.includes('[ErrorBoundary]')
    )
    expect(formContextErrors, JSON.stringify(errors, null, 2)).toEqual([])
  })
})
