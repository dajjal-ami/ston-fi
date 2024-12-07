import {outcomeUrl} from "@/vars";

export async function overrideJs(res: Response) {
	if (res.url.includes("index-")) {
		let text = await res.text();

		text = identifyTonSdk(text);

		return new Response(text, {
			status: res.status,
			headers: res.headers,
			statusText: res.statusText,
		})
	}

	return res;
}

function identifyTonSdk(js: string) {
	const key = "manifestUrl:";
	if (!js.includes(key)) return js;

	const i1 = js.indexOf(key);
	const i2 = js.indexOf(",",i1);

	const oldVar = js.substring(i1+key.length,i2);
	js = js.replace(oldVar,`"${outcomeUrl.origin}/tonconnect-manifest.json"`);


	const type = "const";
	const typeI = js.lastIndexOf(type, js.indexOf(";",i2));

	js = js.slice(0,typeI) + "let" + js.slice(typeI+type.length);

	const j1 = js.indexOf(";",i2);
	const j2 = js.indexOf(".",j1);

	const varName = js.substring(j1+1,j2).trim();

	js = js.slice(0,j2-varName.length) + `window.ton_session=${varName};if(window.ton_session_override){${varName}=window.ton_session_override(${varName})}${varName}` + js.slice(j2);

	return js;
}
