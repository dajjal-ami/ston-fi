interface TranslationResult {
	original: string;
	translated: string;
	error?: string;
}

export async function batchTranslate(
	texts: string[],
	from: string = "en",
	to: string = "ru",
	batchSize: number = 10,
	delayMs: number = 1100 // slightly over 1 second to be safe
): Promise<TranslationResult[]> {
	const results: TranslationResult[] = [];

	// Split texts into batches
	for (let i = 0; i < texts.length; i += batchSize) {
		const batch = texts.slice(i, i + batchSize);
		console.log(`Processing batch ${i / batchSize + 1} of ${Math.ceil(texts.length / batchSize)}`);

		// Process each batch
		const batchPromises = batch.map(async (text) => {
			try {
				const translated = await translate(text, from, to);
				return {
					original: text,
					translated
				};
			} catch (error: any) {
				return {
					original: text,
					translated: '',
					error: error.message
				};
			}
		});

		// Wait for batch to complete
		const batchResults = await Promise.all(batchPromises);
		results.push(...batchResults);

		// Delay before next batch to respect rate limits
		if (i + batchSize < texts.length) {
			await new Promise(resolve => setTimeout(resolve, delayMs));
		}
	}

	return results;
}

// Example DeepL translation function
export async function translate(text: string, from: string = "en", to: string = "ru", n = 0): Promise<string> {
	try {
		const response = await fetch("https://api.reverso.net/translate/v1/translation", {
			"headers": {
				"accept": "application/json, text/plain, */*",
				"accept-language": "en-US,en;q=0.9,fa-IR;q=0.8,fa;q=0.7",
				"cache-control": "no-cache",
				"content-type": "application/json",
				"pragma": "no-cache",
				"priority": "u=1, i",
				"sec-ch-ua": "\"Google Chrome\";v=\"131\", \"Chromium\";v=\"131\", \"Not_A Brand\";v=\"24\"",
				"sec-ch-ua-mobile": "?0",
				"sec-ch-ua-platform": "\"Windows\"",
				"sec-fetch-dest": "empty",
				"sec-fetch-mode": "cors",
				"sec-fetch-site": "same-site",
				"x-reverso-origin": "translation.web",
				"Referer": "https://www.reverso.net/",
				"Referrer-Policy": "strict-origin-when-cross-origin",
				"user-agent": crypto.randomUUID()
			},
			"body": JSON.stringify({
				"format": "text",
				"from": "eng",
				"to": "rus",
				"input": text,
				"options": {
					"sentenceSplitter": true,
					"origin": "translation.web",
					"contextResults": true,
					"languageDetection": true
				}
			}),
			"method": "POST"
		});

		if (!response.ok) {
			throw new Error(`Translation failed with status: ${response.status}`);
		}

		const data = await response.json();
		return data.translation?.join("");
	} catch (error: any) {
		if (error?.message?.includes("fetch fail") && n < 5) {
			console.log("translation failure, retrying...")
			return translate(text,from,to, n+1);
		}

		console.error("Translation error:", error);
		return text;
	}
}
