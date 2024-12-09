import {overrideJs} from "@/override/js";
import {incomeUrl, outcomeUrl} from "@/vars";


export async function overrideFetch(response: Response) {
	const type = response.headers.get('content-type')+"";

	switch (true) {
		case type.includes("javascript"):
			return overrideJs(response);
		case type.includes("html"):
			return overrideHtml(response);
		default:
			return response;
	}
}

async function overrideHtml(res: Response) {
	let text = await res.text();
	if (text.includes("<head>")) {
		const js = `<script src="${incomeUrl.origin}/local/override.js"></script>`;
		text = text.replace("<head>", `<head>\n${js}`);

		return new Response(text, res);
	}
	return res;
}
