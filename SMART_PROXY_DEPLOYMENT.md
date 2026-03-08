# 智能代理系统部署指南

## 📋 系统概述

智能代理系统会在爬虫直连失败时自动切换到 Cloudflare Workers 代理，无需手动干预。

### 核心特性

- ✅ **自动检测**：直连失败时自动切换代理
- ✅ **智能缓存**：记录需要代理的域名，下次直接使用
- ✅ **透明切换**：对爬虫代码完全透明
- ✅ **健康检查**：定期重试直连，自动恢复
- ✅ **统计监控**：实时查看代理使用情况

---

## 🚀 部署步骤

### 第一步：部署 Cloudflare Worker

1. **登录 Cloudflare Dashboard**
   - 访问：https://dash.cloudflare.com/
   - 进入 `Workers & Pages`

2. **创建新 Worker**
   - 点击 `Create application`
   - 选择 `Create Worker`
   - 命名为：`longtv-smart-proxy`

3. **粘贴代码**
   - 打开项目中的 `cloudflare-worker-smart-proxy.js`
   - 复制全部内容
   - 粘贴到 Worker 编辑器中

4. **部署 Worker**
   - 点击 `Save and Deploy`
   - 记录 Worker URL，格式如：
     ```
     https://longtv-smart-proxy.your-subdomain.workers.dev
     ```

5. **测试 Worker**
   ```bash
   # 健康检查
   curl https://longtv-smart-proxy.your-subdomain.workers.dev/health
   
   # 测试代理
   curl "https://longtv-smart-proxy.your-subdomain.workers.dev/?targetUrl=https://httpbin.org/get"
   ```

---

### 第二步：配置后端

1. **设置代理URL**
   
   **方法1：通过API设置（推荐）**
   ```bash
   curl -X POST http://localhost:8000/api/smart-proxy/set-url \
     -H "Content-Type: application/json" \
     -d '{"proxy_url": "https://longtv-smart-proxy.your-subdomain.workers.dev"}'
   ```
   
   **方法2：通过环境变量设置**
   ```bash
   export SMART_PROXY_URL="https://longtv-smart-proxy.your-subdomain.workers.dev"
   ```

2. **验证配置**
   ```bash
   curl http://localhost:8000/api/smart-proxy/get-url
   ```

---

### 第三步：测试智能代理

1. **测试连接**
   ```bash
   curl -X POST http://localhost:8000/api/smart-proxy/test-connection \
     -H "Content-Type: application/json" \
     -d '{"url": "https://target-website.com/api"}'
   ```
   
   返回示例：
   ```json
   {
     "code": 0,
     "data": {
       "direct_success": false,
       "proxy_success": true,
       "url": "https://target-website.com/api"
     }
   }
   ```

2. **查看统计信息**
   ```bash
   curl http://localhost:8000/api/smart-proxy/stats
   ```
   
   返回示例：
   ```json
   {
     "code": 0,
     "data": {
       "proxy_domains": ["target-website.com"],
       "healthy_domains": ["api.example.com"],
       "total_proxy_domains": 1,
       "total_healthy_domains": 1,
       "proxy_url": "https://longtv-smart-proxy.your-subdomain.workers.dev"
     }
   }
   ```

---

## 📊 工作原理

### 请求流程

```
爬虫请求
    ↓
检查域名是否在代理列表？
    ├─ 是 → 使用代理 → 成功？
    │              ├─ 是 → 返回结果
    │              └─ 否 → 尝试直连
    │
    └─ 否 → 尝试直连 → 成功？
                   ├─ 是 → 返回结果，记录域名健康
                   └─ 否 → 失败次数+1
                           ↓
                      失败次数 >= 2？
                      ├─ 是 → 加入代理列表，使用代理
                      └─ 否 → 抛出错误
```

### 自动恢复机制

- 每隔 **1小时** 自动重试直连
- 如果直连成功，自动从代理列表移除
- 无需手动干预

---

## 🔧 API 接口

### 1. 设置代理URL
```http
POST /api/smart-proxy/set-url
Content-Type: application/json

{
  "proxy_url": "https://your-worker.workers.dev"
}
```

### 2. 获取代理URL
```http
GET /api/smart-proxy/get-url
```

### 3. 获取统计信息
```http
GET /api/smart-proxy/stats
```

### 4. 测试连接
```http
POST /api/smart-proxy/test-connection
Content-Type: application/json

{
  "url": "https://target-website.com/api"
}
```

### 5. 清空缓存
```http
POST /api/smart-proxy/clear-cache
```

### 6. 移除域名
```http
POST /api/smart-proxy/remove-domain?domain=target-website.com
```

---

## 🎯 使用场景

### 场景1：云服务器部署

**问题：** 云服务器IP被目标网站封禁

**解决：**
1. 部署 Cloudflare Worker
2. 配置智能代理URL
3. 系统自动检测并切换代理

**效果：**
- 第一次请求：直连失败 → 自动切换代理
- 后续请求：直接使用代理
- 1小时后：自动重试直连

### 场景2：海外爬虫加速

**问题：** 海外网站访问慢或超时

**解决：**
- Cloudflare Worker 全球加速
- 自动选择最优节点

### 场景3：混合环境

**问题：** 部分网站可直连，部分需要代理

**解决：**
- 智能识别需要代理的域名
- 自动分类管理
- 无需手动配置

---

## 📝 配置参数

在 `backend/app/core/smart_proxy.py` 中可调整：

```python
self.max_failures = 2        # 最大失败次数（默认2次）
self.retry_interval = 3600   # 重试间隔（默认1小时）
self.timeout = 10            # 请求超时（默认10秒）
```

---

## 🐛 故障排查

### 问题1：代理不生效

**检查：**
```bash
# 1. 检查代理URL是否设置
curl http://localhost:8000/api/smart-proxy/get-url

# 2. 测试Worker是否正常
curl https://your-worker.workers.dev/health

# 3. 查看统计信息
curl http://localhost:8000/api/smart-proxy/stats
```

### 问题2：Worker部署失败

**解决：**
- 检查代码语法
- 查看 Cloudflare Dashboard 的错误日志
- 确保账户有 Workers 配额

### 问题3：缓存文件权限

**解决：**
```bash
# 确保后端有写入权限
chmod 666 backend/proxy_cache.json
```

---

## 💡 最佳实践

1. **监控代理使用**
   - 定期查看 `/api/smart-proxy/stats`
   - 关注 `proxy_domains` 列表

2. **定期清理缓存**
   - 如果网站恢复，手动清空缓存
   - 让系统重新检测

3. **Worker性能优化**
   - Cloudflare Workers 免费额度：每天 100,000 请求
   - 如需更多，升级到付费计划

4. **安全建议**
   - 不要在 Worker 中硬编码敏感信息
   - 使用环境变量管理配置

---

## 📚 相关文件

- `cloudflare-worker-smart-proxy.js` - Worker代理脚本
- `backend/app/core/smart_proxy.py` - 智能代理管理器
- `backend/app/core/spider.py` - 爬虫基类（已集成）
- `backend/app/api/smart_proxy.py` - API接口
- `backend/proxy_cache.json` - 缓存文件（自动生成）

---

## 🎉 完成！

现在你的爬虫系统已经具备智能代理能力：

- ✅ 自动检测网络问题
- ✅ 自动切换代理
- ✅ 自动恢复直连
- ✅ 无需手动干预

享受无忧的爬虫体验吧！🚀
