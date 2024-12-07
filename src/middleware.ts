import {NextRequest, NextResponse} from "next/server";
import {overrideFetch} from "@/override/fetch";
import {outcomeUrl} from "@/vars";


export async function middleware(request: NextRequest) {
	const ignore = ['/local','/api'];

	if (!process.env['INCOME_URL']) console.log("INCOME",request.url)

	if (ignore.find(o => request.nextUrl.pathname.startsWith(o))) {
		console.log("ignored", request.url)
		return NextResponse.next();
	}

	const overrideUrl = new URL(outcomeUrl.origin+`${request.nextUrl.pathname}${request.nextUrl.search}`);
	const headers = overrideHeaders(new URL(request.nextUrl),request.headers);
	const options = {
		headers,
		method: request.method,
		body: request.body
	};

	return overrideFetch(await fetch(overrideUrl, options));
}


function overrideHeaders(incomeUrl: URL,hds: Headers) {
	let headers: any = {};
	hds.forEach((v,k)=>headers[k]=v);

	incomeUrl.host = hds.get('host')+"";
	console.log("Override headers URL:",incomeUrl.toString());

	return Object.fromEntries(
		Object.entries(headers).map(([key,value]) => [
			key,
			(value+"")
				.replaceAll(incomeUrl.origin,outcomeUrl.origin)
				.replaceAll(incomeUrl.host, outcomeUrl.host)
				.replaceAll(incomeUrl.protocol, outcomeUrl.protocol)
		])
	)
}
