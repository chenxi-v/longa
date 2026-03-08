# Cloudflare Pages 部署指南

本文档介绍如何将 LongTV 前端部署到 Cloudflare Pages。

## 前置要求

- GitHub 账号
- Cloudflare 账号
- 项目代码已推送到 GitHub 仓库

## 部署步骤

### 1. 登录 Cloudflare Dashboard

1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 在左侧导航栏选择 **Workers & Pages**
3. 点击 **Create application**
4. 选择 **Pages** 标签
5. 点击 **Connect to Git**

### 2. 连接 GitHub 仓库

1. 选择 **GitHub** 作为 Git 提供商
2. 授权 Cloudflare 访问你的 GitHub 账号
3. 选择你的 LongTV 仓库
4. 点击 **Begin setup**

### 3. 配置构建设置

在构建配置页面设置以下参数：

| 配置项 | 值 |
|--------|-----|
| **Production branch** | `main`（或你的主分支名称） |
| **Build command** | `npm run build:cf` |
| **Build output directory** | `out` |
| **Root directory** | `/`（默认） |

> **重要说明**：使用 `build:cf` 命令会自动删除 `local-api` 文件夹，避免本地开发路由与 CF Pages Functions 冲突。

### 4. 配置环境变量

在 **Environment variables** 部分添加以下变量：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `ADMIN_USERNAME` | 你的管理员用户名 | 用于登录管理后台 |
| `ADMIN_PASSWORD` | 你的管理员密码 | 用于登录管理后台 |
| `NEXT_PUBLIC_STORAGE_TYPE` | `upstash` | 存储类型，使用 Upstash 数据库 |
| `UPSTASH_URL` | Upstash Redis 连接地址 | 例如：`https://xxx.upstash.io` |
| `UPSTASH_TOKEN` | Upstash Redis 访问令牌 | 从 Upstash 控制台获取 |

> **重要说明**：
> - `ADMIN_USERNAME` 和 `ADMIN_PASSWORD` 用于保护管理后台，请设置强密码
> - `NEXT_PUBLIC_STORAGE_TYPE` 必须设置为 `upstash` 以使用云端数据库
> - `UPSTASH_URL` 和 `UPSTASH_TOKEN` 可在 [Upstash Console](https://console.upstash.com/) 的数据库详情页获取

### 5. 保存并部署

1. 点击 **Save and Deploy**
2. 等待构建完成（首次部署可能需要几分钟）
3. 部署成功后，Cloudflare 会分配一个 `*.pages.dev` 域名

## 自定义域名（可选）

### 1. 添加自定义域名

1. 在项目页面选择 **Custom domains**
2. 点击 **Set up a custom domain**
3. 输入你的域名（如 `longtv.example.com`）
4. 按照提示添加 DNS 记录

### 2. DNS 配置

在 Cloudflare DNS 设置中添加：

| 类型 | 名称 | 内容 |
|------|------|------|
| CNAME | longtv | 你的项目.pages.dev |

## 项目结构说明

```
LongTV-hw/
├── functions/               # CF Pages Functions（云端 API）
│   ├── api/
│   │   ├── data.ts
│   │   ├── login.ts
│   │   ├── logout.ts
│   │   ├── db-status.ts
│   │   ├── health.ts
│   │   ├── spider-proxy.ts
│   │   ├── spider-accelerator.ts
│   │   ├── video-proxy.ts
│   │   ├── proxy.ts
│   │   └── backend/
│   │       └── [[path]].ts
│   └── _middleware.ts
├── src/
│   ├── app/
│   │   ├── local-api/       # 本地开发 API 路由（部署时自动删除）
│   │   └── ...
│   └── ...
├── package.json
├── next.config.ts
└── ...
```

### 路由分离说明

| 环境 | API 路由位置 | 说明 |
|------|-------------|------|
| 本地开发 | `src/app/local-api/` | Next.js API Routes |
| CF Pages 部署 | `functions/` | Cloudflare Pages Functions |

## 构建命令说明

```json
{
  "scripts": {
    "build": "next build",
    "build:cf": "node -e \"const fs=require('fs'); const path='src/app/local-api'; if(fs.existsSync(path)){fs.rmSync(path,{recursive:true}); console.log('Removed local-api folder');}\" && next build"
  }
}
```

- `build`: 标准构建，保留 `local-api` 用于本地开发
- `build:cf`: CF Pages 专用构建，自动删除 `local-api` 文件夹

## 常见问题

### 1. 构建失败：`local-api` 路由冲突

确保使用 `npm run build:cf` 而不是 `npm run build`。

### 2. API 请求失败

检查以下配置：
- `NEXT_PUBLIC_STORAGE_TYPE` 是否设置为 `upstash`
- `UPSTASH_URL` 和 `UPSTASH_TOKEN` 是否正确
- Upstash 数据库是否正常运行

### 3. 管理后台无法登录

检查环境变量：
- `ADMIN_USERNAME` 和 `ADMIN_PASSWORD` 是否已设置
- 用户名和密码是否输入正确

### 4. Node.js 版本问题

在环境变量中设置 `NODE_VERSION=20` 确保使用正确的 Node.js 版本。

### 5. 函数超时

Cloudflare Pages Functions 免费版有以下限制：
- CPU 时间：10ms
- 请求超时：30s

如需更高性能，考虑升级到付费计划。

## 更新部署

每次推送到主分支，Cloudflare Pages 会自动触发新的部署：

```bash
git add .
git commit -m "update"
git push origin main
```

## 预览部署

Cloudflare Pages 会为每个 Pull Request 创建预览部署，方便测试：

```
https://<commit-hash>.longtv.pages.dev
```

## 相关链接

- [Cloudflare Pages 文档](https://developers.cloudflare.com/pages/)
- [Next.js 部署文档](https://nextjs.org/docs/deployment)
- [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/)
