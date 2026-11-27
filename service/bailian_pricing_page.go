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
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	xhtml "golang.org/x/net/html"
)

// Bailian official prices are published on the Model Studio help page. The
// channel catalog API remains the source of model identities and metadata, but
// its prices are supplier quotes and must not be displayed as the official
// list price. This URL is the operator-authorized price source.
const bailianOfficialPricingPageURL = "https://help.aliyun.com/zh/model-studio/model-pricing"

// Kept as a variable so tests can serve a deterministic local copy.
var bailianOfficialPricingPageURLForTest = bailianOfficialPricingPageURL

type bailianIcePageProps struct {
	DocDetailData struct {
		StoreData struct {
			Data struct {
				Content string `json:"content"`
			} `json:"data"`
		} `json:"storeData"`
	} `json:"docDetailData"`
}

type bailianOfficialPricingPage struct {
	fetchedAt time.Time
	prices    map[BailianRegion]map[string][]BailianPriceRange
}

type bailianGridCell struct {
	text    string
	rowSpan int
	colSpan int
}

var (
	bailianPagePropsPattern  = regexp.MustCompile(`window\.__ICE_PAGE_PROPS__\s*=\s*`)
	bailianPageModelPattern  = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._:-]*$`)
	bailianPagePricePattern  = regexp.MustCompile(`([0-9]+(?:\.[0-9]+)?)\s*元`)
	bailianPageNumberPattern = regexp.MustCompile(`([0-9]+(?:\.[0-9]+)?)`)
)

// FetchBailianOfficialPricingPage reads the operator-authorized help page and
// extracts a region-scoped model -> price-range index. The page is public and
// needs no channel credential; a fetch failure is returned instead of silently
// falling back to the catalog API's supplier quote.
func FetchBailianOfficialPricingPage(ctx context.Context) (*bailianOfficialPricingPage, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, bailianOfficialPricingPageURLForTest, nil)
	if err != nil {
		return nil, err
	}
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch bailian official pricing page: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("bailian official pricing page returned HTTP %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 16<<20))
	if err != nil {
		return nil, fmt.Errorf("read bailian official pricing page: %w", err)
	}
	content, err := extractBailianPricingContent(body)
	if err != nil {
		return nil, err
	}
	prices, err := parseBailianPricingContent(content)
	if err != nil {
		return nil, err
	}
	return &bailianOfficialPricingPage{fetchedAt: time.Now().UTC(), prices: prices}, nil
}

// ApplyBailianOfficialPricingPage replaces catalog API prices with the
// operator-authorized official page prices for every model the page publishes.
// Models absent from the page keep their existing metadata; their API quote is
// no longer presented as an official list price.
func ApplyBailianOfficialPricingPage(ctx context.Context, catalog *BailianCatalog) error {
	if catalog == nil {
		return errors.New("bailian catalog is nil")
	}
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
		ranges, ok := rangesByModel[catalog.Models[index].Model]
		if !ok || len(ranges) == 0 {
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
	return nil
}

func extractBailianPricingContent(body []byte) (string, error) {
	location := bailianPagePropsPattern.FindIndex(body)
	if location == nil {
		return "", errors.New("bailian official pricing page has no embedded page data")
	}
	decoder := json.NewDecoder(strings.NewReader(string(body[location[1]:])))
	var props bailianIcePageProps
	if err := decoder.Decode(&props); err != nil {
		return "", fmt.Errorf("decode bailian official pricing page data: %w", err)
	}
	content := strings.TrimSpace(props.DocDetailData.StoreData.Data.Content)
	if content == "" {
		return "", errors.New("bailian official pricing page has no document content")
	}
	return content, nil
}

func parseBailianPricingContent(content string) (map[BailianRegion]map[string][]BailianPriceRange, error) {
	doc, err := xhtml.Parse(strings.NewReader(content))
	if err != nil {
		return nil, fmt.Errorf("parse bailian official pricing page HTML: %w", err)
	}
	out := make(map[BailianRegion]map[string][]BailianPriceRange)
	var walk func(*xhtml.Node, BailianRegion) BailianRegion
	walk = func(node *xhtml.Node, region BailianRegion) BailianRegion {
		if node.Type == xhtml.ElementNode {
			switch node.Data {
			case "h1", "h2", "h3", "h4":
				if detected := regionFromBailianHeading(bailianNodeText(node)); detected != "" {
					region = detected
				}
			case "table":
				appendBailianPageTable(out, node, region)
				return region
			}
		}
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			region = walk(child, region)
		}
		return region
	}
	walk(doc, BailianRegionUnspecified)
	return out, nil
}

func regionFromBailianHeading(heading string) BailianRegion {
	switch {
	case strings.Contains(heading, "北京"):
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

// isAlibabaFamilyBailianModel separates Alibaba's own Model Studio models from
// third-party models resold through Bailian. The official help page publishes
// list prices for the former and Bailian channel prices for the latter, so the
// same page row must land in different price fields.
func isAlibabaFamilyBailianModel(name string) bool {
	lower := strings.ToLower(strings.TrimSpace(name))
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

func appendBailianPageTable(out map[BailianRegion]map[string][]BailianPriceRange, table *xhtml.Node, region BailianRegion) {
	if region == "" {
		return
	}
	grid := buildBailianTableGrid(table)
	if len(grid) < 2 {
		return
	}
	header := grid[0]
	modelIndex := bailianHeaderIndex(header, "模型 ID", "Model ID")
	inputIndex := bailianHeaderIndex(header, "输入单价")
	outputIndex := bailianHeaderIndex(header, "输出单价")
	rangeIndex := bailianHeaderIndex(header, "输入Token数", "输入Token范围", "计费区间")
	if modelIndex < 0 || inputIndex < 0 || outputIndex < 0 {
		return
	}
	byModel := out[region]
	if byModel == nil {
		byModel = make(map[string][]BailianPriceRange)
		out[region] = byModel
	}
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
		priceRange := ""
		if rangeIndex >= 0 && rangeIndex < len(row) {
			priceRange = strings.TrimSpace(row[rangeIndex])
		}
		if priceRange == "" {
			priceRange = lastRange
		}
		if priceRange == "" || priceRange == "无阶梯计价" || priceRange == "不区分阶梯" {
			priceRange = "Default"
		}
		lastRange = priceRange
		if model == "" || inputIndex >= len(row) || outputIndex >= len(row) {
			continue
		}
		inputPrices := parseBailianPagePriceCell(row[inputIndex])
		outputPrices := parseBailianPagePriceCell(row[outputIndex])
		if len(inputPrices) == 0 {
			continue
		}
		prices := make([]BailianPrice, 0, len(inputPrices)+len(outputPrices))
		for _, band := range sortedBailianBands(inputPrices) {
			prices = append(prices, BailianPrice{
				Type:      "input_token",
				Price:     inputPrices[band],
				PriceUnit: "每百万tokens",
				PriceName: "model studio help-center price",
				TimeBand:  band,
				Currency:  "CNY",
				Source:    bailianOfficialPricingPageURL,
			})
		}
		for _, band := range sortedBailianBands(outputPrices) {
			if _, ok := inputPrices[band]; !ok && len(inputPrices) != 1 {
				continue
			}
			prices = append(prices, BailianPrice{
				Type:      "output_token",
				Price:     outputPrices[band],
				PriceUnit: "每百万tokens",
				PriceName: "model studio help-center price",
				TimeBand:  band,
				Currency:  "CNY",
				Source:    bailianOfficialPricingPageURL,
			})
		}
		byModel[model] = appendBailianPageRange(byModel[model], priceRange, prices)
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
		line = strings.TrimSpace(line)
		if bailianPageModelPattern.MatchString(line) {
			return line
		}
	}
	return ""
}

func parseBailianPagePriceCell(text string) map[string]string {
	out := make(map[string]string)
	for _, line := range strings.Split(text, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || line == "无" || strings.Contains(line, "免费额度") {
			continue
		}
		values := bailianPagePricePattern.FindStringSubmatch(line)
		if values == nil {
			values = bailianPageNumberPattern.FindStringSubmatch(line)
		}
		if values == nil {
			continue
		}
		band := ""
		switch {
		case strings.Contains(line, "忙时"):
			band = "peak"
		case strings.Contains(line, "闲时"):
			band = "offpeak"
		}
		if _, exists := out[band]; !exists {
			out[band] = values[1]
		}
	}
	return out
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
		if attr.Key != name {
			continue
		}
		if value, err := strconv.Atoi(attr.Val); err == nil && value > 0 {
			return value
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
