import {NextRequest, NextResponse} from "next/server";
import {overrideFetch} from "@/override/fetch";
import {incomeUrl, outcomeUrl} from "@/vars";


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


function overrideHeaders(url: URL,hds: Headers) {
	let headers: any = {};
	hds.forEach((v,k)=>headers[k]=v);

	url.host = incomeUrl.host;
	url.port = incomeUrl.port;
	console.log("Override headers URL:",url.toString());

	return Object.fromEntries(
		Object.entries(headers).map(([key,value]) => [
			key,
			(value+"")
				.replaceAll(url.origin,outcomeUrl.origin)
				.replaceAll(url.host, outcomeUrl.host)
				.replaceAll(url.protocol, outcomeUrl.protocol)
		])
	)
}
