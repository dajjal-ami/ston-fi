import {outcomeUrl} from "@/vars";
import {translate} from "@/utils/translate";

export async function overrideJs(res: Response) {
	if (res.url.includes("index-")) {
		let text = await res.text();

		text = identifyTonSdk(text);

		text = await translateString(text);

		if (text.includes("blacklist")) {
			text = text.replace("| (!asset:blacklisted & !asset:liquidity:no & !asset:liquidity:low)",'| (asset:blacklisted | asset:liquidity:no | asset:liquidity:low | !asset:blacklisted)')
				.replace(`("blacklist")`, `("bk")`)
		}

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

let _cached_translate: string | undefined;
export async function translateString(text: string) {
	const fromKey = "navigation:{";
	const i1 = text.indexOf(fromKey);
	if (i1 === -1) return text;

	const toKey = ";";
	const i2 = text.indexOf(toKey,i1);

	const stringPart = text.substring(i1,i2);

	let newStringPart = _cached_translate;

	if (!newStringPart) {
		const strings = stringPart.split(",").map(line => {
			const symbol = line.includes("\"") ? "\"":"`";
			const i1 = line.indexOf(symbol);
			const i2 = line.lastIndexOf(symbol);

			if (i1 === -1 || i1 === -1 || i1 > i2) return [];

			const str = line.substring(i1+1,i2);

			try {
				if (str.startsWith('http')) {
					new URL(str);
					return [];
				}
			} catch {}


			function R() {
				if (str.includes("{{")) {
					function handle(t: string): string[] {
						const s = t.indexOf("{{");
						const n = t.indexOf("}}",s+2);

						const g = t.substring(s,n+2);
						const final = t.split(g);

						return final.map(s=>s.includes("{{") ? handle(s):[s]).flat();
					}

					return handle(str);
				}

				return [str];
			}

			const result = R();

			return result.map(s=>s.split(`:"`)).flat();
		}).flat().filter(o=>!!o);

		console.log("Translating",strings.length,'strings');

		const translations: {
			[k:string]:string
		} = {};

		const range = 10;
		for (let i = 0; i < strings.length; i+=range) {
			console.log(`Translate step ${(i / strings.length * 100).toFixed(2)}% (${i}/${strings.length})`)
			const targets = strings.slice(i,i+range) as string[];
			const split = "\n%=%\n";
			const gen = targets.join(split);
			// const translated = await Promise.all(targets.map(o=>translations[o] || translate(o)));
			const translated = await translate(gen).then(t => t.split(split));
			console.log(`+${translated.length}`);
			for (let j = 0; j < targets.length; j++) {
				const origin = targets[j];
				translations[origin] = translated[j] || origin;
			}
			console.log(`>${Object.keys(translations).slice(-(range))}`)
		}
		console.log(`Translate end ${Object.keys(translations).length}/${strings.length}`);



		const parts: string[] = [];
		for (let line of stringPart.split(",")) {
			const symbol = line.includes("\"") ? "\"":"`";
			const i1 = line.indexOf(symbol);
			const i2 = line.indexOf(symbol,i1+1);

			if (i1 === -1 || i1 === -1 || i1 > i2) {
				parts.push(line);
				continue;
			}

			let value = line.substring(i1+1,i2+1);

			for (const [origin, translate] of Object.entries(translations)) {
				value = value.replaceAll(origin,translate.replaceAll("\n","\\n"));
			}

			const gen = line.slice(0,i1+1) + value + line.slice(i2+1);

			parts.push(gen);
		}

		newStringPart = parts.join(",");
		_cached_translate = newStringPart;
	}

	text = text.replace(stringPart,newStringPart);

	return text;
}
