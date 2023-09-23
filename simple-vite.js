const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const compilerSfc = require("@vue/compiler-sfc");
const compilerDom = require("@vue/compiler-dom");

const PORT = 8887;

/** 处理引用node_modules的依赖，添加@modules标记
 * @description 例如： import { createApp } from 'vue' 替换为  import { createApp } from '/@modules/vue'
 */
const correctImport = (content) => {
	return content.replace(/ from ['|"]([^'"]+)['|"]/g, function (s0, s1) {
		if (!s1.startsWith("./") && !s1.startsWith("../")) {
			return ` from '/@modules/${s1}'`;
		} else {
			return s0;
		}
	});
};

const server = http.createServer((req, res) => {
	const { url } = req;
	const query = new URL(req.url, `http://${req.headers.host}`).searchParams;

	// 返回html
	if (url === "/") {
		res.writeHead(200, { "Content-Type": "text/html" });
		const content = fs.readFileSync("./index.html", "utf8");
		res.end(content);
	}
	// 处理js文件
	else if (url.endsWith(".js")) {
		const filePath = path.resolve(__dirname, url.slice(1));
		res.writeHead(200, { "Content-Type": "text/javascript" });
		const content = fs.readFileSync(filePath, "utf8");

		// 当加载到main.js内容时，其中含有引用vue的方法，路径无法正确识别，所以需要特殊处理
		res.end(correctImport(content));
	}
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

	// 处理 .vue 文件
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

	// 处理css
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

	// 处理svg文件
	else if (url.endsWith(".svg")) {
		const p = path.resolve(__dirname, "public/", url.slice(1));
		const file = fs.readFileSync(p, "utf8");
		res.writeHead(200, { "Content-Type": "image/svg+xml" });
		res.end(file);
	}
});

server.listen(PORT, () => {
	console.log(`Server running at http://127.0.0.1:${PORT}/`);
});
