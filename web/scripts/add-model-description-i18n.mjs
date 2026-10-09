// 一次性脚本：为「模型描述多语化」区块补齐 7 份语言包的词条。
// 严格按项目约定「读 → split('\n') → 锚点插入 → json.loads 校验 → 写盘」，
// 绝不 json.load/dump 整文件重写（会重排格式、丢重复键）。
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const localesDir = resolve(here, '../src/i18n/locales')

// key 即英文原文；en 的 value 必须等于 key。
const ENTRIES = [
  ['Model Description Localization', {
    en: 'Model Description Localization',
    zh: '模型描述多语言',
    'zh-TW': '模型描述多語言',
    fr: 'Localisation des descriptions de modèles',
    ru: 'Локализация описаний моделей',
    ja: 'モデル説明の多言語化',
    vi: 'Đa bản đa ngôn ngữ cho mô tả mô hình',
  }],
  ['After syncing upstream channel data, automatically fetch the official descriptions in Chinese, English and Japanese, and use the site LLM to translate the languages the upstream catalog does not provide (zh-TW, fr, ru, vi), so pricing page cards show descriptions in the visitor’s language.', {
    en: 'After syncing upstream channel data, automatically fetch the official descriptions in Chinese, English and Japanese, and use the site LLM to translate the languages the upstream catalog does not provide (zh-TW, fr, ru, vi), so pricing page cards show descriptions in the visitor’s language.',
    zh: '每次同步上游渠道数据后，自动拉取官方中、英、日三语描述，并用站内大模型补译上游目录未提供的语种（繁中、法语、俄语、越南语），让定价页卡片按访客语言显示描述。',
    'zh-TW': '每次同步上游渠道資料後，自動拉取官方中、英、日三語描述，並用站內大模型補譯上游目錄未提供的語種（繁中、法語、俄語、越南語），讓定價頁卡片依訪客語言顯示描述。',
    fr: 'Après chaque synchronisation des données de canal amont, récupère automatiquement les descriptions officielles en chinois, anglais et japonais, puis utilise le LLM du site pour traduire les langues non fournies par le catalogue amont (zh-TW, fr, ru, vi), afin que les cartes de la page de tarification affichent la description dans la langue du visiteur.',
    ru: 'После каждой синхронизации данных вышестоящих каналов автоматически загружаются официальные описания на китайском, английском и японском языках, а затем LLM сайта переводит языки, отсутствующие в вышестоящем каталоге (zh-TW, fr, ru, vi), чтобы карточки на странице цен показывали описание на языке посетителя.',
    ja: '上流チャネルデータの同期ごとに、中国語・英語・日本語の公式説明を自動取得し、上流カタログにない言語（繁体字中国語・フランス語・ロシア語・ベトナム語）をサイト内の LLM で翻訳します。定价ページのカードが訪問者の言語で説明を表示します。',
    vi: 'Sau mỗi lần đồng bộ dữ liệu kênh thượng nguồn, tự động lấy mô tả chính thức bằng tiếng Trung, Anh và Nhật, rồi dùng LLM của trang để dịch các ngôn ngữ mà danh mục thượng nguồn không có (zh-TW, fr, ru, vi), để thẻ trên trang bảng giá hiển thị mô tả theo ngôn ngữ của khách truy cập.',
  }],
  ['Localize model descriptions', {
    en: 'Localize model descriptions',
    zh: '多语言化模型描述',
    'zh-TW': '多語言化模型描述',
    fr: 'Localiser les descriptions de modèles',
    ru: 'Локализовать описания моделей',
    ja: 'モデル説明を多言語化する',
    vi: 'Đa bản đa ngôn ngữ mô tả mô hình',
  }],
  ['Fetch multi-language descriptions after each upstream sync. Only fills in missing languages; existing text is never overwritten.', {
    en: 'Fetch multi-language descriptions after each upstream sync. Only fills in missing languages; existing text is never overwritten.',
    zh: '每次上游同步后拉取多语言描述。只填补缺失语种，已有文本永不被覆盖。',
    'zh-TW': '每次上游同步後拉取多語言描述。只填補缺失語種，已有文字永不覆蓋。',
    fr: 'Récupère les descriptions multilingues après chaque synchronisation amont. Ne comble que les langues manquantes ; le texte existant n’est jamais écrasé.',
    ru: 'Загружать многоязычные описания после каждой синхронизации. Заполняются только отсутствующие языки; существующий текст никогда не перезаписывается.',
    ja: '上流同期のたびに多言語の説明を取得します。不足している言語のみを補い、既存のテキストは上書きしません。',
    vi: 'Tải mô tả đa ngôn ngữ sau mỗi lần đồng bộ thượng nguồn. Chỉ điền các ngôn ngữ còn thiếu; văn bản hiện có không bao giờ bị ghi đè.',
  }],
  ['Translate missing languages with LLM', {
    en: 'Translate missing languages with LLM',
    zh: '用大模型补译缺失语种',
    'zh-TW': '用大模型補譯缺失語種',
    fr: 'Traduire les langues manquantes avec le LLM',
    ru: 'Переводить недостающие языки с помощью LLM',
    ja: 'LLM で不足している言語を翻訳する',
    vi: 'Dịch các ngôn ngữ còn thiếu bằng LLM',
  }],
  ['Requires the API base URL, API key and model below to be filled in. Each missing description costs one LLM call.', {
    en: 'Requires the API base URL, API key and model below to be filled in. Each missing description costs one LLM call.',
    zh: '需要填写下方的 API 地址、密钥与模型。每条待补译描述消耗一次大模型调用。',
    'zh-TW': '需要填寫下方的 API 位址、金鑰與模型。每條待補譯描述消耗一次大模型呼叫。',
    fr: 'Nécessite le remplissage de l’URL d’API, de la clé et du modèle ci-dessous. Chaque description manquante coûte un appel LLM.',
    ru: 'Требуется заполнить ниже базовый URL API, ключ и модель. Каждое отсутствующее описание требует одного вызова LLM.',
    ja: '以下の API ベース URL・API キー・モデルの入力が必要です。翻訳が 1 件につき LLM 呼び出し 1 回 발생합니다。',
    vi: 'Cần điền URL API, khóa API và mô hình bên dưới. Mỗi mô tả cần dịch tốn một lần gọi LLM.',
  }],
  ['Translation API Base URL', {
    en: 'Translation API Base URL',
    zh: '翻译 API 地址',
    'zh-TW': '翻譯 API 位址',
    fr: 'URL de base de l’API de traduction',
    ru: 'Базовый URL API перевода',
    ja: '翻訳 API のベース URL',
    vi: 'URL cơ sở API dịch thuật',
  }],
  ['OpenAI-compatible endpoint. A trailing /v1 is optional; it is normalized automatically.', {
    en: 'OpenAI-compatible endpoint. A trailing /v1 is optional; it is normalized automatically.',
    zh: 'OpenAI 兼容端点。结尾的 /v1 可省略，会自动归一化。',
    'zh-TW': 'OpenAI 相容端點。結尾的 /v1 可省略，會自動正規化。',
    fr: 'Point de terminaison compatible OpenAI. Le suffixe /v1 est facultatif ; il est normalisé automatiquement.',
    ru: 'Совместимая с OpenAI конечная точка. Суффикс /v1 необязателен и нормализуется автоматически.',
    ja: 'OpenAI 互換のエンドポイントです。末尾の /v1 は省略でき、自動的に正規化されます。',
    vi: 'Điểm cuối tương thích OpenAI. Hậu tố /v1 là tùy chọn và sẽ được chuẩn hóa tự động.',
  }],
  ['Translation API Key', {
    en: 'Translation API Key',
    zh: '翻译 API 密钥',
    'zh-TW': '翻譯 API 金鑰',
    fr: 'Clé d’API de traduction',
    ru: 'Ключ API перевода',
    ja: '翻訳 API キー',
    vi: 'Khóa API dịch thuật',
  }],
  ['Stored masked; leaving it empty clears the saved key.', {
    en: 'Stored masked; leaving it empty clears the saved key.',
    zh: '以掩码存储；留空即清除已保存的密钥。',
    'zh-TW': '以遮罩儲存；留空即清除已儲存的金鑰。',
    fr: 'Stockée masquée ; la laisser vide efface la clé enregistrée.',
    ru: 'Хранится в замаскированном виде; пустое значение удаляет сохранённый ключ.',
    ja: 'マスク化して保存されます。空欄にすると保存済みのキーが消去されます。',
    vi: 'Được lưu ở dạng che giấu; để trống sẽ xóa khóa đã lưu.',
  }],
  ['Translation Model', {
    en: 'Translation Model',
    zh: '翻译模型',
    'zh-TW': '翻譯模型',
    fr: 'Modèle de traduction',
    ru: 'Модель перевода',
    ja: '翻訳モデル',
    vi: 'Mô hình dịch thuật',
  }],
  ['A small, inexpensive model is enough: model descriptions are one or two sentences.', {
    en: 'A small, inexpensive model is enough: model descriptions are one or two sentences.',
    zh: '小而便宜的模型即可：模型描述通常只有一两句话。',
    'zh-TW': '小而便宜的模型即可：模型描述通常只有一兩句話。',
    fr: 'Un petit modèle économique suffit : les descriptions font une ou deux phrases.',
    ru: 'Достаточно небольшой недорогой модели: описания состоят из одного-двух предложений.',
    ja: '小さくて安価なモデルで十分です。モデル説明は 1〜2 文です。',
    vi: 'Chỉ cần mô hình nhỏ, giá rẻ: mô tả mô hình thường chỉ một hai câu.',
  }],
  ['Locales to translate', {
    en: 'Locales to translate',
    zh: '待补译语种',
    'zh-TW': '待補譯語種',
    fr: 'Langues à traduire',
    ru: 'Языки для перевода',
    ja: '翻訳対象の言語',
    vi: 'Ngôn ngữ cần dịch',
  }],
  ['Comma-separated. Leave empty to use the default: zh-TW, fr, ru, vi. A locale with no translation falls back to English rather than showing an empty description.', {
    en: 'Comma-separated. Leave empty to use the default: zh-TW, fr, ru, vi. A locale with no translation falls back to English rather than showing an empty description.',
    zh: '用逗号分隔。留空则使用默认值：繁中、法语、俄语、越南语。某语种没有译文时回退到英文，而不是显示空白描述。',
    'zh-TW': '用逗號分隔。留空則使用預設值：繁中、法語、俄語、越南語。某語種沒有譯文時回退到英文，而不是顯示空白描述。',
    fr: 'Séparés par des virgules. Laisser vide pour utiliser la valeur par défaut : zh-TW, fr, ru, vi. Une langue sans traduction retombe sur l’anglais plutôt que d’afficher une description vide.',
    ru: 'Через запятую. Оставьте пустым для значения по умолчанию: zh-TW, fr, ru, vi. Если перевода нет, используется английский, а не пустое описание.',
    ja: 'カンマ区切り。空欄の場合は既定値（zh-TW、fr、ru、vi）を使用します。翻訳がない言語は空欄ではなく英語で表示されます。',
    vi: 'Phân tách bằng dấu phẩy. Để trống sẽ dùng mặc định: zh-TW, fr, ru, vi. Ngôn ngữ chưa có bản dịch sẽ dùng tiếng Anh thay vì để trống mô tả.',
  }],
]

const LOCALES = ['en', 'zh', 'zh-TW', 'fr', 'ru', 'ja', 'vi']

function upsert(lines, key, value) {
  const encodedKey = JSON.stringify(key)
  const encodedLine = `  ${encodedKey}: ${JSON.stringify(value)},`
  const isTranslationMember = (line) => {
    const match = line.match(/^(\s*)"((?:[^"\\]|\\.)*)":\s/)
    if (!match) return false
    const indent = match[1].length
    if (indent < 2) return false
    // translation 自身的定义行（顶层键）缩进为 2，但它是容器的开始，
    // 其内容行的缩进为 4。以「容器内至少有一层缩进」判定成员行。
    return indent >= 4
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trimStart().startsWith(`${encodedKey  }:`)) continue
    if (!isTranslationMember(line)) continue
    const current = line.trimStart().slice(encodedKey.length + 1).trim()
    if (current === JSON.stringify(value)) return 'unchanged'
    lines[i] = encodedLine
    return 'updated'
  }
  // 插到 translation 对象内部的第一条词条之前（缩进 >= 4），保持词条内聚。
  for (let i = 0; i < lines.length; i++) {
    if (isTranslationMember(lines[i])) {
      lines.splice(i, 0, encodedLine)
      return 'added'
    }
  }
  throw new Error('未找到 translation 对象内的插入锚点')
}

let touched = 0
for (const locale of LOCALES) {
  const file = resolve(localesDir, `${locale}.json`)
  const raw = readFileSync(file, 'utf8')
  const lines = raw.split('\n')
  const summary = { added: 0, updated: 0, unchanged: 0 }
  for (const [key, byLocale] of ENTRIES) {
    const value = byLocale[locale]
    if (value === undefined) throw new Error(`缺少语种 ${locale} 的译文：${key}`)
    summary[upsert(lines, key, value)] += 1
  }
  const next = lines.join('\n')
  // 写盘前必须能解析通过，防止插入破坏 JSON 结构。
  JSON.parse(next.slice(next.indexOf('{')))
  writeFileSync(file, next, 'utf8')
  touched += 1
  console.log(
    `${locale}: +${summary.added} 新增, ~${summary.updated} 更新, =${summary.unchanged} 未变`
  )
}
console.log(`\n已更新 ${touched} 份语言包`)
