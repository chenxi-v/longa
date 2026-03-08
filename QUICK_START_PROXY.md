# 智能代理配置完成指南

## ✅ 你的配置信息

- **Worker URL**: `https://corspy.longz.cc.cd` （自定义域名）
- **状态**: 已部署

---

## 🚀 快速配置步骤

### 步骤1：创建配置文件

在 `backend` 目录下创建 `.env` 文件：

```bash
cd backend
```

创建 `.env` 文件，内容如下：

```
SMART_PROXY_URL=https://corspy.longz.cc.cd
```

或者直接复制模板：

```bash
# Windows
copy .env.proxy .env

# Linux/Mac
cp .env.proxy .env
```

### 步骤2：重启后端服务

```bash
# 停止当前后端（Ctrl+C）

# 启动后端
python -m app.main
```

启动后应该看到：
```
智能代理已启用: https://corspy.longz.cc.cd
```

### 步骤3：验证配置

```bash
# 查看代理URL
curl http://localhost:8000/api/smart-proxy/get-url

# 预期返回
{
  "code": 0,
  "data": {
    "proxy_url": "https://corspy.longz.cc.cd"
  }
}
```

---

## 🧪 测试智能代理

### 测试1：测试特定网站连接

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
    "direct_success": false,  // 直连失败
    "proxy_success": true,    // 代理成功
    "url": "https://target-website.com/api"
  }
}
```

### 测试2：查看统计信息

```bash
curl http://localhost:8000/api/smart-proxy/stats
```

返回示例：
```json
{
  "code": 0,
  "data": {
    "proxy_domains": ["target-website.com"],  // 需要代理的域名
    "healthy_domains": ["api.example.com"],   // 健康的域名
    "total_proxy_domains": 1,
    "total_healthy_domains": 1,
    "proxy_url": "https://corspy.longz.cc.cd"
  }
}
```

### 测试3：测试爬虫

```bash
# 测试爬虫首页接口
curl -X POST http://localhost:8000/api/home \
  -H "Content-Type: application/json" \
  -d '{"key": "your-spider-key", "filter": false, "use_proxy": true}'
```

---

## 📊 工作原理

### 自动切换流程

```
1. 爬虫发起请求
   ↓
2. 尝试直连
   ├─ 成功 → 记录域名健康，返回结果
   └─ 失败 → 记录失败次数
       ↓
   失败次数 >= 2？
   ├─ 是 → 自动切换到代理
   │       ↓
   │   使用 https://corspy.longz.cc.cd/?targetUrl=...
   │       ↓
   │   成功 → 返回结果，记录域名需要代理
   │
   └─ 否 → 抛出错误
```

### 自动恢复机制

- 每隔 **1小时** 自动重试直连
- 如果直连恢复，自动从代理列表移除
- 完全自动化，无需人工干预

---

## 🎯 实际使用示例

### 场景：云服务器访问海外网站

**第一次请求：**
```
爬虫 → 直连 https://overseas-site.com/api
     → 失败（超时）
     → 记录失败：1次
```

**第二次请求：**
```
爬虫 → 直连 https://overseas-site.com/api
     → 失败（超时）
     → 记录失败：2次
     → 达到阈值，加入代理列表
     → 使用代理：https://corspy.longz.cc.cd/?targetUrl=...
     → 成功！
```

**第三次请求：**
```
爬虫 → 检查域名在代理列表
     → 直接使用代理
     → 成功！
```

**1小时后：**
```
爬虫 → 自动重试直连
     → 如果成功，从代理列表移除
     → 如果失败，继续使用代理
```

---

## 🔧 管理命令

### 查看当前配置
```bash
curl http://localhost:8000/api/smart-proxy/get-url
```

### 查看统计信息
```bash
curl http://localhost:8000/api/smart-proxy/stats
```

### 清空缓存
```bash
curl -X POST http://localhost:8000/api/smart-proxy/clear-cache
```

### 移除特定域名
```bash
curl -X POST "http://localhost:8000/api/smart-proxy/remove-domain?domain=target-website.com"
```

### 更新代理URL
```bash
curl -X POST http://localhost:8000/api/smart-proxy/set-url \
  -H "Content-Type: application/json" \
  -d '{"proxy_url": "https://new-worker.example.com"}'
```

---

## 📝 配置文件位置

- **环境变量文件**: `backend/.env`
- **缓存文件**: `backend/proxy_cache.json` （自动生成）
- **配置模板**: `backend/.env.proxy`

---

## ✅ 配置完成检查清单

- [ ] 已创建 `backend/.env` 文件
- [ ] 已设置 `SMART_PROXY_URL=https://corspy.longz.cc.cd`
- [ ] 已重启后端服务
- [ ] 启动日志显示 "智能代理已启用"
- [ ] API 测试返回正常

---

## 🎉 完成！

现在你的爬虫系统已经具备智能代理能力：

✅ 自动检测网络问题  
✅ 自动切换代理  
✅ 自动恢复直连  
✅ 无需手动干预  

享受无忧的爬虫体验吧！🚀
