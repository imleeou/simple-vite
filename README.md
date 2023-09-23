# 简单实现 vite

## 参考步骤 🤔

1. 不使用构建工具创建项目，参考 vite 社区模板[template-vue](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-vue)
2. 新建 simple.js，使用 node 创建一个 http 服务器

```js
const http = require("http");
const fs = require("fs");
const PORT = 8887;
const server = http.createServer((req, res) => {
	const { url } = req;
	res.end(url);
});
server.listen(PORT, () => {
	console.log(`Server running at http://127.0.0.1:${PORT}/`);
});
```

3. 读取 html 文件

```js
// 返回 html
if (url === "/") {
	res.writeHead(200, { "Content-Type": "text/html" });
	const content = fs.readFileSync("./index.html", "utf8");
	res.end(content);
}
```

4. 读取 js 文件

```js
  // 处理js文件
  else if (url.endsWith(".js")) {
    const filePath = path.resolve(__dirname, url.slice(1));
    res.writeHead(200, { "Content-Type": "text/javascript" });
    const content = fs.readFileSync(filePath, "utf8");
    res.end(content);
  }
```

5. 处理 node_modules 文件，添加@modules 标记

```js
// 当加载到main.js内容时，其中含有引用vue的方法，路径无法正确识别，所以需要特殊处理
res.end(correctImport(content));

const correctImport = (content) => {
	return content.replace(/ from ['|"]([^'"]+)['|"]/g, function (s0, s1) {
		if (!s1.startsWith("./") && !s1.startsWith("../")) {
			return ` from '/@modules/${s1}'`;
		} else {
			return s0;
		}
	});
};
```

此时，`main.js`中的`import { createApp } from 'vue'`就更改为了`import { createApp } from '/@modules/vue'`，
浏览器会请求`http://127.0.0.1:8887/@modules/vue`的 vue 资源，但此时也是不对的，我们只是为其添加了标记，在下一步进行处理。

6. 处理@modules 标记

```js
	// 处理@modules标记的路径
	else if (url.startsWith("/@modules/")) {
		// 拿到依赖文件夹地址
		const nodeModulesDir = path.resolve(__dirname, "node_modules", url.replace("/@modules/", ""));
		// 取到依赖package.json中的module字段
		const module = require(nodeModulesDir + "/package.json").module;
		// 完整的源码地址
		const filePath = path.resolve(nodeModulesDir, module);
		const content = fs.readFileSync(filePath, "utf8");
		res.writeHead(200, { "Content-Type": "text/javascript" });
		res.end(correctImport(content));
	}
```

此时我们已经解决了第三方模块源码资源请求不到的问题，`Vue`源码中涉及到的各种其他的源码资源也顺势被请求到了。

还剩下最后一个问题，我们可以看到浏览器请求了`App.vue`文件，但却无法解析其内容。

`Vue`是有自己的编译器的，它能将自己的`Vue`独有的语法编译成 `JS` 代码，所以我们只需要在浏览器请求 `.vue` 后缀的文件时用上 `Vue` 自己的编译器就好。

7. 处理 `.vue`文件

```js
else if (url.indexOf(".vue") !== -1) {
		const p = path.resolve(__dirname, url.split("?")[0].slice(1));
		const { descriptor } = compilerSfc.parse(fs.readFileSync(p, "utf8"));
		if (!query.get("type")) {
			res.writeHead(200, { "Content-Type": "application/javascript" });
			const content = `${correctImport(
				descriptor.script.content.replace("export default", "const __script = ")
			)} import { render as __render } from "${url}?type=template"
        __script.render = __render
        export default __script
      `;
			res.end(content);
		} else if (query.get("type") === "template") {
			// 返回.vue文件的html部分
			const template = descriptor.template;
			const render = compilerDom.compile(template.content, { mode: "module" }).code;
			res.writeHead(200, { "Content-Type": "application/javascript" });
			res.end(correctImport(render));
		}
	}

```

8. 处理 `.css`文件

```js
	else if (url.endsWith(".css")) {
		const p = path.resolve(__dirname, url.slice(1));
		const file = fs.readFileSync(p, "utf8");
		const content = `
      const css = "${file.replace(/[\s\n]+/g, "")}"
      let link = document.createElement('style')
      link.setAttribute('type', 'text/css')
      document.head.appendChild(link)
      link.innerHTML = css
      export default css
    `;
		res.writeHead(200, { "Content-Type": "application/javascript" });
		res.end(content);
	}
```

9. 处理 `.svg`文件

```js
	else if (url.endsWith(".svg")) {
		const p = path.resolve(__dirname, "public/", url.slice(1));
		const file = fs.readFileSync(p, "utf8");
		res.writeHead(200, { "Content-Type": "image/svg+xml" });
		res.end(file);
	}
```

## 说明 💡

> 1. 项目是因看到掘金作者【一个大蜗牛】的文章[面试官：”Vite 为什么快？“](https://juejin.cn/post/7280747221510144054)为了学习搭建的。
> 2. 写的时候稍加更改，有一定的局限性且不完善，仅供参考。
