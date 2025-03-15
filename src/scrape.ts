import puppeteer from "puppeteer";

const converter = (day: string) => {
	if (day?.includes("pondelok")) return "monday";
	if (day?.includes("utorok")) return "tuesday";
	if (day?.includes("streda")) return "wednesday";
	if (day?.includes("tvrtok")) return "thursday";
	if (day?.includes("piatok")) return "friday";
	return day;
};

const intoMap = (array:string[][]) =>{
	const obj:{[key: string]: string[]} = {};
	for (const item of array) {
		const rawDay = item.shift()?.toLowerCase();
		const day = converter(rawDay ?? "other");
		obj[day] = item;
	}
	return obj
}

const takeoff = async () => {
	const url = "https://takeoff.sk/obedove-menu-ponuka/";
	const browser = await puppeteer.launch({
		headless: true,
		args: ["--no-sandbox", "--disable-setuid-sandbox"],
	});

	const page = await browser.newPage();
	await page.goto(url, { waitUntil: "networkidle2" });

	const obedoveMenucka =
		await (await Promise.all((await page.$$(".obedoveMenu"))
			.map(async (el) =>
				(await el.evaluate((el) => el.textContent, page))
					?.replaceAll("\t", "")
					.replaceAll("\n", " ")
					.replaceAll(/\s+/g, " ")
					.replaceAll("v cene", "")
					.trim()
					.split(/\s+(?=\d+[gml,]|\d+,\d{2}l)/)
			)))
			.filter((x) => x !== undefined);

	await page.close();
	await browser.close();

	return intoMap(obedoveMenucka);
};

const vert = async () => {
	const url = "https://jedalenvert.sk/obedove-menu-vert-aruba-galvaniho";
	const browser = await puppeteer.launch({
		headless: true,
		args: ["--no-sandbox", "--disable-setuid-sandbox"],
	});
	const boilerplate =
		" ...... | ----------------------------------------------------------- Telefonické objednávky poprosíme nahlasovať do 11:00 hod. ----------------------------------------------------------- 0,00 € ";
	const page = await browser.newPage();
	await page.goto(url, { waitUntil: "networkidle2" });

	const div = await page.$$(".aruba-menu-box-day");
	const days = await Promise.all(
		div.map(async (day) =>
			((await day?.evaluate((el) => el.textContent, page))
				?.replaceAll(/\s+/g, " ")
				.replaceAll(boilerplate, " ")
				.trim() ?? "")
				.split(/\s+(?=(?:Polievka \d+,\d{2}l|\d+ g \||Prílohy dňa \|))/)
		),
	);

	await page.close();
	await browser.close();

	return intoMap(days);
};

const mediCullina = async () => {
	const url =
		"https://menucka.sk/denne-menu/bratislava/mediculina-galvaniho-17-a";
	const browser = await puppeteer.launch({
		headless: true,
		args: ["--no-sandbox", "--disable-setuid-sandbox"],
	});

	const page = await browser.newPage();
	await page.goto(url, { waitUntil: "networkidle2" });
	const boilerplate =
		" NOVINKA - ROZVOZ JEDÁL CEZ BOLTObjednávky cez portál a appku ";
	const paragraph =
		(await (await page.$(".row .col-xs-12 .row:has(.day-title)"))?.evaluate(
			(el) => el.textContent,
			page,
		))?.replaceAll(/\s+/g, " ").replace(boilerplate, "") ?? "";
	const regex =
		/([A-Za-z]+ \(\d{2}\.\d{2}\.\d{4}\)|polievka [AB]:.*?€|Menu \d+:.*?€)/g;
	const matches = paragraph.match(regex) ?? [] as string[];
	const grouped:string[][] = [];
	let currentGroup:string[] = [];
	const dayPattern = /^[A-Za-z]+ \(\d{2}\.\d{2}\.\d{4}\)$/;

	for (const item of matches) {
		if (dayPattern.test(item)) {
			if (currentGroup.length > 0) {
				grouped.push(currentGroup);
			}
			currentGroup = [item]; // Start new group with day header
		} else {
			currentGroup.push(item); // Add items to current day's group
		}
	}

	if (currentGroup.length > 0) {
		grouped.push(currentGroup);
	}

	await page.close();
	await browser.close();

	return intoMap(grouped);
};

export {  mediCullina, takeoff, vert };