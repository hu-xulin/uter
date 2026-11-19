# Uter 阿里云上线部署手册（大陆 + 香港 2 台）

> 适用版本：当前仓库 `main`（Uter 1.5.x）  
> 目标域名：`uter.cc`（大陆备案/支付宝）、`uter.ai`（全球主站）、`uter.pro`（海外站）  
> 目标 API：
>
> - 全球通用：`https://api.uter.ai`
> - 国内专用：`https://api.uter.cc`
> - 海外专用：`https://api.uter.pro`
>
> 最终拓扑：**大陆 1 台应用服务器 + 香港 1 台应用服务器**，共享香港 RDS PostgreSQL 与 Redis。  
> 本文不含任何真实密钥；密码使用占位符，部署时通过 KMS / Secrets Manager 注入。

---

## 1. 最终架构

```text
                       阿里云 DNS / GTM 延迟解析 + 健康检查
                                      │
              ┌───────────────────────┴───────────────────────┐
              │                                               │
      uter.cc / api.uter.cc                         uter.ai / api.uter.ai
      中国大陆 ALB → 大陆 ECS                        香港 ALB / GA → 香港 ECS
      备案、支付宝回调                                 uter.pro / api.uter.pro
              │                                               │
              └───────────────────────┬───────────────────────┘
                                      │
                          香港 CEN / 转发路由器
                                      │
                    ┌─────────────────┴─────────────────┐
                    │                                   │
          RDS PostgreSQL 主库                    云数据库 Redis
          （香港 VPC，高可用版）                 （香港 VPC，与会话/限流共用）
```

### 1.1 节点职责

| 节点 | 域名 | 职责 |
|---|---|---|
| 大陆 ECS | `uter.cc`、`api.uter.cc` | 大陆备案站、国内 API、**支付宝异步回调入口** |
| 香港 ECS | `uter.ai`、`api.uter.ai`、`uter.pro`、`api.uter.pro` | 全球站、海外站、全球/海外 API |
| 香港 RDS PostgreSQL | 无公网域名 | 唯一主库，两节点共同写入 |
| 香港 Redis | 无公网域名 | 唯一逻辑缓存/会话/限流实例 |

### 1.2 关键原则

1. **只有一个 PostgreSQL 主库和一个 Redis 逻辑实例。**
2. 大陆节点通过 **CEN / 转发路由器**访问香港 RDS/Redis；GA 可作为 CEN 不可用时的备用链路，但生产优先 CEN 私网。
3. 支付宝 `notify_url` 固定为：
   ```text
   https://uter.cc/api/user/alipay/notify
   ```
   回调落大陆 ECS，写入香港主库；香港 `uter.ai` 节点读取同一主库，余额实时一致。
4. 两台节点使用相同 `SESSION_SECRET`，不同 `NODE_NAME`。
5. `uter.cc` 必须解析到大陆 Uter 后端，不能再指向 OSS/CDN 静态页。

### 1.3 两台服务器的现实限制

两台 ECS 各承担一个地域入口，属于“最小可用”架构：

- 任意一台故障，对应地域入口不可用；
- 大陆节点故障时支付宝回调会失败，支付宝会重试，但期间订单保持 pending；
- 正式支付业务建议后续扩展为：
  - 大陆 2 台 + ALB 健康检查；
  - 香港 2 台 + ALB；
  - 或至少为大陆节点准备一台冷备/热备。

本文先按用户确定的 2 台方案部署，并在第 12 节给出扩容路径。

---

## 2. 三个硬约束

### 2.1 备案

- `uter.cc` 已备案，可解析到中国大陆节点，可作为支付宝签约网站与回调域名。
- `uter.ai`、`uter.pro` 不能作为中国大陆备案域名使用，必须解析到香港/海外节点。
- 因此：
  - `uter.cc` / `api.uter.cc` → 大陆 ECS；
  - `uter.ai` / `api.uter.ai` / `uter.pro` / `api.uter.pro` → 香港 ECS。

### 2.2 支付数据只有一个事实源

用户在 `uter.cc` 支付，需要在 `uter.ai` 立即看到余额。  
因此不能是：

- 大陆一套数据库、香港一套数据库；
- 大陆 Redis、香港 Redis 各自独立；
- 两地不同 `SESSION_SECRET`。

必须是：

- 同一个香港 RDS PostgreSQL 主库；
- 同一个香港 Redis；
- 两地节点通过 CEN 私网访问；
- 充值、额度、订单、会话全部共享。

### 2.3 支付宝回调必须直达 Uter

支付宝服务器从公网 POST 到：

```text
https://uter.cc/api/user/alipay/notify
```

要求：

- `uter.cc` 解析到大陆 ALB/ECS，不能是 OSS/CDN 静态页；
- 不 301/302；
- 不需要登录；
- 不被 WAF 拦截 POST 表单；
- 保留 `Host`、`X-Forwarded-Proto`、`X-Forwarded-Host`；
- 返回 Uter 的 `success`/`failure` 文本。

当前必须先修复：

```text
https://uter.cc/api/user/alipay/notify
当前实测：HTTP 200 text/html (Tengine/OSS)
期望：404 + X-Uter-Version（Uter 后端）
```

---

## 3. 阿里云资源清单（2 台方案）

### 3.1 计算

| 资源 | 规格建议 | 数量 | 说明 |
|---|---|---|---|
| 大陆 ECS | 4 vCPU / 8 GB / 100 GB ESSD | 1 | `uter.cc`、`api.uter.cc`、支付宝回调 |
| 香港 ECS | 4 vCPU / 8 GB / 100 GB ESSD | 1 | `uter.ai`、`api.uter.ai`、`uter.pro`、`api.uter.pro` |
| 堡垒机（可选） | 2 vCPU / 4 GB | 1 | 禁止直接公网 SSH |

两台都运行同一个 Uter 镜像，配置差异只有 `NODE_NAME` 和地域相关网络参数。

### 3.2 数据库

| 资源 | 规格建议 | 说明 |
|---|---|---|
| RDS PostgreSQL | 15/16，8 vCPU / 32 GB，200 GB ESSD，高可用版 | 香港 VPC，唯一主库 |
| 备份 | 自动全量 + PITR 30 天，跨地域复制到 OSS | 防误删/故障 |
| 日志库 | 可选独立 RDS PostgreSQL 或 ClickHouse | 初期复用主库 |

连接串示例：

```text
postgresql://uter:<PASSWORD>@pgm-xxxx.pg.rds.aliyuncs.com:5432/uter?sslmode=require
```

### 3.3 缓存

| 资源 | 规格建议 | 说明 |
|---|---|---|
| 云数据库 Redis | 8 GB，主从/集群版，开启密码 | 香港 VPC，唯一逻辑实例 |
| 连接串 | `redis://:<PASSWORD>@r-xxxx.redis.rds.aliyuncs.com:6379/0` | 两节点共用 |

### 3.4 网络

| 资源 | 用途 |
|---|---|
| 大陆 VPC | 大陆 ECS、ALB |
| 香港 VPC | 香港 ECS、RDS、Redis |
| CEN / 转发路由器 | 大陆 VPC ↔ 香港 VPC 私网互通 |
| 大陆 ALB | `uter.cc`、`api.uter.cc` HTTPS 入口 |
| 香港 ALB | `uter.ai`、`api.uter.ai`、`uter.pro`、`api.uter.pro` 入口 |
| 全球加速 GA（可选） | `api.uter.ai` 全球加速；CEN 故障时备用 |
| 阿里云 DNS / GTM | 延迟解析、健康检查、故障切换 |
| SSL 证书 | `uter.cc + *.uter.cc`、`uter.ai + *.uter.ai`、`uter.pro + *.uter.pro` |
| WAF | 主站/API 防护，支付回调路径放行 POST |
| Anti-DDoS | 基础防护 |

### 3.5 存储与可观测

| 资源 | 用途 |
|---|---|
| OSS | 数据库备份、日志归档、媒体/附件 |
| SLS | Nginx、Uter、支付宝回调日志集中检索 |
| CloudMonitor / ARMS | CPU、内存、5xx、延迟、CEN 链路、支付回调失败告警 |
| ActionTrail | 阿里云控制台操作审计 |

### 3.6 CN2 GIA 说明

阿里云标准产品没有名为“CN2 GIA”的独立售卖项。两条节点方案下：

1. **推荐**：大陆节点走阿里云多线 BGP；`api.uter.ai` 使用 GA 全球加速。
2. 如果必须使用 CN2 GIA，需要第三方香港/日本 CN2 GIA 中转，放在阿里云入口之前；这不是阿里云标准 SKU。
3. 大陆 `api.uter.cc` 直接走大陆 BGP 即可，不需要跨境 CN2 GIA。
4. 大陆 → 香港数据库/Redis 使用 CEN 私网，优先于公网 CN2。

---

## 4. CEN 跨域私网配置

这是两节点方案的核心。

### 4.1 VPC 规划

| VPC | 地域 | 网段示例 |
|---|---|---|
| `vpc-mainland` | 上海/杭州 | `10.10.0.0/16` |
| `vpc-hk` | 香港 | `10.20.0.0/16` |

子网：

- 大陆 ECS：`10.10.1.0/24`
- 香港 ECS：`10.20.1.0/24`
- 香港 RDS/Redis：使用香港 VPC 内网，不分配公网。

### 4.2 CEN 配置步骤

1. 创建 CEN 实例；
2. 创建转发路由器 TR：
   - 大陆地域 TR；
   - 香港地域 TR；
3. 将 `vpc-mainland`、`vpc-hk` 分别连接到对应 TR；
4. 创建跨地域连接（大陆 TR ↔ 香港 TR）；
5. 配置路由：
   - 大陆 VPC 路由表：`10.20.0.0/16 → 香港 TR`；
   - 香港 VPC 路由表：`10.10.0.0/16 → 大陆 TR`；
6. 安全组：
   - 大陆 ECS 出方向允许到香港 RDS/Redis 端口；
   - 香港 RDS 白名单加入 `10.10.0.0/16`；
   - 香港 Redis 白名单加入 `10.10.0.0/16`；
7. 带宽包：按业务量购买，支付回调与 API 写入都走这条链路。

### 4.3 验证

在大陆 ECS 执行：

```bash
# 数据库
psql "postgresql://uter:<PASSWORD>@<hk-rds-private-host>:5432/uter?sslmode=require" -c 'select 1;'

# Redis
redis-cli -h <hk-redis-private-host> -a '<PASSWORD>' ping

# 延迟
ping -c 10 <hk-rds-private-host>
```

建议：

- 大陆→香港 RDS 延迟稳定在 20–50ms；
- 若超过 80ms 或丢包，检查 CEN 带宽包、TR 路由和运营商线路；
- 不要把 RDS/Redis 暴露公网。

### 4.4 GA 的角色

- `api.uter.ai` 全球用户可经 GA Anycast 到香港；
- 大陆节点访问香港主库优先 CEN；
- GA 可作为 CEN 故障时的备用路径，但不要把数据库连接直接暴露到公网；
- 如果 CEN 故障，应用会因数据库不可达而不可用；因此 CEN 需要监控和带宽冗余。

---

## 5. 域名与 DNS

### 5.1 记录

| 域名 | 解析目标 | 线路 | 说明 |
|---|---|---|---|
| `uter.cc` | 大陆 ALB | 默认/国内 | 备案主域、支付宝 |
| `api.uter.cc` | 大陆 ALB | 国内 | 国内专用 API |
| `uter.ai` | 香港 ALB / GA | 全球 | 全球主站 |
| `api.uter.ai` | 香港 ALB / GA | 全球 | 全球 API |
| `uter.pro` | 香港 ALB | 海外 | 海外站 |
| `api.uter.pro` | 香港 ALB | 海外 | 海外 API |

TTL 60 秒。

### 5.2 延迟解析与健康检查

阿里云 DNS / GTM：

- 健康检查：`GET https://<域名>/api/status`，HTTP 200 且包含 `"success": true`；
- 间隔 10 秒，连续 3 次失败切换；
- `api.uter.cc` 只使用大陆线路；
- `api.uter.pro` 使用海外线路；
- `api.uter.ai` 使用全球默认/地域线路；
- 大陆 ALB 故障时可将 `uter.cc` 临时切到香港备用入口，但需确认备案/支付宝风控允许。

GA（可选）：

- 监听 443；
- 终端节点组：香港（主），后续可加大陆/美国；
- 健康检查 `/api/status`；
- 不对 `/api/user/alipay/notify` 做路径重写/跳转。

### 5.3 证书

```text
uter.cc + *.uter.cc
uter.ai + *.uter.ai
uter.pro + *.uter.pro
```

使用阿里云 SSL 证书或 certbot；到期前 30 天续期。

---

## 6. 服务器初始化

两台 ECS 都执行。

### 6.1 基础环境

```bash
sudo timedatectl set-timezone Asia/Shanghai
sudo useradd --system --create-home --shell /usr/sbin/nologin uter
sudo mkdir -p /opt/uter /data/uter/logs
sudo chown -R uter:uter /opt/uter /data/uter

sudo yum install -y docker || sudo apt-get update && sudo apt-get install -y docker.io
sudo systemctl enable --now docker
sudo usermod -aG docker uter
```

### 6.2 目录

```text
/opt/uter/
├── docker-compose.yml
├── .env
├── data/
└── logs/
```

### 6.3 镜像

```bash
docker login registry.cn-hangzhou.aliyuncs.com
docker pull registry.cn-hangzhou.aliyuncs.com/<namespace>/uter:1.5.69
```

生产固定 tag，不使用 `latest`。

---

## 7. 环境变量

两台节点的 `.env` 只有 `NODE_NAME` 不同，其余数据库、Redis、会话密钥必须一致。

```dotenv
UTER_IMAGE=registry.cn-hangzhou.aliyuncs.com/<namespace>/uter:1.5.69

SQL_DSN=postgresql://uter:<PASSWORD>@<hk-rds-private-host>:5432/uter?sslmode=require
REDIS_CONN_STRING=redis://:<PASSWORD>@<hk-redis-private-host>:6379/0

SESSION_SECRET=<openssl rand -hex 48>
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_TRUSTED_URL=https://uter.cc,https://uter.ai,https://uter.pro,https://api.uter.cc,https://api.uter.ai,https://api.uter.pro

CORS_ALLOWED_ORIGINS=https://uter.cc,https://uter.ai,https://uter.pro

TZ=Asia/Shanghai
NODE_NAME=uter-mainland-1        # 香港节点改为 uter-hk-1
TRUSTED_PROXIES=10.10.0.0/16,10.20.0.0/16
ERROR_LOG_ENABLED=true
BATCH_UPDATE_ENABLED=true
```

密钥生成：

```bash
openssl rand -hex 24   # 数据库/Redis 密码
openssl rand -hex 48   # SESSION_SECRET
```

禁止把 `.env` 提交到 Git；使用 KMS / Secrets Manager 注入。

---

## 8. 启动应用

### 8.1 compose（外接云数据库）

两台节点使用同一个 compose，去掉 `postgres` / `redis` 服务：

```yaml
services:
  uter:
    image: ${UTER_IMAGE}
    container_name: uter
    restart: always
    ports:
      - "127.0.0.1:3000:3000"
    environment:
      - SQL_DSN=${SQL_DSN}
      - REDIS_CONN_STRING=${REDIS_CONN_STRING}
      - SESSION_SECRET=${SESSION_SECRET}
      - SESSION_COOKIE_SECURE=true
      - SESSION_COOKIE_TRUSTED_URL=${SESSION_COOKIE_TRUSTED_URL}
      - CORS_ALLOWED_ORIGINS=${CORS_ALLOWED_ORIGINS}
      - TZ=${TZ}
      - NODE_NAME=${NODE_NAME}
      - TRUSTED_PROXIES=${TRUSTED_PROXIES}
    volumes:
      - ./data:/data
      - ./logs:/app/logs
```

启动：

```bash
cd /opt/uter
docker compose up -d
docker compose ps
curl -fsS http://127.0.0.1:3000/api/status
```

首次启动执行迁移。先在香港节点启动，确认数据库迁移完成，再启动大陆节点。

---

## 9. Nginx / ALB

### 9.1 公共 upstream

```nginx
upstream uter_backend {
    server 127.0.0.1:3000;
    keepalive 64;
}

map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}
```

### 9.2 大陆节点

大陆节点只需要服务 `uter.cc`、`api.uter.cc`：

```nginx
server {
    listen 443 ssl;
    http2 on;
    server_name uter.cc www.uter.cc;

    ssl_certificate     /etc/nginx/ssl/uter.cc.pem;
    ssl_certificate_key /etc/nginx/ssl/uter.cc.key;
    ssl_protocols TLSv1.2 TLSv1.3;

    client_max_body_size 100m;

    location / {
        proxy_pass http://uter_backend;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host  $host;
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        $connection_upgrade;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}

server {
    listen 443 ssl;
    http2 on;
    server_name api.uter.cc;

    ssl_certificate     /etc/nginx/ssl/uter.cc.pem;
    ssl_certificate_key /etc/nginx/ssl/uter.cc.key;

    client_max_body_size 100m;

    location / {
        proxy_pass http://uter_backend;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host  $host;
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        $connection_upgrade;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
    }
}
```

### 9.3 香港节点

香港节点服务四个域名：

```text
uter.ai
api.uter.ai
uter.pro
api.uter.pro
```

server block 与上面相同，只替换 `server_name` 和证书路径。  
如果需要大陆节点故障时临时接管 `uter.cc`，可在大陆节点和香港节点都保留 `uter.cc` 的 server block，但 DNS 默认只指向大陆；切换前确认备案/支付宝策略。

### 9.4 支付回调

`/api/user/alipay/notify` 必须是 POST 直达 Uter：

- 不跳转；
- 不登录；
- 不经过 OSS/CDN 静态页；
- 不被 WAF 拦截；
- 保留 Host/X-Forwarded-*。

验证：

```bash
curl -sSI https://uter.cc/api/status
curl -sSI https://uter.cc/api/user/alipay/notify
# 期望第二项：404 + X-Uter-Version
```

---

## 10. Uter 后台配置

### 10.1 站点

```text
Server Address = https://uter.ai
```

### 10.2 支付通用

```text
Payment site address   = https://uter.cc
Async callback address = https://uter.cc
```

### 10.3 支付宝

```text
Enable Alipay          = true
App ID                 = <支付宝 AppID>
Alipay gateway URL     = https://openapi.alipay.com/gateway.do
Application Private Key= <RSA2 应用私钥>
Alipay Public Key      = <支付宝公钥>
```

保存后打开“回调诊断”：

- `notify_url` 应为 `https://uter.cc/api/user/alipay/notify`；
- HTTP 状态应为 Uter 的 404 + `X-Uter-Version`；
- 显示 `notify_url 已到达 Uter`；
- 如果显示 `200 text/html (Tengine)`，说明 uter.cc 仍指向 OSS/CDN；
- 如果显示 localhost/内网警告，说明回调地址不可被支付宝访问。

### 10.4 支付宝开放平台

- 应用网站：`https://uter.cc`；
- 已签约电脑网站支付、手机网站支付；
- 回调地址无需在开放平台逐个登记，但必须公网可达；
- 沙箱网关：`https://openapi-sandbox.dl.alipaydev.com/gateway.do`。

---

## 11. 支付一致性验证

### 11.1 支付路径

```text
用户浏览器 → uter.cc → 大陆 ECS → 香港 RDS
支付宝回调 → uter.cc/api/user/alipay/notify → 大陆 ECS → 香港 RDS
uter.ai 香港 ECS → 香港 RDS（同一主库）
```

### 11.2 验证步骤

1. 在 `uter.cc` 创建 0.01 元订单；
2. 支付宝付款；
3. 打开后台“回调诊断”，确认最新回调事件为 `received` / `success`；
4. 查询 `top_ups`，状态为 `success`；
5. 用户余额增加；
6. 登录 `uter.ai`，同一用户余额一致；
7. 计费历史自动从“待确认”变为“成功”。

### 11.3 注意事项

- 用户如果在 `uter.ai` 发起支付，`return_url` 会回 `uter.ai`，但 `notify_url` 仍固定 `uter.cc`；两边写同一主库，余额一致。
- 如果要求用户在 `uter.cc` 支付，则支付入口和 return_url 都在 uter.cc。
- 两节点必须 NTP 同步、数据库时区一致。

---

## 12. 故障与扩容

### 12.1 两台方案的故障点

| 故障 | 影响 | 处理 |
|---|---|---|
| 大陆 ECS 故障 | `uter.cc`/`api.uter.cc`、支付宝回调不可用 | 切换到香港备用入口（需备案/风控确认），修复大陆节点 |
| 香港 ECS 故障 | `uter.ai`/`api.uter.ai`/`uter.pro` 不可用 | 切换 GA/DNS 到备用；修复香港节点 |
| CEN 故障 | 大陆节点无法访问香港 RDS/Redis | 监控告警；GA 备用；尽快恢复 CEN |
| 香港 RDS 故障 | 全站不可写 | RDS 高可用自动切换；恢复备份 |
| 香港 Redis 故障 | 会话/限流/缓存异常 | Redis 高可用自动切换 |

### 12.2 推荐扩容

- 大陆 2 台 ECS + 大陆 ALB；
- 香港 2 台 ECS + 香港 ALB；
- 香港 RDS 高可用 + 只读实例（可选）；
- 海外美国节点（后续）服务 `uter.pro`；
- 所有节点仍共享一个主库/Redis。

---

## 13. 备份、监控与安全

### 13.1 备份

- RDS 自动全量 + PITR 30 天；
- 每日逻辑备份到 OSS，跨地域复制；
- Redis 开启持久化/备份；
- KMS/Secrets 单独备份；
- 每季度恢复演练。

### 13.2 监控

- 每个域名 `/api/status` 可用性；
- 5xx、P95/P99 延迟；
- 支付回调失败数、pending 超过 5 分钟订单数；
- RDS 连接数、CPU、慢查询、磁盘；
- Redis 连接数、内存、命中率；
- CEN 跨域延迟/丢包/带宽；
- 证书到期。

### 13.3 安全

- RDS/Redis 不开放公网；
- 安全组只放行 ALB/Nginx → 3000；
- SSH 仅堡垒机；
- WAF 防护 API，支付回调路径放行 POST；
- RAM 最小权限、MFA、ActionTrail；
- 定期轮换数据库/Redis/会话密钥；
- 不提交 `.env`、备份、日志 token。

---

## 14. 回滚

1. 保留上一稳定镜像 tag；
2. 发布前备份 RDS；
3. 回滚：
   ```bash
   docker compose down
   UTER_IMAGE=<上一个稳定 tag> docker compose up -d
   ```
4. 数据库迁移不兼容时，先恢复 RDS 备份；
5. 回滚后立即用“回调诊断”确认支付回调仍到达 Uter。

---

## 15. 实施顺序

1. 创建香港 VPC、RDS PostgreSQL、Redis；
2. 创建大陆 VPC，配置 CEN/TR 与路由、白名单；
3. 部署香港 ECS + Uter，验证 `/api/status`、数据库连接；
4. 部署大陆 ECS + Uter，验证跨域数据库/Redis；
5. 配置大陆 ALB、香港 ALB 与证书；
6. 配置 DNS：`uter.cc`/`api.uter.cc` → 大陆，其余 → 香港；
7. 修复 `uter.cc` 的 OSS/CDN 静态指向，确认回调到达 Uter；
8. 后台配置 ServerAddress、PaymentSiteAddress、CustomCallbackAddress、支付宝参数；
9. 用回调诊断确认 `notify_url 已到达 Uter`；
10. 做 0.01 元支付，验证 `uter.cc` 支付后 `uter.ai` 余额一致；
11. 开启监控、备份、WAF；
12. 逐步切流量，保留回滚窗口。