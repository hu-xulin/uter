package jsplugin

import (
	"fmt"
	"mime/multipart"
	"strconv"
	"strings"
)

// 请求体文件引用（ref）的编解码。
//
// 形如request_file:<field> 或 request_file:<field>#<index>。
//
// 为什么需要 index：一个 multipart 字段可以带多个文件（OpenAI 的
// `image[]` 就是这样）。只按字段名做 ref 的话，同字段的每个文件都会拿到
// 完全相同的 ref，插件根本无法区分自己拿到的是第几张图；而消费端只能回退到
// `files[0]`，于是无论插件怎么选，发出去的都是同一张图——错得毫无提示。
//
// 带index 之后每个文件有唯一 ref，消费端能精确取回对应的那一个。
//
// 歧义说明：字段名本身含 `#<数字>` 后缀时无法与 index 区分。编解码两端都
// 按「第一个 # 之后是规范十进制序号就当 index」处理，因此这种字段名请改用别的
// 写法（表单字段名里避开 `#数字` 即可）。规范十进制（非前导零、非负）是硬要求，
// 这样一个畸形引用会被明确拒绝，而不是被悄悄当成「字段名里带了 #」。
const requestFileRefPrefix = "request_file:"

// EncodeFileRef 为某个字段的第 index 个文件生成引用。index 从 0 开始，
// 第 0 个保持裸字段名（不带后缀），与单文件字段的既有形态一致。
func EncodeFileRef(field string, index int) string {
	if index <= 0 {
		return requestFileRefPrefix + field
	}
	return requestFileRefPrefix + field + "#" + strconv.Itoa(index)
}

// DecodeFileRef 解析引用，返回字段名与序号。不是文件引用时 ok 为 false。
//
// 严格性：序号必须是规范十进制写法且非负（`#01`、`#-1` 一律判为不是引用），
// 字段名不得为空。这样 `EncodeFileRef` 的产物与本函数的接受集合严格互逆，
// 插件拿到一个畸形引用时会明确失败，而不是被悄悄当成「字段名里带了 #」。
func DecodeFileRef(ref string) (field string, index int, ok bool) {
	body, found := strings.CutPrefix(ref, requestFileRefPrefix)
	if !found || body == "" {
		return "", 0, false
	}
	field, suffix, hasIndex := strings.Cut(body, "#")
	if field == "" {
		return "", 0, false
	}
	if !hasIndex {
		return field, 0, true
	}
	parsed, err := strconv.Atoi(suffix)
	if err != nil || parsed < 0 || strconv.Itoa(parsed) != suffix {
		return "", 0, false
	}
	return field, parsed, true
}

// 上游 new-api 的公开名保持可用：上游把这两个函数放在 pkg/jsplugin/routing.go
// 且命名为 FileReference / ParseFileReference，合并进来的上游代码与插件测试
// 按那两个名字引用。语义完全一致，这里给出别名而不是改名，避免破坏 uter
// 内部 EncodeFileRef / DecodeFileRef 的既有调用点。
//
// FileReference 为某个 multipart 字段的第 index 个文件生成引用。
func FileReference(field string, index int) string {
	return EncodeFileRef(field, index)
}

// ParseFileReference 解析 FileReference 产出的引用。
func ParseFileReference(ref string) (field string, index int, ok bool) {
	return DecodeFileRef(ref)
}

// ResolveFileRef 按引用取回原始文件头。
//
// 越界或字段不存在都报「unknown file reference」：从插件视角看，它引用的那个
// 文件就是不存在，报「不存在」与报「越界」对它没有区别；而具体差在哪儿由
// 调用方在自己的上下文里补。刻意不做「静默回退到第一个文件」——那会让插件
// 拿到错误的图片并成功发出请求，这种错必须让调用方看见。
func ResolveFileRef(files map[string][]*multipart.FileHeader, ref string) (*multipart.FileHeader, error) {
	field, index, ok := DecodeFileRef(ref)
	if !ok {
		return nil, fmt.Errorf("unknown file reference %q", ref)
	}
	candidates := files[field]
	if len(candidates) == 0 || index >= len(candidates) {
		return nil, fmt.Errorf("unknown file reference %q", ref)
	}
	return candidates[index], nil
}