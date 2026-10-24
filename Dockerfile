FROM oven/bun:1.4.0@sha256:5ff609364c049b54eb0ff560ec96319729a972078ef2c755d758f0c6ef89c2d6 AS frontend

COPY ./VERSION /build/VERSION

# --- 前端 SPA ---
WORKDIR /build/web
COPY web/package.json web/bun.lock ./
RUN bun install --frozen-lockfile
COPY ./web ./
RUN DISABLE_ESLINT_PLUGIN='true' VITE_REACT_APP_VERSION=$(cat /build/VERSION) bun run build

# --- 文档静态站 ---
# 必须在前端之后、go build 之前构建：docs-web 的 postbuild 会把静态导出拷进
# web/dist/docs-content，而 Go 用 go:embed web/dist 把前端与文档一起打进二进制。
# 漏掉这一步不会编译报错，只会得到一个「能跑但没有文档」的镜像——这正是发布
# 验收要挡住的缺陷。顺序也不能反：先跑 docs 会被 web 的构建清掉。
WORKDIR /build/docs-web
COPY docs-web/package.json docs-web/bun.lock ./
RUN bun install --frozen-lockfile
COPY ./docs-web ./
RUN bun run build

# 工具链版本与 go.mod 的 go 指令保持一致（1.27.3）。go1.27.1 的标准库带 11 个
# 已公布漏洞（net/http、net/http2、crypto/tls、crypto/x509、net/textproto），
# 全部在 go1.27.3 修复；镜像里用旧工具链编译就会把漏洞一起打包发布。
FROM golang:1.27.3-alpine@sha256:b8c9b82affbbb82a020bbcf998dad2ba9516944ac7e883524642a481a9505e9c AS builder2
ENV GO111MODULE=on CGO_ENABLED=0 GOWORK=off

ARG TARGETOS
ARG TARGETARCH
ENV GOOS=${TARGETOS:-linux} GOARCH=${TARGETARCH:-amd64}
ENV GOEXPERIMENT=greenteagc

WORKDIR /build

ADD go.mod go.sum ./
# relaykit 与 tokenkit 都是通过 replace 指向本地路径的子模块，go mod download
# 必须能读到它们的 go.mod 才能解析主模块依赖图。
#
# 这里曾经只 ADD 了 relaykit/go.mod，漏了 tokenkit：于是 `go mod download` 在
# docker build 里直接失败（reading tokenkit/go.mod: no such file or directory），
# 镜像根本构建不出来。而本地 `go build` 不受影响——本地两个目录都在，所以这个
# 问题只在 Docker 构建路径上暴露。
ADD relaykit/go.mod ./relaykit/go.mod
ADD tokenkit/go.mod ./tokenkit/go.mod
RUN go mod download

COPY . .
COPY --from=frontend /build/web/dist ./web/dist
# go:embed 只会嵌入存在的文件：文档站漏构建时编译照样通过，镜像却没有文档。
# 这里复用发布链路共用的校验脚本，把「静默缺文档」变成构建失败。
# builder2 是中间层、不进最终镜像，装 bash 不增加产物体积。
RUN apk add --no-cache bash
RUN ./scripts/verify-docs-artifacts.sh web/dist
RUN go build -ldflags "-s -w -X 'github.com/uter-ai/uter/common.Version=$(cat VERSION)'" -o uter

FROM debian:bookworm-slim@sha256:f06537653ac770703bc45b4b113475bd402f451e85223f0f2837acbf89ab020a

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates tzdata libasan8 wget \
    && rm -rf /var/lib/apt/lists/* \
    && update-ca-certificates

COPY --from=builder2 /build/uter /
COPY LICENSE NOTICE THIRD-PARTY-LICENSES.md /licenses/
EXPOSE 3000
WORKDIR /data
ENTRYPOINT ["/uter"]
