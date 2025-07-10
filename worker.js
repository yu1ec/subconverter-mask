/**
 * Cloudflare Workers 订阅转换服务
 * 
 * 主要功能：
 * 1. 代理订阅链接转换和隐藏真实服务器信息  
 * 2. 支持多种代理协议：SS、SSR、VMess、Trojan、VLESS、Hysteria
 * 3. 临时数据缓存和存储管理
 * 4. 前端界面服务
 */

// 引入js-yaml库来处理YAML数据
import yaml from 'js-yaml';

// ========== 配置常量 ==========
const CONFIG = {
  SUBSCRIPTION_PATH: 'subscription',
  SUPPORTED_PROTOCOLS: {
    SS: 'ss://',
    SSR: 'ssr://',
    VMESS: 'vmess://',
    VMESS1: 'vmess1://',
    TROJAN: 'trojan://',
    VLESS: 'vless://',
    HYSTERIA: 'hysteria://'
  },
  DEFAULT_HEADERS: {
    'Content-Type': 'text/plain;charset=UTF-8'
  }
};

// 内联前端HTML内容
const FRONTEND_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#409EFF">
    <title>订阅转换工具 - Sub Converter</title>
    
    <!-- 引入Element UI CSS -->
    <link rel="stylesheet" href="https://unpkg.com/element-ui/lib/theme-chalk/index.css">
    
    <!-- 自定义样式 -->
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            overflow-x: hidden;
        }

        .app-container {
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }

        .main-card {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
            backdrop-filter: blur(10px);
            overflow: hidden;
        }

        .content {
            padding: 40px;
        }

        .form-section {
            margin-bottom: 30px;
        }

        .form-section h3 {
            color: #333;
            margin-bottom: 15px;
            font-size: 1.2rem;
            font-weight: 600;
        }

        .form-row {
            margin-bottom: 20px;
        }

        .result-section {
            margin-top: 30px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 10px;
            border: 1px solid #e9ecef;
        }

        .footer {
            text-align: center;
            padding: 20px;
            color: #666;
            border-top: 1px solid #e9ecef;
        }

        .footer a {
            color: #409EFF;
            text-decoration: none;
        }

        .footer a:hover {
            text-decoration: underline;
        }

        /* 响应式设计 */
        @media (max-width: 768px) {
            .app-container {
                padding: 10px;
            }
            
            .content {
                padding: 20px;
            }
        }

        /* 动画效果 */
        .fade-enter-active, .fade-leave-active {
            transition: opacity 0.3s;
        }
        
        .fade-enter, .fade-leave-to {
            opacity: 0;
        }

        /* 自定义按钮样式 */
        .custom-button {
            background: linear-gradient(135deg, #409EFF, #5A67D8);
            border: none;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(64, 158, 255, 0.3);
        }

        .custom-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(64, 158, 255, 0.4);
        }

        .custom-button:active {
            transform: translateY(0);
        }

        /* 加载动画 */
        .loading-spinner {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #409EFF;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            animation: spin 1s linear infinite;
            margin-right: 10px;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>

<body>
    <div id="app">
        <div class="app-container">
            <div class="main-card">
                <!-- 主要内容 -->
                <div class="content">
                    <!-- 订阅链接输入区域 -->
                    <div class="form-section">
                        <h3><i class="el-icon-link"></i> 订阅链接</h3>
                        <el-input
                            v-model="subscription.url"
                            type="textarea"
                            :rows="3"
                            placeholder="请输入订阅链接，支持多个链接（每行一个）"
                            clearable>
                        </el-input>
                        <div style="margin-top: 10px;">
                            <el-button 
                                type="text" 
                                @click="showExampleUrls = !showExampleUrls">
                                <i class="el-icon-question"></i> 查看示例链接
                            </el-button>
                        </div>
                        <el-collapse-transition>
                            <div v-show="showExampleUrls" style="margin-top: 10px;">
                                <el-alert
                                    title="示例订阅链接"
                                    type="info"
                                    show-icon
                                    :closable="false">
                                    <template slot="default">
                                        <div>SS订阅: https://example.com/ss-subscription</div>
                                        <div>SSR订阅: https://example.com/ssr-subscription</div>
                                        <div>V2ray订阅: https://example.com/v2ray-subscription</div>
                                        <div>Trojan订阅: https://example.com/trojan-subscription</div>
                                    </template>
                                </el-alert>
                            </div>
                        </el-collapse-transition>
                    </div>

                    <!-- 高级设置 -->
                    <div class="form-section">
                        <h3><i class="el-icon-setting"></i> 高级设置</h3>
                        <el-row :gutter="20">
                            <el-col :span="12">
                                <div class="form-row">
                                    <label>输出格式:</label>
                                    <el-select 
                                        v-model="config.target" 
                                        placeholder="选择输出格式"
                                        style="width: 100%; margin-top: 5px;">
                                        <el-option
                                            v-for="item in targetFormats"
                                            :key="item.value"
                                            :label="item.label"
                                            :value="item.value">
                                        </el-option>
                                    </el-select>
                                </div>
                            </el-col>
                            <el-col :span="12">
                                <div class="form-row">
                                    <label>配置文件:</label>
                                    <el-select 
                                        v-model="config.config" 
                                        placeholder="选择配置文件"
                                        style="width: 100%; margin-top: 5px;">
                                        <el-option
                                            v-for="item in configFiles"
                                            :key="item.value"
                                            :label="item.label"
                                            :value="item.value">
                                        </el-option>
                                    </el-select>
                                </div>
                            </el-col>
                        </el-row>

                        <el-row :gutter="20" style="margin-top: 15px;">
                            <el-col :span="12">
                                <div class="form-row">
                                    <el-checkbox v-model="config.emoji">
                                        <i class="el-icon-star-on"></i> 启用 Emoji
                                    </el-checkbox>
                                </div>
                            </el-col>
                            <el-col :span="12">
                                <div class="form-row">
                                    <el-checkbox v-model="config.udp">
                                        <i class="el-icon-connection"></i> 启用 UDP
                                    </el-checkbox>
                                </div>
                            </el-col>
                        </el-row>

                        <el-row :gutter="20" style="margin-top: 15px;">
                            <el-col :span="12">
                                <div class="form-row">
                                    <el-checkbox v-model="config.scv">
                                        <i class="el-icon-check"></i> 跳过证书验证
                                    </el-checkbox>
                                </div>
                            </el-col>
                            <el-col :span="12">
                                <div class="form-row">
                                    <el-checkbox v-model="config.sort">
                                        <i class="el-icon-sort"></i> 节点排序
                                    </el-checkbox>
                                </div>
                            </el-col>
                        </el-row>

                        <div class="form-row" style="margin-top: 15px;">
                            <label>Exclude:</label>
                            <el-input
                                v-model="config.exclude"
                                placeholder="输入要排除的节点关键词，多个关键词用|分隔"
                                clearable
                                style="margin-top: 5px;">
                                <template slot="prepend">
                                    <i class="el-icon-remove"></i>
                                </template>
                            </el-input>
                            <div style="margin-top: 5px; color: #909399; font-size: 12px;">
                                例如：港|HK|Taiwan 将排除包含这些关键词的节点
                            </div>
                        </div>
                    </div>

                    <!-- 操作按钮 -->
                    <div class="form-section" style="text-align: center;">
                        <el-button 
                            type="primary" 
                            size="large"
                            @click="convertSubscription"
                            :loading="isConverting"
                            class="custom-button">
                            <i class="el-icon-refresh" v-if="!isConverting"></i>
                            <span v-if="isConverting" class="loading-spinner"></span>
                            {{ isConverting ? '转换中...' : '开始转换' }}
                        </el-button>
                        
                        <el-button 
                            size="large"
                            @click="resetForm"
                            style="margin-left: 15px;">
                            <i class="el-icon-refresh-left"></i>
                            重置
                        </el-button>
                    </div>

                    <!-- 结果展示区域 -->
                    <transition name="fade">
                        <div v-if="result.url" class="result-section">
                            <h3><i class="el-icon-success text-success"></i> 转换结果</h3>
                            <el-input
                                v-model="result.url"
                                type="textarea"
                                :rows="3"
                                readonly
                                style="margin-top: 15px;">
                            </el-input>
                            
                            <div style="margin-top: 15px; text-align: center;">
                                <el-button 
                                    type="success" 
                                    @click="copyToClipboard"
                                    icon="el-icon-document-copy">
                                    复制链接
                                </el-button>
                                
                                <el-button 
                                    type="info" 
                                    @click="generateQRCode"
                                    icon="el-icon-picture">
                                    生成二维码
                                </el-button>
                            </div>

                            <!-- 二维码展示 -->
                            <transition name="fade">
                                <div v-if="qrCodeUrl" style="text-align: center; margin-top: 20px;">
                                    <div id="qrcode" style="display: inline-block;"></div>
                                    <p style="margin-top: 10px; color: #666;">扫描二维码导入订阅</p>
                                </div>
                            </transition>
                        </div>
                    </transition>

                    <!-- 错误信息 -->
                    <transition name="fade">
                        <el-alert
                            v-if="errorMessage"
                            :title="errorMessage"
                            type="error"
                            show-icon
                            :closable="true"
                            @close="errorMessage = ''"
                            style="margin-top: 20px;">
                        </el-alert>
                    </transition>
                </div>

                <!-- 页脚 -->
                <div class="footer">
                    <p>
                        Powered by 
                        <a href="https://github.com/tindy2013/subconverter" target="_blank">
                            SubConverter
                        </a>
                    </p>
                    <p style="margin-top: 5px; font-size: 0.9rem;">
                        支持 SS / SSR / V2Ray / Trojan / Shadowsocks 等多种格式转换
                    </p>
                </div>
            </div>
        </div>
    </div>

    <!-- 引入依赖库 -->
    <script src="https://unpkg.com/vue@2.6.14/dist/vue.min.js"></script>
    <script src="https://unpkg.com/element-ui/lib/index.js"></script>
    <script src="https://unpkg.com/axios/dist/axios.min.js"></script>
    <script src="https://unpkg.com/qrcode-generator/qrcode.js"></script>

    <!-- Vue应用脚本 -->
    <script>
        new Vue({
            el: '#app',
            data() {
                return {
                    // 订阅配置
                    subscription: {
                        url: ''
                    },
                    
                    // 转换配置
                    config: {
                        target: 'clash',
                        config: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online.ini',
                        emoji: true,
                        udp: true,
                        scv: false,
                        sort: false
                    },
                    
                    // 目标格式选项
                    targetFormats: [
                        { label: 'Clash', value: 'clash' },
                        { label: 'ClashR', value: 'clashr' },
                        { label: 'Quantumult', value: 'quan' },
                        { label: 'Quantumult X', value: 'quanx' },
                        { label: 'Loon', value: 'loon' },
                        { label: 'Surfboard', value: 'surfboard' },
                        { label: 'SS', value: 'ss' },
                        { label: 'SSR', value: 'ssr' },
                        { label: 'V2Ray', value: 'v2ray' },
                        { label: 'Trojan', value: 'trojan' }
                    ],
                    
                    // 配置文件选项
                    configFiles: [
                        { 
                            label: 'ACL4SSR_Online 默认版', 
                            value: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online.ini' 
                        },
                        { 
                            label: 'ACL4SSR_Online_AdblockPlus 去广告版', 
                            value: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online_AdblockPlus.ini' 
                        },
                        { 
                            label: 'ACL4SSR_Online_NoAuto 无自动测速版', 
                            value: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online_NoAuto.ini' 
                        },
                        { 
                            label: 'ACL4SSR_Online_Mini 精简版', 
                            value: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online_Mini.ini' 
                        }
                    ],
                    
                    // 状态管理
                    isConverting: false,
                    showExampleUrls: false,
                    
                    // 结果数据
                    result: {
                        url: ''
                    },
                    
                    // 错误信息
                    errorMessage: '',
                    
                    // 二维码
                    qrCodeUrl: ''
                }
            },
            
            methods: {
                // 转换订阅
                async convertSubscription() {
                    if (!this.subscription.url.trim()) {
                        this.showError('请输入订阅链接');
                        return;
                    }
                    
                    this.isConverting = true;
                    this.errorMessage = '';
                    this.result.url = '';
                    this.qrCodeUrl = '';
                    
                    try {
                        // 构建转换参数
                        const params = new URLSearchParams({
                            target: this.config.target,
                            url: this.subscription.url,
                            config: this.config.config,
                            emoji: this.config.emoji ? 'true' : 'false',
                            udp: this.config.udp ? 'true' : 'false',
                            scv: this.config.scv ? 'true' : 'false',
                            sort: this.config.sort ? 'true' : 'false'
                        });
                        
                        // 如果有exclude参数，添加到URL中
                        if (this.config.exclude && this.config.exclude.trim()) {
                            params.append('exclude', this.config.exclude.trim());
                        }
                        
                        // 构建转换URL（使用当前域名的API）
                        const convertUrl = \`\${window.location.origin}/sub?\${params.toString()}\`;
                        
                        // 设置结果
                        this.result.url = convertUrl;
                        
                        this.$message({
                            type: 'success',
                            message: '转换成功！',
                            duration: 2000
                        });
                        
                    } catch (error) {
                        console.error('转换失败:', error);
                        this.showError('转换失败，请检查订阅链接是否正确');
                    } finally {
                        this.isConverting = false;
                    }
                },
                
                // 重置表单
                resetForm() {
                    this.subscription.url = '';
                    this.result.url = '';
                    this.errorMessage = '';
                    this.qrCodeUrl = '';
                    this.showExampleUrls = false;
                    
                    // 重置配置为默认值
                    this.config = {
                        target: 'clash',
                        config: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online.ini',
                        emoji: true,
                        udp: true,
                        scv: false,
                        sort: false,
                        exclude: ''
                    };
                    
                    this.$message({
                        type: 'info',
                        message: '已重置所有设置',
                        duration: 1500
                    });
                },
                
                // 复制到剪贴板
                async copyToClipboard() {
                    try {
                        await navigator.clipboard.writeText(this.result.url);
                        this.$message({
                            type: 'success',
                            message: '已复制到剪贴板',
                            duration: 2000
                        });
                    } catch (error) {
                        // 降级方案
                        const textarea = document.createElement('textarea');
                        textarea.value = this.result.url;
                        document.body.appendChild(textarea);
                        textarea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textarea);
                        
                        this.$message({
                            type: 'success',
                            message: '已复制到剪贴板',
                            duration: 2000
                        });
                    }
                },
                
                // 生成二维码
                generateQRCode() {
                    if (!this.result.url) return;
                    
                    try {
                        // 清除之前的二维码
                        const qrContainer = document.getElementById('qrcode');
                        qrContainer.innerHTML = '';
                        
                        // 生成新的二维码
                        const qr = qrcode(0, 'M');
                        qr.addData(this.result.url);
                        qr.make();
                        
                        // 创建二维码图片
                        const qrImage = qr.createImgTag(4, 8);
                        qrContainer.innerHTML = qrImage;
                        
                        this.qrCodeUrl = this.result.url;
                        
                        this.$message({
                            type: 'success',
                            message: '二维码生成成功',
                            duration: 2000
                        });
                        
                    } catch (error) {
                        console.error('二维码生成失败:', error);
                        this.showError('二维码生成失败');
                    }
                },
                
                // 显示错误信息
                showError(message) {
                    this.errorMessage = message;
                    this.$message({
                        type: 'error',
                        message: message,
                        duration: 3000
                    });
                }
            },
            
            mounted() {
                // 页面加载完成后的初始化
                console.log('订阅转换工具已加载');
                
                // 检查URL参数
                const urlParams = new URLSearchParams(window.location.search);
                const urlParam = urlParams.get('url');
                if (urlParam) {
                    this.subscription.url = decodeURIComponent(urlParam);
                }
            }
        });
    </script>
</body>
</html>`;

// ========== 工具函数类 ==========
class Utils {
  /**
   * URL安全的Base64编码
   */
  static base64Encode(str) {
    return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  /**
   * URL安全的Base64解码
   */
  static base64Decode(str) {
    const padded = str + "=".repeat((4 - str.length % 4) % 4);
    return atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  }

  /**
   * 生成随机字符串
   */
  static randomString(length = 10) {
    return Math.random().toString(36).substring(2, length + 2);
  }

  /**
   * 生成随机UUID
   */
  static randomUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == "x" ? r : r & 3 | 8;
      return v.toString(16);
    });
  }
}

// ========== 数据解析器 ==========
class DataParser {
  /**
   * 智能解析数据格式
   */
  static parseData(data) {
    // 尝试Base64解码
    try {
      return { 
        format: "base64", 
        data: Utils.base64Decode(data) 
      };
    } catch (base64Error) {
      // 尝试YAML解析
      try {
        return { 
          format: "yaml", 
          data: yaml.load(data) 
        };
      } catch (yamlError) {
        return { 
          format: "unknown", 
          data 
        };
      }
    }
  }
}

// ========== 协议处理器 ==========
class ProtocolHandler {
  /**
   * 处理不同协议的代理链接
   */
  static replaceInUri(link, replacements, isRecovery) {
    if (!link) return null;

    // 根据协议类型选择处理方法
    if (link.startsWith(CONFIG.SUPPORTED_PROTOCOLS.SS)) {
      return this.replaceSS(link, replacements, isRecovery);
    } else if (link.startsWith(CONFIG.SUPPORTED_PROTOCOLS.SSR)) {
      return this.replaceSSR(link, replacements, isRecovery);
    } else if (link.startsWith(CONFIG.SUPPORTED_PROTOCOLS.VMESS) || 
               link.startsWith(CONFIG.SUPPORTED_PROTOCOLS.VMESS1)) {
      return this.replaceVmess(link, replacements, isRecovery);
    } else if (link.startsWith(CONFIG.SUPPORTED_PROTOCOLS.TROJAN) || 
               link.startsWith(CONFIG.SUPPORTED_PROTOCOLS.VLESS)) {
      return this.replaceTrojan(link, replacements, isRecovery);
    } else if (link.startsWith(CONFIG.SUPPORTED_PROTOCOLS.HYSTERIA)) {
      return this.replaceHysteria(link, replacements);
    }
    
    return null;
  }

  /**
   * 处理SSR协议
   */
  static replaceSSR(link, replacements, isRecovery) {
    try {
      link = link.slice(4).replace("\r", "").split("#")[0]; // 移除ssr://
      link = Utils.base64Decode(link);
      
      const regexMatch = link.match(/(\S+):(\d+?):(\S+?):(\S+?):(\S+?):(\S+)\//);
      if (!regexMatch) return null;

      const [, server, , , , , password] = regexMatch;
      
      if (isRecovery) {
        const newLink = link
          .replace(password, Utils.base64Encode(replacements[Utils.base64Decode(password)]))
          .replace(server, replacements[server]);
        return "ssr://" + Utils.base64Encode(newLink);
      } else {
        const randomPassword = Utils.randomString(12);
        const randomDomain = Utils.randomString(12) + ".com";
        
        replacements[randomDomain] = server;
        replacements[randomPassword] = Utils.base64Decode(password);
        
        const newLink = link
          .replace(server, randomDomain)
          .replace(password, Utils.base64Encode(randomPassword));
        return "ssr://" + Utils.base64Encode(newLink);
      }
    } catch (error) {
      return null;
    }
  }

  /**
   * 处理VMess协议
   */
  static replaceVmess(link, replacements, isRecovery) {
    const randomUUID = Utils.randomUUID();
    const randomDomain = Utils.randomString(10) + ".com";

    try {
      let tempLink = link.replace(/vmess:\/\/|vmess1:\/\//g, "");
      tempLink = Utils.base64Decode(tempLink);

      const jsonData = JSON.parse(tempLink);
      const server = jsonData.add;
      const uuid = jsonData.id;

      let result;
      if (isRecovery) {
        result = tempLink
          .replace(uuid, replacements[uuid])
          .replace(server, replacements[server]);
      } else {
        replacements[randomDomain] = server;
        replacements[randomUUID] = uuid;
        result = tempLink
          .replace(uuid, randomUUID)
          .replace(server, randomDomain);
      }

      return "vmess://" + btoa(result);
    } catch (error) {
      return null;
    }
  }

  /**
   * 处理SS协议
   */
  static replaceSS(link, replacements, isRecovery) {
    const randomPassword = Utils.randomString(12);
    const randomDomain = randomPassword + ".com";
    
    try {
      let tempLink = link.slice(5).split("#")[0]; // 移除ss://
      
      if (tempLink.includes("@")) {
        const regexMatch1 = tempLink.match(/(\S+?)@(\S+):/);
        if (!regexMatch1) return null;

        const [, base64Data, server] = regexMatch1;
        const regexMatch2 = Utils.base64Decode(base64Data).match(/(\S+?):(\S+)/);
        if (!regexMatch2) return null;

        const [, encryption, password] = regexMatch2;

        if (isRecovery) {
          const newStr = Utils.base64Encode(encryption + ":" + replacements[password]);
          return link.replace(base64Data, newStr).replace(server, replacements[server]);
        } else {
          replacements[randomDomain] = server;
          replacements[randomPassword] = password;
          const newStr = Utils.base64Encode(encryption + ":" + randomPassword);
          return link.replace(base64Data, newStr).replace(/@.*:/, "@" + randomDomain + ":");
        }
      } else {
        const decodedValue = Utils.base64Decode(tempLink);
        const regexMatch = decodedValue.match(/(\S+?):(\S+)@(\S+):/);
        if (!regexMatch) return null;

        const [, , password, server] = regexMatch;
        replacements[randomDomain] = server;
        replacements[randomPassword] = password;

        let replacedString = "ss://" + Utils.base64Encode(
          decodedValue
            .replace(/:.*@/, ":" + randomPassword + "@")
            .replace(/@.*:/, "@" + randomDomain + ":")
        );

        const hashPart = link.match(/#.*/);
        if (hashPart) replacedString += hashPart[0];

        return replacedString;
      }
    } catch (error) {
      return null;
    }
  }

  /**
   * 处理Trojan/VLESS协议
   */
  static replaceTrojan(link, replacements, isRecovery) {
    const randomUUID = Utils.randomUUID();
    const randomDomain = Utils.randomString(10) + ".com";
    
    const regexMatch = link.match(/(vless|trojan):\/\/(.*?)@(.*):/);
    if (!regexMatch) return null;

    const [, , uuid, server] = regexMatch;
    replacements[randomDomain] = server;
    replacements[randomUUID] = uuid;

    const regex = new RegExp(uuid + "|" + server, "g");
    
    if (isRecovery) {
      return link.replace(regex, (match) => {
        if (match === uuid) return replacements[uuid];
        if (match === server) return replacements[server];
        return match;
      });
    } else {
      return link.replace(regex, (match) => {
        if (match === uuid) return randomUUID;
        if (match === server) return randomDomain;
        return match;
      });
    }
  }

  /**
   * 处理Hysteria协议
   */
  static replaceHysteria(link, replacements) {
    const regexMatch = link.match(/hysteria:\/\/(.*):(.*?)\?/);
    if (!regexMatch) return null;

    const server = regexMatch[1];
    const randomDomain = Utils.randomString(12) + ".com";
    replacements[randomDomain] = server;

    return link.replace(server, randomDomain);
  }

  /**
   * 处理YAML格式数据
   */
  static replaceYAML(yamlObj, replacements) {
    if (!yamlObj.proxies) return null;

    yamlObj.proxies.forEach((proxy) => {
      const randomPassword = Utils.randomString(12);
      const randomDomain = randomPassword + ".com";
      
      // 替换服务器地址
      const originalServer = proxy.server;
      proxy.server = randomDomain;
      replacements[randomDomain] = originalServer;

      // 替换密码
      if (proxy.password) {
        const originalPassword = proxy.password;
        proxy.password = randomPassword;
        replacements[randomPassword] = originalPassword;
      }

      // 替换UUID
      if (proxy.uuid) {
        const originalUUID = proxy.uuid;
        const randomUUID = Utils.randomUUID();
        proxy.uuid = randomUUID;
        replacements[randomUUID] = originalUUID;
      }
    });

    return yaml.dump(yamlObj);
  }
}

// ========== 存储管理器 ==========
class StorageHandler {
  constructor(bucket) {
    this.bucket = bucket;
  }

  /**
   * 存储数据和头信息
   */
  async store(key, data, headers = null) {
    await this.bucket.put(key, data);
    if (headers) {
      await this.bucket.put(key + "_headers", JSON.stringify(Object.fromEntries(headers)));
    }
  }

  /**
   * 获取数据
   */
  async get(key) {
    console.log("🗄️  存储查询:", key);
    
    try {
      const object = await this.bucket.get(key);
      const objectHeaders = await this.bucket.get(key + "_headers");
      
      console.log("  - 主数据:", object === null ? "❌ 未找到" : "✅ 找到");
      console.log("  - 头信息:", objectHeaders === null ? "❌ 未找到" : "✅ 找到");
      
      if (object === null) {
        console.log("  - 返回结果: null");
        return null;
      }

      let headers;
      if (objectHeaders) {
        if ("R2Bucket" === this.bucket.constructor.name) {
          headers = new Headers(await objectHeaders.json());
        } else {
          headers = new Headers(JSON.parse(objectHeaders));
        }
        console.log("  - 使用存储的头信息");
      } else {
        headers = new Headers(CONFIG.DEFAULT_HEADERS);
        console.log("  - 使用默认头信息");
      }

      let body;
      if ("R2Bucket" === this.bucket.constructor.name) {
        body = object.body;
        console.log("  - 数据源: R2 Bucket");
      } else {
        body = object;
        console.log("  - 数据源: KV Store");
      }

      console.log("  - 数据大小:", body ? (body.length || 0) : 0);
      return { body, headers };
    } catch (error) {
      console.error("❌ 存储查询错误:", error);
      throw error;
    }
  }

  /**
   * 删除数据
   */
  async delete(key) {
    await this.bucket.delete(key);
    await this.bucket.delete(key + "_headers");
  }
}

// ========== 主服务类 ==========
class SubscriptionService {
  constructor(env) {
    this.env = env;
    this.storage = new StorageHandler(env.SUB_BUCKET);
    this.backend = env.BACKEND.replace(/(https?:\/\/[^/]+).*$/, "$1");
  }

  /**
   * 处理请求入口
   */
  async handleRequest(request) {
    const url = new URL(request.url);
    const host = url.origin;
    const pathSegments = url.pathname.split("/").filter(segment => segment.length > 0);

    // 处理根路径 - 返回前端页面
    if (pathSegments.length === 0) {
      return await this.serveFrontend(host);
    }

    // 处理订阅路径 - 从存储获取数据
    if (pathSegments[0] === CONFIG.SUBSCRIPTION_PATH) {
      return await this.serveSubscription(pathSegments);
    }

    // 处理转换请求
    return await this.processConversion(request, url, host);
  }

  /**
   * 提供前端页面
   */
  async serveFrontend(host) {
    return new Response(FRONTEND_HTML, {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });
  }

  /**
   * 提供订阅数据
   */
  async serveSubscription(pathSegments) {
    const key = pathSegments[pathSegments.length - 1];
    console.log("📝 订阅请求调试信息:");
    console.log("  - 请求路径:", pathSegments.join('/'));
    console.log("  - 订阅密钥:", key);
    
    try {
      const result = await this.storage.get(key);
      console.log("  - 存储查询结果:", result ? "✅ 找到数据" : "❌ 未找到数据");
      
      if (!result) {
        console.log("  - 返回状态: 404 Not Found");
        return new Response("订阅未找到", { 
          status: 404,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }

      console.log("  - 数据类型:", typeof result.body);
      console.log("  - 数据长度:", result.body ? result.body.length || 0 : 0);
      console.log("  - 响应头数量:", result.headers ? result.headers.size || 0 : 0);
      console.log("  - 返回状态: 200 OK");

      return new Response(result.body, { headers: result.headers });
    } catch (error) {
      console.error("❌ 订阅服务错误:", error);
      return new Response("服务器内部错误: " + error.message, { 
        status: 500,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  }

  /**
   * 处理转换请求
   */
  async processConversion(request, url, host) {
    console.log("🔄 开始处理转换请求:");
    console.log("  - 请求URL:", url.toString());
    
    const urlParam = url.searchParams.get("url");
    if (!urlParam) {
      console.log("  - ❌ 缺少URL参数");
      return new Response("缺少URL参数", { status: 400 });
    }

    console.log("  - 输入URL参数:", urlParam.substring(0, 100) + (urlParam.length > 100 ? '...' : ''));

    // 处理后端参数
    let backend = this.backend;
    const backendParam = url.searchParams.get("bd");
    if (backendParam && /^(https?:\/\/[^/]+)[.].+$/g.test(backendParam)) {
      backend = backendParam.replace(/(https?:\/\/[^/]+).*$/, "$1");
    }
    console.log("  - 使用后端:", backend);

    const replacements = {};
    const replacedURIs = [];
    const keys = [];

    try {
      // 处理输入的URL列表
      console.log("  - 🔍 开始处理URL列表");
      await this.processUrlList(urlParam, request, host, replacements, replacedURIs, keys);
      console.log("  - 处理后的URI数量:", replacedURIs.length);
      console.log("  - 临时存储密钥数量:", keys.length);

      // 发送转换请求
      console.log("  - 📤 发送转换请求到后端");
      const response = await this.sendConversionRequest(backend, url, replacedURIs, request);
      console.log("  - 后端响应状态:", response.status);
      
      // 清理临时存储
      console.log("  - 🧹 清理临时存储");
      await this.cleanup(keys);

      // 处理响应
      console.log("  - 🔄 处理响应数据");
      return await this.processResponse(response, replacements);

    } catch (error) {
      console.error("❌ 转换处理错误:", error);
      console.error("  - 错误堆栈:", error.stack);
      
      // 清理临时存储
      await this.cleanup(keys);
      return new Response("处理错误: " + error.message, { 
        status: 500,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  }

  /**
   * 处理URL列表
   */
  async processUrlList(urlParam, request, host, replacements, replacedURIs, keys) {
    const urlParts = urlParam.split("|").filter(part => part.trim() !== "");
    
    if (urlParts.length === 0) {
      throw new Error("There are no valid links");
    }

    for (const url of urlParts) {
      await this.processSingleUrl(url, request, host, replacements, replacedURIs, keys);
    }
  }

  /**
   * 处理单个URL
   */
  async processSingleUrl(url, request, host, replacements, replacedURIs, keys) {
    const key = Utils.randomString(11);
    console.log("🔗 处理单个URL:");
    console.log("  - URL:", url.substring(0, 100) + (url.length > 100 ? '...' : ''));
    console.log("  - 生成的密钥:", key);
    
    let parsedObj;

    if (url.startsWith("https://") || url.startsWith("http://")) {
      console.log("  - 类型: HTTP(S) URL");
      // 处理HTTP URL
      try {
        const response = await fetch(url, {
          method: request.method,
          headers: request.headers,
          redirect: 'follow'
        });
        
        console.log("  - 获取响应状态:", response.status);
        
        if (!response.ok) {
          console.log("  - ❌ 响应失败，跳过处理");
          return;
        }

        const plaintextData = await response.text();
        console.log("  - 获取数据长度:", plaintextData.length);
        
        parsedObj = DataParser.parseData(plaintextData);
        console.log("  - 解析格式:", parsedObj.format);
        
        await this.storage.store(key, '', response.headers);
        keys.push(key);
        console.log("  - 已存储空占位符，密钥:", key);
      } catch (error) {
        console.error("  - ❌ HTTP请求失败:", error.message);
        return;
      }
    } else {
      console.log("  - 类型: 直接数据");
      // 处理直接数据
      parsedObj = DataParser.parseData(url);
      console.log("  - 解析格式:", parsedObj.format);
    }

    // 处理不同类型的数据
    if (/^(ssr?|vmess1?|trojan|vless|hysteria):\/\//.test(url)) {
      console.log("  - 处理单个代理链接");
      // 单个代理链接
      const newLink = ProtocolHandler.replaceInUri(url, replacements, false);
      if (newLink) {
        replacedURIs.push(newLink);
        console.log("  - 添加到替换URI列表");
      } else {
        console.log("  - ❌ 链接处理失败");
      }
    } else if (parsedObj.format === "base64") {
      console.log("  - 处理Base64数据");
      // Base64编码的订阅
      await this.processBase64Data(parsedObj.data, key, host, replacements, replacedURIs, keys);
    } else if (parsedObj.format === "yaml") {
      console.log("  - 处理YAML数据");
      // YAML格式的订阅
      await this.processYamlData(parsedObj.data, key, host, replacements, replacedURIs, keys);
    } else {
      console.log("  - ❌ 未知数据格式，跳过处理");
    }
    
    console.log("  - 当前替换URI数量:", replacedURIs.length);
    console.log("  - 当前密钥数量:", keys.length);
  }

  /**
   * 处理Base64数据
   */
  async processBase64Data(data, key, host, replacements, replacedURIs, keys) {
    console.log("🔒 处理Base64数据:");
    console.log("  - 数据长度:", data.length);
    
    const links = data.split(/\r?\n/).filter(link => link.trim() !== "");
    console.log("  - 分割后链接数量:", links.length);
    
    const newLinks = [];
    
    for (const link of links) {
      console.log("  - 处理链接:", link.substring(0, 50) + (link.length > 50 ? '...' : ''));
      const newLink = ProtocolHandler.replaceInUri(link, replacements, false);
      if (newLink) {
        newLinks.push(newLink);
        console.log("    * 替换成功");
      } else {
        console.log("    * 替换失败，跳过");
      }
    }

    console.log("  - 有效链接数量:", newLinks.length);
    
    if (newLinks.length > 0) {
      const replacedBase64Data = btoa(newLinks.join("\r\n"));
      console.log("  - 重新编码的Base64数据长度:", replacedBase64Data.length);
      
      await this.storage.store(key, replacedBase64Data);
      keys.push(key);
      
      const subscriptionUrl = host + "/" + CONFIG.SUBSCRIPTION_PATH + "/" + key;
      replacedURIs.push(subscriptionUrl);
      
      console.log("  - 已存储处理后的数据，密钥:", key);
      console.log("  - 生成的订阅URL:", subscriptionUrl);
    } else {
      console.log("  - ❌ 没有有效链接，跳过存储");
    }
  }

  /**
   * 处理YAML数据
   */
  async processYamlData(data, key, host, replacements, replacedURIs, keys) {
    const replacedYAMLData = ProtocolHandler.replaceYAML(data, replacements);
    
    if (replacedYAMLData) {
      await this.storage.store(key, replacedYAMLData);
      keys.push(key);
      replacedURIs.push(host + "/" + CONFIG.SUBSCRIPTION_PATH + "/" + key);
    }
  }

  /**
   * 发送转换请求
   */
  async sendConversionRequest(backend, url, replacedURIs, request) {
    const newUrl = replacedURIs.join("|");
    console.log("📤 构建后端请求:");
    console.log("  - 替换后的URI:", newUrl.substring(0, 200) + (newUrl.length > 200 ? '...' : ''));
    
    // 创建新的URL对象，避免修改原始URL
    const backendUrl = new URL(url.toString());
    backendUrl.searchParams.set("url", newUrl);
    
    const finalUrl = backend + backendUrl.pathname + backendUrl.search;
    console.log("  - 发送到后端的完整URL:", finalUrl.substring(0, 300) + (finalUrl.length > 300 ? '...' : ''));
    console.log("  - 请求方法:", request.method);
    console.log("  - 原始请求头数量:", request.headers ? Array.from(request.headers.keys()).length : 0);
    
    try {
      const modifiedRequest = new Request(finalUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body
      });
      
      const response = await fetch(modifiedRequest);
      console.log("  - 后端响应详情:");
      console.log("    * 状态码:", response.status);
      console.log("    * 状态文本:", response.statusText);
      console.log("    * 响应头:", Object.fromEntries(response.headers.entries()));
      
      // 如果是错误响应，尝试读取错误信息
      if (!response.ok) {
        const errorText = await response.clone().text();
        console.log("    * 错误响应内容:", errorText.substring(0, 500));
      }
      
      return response;
    } catch (error) {
      console.error("❌ 后端请求失败:", error);
      throw error;
    }
  }

  /**
   * 处理响应
   */
  async processResponse(response, replacements) {
    if (response.status !== 200) {
      return response;
    }

    const plaintextData = await response.text();

    try {
      // 尝试处理为Base64编码的订阅
      const decodedData = Utils.base64Decode(plaintextData);
      const links = decodedData.split(/\r?\n/).filter(link => link.trim() !== "");
      const newLinks = [];

      for (const link of links) {
        const newLink = ProtocolHandler.replaceInUri(link, replacements, true);
        if (newLink) newLinks.push(newLink);
      }

      const replacedBase64Data = btoa(newLinks.join("\r\n"));
      return new Response(replacedBase64Data, response);
    } catch (base64Error) {
      // 处理为普通文本
      const result = plaintextData.replace(
        new RegExp(Object.keys(replacements).join("|"), "g"),
        (match) => replacements[match] || match
      );
      return new Response(result, response);
    }
  }

  /**
   * 清理临时存储
   */
  async cleanup(keys) {
    console.log("🗑️  开始清理临时存储:", keys.length, "个密钥");
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const key of keys) {
      try {
        console.log("  - 删除:", key);
        await this.storage.delete(key);
        successCount++;
      } catch (error) {
        console.error("  - ❌ 清理失败:", key, error.message);
        errorCount++;
      }
    }
    
    console.log("🗑️  清理完成 - 成功:", successCount, "失败:", errorCount);
  }
}

// ========== 主导出对象 ==========
export default {
  async fetch(request, env) {
    const service = new SubscriptionService(env);
    return await service.handleRequest(request);
  }
};
