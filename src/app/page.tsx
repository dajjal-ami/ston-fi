
async function Page(props: any) {
	await test();
	return (
		<div>
			asd
		</div>
	);
}

async function test() {
	return new Promise(r=>setTimeout(r,5000));
}

export default Page;
