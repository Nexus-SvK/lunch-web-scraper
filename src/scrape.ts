import puppeteer from "puppeteer";
import { MenuItem,intoMap, puppeteerConfig } from ".";

function splitMenuString(str:string) {
	// Extract the date part (e.g., "Piatok 21.03.")
	const dateRegex = /^(.*?)(?=\s*\d+(?:,\d+)?[lg])/i;
	const dateMatch = str.match(dateRegex);
	if (!dateMatch) return [];
	const date = dateMatch[1].trim();
  
	// Extract the menu items part
	const itemsPart = str.slice(dateMatch[0].length).trim();
  
	// Split into menu items based on quantity prefixes (e.g., 150g, 0,25l)
	const items = itemsPart.split(/\s+(?=\d+(?:,\d+)?[lg])/g).map(item => item.trim());
  
	return [date, ...items];
  }

  const takeoffMenuItem = (item:string) => {
    const match = item.match(/^([0-9,]+([lg]))\s+(.*?)(?:\s+(\d+,\d+)€)?$/);
    if (!match) return null;

	const data:MenuItem = {
        type: match[2] == 'g' ? 'menu' : 'soup', // 'l' or 'g' from the quantity unit
        name: match[3].trim(), // name part, trimmed to remove any extra spaces
        quantity: match[1], // full quantity including unit // price if present, otherwise undefined
    }

	if(match[4]){
		data.price = match[4]+' €';
	}

    return data;
}

const vertMenuItem = (input: string): MenuItem | null => {
	const regex = /^(?:(?<quantity>\d+[\d,]*\s*[a-zA-Z\/]+)\s*\|\s*Menu\s+(?<index>\d+).*?\|\s*(?<name>.+?)\s+-.*?(?<price>\d+,\d+\s€))|(?:Polievka\s+(?<soupQuantity>[\d,]+\s*[a-zA-Z]+)\s*\|\s*(?<soupName>.+?)\s+(?<soupPrice>\d+,\d+\s€))$/i;
	
	const match = input.match(regex);
	if (!match?.groups) return null;
  
	const { groups } = match;
  
	if (groups.quantity) {
	  return {
		type: "menu",
		// index: parseInt(groups.index, 10),
		name: groups.name.trim(),
		quantity: groups.quantity,
		price: groups.price
	  };
	}
  
	if (groups.soupQuantity) {
	  return {
		type: "soup",
		name: groups.soupName.trim(),
		quantity: groups.soupQuantity.replace(/\s+/g, ''),
		price: groups.soupPrice
	  };
	}
  
	return null;
  };

  
  const mediCullinaMenuItem = (input: string): MenuItem | null => {
	const regex = /\b(Polievka [AB]|Menu \d+):\s*((?:.(?!\d+[,\/]?\d*\s*[gl]))*?(?:\s+- VEGAN)?)\s+(\d+(?:,\d+)?(?:\/\d+)?)\s*([gl])\s*(?:(\d+(?:,\d+)*)\s+)?(\d+,\d+)\s*€/;

	let match = regex.exec(input);

	if (!match) return null;

  	return {
    type: match[1].includes("Polievka") ? "soup" : "menu",
    name: match[2].trim(),
    quantity: `${match[3]}${match[4]}`, // Combine value and unit (e.g., "150/200g")
    price: match[6]+" €",
  	};
  };

const takeoff = async () => {
	const url = "https://takeoff.sk/obedove-menu-ponuka/";
	const browser = await puppeteer.launch(puppeteerConfig);

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
					// .split(/\s+(?=\d+[gml,]|\d+,\d{2}l)/)
			)))
			.filter((x) => x !== undefined);

	await page.close();
	await browser.close();
  
	return intoMap(obedoveMenucka.map(splitMenuString),takeoffMenuItem);
	// return obedoveMenucka;
  };

const vert = async () => {
	const url = "https://jedalenvert.sk/obedove-menu-vert-aruba-galvaniho";
	const browser = await puppeteer.launch(puppeteerConfig);
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

	return intoMap(days,vertMenuItem);
};

const mediCullina = async () => {
	const url =
		"https://menucka.sk/denne-menu/bratislava/mediculina-galvaniho-17-a";
	const browser = await puppeteer.launch(puppeteerConfig);

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
		/([A-Za-z]+ \(\d{2}\.\d{2}\.\d{4}\)|\b(Polievka [AB]|Menu \d+):\s*((?:.(?!\d+[,\/]?\d*\s*[gl]))*?(?:\s+- VEGAN)?)\s+(\d+(?:,\d+)?(?:\/\d+)?)\s*([gl])\s*(?:(\d+(?:,\d+)*)\s+)?(\d+,\d+)\s*€)/g;
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

	return intoMap(grouped,mediCullinaMenuItem);
};

export {  mediCullina, takeoff, vert };