# Cloudflare Workers 订阅转换服务

## AI重构后的bulianglin/psub

## 🚀 主要功能

1. **代理订阅链接转换** - 支持多种订阅格式转换
2. **隐藏敏感信息** - 隐藏真实服务器地址、密码等敏感信息
3. **多协议支持** - 支持 SS、SSR、VMess、Trojan、VLESS、Hysteria 等协议
4. **临时数据缓存** - 使用 R2 存储进行临时数据管理
5. **前端界面** - 提供用户友好的 Web 界面

## 📁 代码结构

### 配置模块
```javascript
const CONFIG = {
  FRONTEND_URL: 'https://...',          // 前端页面地址
  SUBSCRIPTION_PATH: 'subscription',    // 订阅路径
  SUPPORTED_PROTOCOLS: {...},           // 支持的协议列表
  DEFAULT_HEADERS: {...}                // 默认HTTP头
};
```

### 核心类说明

#### 1. Utils 工具类
```javascript
class Utils {
  static base64Encode(str)      // URL安全的Base64编码
  static base64Decode(str)      // URL安全的Base64解码
  static randomString(length)   // 生成随机字符串
  static randomUUID()           // 生成随机UUID
}
```

#### 2. DataParser 数据解析器
```javascript
class DataParser {
  static parseData(data)        // 智能解析数据格式(base64/yaml/unknown)
}
```

#### 3. ProtocolHandler 协议处理器
```javascript
class ProtocolHandler {
  static replaceInUri(link, replacements, isRecovery)  // 处理不同协议的代理链接
  static replaceSSR(...)        // 处理SSR协议
  static replaceVmess(...)      // 处理VMess协议
  static replaceSS(...)         // 处理SS协议
  static replaceTrojan(...)     // 处理Trojan/VLESS协议
  static replaceHysteria(...)   // 处理Hysteria协议
  static replaceYAML(...)       // 处理YAML格式数据
}
```

#### 4. StorageHandler 存储管理器
```javascript
class StorageHandler {
  async store(key, data, headers)   // 存储数据和头信息
  async get(key)                    // 获取数据
  async delete(key)                 // 删除数据
}
```

#### 5. SubscriptionService 主服务类
```javascript
class SubscriptionService {
  async handleRequest(request)          // 处理请求入口
  async serveFrontend(host)             // 提供前端页面
  async serveSubscription(pathSegments) // 提供订阅数据
  async processConversion(...)          // 处理转换请求
  async processUrlList(...)             // 处理URL列表
  async cleanup(keys)                   // 清理临时存储
}
```

## 🔄 工作流程

1. **接收请求** - 根据路径判断请求类型
2. **解析数据** - 智能识别订阅数据格式
3. **隐藏敏感信息** - 将真实服务器地址等替换为随机值
4. **临时存储** - 将处理后的数据存储到 R2
5. **后端转换** - 调用后端转换服务
6. **恢复信息** - 将随机值替换回真实信息
7. **返回结果** - 返回最终的订阅数据
8. **清理缓存** - 删除临时存储的数据

## 🛠️ 环境变量

在 Cloudflare Workers 中需要配置以下环境变量：

- `SUB_BUCKET` - R2 存储桶实例
- `BACKEND` - 后端转换服务地址

## 📝 代码改进

## 🔧 部署说明

- 注册 Cloudflare 账号，并创建一个 Worker
- 创建储存库：
  - 在 “Workers 和 Pages” > “KV” > “创建命名空间”，名称可自定义，如 `subconverter-mask`
  - 或，在 “Workers 和 Pages” 的下方找到 “R2” > “创建储存桶”，名称可自定义，如 `subconverter-mask`
- 进入 Worker 选择 “设置” > “变量”
  - **添加环境变量（可选）：**
    变量名： `BACKEND` ，值：第三方订阅转换服务地址，比如 `https://api.dler.io`
  - **添加 KV 命名空间绑定：**
    变量名： `SUB_BUCKET` ，值：刚创建的 KV 空间名称，和“R2 储存桶，选择其一进行配置即可”
  - **添加 R2 储存桶绑定：**
    变量名： `SUB_BUCKET` ，值：刚创建的 R2 储存桶名称，和“KV 空间名称，选择其一进行配置即可”
- 绑定自定义域名（略）

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来改进这个项目。

## 重构来源
[bulianglin/psub](https://github.com/bulianglin/psub)


## 部署到
```bash
npx wrangler deploy
```