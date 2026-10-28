package model

import (
	"context"
	"fmt"
	"reflect"
	"sort"
	"strings"

	"github.com/uter-ai/uter/common"

	"gorm.io/gorm/schema"
)

// ModelDescriptionLocales 是模型描述支持的全部语种，与前端 7 份语言包
// （en/zh/zh-TW/fr/ru/ja/vi）保持一致。
//
// zh/en/ja 三个语种由上游官方目录直接提供；zh-TW/fr/ru/vi 由站内 LLM
// 从英文描述补译而来（见 controller/model_desc_translate.go）。
var ModelDescriptionLocales = []string{"en", "zh", "zh-TW", "fr", "ru", "ja", "vi"}

// LocalizedDescription 是模型描述的多语存储形态：locale -> 文本。
//
// 持久化为 models 表的一个 text 列（JSON 字符串），因为 MySQL/SQLite/Postgres
// 之间可移植的 JSON 列类型在 GORM 里并不统一，而 text + 自定义 Scan/Value
// 在三者上行为一致。
type LocalizedDescription map[string]string

// descriptionFallbackChain 给出某个语种的回退顺序。
//
// zh-TW 回退到 zh（繁中与简中用词高度重合，优于直接跳英文）；其余语种
// 上游或补译都可能缺席，落到英文这个语义最完整的源语言。
var descriptionFallbackChain = map[string][]string{
	"zh-TW": {"zh-TW", "zh", "en"},
	"zh":    {"zh", "en"},
	"ja":    {"ja", "en"},
	"fr":    {"fr", "en"},
	"ru":    {"ru", "en"},
	"vi":    {"vi", "en"},
	"en":    {"en"},
}

// FallbackChain 返回指定语种的回退顺序，未知语种回退到英文优先。
func (t LocalizedDescription) FallbackChain(locale string) []string {
	if chain, ok := descriptionFallbackChain[locale]; ok {
		return chain
	}
	return []string{locale, "en"}
}

// Resolve 按访客语种返回应展示的描述文本。
//
// 逐级沿回退链查找，第一个非空命中即返回；全部落空返回空串，让调用方
// 决定是否回落到 Model.Description 这类单字段来源。
func (t LocalizedDescription) Resolve(locale string) string {
	if len(t) == 0 {
		return ""
	}
	for _, candidate := range t.FallbackChain(locale) {
		if text := strings.TrimSpace(t[candidate]); text != "" {
			return text
		}
	}
	return ""
}

// ResolveModelDescription 按访客语种解析模型描述，并把单字段 description
// 作为最后的兜底来源。
//
// 与只认多语副本的 Resolve 分开，是为了让「只有 description、尚无多语副本」的
// 历史模型也能立刻按语言显示——它们在非英文界面下最容易被误判成「没有描述」。
func ResolveModelDescription(descriptions LocalizedDescription, description string, locale string) string {
	if text := descriptions.Resolve(locale); text != "" {
		return text
	}
	return strings.TrimSpace(description)
}

// Value 把多语描述序列化为 JSON 文本，供 JSONMapSerializer 与 JSON 编码复用。
//
// 刻意返回 string 而不是 []byte：UpdateColumn 这类不接受 Serializer 的写入
// 路径会把 []byte 原样交给驱动，字段被静默跳过（无报错、无写入），而 string
// 在所有路径上都能正确落盘。
func (t LocalizedDescription) Value() (any, error) {
	if len(t) == 0 {
		return "", nil
	}
	encoded, err := common.Marshal(map[string]string(t))
	if err != nil {
		return nil, err
	}
	return string(encoded), nil
}

// JSONMapSerializer 让 GORM 把 map 形态的自定义类型当作文本列读写。
//
// 为什么需要它：GORM 遇到 map 字段时不会调用 driver.Valuer，而是把 map
// 直接交给 database/sql，于是报
// "unsupported type model.LocalizedDescription, a map"。
// driver.Valuer / GormValue 都绕不开这条路径，必须走 GORM 的 Serializer
// 扩展点。
type JSONMapSerializer struct{}

// Value 写入前把 map 序列化成 JSON 文本。
func (JSONMapSerializer) Value(_ context.Context, _ *schema.Field, _ reflect.Value, fieldValue any) (any, error) {
	switch typed := fieldValue.(type) {
	case nil:
		return "", nil
	case LocalizedDescription:
		return typed.Value()
	case *LocalizedDescription:
		if typed == nil {
			return "", nil
		}
		return typed.Value()
	case map[string]string:
		return LocalizedDescription(typed).Value()
	default:
		return nil, fmt.Errorf("model: JSONMapSerializer cannot serialize %T", fieldValue)
	}
}

// Scan 读取后把 JSON 文本解析回 map，并做语种归一。
//
// dst 不保证就是字段本身：GORM 在部分路径（如 Scan 到结构体指针）里传入的
// 是整个宿主结构的指针。必须用 field.ValueOf 按字段名取出真正的目标，
// 直接对 dst 取值会得到 "cannot scan into *model.Model"。
func (JSONMapSerializer) Scan(_ context.Context, field *schema.Field, dst reflect.Value, dbValue any) error {
	target, err := descriptionFieldValue(field, dst)
	if err != nil {
		return err
	}
	return target.Scan(rawDescriptionBytes(dbValue))
}

// GORM 的序列化器注册表是包级全局（schema.RegisterSerializer），不是
// field.TagOptions 的一部分，必须在包初始化时注册一次，否则任何带
// `serializer:jsonMap` 的字段在解析 schema 时就报
// "invalid serializer type jsonMap"。
//
// 刻意放在本文件（模型描述多语的实现处）而不是 gorm_logger.go：
// 后者会随上游改动被整文件覆盖，而这个注册一旦丢失，
// models.descriptions 列的所有读写都会失败。
func init() {
	schema.RegisterSerializer("jsonMap", JSONMapSerializer{})
}

// descriptionFieldValue 定位 Descriptions 字段对应的 *LocalizedDescription。
//
// dst 可能是字段值本身，也可能是宿主结构（值或指针）；后一种需要按字段名
// 取地址。field 为 nil 时只能依赖 dst 本身。
func descriptionFieldValue(field *schema.Field, dst reflect.Value) (*LocalizedDescription, error) {
	if field != nil {
		holder := dst
		if holder.Kind() == reflect.Ptr {
			if holder.IsNil() {
				return nil, fmt.Errorf("model: cannot scan localized description into nil %s", holder.Type())
			}
			holder = holder.Elem()
		}
		if holder.Kind() == reflect.Struct {
			fieldValue := holder.FieldByName(field.Name)
			if fieldValue.IsValid() && fieldValue.CanAddr() {
				if target, ok := fieldValue.Addr().Interface().(*LocalizedDescription); ok {
					return target, nil
				}
			}
		}
	}
	// 退化路径：dst 就是字段本身（或其指针）。
	if dst.Kind() == reflect.Ptr {
		if target, ok := dst.Interface().(*LocalizedDescription); ok {
			return target, nil
		}
	}
	if dst.CanAddr() {
		if target, ok := dst.Addr().Interface().(*LocalizedDescription); ok {
			return target, nil
		}
	}
	return nil, fmt.Errorf("model: cannot locate localized description field (field=%v, dst=%s)",
		fieldValueName(field), dst.Type())
}

func fieldValueName(field *schema.Field) string {
	if field == nil {
		return "<nil>"
	}
	return field.Name
}

// rawDescriptionBytes 把驱动返回的任意形态归一成待解析的字节切片。
func rawDescriptionBytes(dbValue any) []byte {
	switch value := dbValue.(type) {
	case nil:
		return nil
	case []byte:
		return value
	case string:
		return []byte(value)
	default:
		return nil
	}
}

// Scan 实现 sql.Scanner，兼容历史遗留的空串与 NULL 值。
func (t *LocalizedDescription) Scan(src any) error {
	*t = nil
	var raw []byte
	switch value := src.(type) {
	case nil:
		return nil
	case []byte:
		raw = value
	case string:
		raw = []byte(value)
	default:
		return nil
	}
	trimmed := strings.TrimSpace(string(raw))
	if trimmed == "" || trimmed == "null" {
		return nil
	}
	// 容错：历史数据或人工填写可能留下裸字符串而非 JSON 对象，此时按英文单语
	// 解析，让这一行不至于因为一条脏数据整体读取失败。裸词不是合法 JSON，
	// 因此不能走 Unmarshal（它会对 "Bare English" 直接报错），直接取值即可。
	if trimmed[0] != '{' {
		if trimmed == "null" {
			return nil
		}
		*t = LocalizedDescription{"en": trimmed}
		return nil
	}
	var parsed map[string]string
	if err := common.Unmarshal([]byte(trimmed), &parsed); err != nil {
		return nil
	}
	*t = sanitizeDescription(parsed)
	return nil
}

// sanitizeDescription 丢弃空白条目并把 key 归一为受支持语种。
//
// 上游目录与 LLM 补译都可能回传 "zh_CN"、"zh-TW " 这类非规范 key，若原样
// 入库，Resolve 的精确匹配会失配，表现为「配了多语却仍显示英文」。
func sanitizeDescription(in map[string]string) LocalizedDescription {
	if len(in) == 0 {
		return nil
	}
	supported := make(map[string]struct{}, len(ModelDescriptionLocales))
	for _, locale := range ModelDescriptionLocales {
		supported[locale] = struct{}{}
	}

	// 按 key 字典序处理，而不是直接遍历 map：Go 的 map 迭代顺序是随机的，
	// 「同语种保留首条」若依赖遍历顺序，同一份输入每次可能得到不同结果
	// （zh-TW 与 zh_Hant 同时存在时保留哪一个会随机漂移）。排序后规则稳定：
	// 规范化后同语种冲突时，保留字典序最小的那个 key。
	keys := make([]string, 0, len(in))
	for locale := range in {
		keys = append(keys, locale)
	}
	sort.Strings(keys)

	out := make(LocalizedDescription, len(in))
	for _, locale := range keys {
		text := strings.TrimSpace(in[locale])
		if text == "" {
			continue
		}
		key, ok := NormalizeModelDescriptionLocale(locale)
		if !ok {
			continue
		}
		if _, known := supported[key]; !known {
			continue
		}
		if _, dup := out[key]; dup {
			continue
		}
		out[key] = text
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

// NormalizeModelDescriptionLocale 把各种写法的语种标签归一到受支持的语种。
//
// 覆盖上游目录与 i18n 生态的常见形态：zh-CN/zh_CN/zh-Hans -> zh、
// zh-TW/zh_TW/zh-Hant -> zh-TW，其余按小写匹配。
func NormalizeModelDescriptionLocale(locale string) (string, bool) {
	key := strings.ToLower(strings.TrimSpace(locale))
	key = strings.ReplaceAll(key, "_", "-")
	if key == "" {
		return "", false
	}
	switch key {
	case "zh", "zh-cn", "zh-hans", "zh-sg", "zh-hans-cn":
		return "zh", true
	case "zh-tw", "zh-hant", "zh-hk", "zh-mo":
		return "zh-TW", true
	}
	if key == "en" || key == "fr" || key == "ru" || key == "ja" || key == "vi" {
		return key, true
	}
	return "", false
}

// normalizeModelDescriptions 抹平单字段 Description 与多语 Descriptions 的分歧。
//
// 规则：
//   - 单字段非空时，按**检测出的语种**补位（中文描述进 "zh"，英文进 "en"），
//     绝不无条件写 "en"——那会把中文描述塞进英文位，英文访客直接看到中文，
//     且后续补译会把中文当英文源；
//   - Description 为空而英文位有值时，回写 Description，保持旧调用方可用；
//   - 其余语种一律以 Descriptions 为准，不被单字段覆盖。
func normalizeModelDescriptions(description string, descriptions LocalizedDescription) (string, LocalizedDescription) {
	description = strings.TrimSpace(description)
	if len(descriptions) == 0 {
		if description == "" {
			return "", nil
		}
		return description, LocalizedDescription{detectDescriptionLocale(description): description}
	}
	if description != "" {
		locale := detectDescriptionLocale(description)
		if strings.TrimSpace(descriptions[locale]) == "" {
			descriptions[locale] = description
		}
	}
	if description == "" {
		description = strings.TrimSpace(descriptions["en"])
	}
	if len(descriptions) == 0 {
		return description, nil
	}
	return description, descriptions
}

// SortedLocales 返回该多语描述已覆盖的语种，按 ModelDescriptionLocales 的
// 稳定顺序排列，便于日志与测试断言。
func (t LocalizedDescription) SortedLocales() []string {
	if len(t) == 0 {
		return nil
	}
	present := make(map[string]struct{}, len(t))
	for locale, text := range t {
		if strings.TrimSpace(text) != "" {
			present[locale] = struct{}{}
		}
	}
	locales := make([]string, 0, len(present))
	for _, locale := range ModelDescriptionLocales {
		if _, ok := present[locale]; ok {
			locales = append(locales, locale)
		}
	}
	// ModelDescriptionLocales 之外的键也保留，避免静默丢数据。
	var extra []string
	for locale := range present {
		if !containsString(ModelDescriptionLocales, locale) {
			extra = append(extra, locale)
		}
	}
	sort.Strings(extra)
	return append(locales, extra...)
}

func containsString(list []string, target string) bool {
	for _, item := range list {
		if item == target {
			return true
		}
	}
	return false
}
