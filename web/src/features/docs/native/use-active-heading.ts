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
import { useEffect, useState } from 'react'

/**
 * 滚动高亮：返回当前"正在读"的那一节 id。
 *
 * 判据是「最后一个已经滚过阅读线的标题」而不是 IntersectionObserver 的
 * 可见性 —— 长章节里标题早就滚出视口了，但那一节仍然是读者所在的位置；
 * 用可见性判断会出现「读到一半目录全灭」。
 *
 * @param ids 标题 id，必须按**文档顺序**给出
 * @param offset 阅读线距视口顶部的距离（固定头部高度 + 一点余量）
 */
export function useActiveHeading(ids: string[], offset = 96): string | null {
  // 依赖数组不能直接放 `ids`（每次渲染都是新数组），用拼接后的字符串当键。
  const key = ids.join('|')
  const [active, setActive] = useState<string | null>(ids[0] ?? null)
  const [prevKey, setPrevKey] = useState(key)
  if (prevKey !== key) {
    setPrevKey(key)
    if (!key) setActive(null)
  }

  useEffect(() => {
    const list = key ? key.split('|') : []
    if (list.length === 0) return

    let frame = 0

    const measure = () => {
      frame = 0
      let current = list[0] ?? null

      for (const id of list) {
        const el = document.querySelector(`#${CSS.escape(id)}`)
        if (!el) continue
        // 一旦遇到还没滚到的标题就停：后面的标题都在它下面。
        if (el.getBoundingClientRect().top - offset > 0) break
        current = id
      }

      // 滚到底部时最后一个标题可能永远够不到阅读线（页面不够长），
      // 这时直接把最后一节标为当前，否则末尾几节在目录里永远点不亮。
      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 2
      if (atBottom) current = list.at(-1) ?? current

      setActive(current)
    }

    const schedule = () => {
      if (frame) return
      frame = requestAnimationFrame(measure)
    }

    measure()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [key, offset])

  return active
}
