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
package service

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	xhtml "golang.org/x/net/html"
)

// Bailian official prices are published on the Model Studio help page. The
// channel catalog API remains the source of model identities and metadata, but
// its prices are supplier quotes and must not be displayed as the official
// list price. This URL is the operator-authorized price source.
const bailianOfficialPricingPageURL = "https://help.aliyun.com/zh/model-studio/model-pricing"

// The help center publishes the same document as Markdown at the .md sibling
// URL. This is the single authoritative price source: the rendered HTML page
// is intentionally not parsed so two representations can never disagree.
const bailianOfficialPricingMarkdownURL = bailianOfficialPricingPageURL + ".md"

// Kept as variables so tests can serve deterministic local copies and lower
// the minimum-model guard for a small fixture.
var (
	bailianOfficialPricingMarkdownURLForTest = bailianOfficialPricingMarkdownURL
	bailianMarkdownMinModelCount             = 20
)

const bailianOfficialPricingPageCacheTTL = 15 * time.Minute

var (
	bailianOfficialPricingPageCacheMu  sync.Mutex
	bailianOfficialPricingPageCache    *bailianOfficialPricingPage
	bailianOfficialPricingPageCacheKey string
)

type bailianOfficialPricingPage struct {
	fetchedAt   time.Time
	sourceURL   string
	contentHash string
	prices      map[BailianRegion]map[string][]BailianPriceRange
}

type bailianGridCell struct {
	text    string
	rowSpan int
	colSpan int
}

var (
	bailianPageModelPattern     = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._:/-]*$`)
	bailianPagePricePattern     = regexp.MustCompile(`([0-9]+(?:\.[0-9]+)?)\s*(?:元|美元)`)
	bailianPageUSDPricePattern  = regexp.MustCompile(`(?:US\$|\$)\s*([0-9]+(?:\.[0-9]+)?)`)
	bailianPageTimeBandPattern  = regexp.MustCompile(`(忙时|闲时)\s*(?:US\$|\$)?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:元|美元)?`)
	bailianMarkdownBlockPattern = regexp.MustCompile(`(?is)(<Tab\b[^>]*\btitle="([^"]+)"[^>]*>)|(</Tabs>)|(<table\b[^>]*>.*?</table>)`)
	bailianPageModelStopWords   = map[string]bool{"model": true, "id": true, "token": true, "batch": true, "default": true}
)

// FetchBailianOfficialPricingPage reads the operator-authorized Markdown price
// document and extracts a region-scoped model -> price-range index. It is the
// only price source; any fetch or parse failure is returned so callers never
// silently substitute catalog supplier quotes or a second representation.
//
// Parsed pages are cached briefly so a sync cycle with several Bailian channels
// does not download and parse the same 700 KB document once per channel.
func FetchBailianOfficialPricingPage(ctx context.Context) (*bailianOfficialPricingPage, error) {
	key := fmt.Sprintf("%s|%d", bailianOfficialPricingMarkdownURLForTest, bailianMarkdownMinModelCount)
	bailianOfficialPricingPageCacheMu.Lock()
	if cached := bailianOfficialPricingPageCache; cached != nil &&
		bailianOfficialPricingPageCacheKey == key &&
		time.Since(cached.fetchedAt) < bailianOfficialPricingPageCacheTTL {
		copy := *cached
		bailianOfficialPricingPageCacheMu.Unlock()
		return &copy, nil
	}
	bailianOfficialPricingPageCacheMu.Unlock()

	prices, hash, err := fetchBailianOfficialPricingMarkdown(ctx)
	if err != nil {
		return nil, err
	}
	page := &bailianOfficialPricingPage{
		fetchedAt:   time.Now().UTC(),
		sourceURL:   bailianOfficialPricingMarkdownURLForTest,
		contentHash: hash,
		prices:      prices,
	}
	bailianOfficialPricingPageCacheMu.Lock()
	bailianOfficialPricingPageCache = page
	bailianOfficialPricingPageCacheKey = key
	bailianOfficialPricingPageCacheMu.Unlock()
	return page, nil
}

func resetBailianOfficialPricingPageCache() {
	bailianOfficialPricingPageCacheMu.Lock()
	bailianOfficialPricingPageCache = nil
	bailianOfficialPricingPageCacheKey = ""
	bailianOfficialPricingPageCacheMu.Unlock()
}

// fetchBailianOfficialPricingMarkdown is the single price fetch path.
func fetchBailianOfficialPricingMarkdown(ctx context.Context) (map[BailianRegion]map[string][]BailianPriceRange, string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, bailianOfficialPricingMarkdownURLForTest, nil)
	if err != nil {
		return nil, "", err
	}
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, "", fmt.Errorf("fetch bailian official pricing markdown: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, "", fmt.Errorf("bailian official pricing markdown returned HTTP %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 16<<20))
	if err != nil {
		return nil, "", fmt.Errorf("read bailian official pricing markdown: %w", err)
	}
	prices, err := parseBailianPricingMarkdown(string(body))
	if err != nil {
		return nil, "", err
	}
	models := 0
	for _, byModel := range prices {
		models += len(byModel)
	}
	if models < bailianMarkdownMinModelCount {
		return nil, "", fmt.Errorf("bailian official pricing markdown yielded only %d models", models)
	}
	hash := fmt.Sprintf("%x", sha256.Sum256(body))
	return prices, hash, nil
}

// ApplyBailianOfficialPricingPage replaces catalog API prices with the
// operator-authorized official page prices for every model the page publishes.
// Models absent from the page keep their existing metadata; their API quote is
// no longer presented as an official list price.
func ApplyBailianOfficialPricingPage(ctx context.Context, catalog *BailianCatalog) error {
	if catalog == nil {
		return errors.New("bailian catalog is nil")
	}
	// The aggregate page publishes token prices only. Plugin task models are
	// selected by name in the channel editor and may be absent from the catalog
	// response; add price-bearing alias rows before matching so they can still
	// inherit a documented same-price variant when one exists.
	augmentBailianCatalogWithTaskPluginModels(catalog)
	page, err := FetchBailianOfficialPricingPage(ctx)
	if err != nil {
		return err
	}
	region := catalog.Region
	rangesByModel := page.prices[region]
	if len(rangesByModel) == 0 {
		return fmt.Errorf("bailian official pricing page has no %s prices", displayBailianRegion(region))
	}
	matched := 0
	for index := range catalog.Models {
		modelName := catalog.Models[index].Model
		modelKey := strings.ToLower(strings.TrimSpace(modelName))
		ranges, ok := rangesByModel[modelKey]
		if !ok {
			for _, alias := range bailianPageModelAliases(modelKey) {
				if ranges, ok = rangesByModel[alias]; ok {
					break
				}
			}
		}
		if !ok || len(ranges) == 0 {
			// The help-center Markdown is the only price authority, including
			// for task-plugin models. A catalog quote for a model the page does
			// not publish is a second source and must never become billable;
			// clearing it puts the row into review-only downstream.
			catalog.Models[index].Prices = nil
			continue
		}
		catalog.Models[index].Prices = ranges
		matched++
	}
	if matched == 0 {
		return fmt.Errorf("bailian official pricing page matched none of the catalog models")
	}
	catalog.OfficialPricingSource = bailianOfficialPricingPageURL
	catalog.OfficialPricingSourceURL = page.sourceURL
	catalog.OfficialPricingHash = page.contentHash
	return nil
}

// parseBailianPricingMarkdown parses the help-center Markdown source. Its
// tables are still HTML fragments, but region names are carried by <Tab
// title="..."> blocks instead of rendered h1-h4 headings.
func parseBailianPricingMarkdown(markdown string) (map[BailianRegion]map[string][]BailianPriceRange, error) {
	out := make(map[BailianRegion]map[string][]BailianPriceRange)
	region := BailianRegionUnspecified
	for _, match := range bailianMarkdownBlockPattern.FindAllStringSubmatch(markdown, -1) {
		if title := strings.TrimSpace(match[2]); title != "" {
			if detected := regionFromBailianHeading(title); detected != "" {
				region = detected
			}
			continue
		}
		if strings.TrimSpace(match[3]) != "" {
			// A table after </Tabs> no longer belongs to the last region.
			region = BailianRegionUnspecified
			continue
		}
		fragment := match[4]
		if strings.TrimSpace(fragment) == "" {
			continue
		}
		// Markdown escapes comparison signs as `\<` / `\>`. Decode them before
		// HTML parsing or a range like `0\<Token≤1M` is read as a bogus tag.
		fragment = strings.ReplaceAll(fragment, `\<`, "&lt;")
		fragment = strings.ReplaceAll(fragment, `\>`, "&gt;")
		doc, err := xhtml.Parse(strings.NewReader("<html><body>" + fragment + "</body></html>"))
		if err != nil {
			return nil, fmt.Errorf("parse bailian markdown pricing table: %w", err)
		}
		for node := doc.FirstChild; node != nil; node = node.NextSibling {
			walkBailianMarkdownTables(node, out, region)
		}
	}
	return out, nil
}

func walkBailianMarkdownTables(node *xhtml.Node, out map[BailianRegion]map[string][]BailianPriceRange, region BailianRegion) {
	if node.Type == xhtml.ElementNode && node.Data == "table" {
		appendBailianPageTable(out, node, region)
		return
	}
	for child := node.FirstChild; child != nil; child = child.NextSibling {
		walkBailianMarkdownTables(child, out, region)
	}
}

func regionFromBailianHeading(heading string) BailianRegion {
	switch {
	case strings.Contains(heading, "北京"), strings.Contains(heading, "中国内地"):
		return BailianRegionBeijing
	case strings.Contains(heading, "弗吉尼亚"), strings.Contains(heading, "美国"):
		return BailianRegionUS
	case strings.Contains(heading, "新加坡"):
		return BailianRegionSingapore
	case strings.Contains(heading, "德国"):
		return BailianRegionGermany
	case strings.Contains(heading, "日本"):
		return BailianRegionJapan
	case strings.Contains(heading, "香港"):
		return BailianRegionHongKong
	default:
		return BailianRegionUnspecified
	}
}

// bailianAlibabaProviders is the catalog-level source of truth for Alibaba's
// own Model Studio families. The official help page publishes vendor list
// prices for these models and Bailian channel prices for everyone else.
var bailianAlibabaProviders = map[string]bool{
	"qwen":              true,
	"qwen-domain-model": true,
	"wan":               true,
	"happyhorse":        true,
	"happyoyster":       true,
}

// isAlibabaFamilyBailianModel separates Alibaba's own models from third-party
// models resold through Bailian. Catalog provider is authoritative when it is
// present; the model-name prefix is only a fallback for legacy snapshots that
// do not carry a provider.
func isAlibabaFamilyBailianModel(item BailianModel) bool {
	provider := strings.ToLower(strings.TrimSpace(item.Provider))
	if provider != "" && provider != "aliyun-bailian" {
		return bailianAlibabaProviders[provider]
	}
	lower := strings.ToLower(strings.TrimSpace(item.Model))
	for _, prefix := range []string{"qwen", "qwq", "qvq", "wan", "wanx", "tongyi"} {
		if strings.HasPrefix(lower, prefix) {
			return true
		}
	}
	return false
}

func displayBailianRegion(region BailianRegion) string {
	if region == "" {
		return "unspecified"
	}
	return string(region)
}

type bailianPagePriceColumn struct {
	index int
	kind  string
	unit  string
}

type bailianPagePriceCandidate struct {
	model     string
	rangeName string
	scope     string
	score     int
	prices    []BailianPrice
}

func appendBailianPageTable(out map[BailianRegion]map[string][]BailianPriceRange, table *xhtml.Node, region BailianRegion) {
	if region == "" {
		return
	}
	grid := buildBailianTableGrid(table)
	if len(grid) < 2 {
		return
	}
	header := grid[0]
	modelIndex := bailianHeaderIndex(header, "模型 ID", "Model ID", "模型名称")
	if modelIndex < 0 {
		return
	}
	priceColumns := bailianPagePriceColumns(header)
	if len(priceColumns) == 0 {
		return
	}
	rangeIndex := bailianHeaderIndex(header, "输入Token数", "输入Token范围", "计费区间")
	scopeIndex := bailianHeaderIndex(header, "服务部署范围")
	qualifierIndexes := bailianPageQualifierIndexes(header)

	byModel := out[region]
	if byModel == nil {
		byModel = make(map[string][]BailianPriceRange)
		out[region] = byModel
	}

	candidates := make([]bailianPagePriceCandidate, 0, len(grid)-1)
	lastModel := ""
	lastRange := ""
	for _, row := range grid[1:] {
		model := ""
		if modelIndex < len(row) {
			model = normalizeBailianPageModel(row[modelIndex])
		}
		if model != "" {
			lastModel = model
		} else {
			model = lastModel
		}
		if model == "" {
			continue
		}

		priceRange := ""
		if rangeIndex >= 0 && rangeIndex < len(row) {
			priceRange = strings.TrimSpace(row[rangeIndex])
		}
		if priceRange == "" {
			priceRange = lastRange
		}
		priceRange = strings.ReplaceAll(priceRange, "\\<", "<")
		if priceRange == "" || priceRange == "无阶梯计价" || priceRange == "不区分阶梯" {
			priceRange = "Default"
		}
		lastRange = priceRange

		qualifiers := make([]string, 0, len(qualifierIndexes))
		for _, index := range qualifierIndexes {
			if index < len(row) && strings.TrimSpace(row[index]) != "" {
				qualifiers = append(qualifiers, strings.TrimSpace(row[index]))
			}
		}
		rangeName := priceRange
		if len(qualifiers) > 0 {
			rangeName += "|" + strings.Join(qualifiers, "|")
		}

		scope := ""
		if scopeIndex >= 0 && scopeIndex < len(row) {
			scope = strings.TrimSpace(row[scopeIndex])
		}
		score := bailianPageScopeScore(scope, region)
		if score <= 0 {
			continue
		}

		prices := make([]BailianPrice, 0, len(priceColumns)*2)
		for _, column := range priceColumns {
			if column.index >= len(row) {
				continue
			}
			cell := strings.TrimSpace(row[column.index])
			unit := column.unit
			if unit == "" {
				unit = bailianPageUnitFromText(cell)
			}
			unit = normalizeBailianPageRawUnit(unit)
			values := parseBailianPagePriceCell(cell)
			priceType := bailianPagePriceType(column, cell, unit, qualifiers)
			currency := bailianPageCurrencyFromText(cell + " " + unit)
			for _, band := range sortedBailianBands(values) {
				prices = append(prices, BailianPrice{
					Type:      priceType,
					Price:     values[band],
					PriceUnit: unit,
					PriceName: "model studio help-center price",
					TimeBand:  band,
					Currency:  currency,
					Source:    bailianOfficialPricingPageURL,
				})
			}
		}
		if len(prices) == 0 {
			continue
		}
		for _, modelKey := range bailianPageModelAliases(model) {
			candidates = append(candidates, bailianPagePriceCandidate{
				model:     modelKey,
				rangeName: rangeName,
				scope:     scope,
				score:     score,
				prices:    prices,
			})
		}
	}

	// A region section can list both a global quote and a region-specific quote
	// for the same model/range. Keep the most specific scope so the provider
	// does not see two conflicting prices and park the row in needs_review.
	selected := make(map[string]int)
	for _, candidate := range candidates {
		key := candidate.model + "\x00" + candidate.rangeName
		if score, ok := selected[key]; ok && score >= candidate.score {
			continue
		}
		selected[key] = candidate.score
	}
	seen := make(map[string]bool, len(candidates))
	for _, candidate := range candidates {
		key := candidate.model + "\x00" + candidate.rangeName
		if selected[key] != candidate.score {
			continue
		}
		signature := key + "\x00" + candidate.scope + "\x00" + bailianPagePriceSignature(candidate.prices)
		if seen[signature] {
			continue
		}
		seen[signature] = true
		byModel[candidate.model] = appendBailianPageRange(byModel[candidate.model], candidate.rangeName, candidate.prices)
	}
}

func bailianPagePriceSignature(prices []BailianPrice) string {
	var builder strings.Builder
	for _, price := range prices {
		builder.WriteString(price.Type)
		builder.WriteByte('=')
		builder.WriteString(price.Price)
		builder.WriteByte('@')
		builder.WriteString(price.PriceUnit)
		builder.WriteByte('/')
		builder.WriteString(price.TimeBand)
		builder.WriteByte(';')
	}
	return builder.String()
}

func bailianPagePriceColumns(header []string) []bailianPagePriceColumn {
	columns := make([]bailianPagePriceColumn, 0, len(header))
	for index, cell := range header {
		trimmed := strings.TrimSpace(cell)
		if trimmed == "" || strings.Contains(trimmed, "免费额度") || strings.Contains(trimmed, "有效期") {
			continue
		}
		column := bailianPagePriceColumn{index: index}
		switch {
		case strings.Contains(trimmed, "缓存命中输入单价"):
			column.kind = "cache_input"
		case strings.Contains(trimmed, "输入和输出单价"), strings.Contains(trimmed, "输入和输出视频单价"):
			column.kind = "combined"
		case strings.Contains(trimmed, "输入单价"), strings.Contains(trimmed, "输入价格"):
			column.kind = "input"
		case strings.Contains(trimmed, "输出单价"), strings.Contains(trimmed, "输出价格"):
			column.kind = "output"
		case strings.Contains(trimmed, "语音合成单价"), strings.Contains(trimmed, "计费单价"),
			strings.Contains(trimmed, "示例单价"), strings.HasPrefix(trimmed, "单价"), trimmed == "价格":
			column.kind = "unit"
		default:
			continue
		}
		column.unit = bailianPageUnitFromText(trimmed)
		columns = append(columns, column)
	}
	return columns
}

func bailianPageQualifierIndexes(header []string) []int {
	indexes := make([]int, 0, len(header))
	for index, cell := range header {
		for _, needle := range []string{
			"输出视频分辨率", "输出图像分辨率", "输出视频类型", "输出视频模式",
			"输入参考类型", "输入素材类型", "计费项", "翻译类型",
		} {
			if strings.Contains(cell, needle) {
				indexes = append(indexes, index)
				break
			}
		}
	}
	return indexes
}

func bailianPageScopeScore(scope string, region BailianRegion) int {
	value := strings.TrimSpace(scope)
	if value == "" {
		return 2
	}
	if detected := regionFromBailianHeading(value); detected != "" && detected == region {
		return 3
	}
	if detected := regionFromBailianHeading(value); detected != "" && detected != region {
		return 0
	}
	lower := strings.ToLower(value)
	if strings.Contains(lower, "全球") || strings.Contains(lower, "国际") ||
		strings.Contains(lower, "worldwide") || strings.Contains(lower, "global") {
		return 1
	}
	return 1
}

func bailianPageCurrencyFromText(text string) string {
	lower := strings.ToLower(text)
	if strings.Contains(text, "美元") || strings.Contains(lower, "usd") || strings.Contains(text, "$") {
		return "USD"
	}
	return "CNY"
}

func bailianPageUnitFromText(text string) string {
	value := strings.ToLower(strings.TrimSpace(text))
	switch {
	case strings.Contains(value, "每百万token"), strings.Contains(value, "百万token"), strings.Contains(value, "per 1m token"):
		return "每百万tokens"
	case strings.Contains(value, "每千token"), strings.Contains(value, "千token"), strings.Contains(value, "per 1k token"):
		// The normalizer already scales per_1k_tokens by 1000. Without this
		// branch the page parser would emit a unitless "元" price and
		// undercharge every per-thousand-token model by 1000x.
		return "每千tokens"
	case strings.Contains(value, "每万字符"), strings.Contains(value, "10k char"):
		return "每万字符"
	case strings.Contains(value, "每秒"), strings.Contains(value, "元/秒"):
		return "每秒"
	case strings.Contains(value, "每分钟"), strings.Contains(value, "元/分钟"):
		return "每分钟"
	case strings.Contains(value, "每张"), strings.Contains(value, "元/张"):
		return "每张"
	case strings.Contains(value, "每次"), strings.Contains(value, "元/次"):
		return "每次"
	default:
		return ""
	}
}

func normalizeBailianPageRawUnit(unit string) string {
	if unit != "" {
		return unit
	}
	return "元"
}

func bailianPagePriceType(column bailianPagePriceColumn, cell, unit string, qualifiers []string) string {
	qualifier := strings.Join(qualifiers, " ")
	switch column.kind {
	case "cache_input":
		return "input_token_cache"
	case "input":
		switch unit {
		case "每万字符":
			return "tts_text_number"
		case "每秒":
			return "asr_input_token"
		case "每百万tokens":
			if strings.Contains(cell, "音频") || strings.Contains(qualifier, "音频") {
				return "audio_input_token"
			}
			return "input_token"
		default:
			return "input_token"
		}
	case "output":
		switch unit {
		case "每张":
			return "image_standard"
		case "每秒":
			return bailianPageVideoPriceType(qualifier)
		case "每次":
			return "per_call"
		case "每百万tokens":
			if strings.Contains(cell, "音频") || strings.Contains(qualifier, "音频") {
				return "audio_output_token"
			}
			return "output_token"
		default:
			return "output_token"
		}
	case "combined":
		if unit == "每秒" {
			return bailianPageVideoPriceType(qualifier)
		}
		return "combined_input_output"
	case "unit":
		switch unit {
		case "每张":
			return "image_standard"
		case "每秒":
			return bailianPageVideoPriceType(qualifier)
		case "每次":
			return "per_call"
		case "每万字符":
			return "tts_text_number"
		default:
			return "page_unit_price"
		}
	default:
		return "page_unit_price"
	}
}

func bailianPageVideoPriceType(qualifier string) string {
	switch {
	case strings.Contains(qualifier, "480P"), strings.Contains(qualifier, "480p"):
		return "video_ratio_480p"
	case strings.Contains(qualifier, "720P"), strings.Contains(qualifier, "720p"):
		return "video_ratio_720p"
	case strings.Contains(qualifier, "1080P"), strings.Contains(qualifier, "1080p"):
		return "video_ratio_1080p"
	default:
		return "per_second"
	}
}

func appendBailianPageRange(ranges []BailianPriceRange, name string, prices []BailianPrice) []BailianPriceRange {
	for index := range ranges {
		if ranges[index].RangeName != name {
			continue
		}
		ranges[index].Prices = append(ranges[index].Prices, prices...)
		return ranges
	}
	return append(ranges, BailianPriceRange{RangeName: name, Prices: prices})
}

func buildBailianTableGrid(table *xhtml.Node) [][]string {
	rawRows := make([][]bailianGridCell, 0)
	var collectRows func(*xhtml.Node)
	collectRows = func(node *xhtml.Node) {
		if node == nil {
			return
		}
		if node.Type == xhtml.ElementNode && node.Data == "table" && node != table {
			return
		}
		if node.Type == xhtml.ElementNode && node.Data == "tr" {
			cells := make([]bailianGridCell, 0)
			for child := node.FirstChild; child != nil; child = child.NextSibling {
				if child.Type != xhtml.ElementNode || (child.Data != "td" && child.Data != "th") {
					continue
				}
				cells = append(cells, bailianGridCell{
					text:    bailianNodeText(child),
					rowSpan: bailianAttrInt(child, "rowspan"),
					colSpan: bailianAttrInt(child, "colspan"),
				})
			}
			if len(cells) > 0 {
				rawRows = append(rawRows, cells)
			}
			return
		}
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			collectRows(child)
		}
	}
	collectRows(table)
	cols := 0
	for _, row := range rawRows {
		width := 0
		for _, cell := range row {
			width += cell.colSpan
		}
		if width > cols {
			cols = width
		}
	}
	grid := make([][]string, 0, len(rawRows))
	pending := make(map[int]bailianGridCell)
	for _, row := range rawRows {
		out := make([]string, cols)
		occupied := make([]bool, cols)
		for col, cell := range pending {
			if col >= cols {
				continue
			}
			out[col] = cell.text
			occupied[col] = true
			cell.rowSpan--
			if cell.rowSpan <= 0 {
				delete(pending, col)
			} else {
				pending[col] = cell
			}
		}
		col := 0
		for _, cell := range row {
			for col < cols && occupied[col] {
				col++
			}
			if col >= cols {
				break
			}
			for offset := 0; offset < cell.colSpan && col+offset < cols; offset++ {
				out[col+offset] = cell.text
				occupied[col+offset] = true
			}
			if cell.rowSpan > 1 {
				next := cell
				next.rowSpan--
				pending[col] = next
			}
			col += cell.colSpan
		}
		grid = append(grid, out)
	}
	return grid
}

func bailianHeaderIndex(header []string, needles ...string) int {
	for index, cell := range header {
		for _, needle := range needles {
			if strings.Contains(cell, needle) {
				return index
			}
		}
	}
	return -1
}

func normalizeBailianPageModel(text string) string {
	for _, line := range strings.Split(text, "\n") {
		for _, field := range strings.Fields(line) {
			token := strings.Trim(field, "（）()[],;:。、")
			if token == "" || bailianPageModelStopWords[strings.ToLower(token)] {
				continue
			}
			if bailianPageModelPattern.MatchString(token) {
				return token
			}
		}
	}
	return ""
}

// bailianPageModelAliases returns the normalized names that may legitimately
// resolve to one official page row. The page often publishes a family name
// while the workspace returns a dated snapshot model.
func bailianPageModelAliases(name string) []string {
	normalized := strings.ToLower(strings.TrimSpace(name))
	if normalized == "" {
		return nil
	}
	aliases := []string{normalized}
	if match := bailianVersionSuffixPattern.FindStringSubmatch(normalized); match != nil {
		if base := strings.TrimSpace(match[1]); base != "" && base != normalized {
			aliases = append(aliases, base)
		}
	}
	return aliases
}

func parseBailianPagePriceCell(text string) map[string]string {
	out := make(map[string]string)
	for _, match := range bailianPageTimeBandPattern.FindAllStringSubmatch(text, -1) {
		band := ""
		if match[1] == "忙时" {
			band = "peak"
		} else {
			band = "offpeak"
		}
		if _, exists := out[band]; !exists {
			out[band] = match[2]
		}
	}
	if len(out) > 0 {
		return out
	}
	for _, line := range strings.Split(text, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || line == "无" || strings.Contains(line, "免费额度") ||
			strings.Contains(line, "限时免费") || strings.Contains(line, "不计费") {
			continue
		}
		value := findBailianPagePriceValue(line)
		if value == "" {
			continue
		}
		if strings.Contains(line, "忙时") {
			if _, exists := out["peak"]; !exists {
				out["peak"] = value
			}
			continue
		}
		if strings.Contains(line, "闲时") {
			if _, exists := out["offpeak"]; !exists {
				out["offpeak"] = value
			}
			continue
		}
		if _, exists := out[""]; !exists {
			out[""] = value
		}
	}
	return out
}

func findBailianPagePriceValue(line string) string {
	if values := bailianPagePricePattern.FindStringSubmatch(line); values != nil {
		return values[1]
	}
	if values := bailianPageUSDPricePattern.FindStringSubmatch(line); values != nil {
		return values[1]
	}
	return ""
}

func sortedBailianBands(values map[string]string) []string {
	bands := make([]string, 0, len(values))
	for band := range values {
		bands = append(bands, band)
	}
	sort.Slice(bands, func(i, j int) bool {
		order := map[string]int{"": 0, "peak": 1, "offpeak": 2}
		return order[bands[i]] < order[bands[j]]
	})
	return bands
}

func bailianIsBlockElement(name string) bool {
	switch name {
	case "p", "div", "blockquote", "li", "br", "tr", "td", "th", "h1", "h2", "h3", "h4", "h5", "h6":
		return true
	default:
		return false
	}
}

func bailianAttrInt(node *xhtml.Node, name string) int {
	for _, attr := range node.Attr {
		if !strings.EqualFold(attr.Key, name) {
			continue
		}
		// Markdown source uses JSX-style rowSpan={3}; HTML uses rowspan="3".
		value := strings.TrimSpace(attr.Val)
		value = strings.Trim(value, "{}")
		if parsed, err := strconv.Atoi(value); err == nil && parsed > 0 {
			return parsed
		}
	}
	return 1
}

func bailianNodeText(node *xhtml.Node) string {
	var builder strings.Builder
	var walk func(*xhtml.Node)
	walk = func(current *xhtml.Node) {
		if current.Type == xhtml.TextNode {
			builder.WriteString(current.Data)
			return
		}
		for child := current.FirstChild; child != nil; child = child.NextSibling {
			walk(child)
		}
		if current.Type == xhtml.ElementNode && bailianIsBlockElement(current.Data) {
			builder.WriteString("\n")
		}
	}
	walk(node)
	lines := strings.Split(builder.String(), "\n")
	for index, line := range lines {
		lines[index] = strings.Join(strings.Fields(line), " ")
	}
	return strings.TrimSpace(strings.Join(lines, "\n"))
}
