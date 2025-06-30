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
  FRONTEND_URL: 'https://raw.githubusercontent.com/yu1ec/subconverter-mask/master/frontend.html',
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
    const object = await this.bucket.get(key);
    const objectHeaders = await this.bucket.get(key + "_headers");
    
    if (object === null) return null;

    let headers;
    if (objectHeaders) {
      if ("R2Bucket" === this.bucket.constructor.name) {
        headers = new Headers(await objectHeaders.json());
      } else {
        headers = new Headers(JSON.parse(objectHeaders));
      }
    } else {
      headers = new Headers(CONFIG.DEFAULT_HEADERS);
    }

    let body;
    if ("R2Bucket" === this.bucket.constructor.name) {
      body = object.body;
    } else {
      body = object;
    }

    return { body, headers };
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
    try {
      const response = await fetch(CONFIG.FRONTEND_URL);
      if (response.status !== 200) {
        return new Response('Failed to fetch frontend', { status: response.status });
      }

      const originalHtml = await response.text();
      const modifiedHtml = originalHtml.replace(/https:\/\/bulianglin2023\.dev/g, host);
      
      return new Response(modifiedHtml, {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      });
    } catch (error) {
      return new Response('Error loading frontend', { status: 500 });
    }
  }

  /**
   * 提供订阅数据
   */
  async serveSubscription(pathSegments) {
    const key = pathSegments[pathSegments.length - 1];
    const result = await this.storage.get(key);
    
    if (!result) {
      return new Response("Not Found", { status: 404 });
    }

    return new Response(result.body, { headers: result.headers });
  }

  /**
   * 处理转换请求
   */
  async processConversion(request, url, host) {
    const urlParam = url.searchParams.get("url");
    if (!urlParam) {
      return new Response("Missing URL parameter", { status: 400 });
    }

    // 处理后端参数
    let backend = this.backend;
    const backendParam = url.searchParams.get("bd");
    if (backendParam && /^(https?:\/\/[^/]+)[.].+$/g.test(backendParam)) {
      backend = backendParam.replace(/(https?:\/\/[^/]+).*$/, "$1");
    }

    const replacements = {};
    const replacedURIs = [];
    const keys = [];

    try {
      // 处理输入的URL列表
      await this.processUrlList(urlParam, request, host, replacements, replacedURIs, keys);

      // 发送转换请求
      const response = await this.sendConversionRequest(backend, url, replacedURIs, request);
      
      // 清理临时存储
      await this.cleanup(keys);

      // 处理响应
      return await this.processResponse(response, replacements);

    } catch (error) {
      // 清理临时存储
      await this.cleanup(keys);
      return new Response("处理错误: " + error.message, { status: 500 });
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
    let parsedObj;

    if (url.startsWith("https://") || url.startsWith("http://")) {
      // 处理HTTP URL
      const response = await fetch(url, {
        method: request.method,
        headers: request.headers,
        redirect: 'follow'
      });
      
      if (!response.ok) return;

      const plaintextData = await response.text();
      parsedObj = DataParser.parseData(plaintextData);
      
      await this.storage.store(key, '', response.headers);
      keys.push(key);
    } else {
      // 处理直接数据
      parsedObj = DataParser.parseData(url);
    }

    // 处理不同类型的数据
    if (/^(ssr?|vmess1?|trojan|vless|hysteria):\/\//.test(url)) {
      // 单个代理链接
      const newLink = ProtocolHandler.replaceInUri(url, replacements, false);
      if (newLink) replacedURIs.push(newLink);
    } else if (parsedObj.format === "base64") {
      // Base64编码的订阅
      await this.processBase64Data(parsedObj.data, key, host, replacements, replacedURIs, keys);
    } else if (parsedObj.format === "yaml") {
      // YAML格式的订阅
      await this.processYamlData(parsedObj.data, key, host, replacements, replacedURIs, keys);
    }
  }

  /**
   * 处理Base64数据
   */
  async processBase64Data(data, key, host, replacements, replacedURIs, keys) {
    const links = data.split(/\r?\n/).filter(link => link.trim() !== "");
    const newLinks = [];
    
    for (const link of links) {
      const newLink = ProtocolHandler.replaceInUri(link, replacements, false);
      if (newLink) newLinks.push(newLink);
    }

    if (newLinks.length > 0) {
      const replacedBase64Data = btoa(newLinks.join("\r\n"));
      await this.storage.store(key, replacedBase64Data);
      keys.push(key);
      replacedURIs.push(host + "/" + CONFIG.SUBSCRIPTION_PATH + "/" + key);
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
    url.searchParams.set("url", newUrl);
    
    const modifiedRequest = new Request(backend + url.pathname + url.search, request);
    return await fetch(modifiedRequest);
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
    for (const key of keys) {
      try {
        await this.storage.delete(key);
      } catch (error) {
        console.error("清理失败: " + key, error);
      }
    }
  }
}

// ========== 主导出对象 ==========
export default {
  async fetch(request, env) {
    const service = new SubscriptionService(env);
    return await service.handleRequest(request);
  }
};
